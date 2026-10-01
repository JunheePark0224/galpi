"""One day of the pipeline (design 2-1): gaps → candidates → pass A + pass B → checks → additions file + run summary.

Usage (from the checkout):  PYTHONIOENCODING=utf-8 python -m src.pipeline.run_daily [--date YYYY-MM-DD] [--count N]
Then:                        cd web && npm run books:import && npm test      (the workflow does both, then report.py)
Keys: YES24_API_KEY / ANTHROPIC_API_KEY from the environment (Actions secrets) or the local .env — never printed.
Models and counts come from data/pipeline/config.json (model = pass A, second_model = blind pass B).
Exit 0: done (also "nothing to fill", "no usable candidates" and "no usable books today"); 1: missing key, YES24 gave
nothing, or the run stopped before any book was finished. Failure rules (design 2-1):
  YES24 gives no candidate at all  → `yes24_failed`, no file (so no PR); only the failed API paths are named
  a key is refused (401/403), the model is unknown (404) or the account is the problem (400), or one model's calls fail
  STOP_LIMIT times in a row (tagger.Breaker, one streak per model) → the run stops there; the books finished before it are
  written as `partial`, and if there are none it is `anthropic_failed` with no file
  nothing to fill → `full`, zero API calls
YES24 text (intro, TOC) lives on the Candidate in memory and goes to the tagger only; the additions file, the summary and
stdout carry our tags and counts. Do not set ANTHROPIC_LOG=debug (the SDK would log request bodies with YES24 text).
The summary goes to data/pipeline/runs/<date>.json (git-ignored) and stdout.
"""
import argparse
import json
import os
import sys
from collections import Counter
from datetime import datetime

import collect_candidates
from compare_apis import load_env

from . import ADDITIONS, BOOKS, KST, RUNS, VOCAB
from .candidates import Candidate, find, known_from, yes24_env
from .checks import decide, disagreements, rule_issues
from .config import Config, load_config
from .gaps import plan_day
from .merge import additions_doc, keyword_hints, record, write_doc
from .prompt import schema, system_prompt, user_message
from .slots import keyword_rule, slot_rule
from .tagger import Breaker, TaggerStop, Usage, call, parse


def load_state() -> tuple[list[dict], dict, list[dict]]:
    books = json.loads(BOOKS.read_text(encoding="utf-8"))
    vocab = json.loads(VOCAB.read_text(encoding="utf-8"))
    additions = [json.loads(p.read_text(encoding="utf-8")) for p in sorted(ADDITIONS.glob("*.json"))]
    return books, vocab, additions


def gather(env: dict, wants, vocab: dict, known) -> list[Candidate]:
    out: list[Candidate] = []
    for w in wants:
        rule = keyword_rule(w.slot, w.keyword, vocab[w.slot]["kept"][w.keyword]["pattern"]) if w.keyword else slot_rule(w.slot)
        found = find(env, w, rule, known)
        known = known.plus(found)
        out += found
    return out


def _spend(ledger: dict, model: str, used: Usage) -> None:
    """Add `used` to the run's token ledger (one entry per model). Called after every API call, so a book interrupted by
    a stop still has what it cost counted."""
    ledger[model] = ledger.get(model, Usage()).plus(used)


def tag_one(client, cfg: Config, prompts: dict, vocab: dict, cand: Candidate, breaker: Breaker,
            ledger: dict) -> tuple[dict | None, str]:
    """(record or None, reason). Pass A tags, pass B checks blind; token use goes to `ledger`. Raises TaggerStop."""
    kept = vocab[cand.slot]["kept"] if cand.entry == "target" else {}
    names, hints = list(kept), keyword_hints(cand, kept) if kept else []
    user = user_message(cand.entry, cand.slot, cand.title, cand.intro, cand.toc, hints)
    raw_a, used, why = call(client, cfg.model, prompts["tag"], user, schema(cand.entry, "tag", names), breaker)
    _spend(ledger, cfg.model, used)
    a = parse(raw_a, cand.entry, "tag", names) if raw_a else None
    if a is None:
        return None, why if raw_a is None else "invalid_answer"
    raw_b, used, why = call(client, cfg.second_model, prompts["check"], user, schema(cand.entry, "check", names), breaker)
    _spend(ledger, cfg.second_model, used)
    b = parse(raw_b, cand.entry, "check", names) if raw_b else None
    if b is None:
        return None, why if raw_b is None else "invalid_answer"
    flags = disagreements(cand.entry, a, b)
    issues = rule_issues(cand.entry, a, cand.title, f"{cand.intro} {cand.toc}", b)
    status, auto = decide(a, b, flags, issues, cfg.auto_merge)
    return record(cand, a, b, flags, issues, status, auto, hints), "ok"  # record() blanks any field that copied YES24 text


def run(date: str, cfg: Config, env: dict, client) -> dict:
    books, vocab, additions = load_state()
    kept = {t: list(v.get("kept", {})) for t, v in vocab.items()}
    wants = plan_day(books, kept, cfg.daily_count)
    summary = {"date": date, "model": cfg.model, "second_model": cfg.second_model, "wanted": sum(w.n for w in wants),
               "slots": [f"{w.slot}{'/' + w.keyword if w.keyword else ''} {w.n}" for w in wants]}
    if not wants:
        return summary | {"status": "full"}
    fails_before = len(collect_candidates.FAILURES)
    cands = gather(env, wants, vocab, known_from(books, additions))
    yes24_fail = [f.split(" -> ")[0] for f in collect_candidates.FAILURES[fails_before:]]  # paths only, never the answer
    summary |= {"candidates": len(cands), "yes24_failures": len(yes24_fail), "yes24_failed_paths": sorted(set(yes24_fail))}
    if not cands:
        return summary | {"status": "yes24_failed" if yes24_fail else "no_candidates"}
    prompts = {kind: system_prompt(vocab, kind) for kind in ("tag", "check")}
    recs, reasons, ledger, stopped, breaker = [], Counter(), {}, None, Breaker()
    for cand in cands:
        try:
            rec, why = tag_one(client, cfg, prompts, vocab, cand, breaker, ledger)
        except TaggerStop as err:
            stopped = str(err)
            break
        reasons[why] += 1
        if rec:
            recs.append(rec)
    status = Counter(r["status"] for r in recs)
    summary |= {"tagged": len(recs), "reasons": dict(reasons), "stopped": stopped,
                "picked": status["picked"], "reserve": status["reserve"], "dropped": status["dropped"],
                "auto_agreed": sum(r.get("auto") == "ai-agree" for r in recs),
                "flagged": sum(bool(r["flags"]) and r["status"] != "dropped" for r in recs),
                "usage": {m: u.__dict__ for m, u in ledger.items()},
                "cost_usd": round(sum(u.cost(m) for m, u in ledger.items()), 4)}
    if not recs:
        return summary | {"status": "anthropic_failed" if stopped else "no_books"}
    write_doc(ADDITIONS / f"{date}.json", additions_doc(date, cfg.model, cfg.second_model, recs))
    return summary | {"status": "partial" if stopped else "ok", "file": f"data/processed/additions/{date}.json"}


def anthropic_key() -> str:
    key = os.environ.get("ANTHROPIC_API_KEY")
    if key:
        return key
    try:
        return load_env().get("ANTHROPIC_API_KEY", "")
    except FileNotFoundError:
        return ""


def main(argv: list[str] | None = None) -> int:
    ap = argparse.ArgumentParser(description="갈피 daily book pipeline")
    ap.add_argument("--date", default=datetime.now(KST).date().isoformat())
    ap.add_argument("--count", type=int)
    args = ap.parse_args(argv)
    if (ADDITIONS / f"{args.date}.json").exists():
        print(f"{args.date}: additions file already exists — nothing to do")
        return 0
    cfg, env, key = load_config(count=args.count), yes24_env(), anthropic_key()
    missing = [n for n, v in (("YES24_API_KEY", env.get("YES24_API_KEY")), ("ANTHROPIC_API_KEY", key)) if not v]
    if missing:
        print(f"ERROR: {', '.join(missing)} not set", file=sys.stderr)
        return 1
    import anthropic  # the SDK is only needed for a real run
    summary = run(args.date, cfg, env, anthropic.Anthropic(api_key=key, max_retries=2, timeout=60))
    RUNS.mkdir(parents=True, exist_ok=True)
    (RUNS / f"{args.date}.json").write_text(json.dumps(summary, ensure_ascii=False, indent=1) + "\n", encoding="utf-8")
    print(json.dumps(summary, ensure_ascii=False, indent=1))
    return 1 if summary["status"] in ("yes24_failed", "anthropic_failed") else 0


if __name__ == "__main__":
    sys.exit(main())
