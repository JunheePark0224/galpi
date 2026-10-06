"""Tag a batch again with today's instructions into a NEW additions file (10-06 label signals, plans/2026-10-06-label-signals.md).

Usage (from the checkout; real API calls — costs money):
  PYTHONIOENCODING=utf-8 python -m src.pipeline.retag 2026-10-05-2 [--max-cost 3]
  → data/processed/additions/2026-10-05-2.v2.json, then `python -m src.pipeline.review 2026-10-05-2.v2` builds its own page
Every book of the batch that was not dropped runs through both passes again (run_daily.tag_one: pass A with the one-liner
retry, blind pass B, today's checks and decide), with the models of data/pipeline/config.json; every book and the file carry `rules_version` (rules_version.py). The text is the YES24 intro
and TOC from the local cache (this checkout's data/raw/yes24/detail, then the main checkout's), fetched with the local key
only when neither has it; a book with no text is skipped and named. The original file — and any answers a person has
already applied to it — is never touched; the new file keeps the original's trial sample (the same books are measured)
and is never written over. A TaggerStop (refused key, unknown model, API failures in a row) or the `--max-cost` cap stops
the run and writes nothing; the summary says what was spent. The new file holds our tags only — no YES24 text.
"""
import argparse
import json
import sys
from pathlib import Path

from build_check_page import DETAIL
from collect_candidates import detail
from pick_pilot import clean

from . import ADDITIONS, VOCAB
from .candidates import INTRO_MAX, TOC_MAX, Candidate, yes24_env
from .config import Config, load_config
from .merge import additions_doc
from .one_liner import RetryLog
from .prompt import system_prompt
from .review import main_checkout
from .rules_version import rules_version
from .run_daily import anthropic_key, tag_one
from .tagger import Breaker, TaggerStop

SUFFIX = ".v2"
MAX_COST = 3.0  # USD; the 10-06 run of ~90 books was expected at $1–2


def cached_text(isbn: str, dirs: list[Path], env: dict) -> tuple[str, str]:
    """(intro, TOC) cut like candidates.find cuts them for the tagger; ("", "") when no cache has the book and no key."""
    path = next((d / f"{isbn}.json" for d in dirs if (d / f"{isbn}.json").exists()), None)
    if path is None and env.get("YES24_API_KEY"):
        detail(env, isbn)  # caches under this checkout's data/raw/yes24/detail
        path = dirs[0] / f"{isbn}.json" if (dirs[0] / f"{isbn}.json").exists() else None
    if path is None:
        return "", ""
    items = (json.loads(path.read_text(encoding="utf-8")).get("data") or {}).get("items") or []
    cd = (items[0].get("contentDetail") or {}) if items else {}
    return clean(cd.get("bookIntroduction") or "", INTRO_MAX), clean(cd.get("tableOfContents") or "", TOC_MAX)


def candidate(b: dict, intro: str, toc: str) -> Candidate:
    slot = b["topic"] if b["entry"] == "target" else b["genre"]
    return Candidate(b["entry"], slot, b["isbn"], b["title"], b["author"], b["pages"], b.get("link") or "", intro, toc)


def run(batch: str, cfg: Config, client, vocab: dict, text_of, max_cost: float = MAX_COST) -> tuple[dict | None, dict]:
    """(new doc or None when the run stopped, summary). `text_of(isbn)` → (intro, TOC)."""
    doc = json.loads((ADDITIONS / f"{batch}.json").read_text(encoding="utf-8"))
    prompts, rules = {kind: system_prompt(vocab, kind) for kind in ("tag", "check")}, rules_version()
    recs, failed, no_text, ledger, breaker, retries, stopped = [], {}, [], {}, Breaker(), RetryLog(), None
    for b in doc["books"]:
        if b["status"] == "dropped":
            continue
        intro, toc = text_of(b["isbn"])
        if not intro:
            no_text.append(b["isbn"])
            continue
        try:
            rec, why = tag_one(client, cfg, prompts, vocab, candidate(b, intro, toc), breaker, ledger, retries, rules)
        except TaggerStop as err:
            stopped = str(err)
            break
        if rec:
            recs.append(rec)
        else:
            failed[b["isbn"]] = why
        spent = sum(u.cost(m) for m, u in ledger.items())
        if spent > max_cost:
            stopped = f"cost cap ${max_cost} passed (${spent:.2f})"
            break
    summary = {"batch": batch, "rules_version": rules, "model": cfg.model, "second_model": cfg.second_model, "tagged": len(recs),
               "failed": failed, "skipped_no_text": no_text, "stopped": stopped, "one_liner_retries": retries.summary(),
               "usage": {m: u.__dict__ for m, u in ledger.items()},
               "cost_usd": round(sum(u.cost(m) for m, u in ledger.items()), 4)}
    if stopped:
        return None, summary
    new = additions_doc(doc["date"], cfg.model, cfg.second_model, recs, f"{batch}{SUFFIX}")
    return new | {"retag_of": batch, "rules_version": rules, "trial_sample": list(doc.get("trial_sample") or [])}, summary


def write(batch: str, doc: dict) -> Path:
    path = ADDITIONS / f"{batch}{SUFFIX}.json"
    if path.exists():
        raise FileExistsError(f"{path.name} already exists — never written over")
    path.write_text(json.dumps(doc, ensure_ascii=False, indent=1) + "\n", encoding="utf-8", newline="")
    return path


def main(argv: list[str] | None = None) -> int:
    ap = argparse.ArgumentParser(description="tag a batch again into <batch>.v2.json")
    ap.add_argument("batch")
    ap.add_argument("--max-cost", type=float, default=MAX_COST)
    args = ap.parse_args(argv)
    if (ADDITIONS / f"{args.batch}{SUFFIX}.json").exists():
        print(f"ERROR: {args.batch}{SUFFIX}.json already exists", file=sys.stderr)
        return 1
    key, env = anthropic_key(), yes24_env()
    if not key:
        print("ERROR: ANTHROPIC_API_KEY not set", file=sys.stderr)
        return 1
    import anthropic  # the SDK is only needed for a real run
    dirs = [DETAIL, main_checkout() / DETAIL.relative_to(DETAIL.parents[3])]
    vocab = json.loads(VOCAB.read_text(encoding="utf-8"))
    new, summary = run(args.batch, load_config(), anthropic.Anthropic(api_key=key, max_retries=2, timeout=60), vocab,
                       lambda isbn: cached_text(isbn, dirs, env), args.max_cost)
    if new is not None:
        summary["file"] = str(write(args.batch, new))
    print(json.dumps(summary, ensure_ascii=False, indent=1))
    return 0 if new is not None else 1


if __name__ == "__main__":
    sys.exit(main())
