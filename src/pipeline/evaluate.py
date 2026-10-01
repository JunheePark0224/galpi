"""Offline eval of the tagger on books a person already reviewed (design 2-2) — run once before the pipeline goes live.

Gold: data/processed/books_v1.json (D4-reviewed 200 books: every field) + OPTIONAL reviewed picked books of the pilot file(s)
(data/processed/additions/*-pilot.json, reviewed=true: topic · keywords · way) — with no pilot file the 200 books alone are used.
Input text: the local YES24 cache (data/raw/yes24/detail/<isbn>.json, git-ignored; `--detail-dir` points elsewhere) — books
without it are skipped and counted.
For each pass-A model (`--models`), pass B runs with `--second`. Scores per field = share equal to the person's answer
(🎯 keywords compared inside the topic's closed keyword list: the tagger cannot name a keyword that was dropped from it);
the one-liner cannot be compared by code, so its rule-check pass rate is reported instead (whether it is usable as is stays
a person's call). Two-pass figures: share of books flagged for review, and among books the two passes agreed on
(auto-accepted in the pipeline) the share whose fields still differ from the person — the error nobody would review.
These books are where the instructions get tuned, so the figures are in-sample (원칙 4): graduation is judged on D-C's new
books only (design 2-2).

Cost: an ESTIMATE (a range) is printed and saved before the first call; the MEASURED token use and cost per model are printed
after. The key is read from the environment only (ANTHROPIC_API_KEY) and never printed.

Usage (from the checkout; real API calls — costs money):
  PYTHONIOENCODING=utf-8 python -m src.pipeline.evaluate --dry-run --limit 80          # estimate only, no key, no calls
  PYTHONIOENCODING=utf-8 python -m src.pipeline.evaluate --limit 4                      # smoke run
  PYTHONIOENCODING=utf-8 python -m src.pipeline.evaluate --models claude-haiku-4-5,claude-sonnet-5-5 --limit 80
  (--limit 0 = every gold book; --detail-dir ../Galpi/data/raw/yes24/detail from a worktree without the cache)
Output: data/pipeline/eval/<date>-<model>.json — scores, flags, token use and our tags only (no YES24 text).
"""
import argparse
import csv
import json
import os
import random
import sys
from collections import Counter
from datetime import datetime
from pathlib import Path

from build_check_page import DETAIL
from pick_pilot import clean

from . import ADDITIONS, KST, PIPELINE, ROOT, VOCAB
from .candidates import INTRO_MAX, TOC_MAX, Candidate
from .checks import disagreements, rule_issues, scrub
from .config import MODELS
from .merge import keyword_hints
from .prompt import AXES, schema, system_prompt, user_message
from .tagger import CACHE_READ, CACHE_WRITE, PRICES, Breaker, TaggerStop, Usage, call, parse

PROCESSED = ROOT / "data" / "processed"
OUT = PIPELINE / "eval"
TOKENS_PER_CHAR = (0.8, 1.6)                 # guess for Korean text on the Claude tokenizer: (low, high)
OUT_TOKENS = {"tag": (150, 600), "check": (80, 400)}  # the JSON answer (high allows some low-effort thinking)


def gold_books() -> list[dict]:
    with (PROCESSED / "d1_selected.csv").open(encoding="utf-8-sig") as f:
        titles = {r["isbn"]: r["title"] for r in csv.DictReader(f)}
    out = [{"isbn": r["isbn"], "title": titles.get(r["isbn"], ""), "entry": r["entry"], "slot": r["slot"], "source": "d4",
            **({"keywords": r["keywords"], "way": r["way"]} if r["entry"] == "target" else {"axes": r["axes"]})}
           for r in json.loads((PROCESSED / "books_v1.json").read_text(encoding="utf-8"))]
    for path in sorted(ADDITIONS.glob("*-pilot.json")):
        for b in json.loads(path.read_text(encoding="utf-8"))["books"]:
            if b.get("reviewed") is True and b.get("status") == "picked":
                out.append({"isbn": b["isbn"], "title": b["title"], "entry": "target", "slot": b["topic"],
                            "source": "pilot", "keywords": b["keywords"], "way": b["way"]})
    return out


def candidate(g: dict, detail_dir: Path) -> Candidate | None:
    path = detail_dir / f"{g['isbn']}.json"
    if not path.exists():
        return None
    items = (json.loads(path.read_text(encoding="utf-8")).get("data") or {}).get("items") or []
    cd = (items[0].get("contentDetail") or {}) if items else {}
    return Candidate(g["entry"], g["slot"], g["isbn"], g["title"], "", 0, "", clean(cd.get("bookIntroduction") or "", INTRO_MAX),
                     clean(cd.get("tableOfContents") or "", TOC_MAX))


def wrong_fields(g: dict, a: dict, kept: list[str] | None = None) -> list[str]:
    """Fields where pass A differs from the person. `kept`: the topic's closed keyword list — the person's keywords are cut
    to it (a keyword dropped from the vocabulary since the review cannot be named by the tagger)."""
    if g["entry"] == "target":
        gold_kw = set(g["keywords"]) if kept is None else set(g["keywords"]) & set(kept)
        return [f for f, ok in (("fits", a["fits"]), ("keywords", set(a["keywords"]) == gold_kw),
                                ("way", a["way"] == g["way"])) if not ok]
    return [f for f, ok in (("fits", a["fits"]), *((x, a["axes"][x] == g["axes"][x]) for x in AXES)) if not ok]


def score(rows: list[dict]) -> dict:
    """Per-field agreement with the person, flag share and the error left in agreed (auto-accepted) books."""
    out: dict = {"books": len(rows)}
    for entry, fields in (("target", ("fits", "keywords", "way")), ("leaf", ("fits", *AXES))):
        mine = [r for r in rows if r["entry"] == entry]
        agreed = [r for r in mine if not r["flags"] and not r["issues"]]
        out[entry] = {"n": len(mine), "flagged_pct": round(100 * (len(mine) - len(agreed)) / len(mine), 1) if mine else None,
                      "line_rules_ok_pct": round(100 * sum(not r["issues"] for r in mine) / len(mine), 1) if mine else None,
                      "agree_pct": {f: round(100 * sum(f not in r["wrong"] for r in mine) / len(mine), 1) if mine else None for f in fields},
                      "agreed_n": len(agreed),
                      "agreed_but_wrong_pct": {f: round(100 * sum(f in r["wrong"] for r in agreed) / len(agreed), 1) if agreed else None
                                               for f in fields}}
    return out


def run_model(client, model: str, second: str, golds: list[dict], vocab: dict, detail_dir: Path) -> dict:
    prompts = {k: system_prompt(vocab, k) for k in ("tag", "check")}
    rows, usage, skipped, failed, breaker = [], {}, 0, Counter(), Breaker()
    for g in golds:
        cand = candidate(g, detail_dir)
        if cand is None:
            skipped += 1
            continue
        kept = vocab[cand.slot]["kept"] if cand.entry == "target" else {}
        names = list(kept)
        user = user_message(cand.entry, cand.slot, cand.title, cand.intro, cand.toc, keyword_hints(cand, kept) if kept else [])
        raw_a, ua, why_a = call(client, model, prompts["tag"], user, schema(cand.entry, "tag", names), breaker)
        raw_b, ub, why_b = call(client, second, prompts["check"], user, schema(cand.entry, "check", names), breaker)
        for m, u in ((model, ua), (second, ub)):
            usage[m] = usage.get(m, Usage()).plus(u)
        a = parse(raw_a, cand.entry, "tag", names) if raw_a else None
        b = parse(raw_b, cand.entry, "check", names) if raw_b else None
        if a is None or b is None:
            failed[why_a if a is None else why_b] += 1
            continue
        issues = rule_issues(cand.entry, a, cand.title, f"{cand.intro} {cand.toc}", b)
        safe_a, safe_b = scrub(a, b, issues)  # a field that copied the YES24 text is not kept in the row, only its issue
        rows.append({"isbn": g["isbn"], "entry": g["entry"], "source": g["source"], "tag": safe_a, "second": safe_b,
                     "wrong": wrong_fields(g, a, names if cand.entry == "target" else None),
                     "flags": disagreements(cand.entry, a, b), "issues": issues})
    tagged = len(rows) or 1
    cost = sum(u.cost(m) for m, u in usage.items())
    return {"model": model, "second_model": second, "skipped_no_text": skipped, "failed": dict(failed),
            "usage": {m: u.__dict__ for m, u in usage.items()}, "cost_usd": round(cost, 4),
            "cost_per_book_usd": round(cost / tagged, 5), "score": score(rows), "rows": rows}


def estimate(golds: list[dict], models: list[str], second: str, vocab: dict, detail_dir: Path) -> dict:
    """What a run will cost BEFORE any call, as a (low, high) range. Per book and model: pass A on `model`, pass B on `second`.
    Low: few tokens per character, the system prompt read from the cache after each model+pass's first call, short answers.
    High: many tokens per character, no caching, long answers. The measured figures after the run are the real ones."""
    prompts = {k: len(system_prompt(vocab, k)) for k in ("tag", "check")}
    calls, books, skipped = [], 0, 0
    for g in golds:
        cand = candidate(g, detail_dir)
        if cand is None:
            skipped += 1
            continue
        books += 1
        user = len(user_message(cand.entry, cand.slot, cand.title, cand.intro, cand.toc, []))
        for first in models:
            calls += [(first, "tag", user), (second, "check", user)]
    lo, hi = TOKENS_PER_CHAR
    per: dict = {}
    first_seen: set = set()
    for model, kind, user in calls:
        p = per.setdefault(model, {"calls": 0, "input_tokens": [0, 0], "output_tokens": [0, 0], "cost_usd": [0.0, 0.0]})
        price_in, price_out = PRICES[model]
        sys_lo, sys_hi, user_lo, user_hi = prompts[kind] * lo, prompts[kind] * hi, user * lo, user * hi
        warm = (model, kind) in first_seen
        first_seen.add((model, kind))
        cost_lo = (sys_lo * (CACHE_READ if warm else CACHE_WRITE) + user_lo) * price_in + OUT_TOKENS[kind][0] * price_out
        cost_hi = (sys_hi + user_hi) * price_in + OUT_TOKENS[kind][1] * price_out
        p["calls"] += 1
        for i, (tin, tout, cost) in enumerate(((sys_lo + user_lo, OUT_TOKENS[kind][0], cost_lo),
                                               (sys_hi + user_hi, OUT_TOKENS[kind][1], cost_hi))):
            p["input_tokens"][i] += round(tin)
            p["output_tokens"][i] += tout
            p["cost_usd"][i] += cost / 1_000_000
    for p in per.values():
        p["cost_usd"] = [round(c, 3) for c in p["cost_usd"]]
    total = [round(sum(p["cost_usd"][i] for p in per.values()), 2) for i in (0, 1)]
    return {"books": books, "skipped_no_text": skipped, "calls": len(calls), "per_model": per, "total_usd": total}


def pick(golds: list[dict], limit: int | None) -> list[dict]:
    """A fixed, stratified subset: half 🍃 and half 🎯 (pilot books first among 🎯 — they are the new topics; the rest of
    the 🎯 are sampled with the same seed so one topic does not fill the subset). `limit` 0/None = every book."""
    if not limit:
        return golds
    rng = random.Random(7)
    leaf = [g for g in golds if g["entry"] == "leaf"]
    pilot = [g for g in golds if g["entry"] == "target" and g["source"] == "pilot"]
    rest = [g for g in golds if g["entry"] == "target" and g["source"] != "pilot"]
    want = limit - limit // 2
    chosen = pilot[:want]
    return rng.sample(leaf, min(len(leaf), limit // 2)) + chosen + rng.sample(rest, min(len(rest), want - len(chosen)))


def make_client(key: str):
    import anthropic
    return anthropic.Anthropic(api_key=key, max_retries=2, timeout=60)


def main(argv: list[str] | None = None) -> int:
    ap = argparse.ArgumentParser(description="offline tagger eval on reviewed books")
    ap.add_argument("--models", default=MODELS[0], help="comma-separated pass-A models")
    ap.add_argument("--second", default=MODELS[0], choices=MODELS, help="pass-B model")
    ap.add_argument("--limit", type=int, default=80, help="books to evaluate (0 = all)")
    ap.add_argument("--detail-dir", type=Path, default=DETAIL)
    ap.add_argument("--dry-run", action="store_true", help="print the cost estimate and stop (no key, no calls)")
    args = ap.parse_args(argv)
    models = args.models.split(",")
    if any(m not in MODELS for m in models):
        ap.error(f"models must be in {MODELS}")
    vocab = json.loads(VOCAB.read_text(encoding="utf-8"))
    golds = pick(gold_books(), args.limit)
    est = estimate(golds, models, args.second, vocab, args.detail_dir)
    print(json.dumps({"estimate": est}, ensure_ascii=False, indent=1))
    if est["books"] == 0:
        print(f"ERROR: no YES24 detail text found in {args.detail_dir} (use --detail-dir)", file=sys.stderr)
        return 1
    if args.dry_run:
        return 0
    key = os.environ.get("ANTHROPIC_API_KEY", "")
    if not key:
        print("ERROR: ANTHROPIC_API_KEY is not set in the environment", file=sys.stderr)
        return 1
    client = make_client(key)
    OUT.mkdir(parents=True, exist_ok=True)
    today = datetime.now(KST).date().isoformat()
    total = 0.0
    for model in models:
        try:
            result = run_model(client, model, args.second, golds, vocab, args.detail_dir)
        except TaggerStop as stop:
            print(f"STOPPED: {stop}; no more calls", file=sys.stderr)
            return 1
        total += result["cost_usd"]
        (OUT / f"{today}-{model}.json").write_text(
            json.dumps({**{k: v for k, v in result.items() if k != "rows"}, "estimate": est, "rows": result["rows"]},
                       ensure_ascii=False, indent=1) + "\n", encoding="utf-8")
        print(json.dumps({"measured": {k: v for k, v in result.items() if k != "rows"}}, ensure_ascii=False, indent=1))
    print(json.dumps({"measured_total_usd": round(total, 4), "estimate_total_usd": est["total_usd"]}))
    return 0


if __name__ == "__main__":
    sys.exit(main())
