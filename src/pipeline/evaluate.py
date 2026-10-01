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
  PYTHONIOENCODING=utf-8 python -m src.pipeline.evaluate --rescore data/pipeline/eval/<date>-<model>.json   # offline re-scoring
  (--limit 0 = every gold book; --detail-dir ../Galpi/data/raw/yes24/detail from a worktree without the cache)
Output: data/pipeline/eval/<date>-<model>.json — scores, flags, token use and our tags. Model-written evidence can still echo a
short YES24 phrase (a copy run of 9 characters or fewer passes the scrub), so the folder is git-ignored and local only.
"""
import argparse
import csv
import json
import math
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
from .checks import disagreements, rule_issues, scrub, split_issues
from .config import MODELS
from .merge import keyword_hints
from .prompt import AXES, MAX_KEYWORDS, schema, system_prompt, user_message
from .tagger import CACHE_READ, CACHE_WRITE, PRICES, Breaker, TaggerStop, Usage, call, parse

PROCESSED = ROOT / "data" / "processed"
OUT = PIPELINE / "eval"
TOKENS_PER_CHAR = (0.8, 1.6)                 # guess for Korean text on the Claude tokenizer: (low, high)
NOTES = ["figures are in-sample (the instructions are tuned on these books); the one-liner itself is not scored",
         "D4 `way` labels were reviewed before the 10-01 reading-way rule, so way agreement partly measures that rule change",
         "agree/agreed_but_wrong count only books both passes answered; failed books are listed under `failed`"]
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


def wilson(k: int, n: int, z: float = 1.96) -> list[float] | None:
    """95% Wilson interval of k out of n, in percent (principle 5: a size and an interval, not a bare percentage)."""
    if not n:
        return None
    p, d = k / n, 1 + z * z / n
    centre, half = (p + z * z / (2 * n)) / d, z * math.sqrt(p * (1 - p) / n + z * z / (4 * n * n)) / d
    return [round(100 * max(0.0, centre - half), 1), round(100 * min(1.0, centre + half), 1)]


def fig(k: int, n: int) -> dict:
    """One figure with its size: k of n, the percentage and its 95% interval. n = 0 gives pct None."""
    return {"pct": round(100 * k / n, 1) if n else None, "k": k, "n": n, "ci95": wilson(k, n)}


def gold_keyword_count(g: dict, kept: list[str] | None) -> int | None:
    """How many of the person's keywords the tagger could name (the kept list); None for 🍃."""
    return len(set(g["keywords"]) & set(kept or [])) if g["entry"] == "target" else None


def score(rows: list[dict]) -> dict:
    """Per-entry figures, each as {pct, k, n, ci95}:
    flagged            sent to a person because the two AIs differ (fit / keywords / way / an axis) or pass A is unsure
    line_rules_ok      the one-liner passes its rules (length, hype, title repeat, grounded, style, not copied)
    evidence_ok        the evidence and pass B's reason are present, short enough and in the model's own words
    not_auto_accepted  held or flagged for either reason (the complement of what the pipeline accepts without a person)
    agree              share equal to the person per field; for 🎯 `keywords` is the exact set (the tagger names at most
                       MAX_KEYWORDS), `keywords_within_cap` leaves out books whose person-keywords (after the vocabulary
                       cut) exceed that cap, which can never match
    agreed_but_wrong   among auto-accepted books, the share still different from the person, per field"""
    out: dict = {"books": len(rows)}
    for entry, fields in (("target", ("fits", "keywords", "way")), ("leaf", ("fits", *AXES))):
        mine = [r for r in rows if r["entry"] == entry]
        agreed = [r for r in mine if not r["flags"] and not r["issues"]]
        split = [split_issues(r["issues"]) for r in mine]
        n = len(mine)
        agree = {f: fig(sum(f not in r["wrong"] for r in mine), n) for f in fields}
        figures = {"n": n, "flagged": fig(sum(bool(r["flags"]) for r in mine), n),
                   "line_rules_ok": fig(sum(not line for line, _ in split), n),
                   "evidence_ok": fig(sum(not ev for _, ev in split), n),
                   "not_auto_accepted": fig(n - len(agreed), n), "agree": agree, "agreed_n": len(agreed),
                   "agreed_but_wrong": {f: fig(sum(f in r["wrong"] for r in agreed), len(agreed)) for f in fields}}
        if entry == "target":
            within = [r for r in mine if (r.get("gold_kw_n") or 0) <= MAX_KEYWORDS]
            figures["keywords_over_cap_n"] = n - len(within)
            agree["keywords_within_cap"] = fig(sum("keywords" not in r["wrong"] for r in within), len(within))
        out[entry] = figures
    return out


def rescore_rows(rows: list[dict], golds: list[dict], vocab: dict) -> list[dict]:
    """Rows of a saved eval file with `wrong` and `gold_kw_n` recomputed from the gold set and today's vocabulary, with
    no API call. Rows whose ISBN is not in the gold set any more are left out."""
    by_isbn, out = {g["isbn"]: g for g in golds}, []
    for r in rows:
        g = by_isbn.get(r["isbn"])
        if g is None:
            continue
        kept = list(vocab[g["slot"]]["kept"]) if g["entry"] == "target" else None
        out.append({**r, "wrong": wrong_fields(g, r["tag"], kept), "gold_kw_n": gold_keyword_count(g, kept)})
    return out


def rescore(paths: list[Path]) -> int:
    """Print the figures of saved eval files again with the current scoring code (offline: no key, no API call, no rows)."""
    vocab, golds = json.loads(VOCAB.read_text(encoding="utf-8")), gold_books()
    for path in paths:
        saved = json.loads(path.read_text(encoding="utf-8"))
        rows = rescore_rows(saved["rows"], golds, vocab)
        print(json.dumps({"file": path.name, "model": saved.get("model"), "second_model": saved.get("second_model"),
                          "rows_in_file": len(saved["rows"]), "rows_scored": len(rows), "rescored": score(rows),
                          "notes": NOTES}, ensure_ascii=False, indent=1))
    return 0


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
        raw_a, ua, why_a = call(client, model, prompts["tag"], user, schema(cand.entry, "tag", names), breaker, "A")
        raw_b, ub, why_b = call(client, second, prompts["check"], user, schema(cand.entry, "check", names), breaker, "B")
        for m, u in ((model, ua), (second, ub)):
            usage[m] = usage.get(m, Usage()).plus(u)
        a = parse(raw_a, cand.entry, "tag", names) if raw_a else None
        b = parse(raw_b, cand.entry, "check", names) if raw_b else None
        if a is None or b is None:
            # a call that answered but whose answer could not be used is "unusable", not "ok"
            failed[(why_a if raw_a is None else "unusable") if a is None else (why_b if raw_b is None else "unusable")] += 1
            continue
        issues = rule_issues(cand.entry, a, cand.title, f"{cand.intro} {cand.toc}", b)
        safe_a, safe_b = scrub(a, b, issues)  # a field that copied the YES24 text is not kept in the row, only its issue
        rows.append({"isbn": g["isbn"], "entry": g["entry"], "source": g["source"], "tag": safe_a, "second": safe_b,
                     "wrong": wrong_fields(g, a, names if cand.entry == "target" else None),
                     "gold_kw_n": gold_keyword_count(g, names), "flags": disagreements(cand.entry, a, b), "issues": issues})
    tagged = len(rows) or 1
    cost = sum(u.cost(m) for m, u in usage.items())
    return {"model": model, "second_model": second, "skipped_no_text": skipped, "failed": dict(failed),
            "usage": {m: u.__dict__ for m, u in usage.items()}, "cost_usd": round(cost, 4),
            "cost_per_book_usd": round(cost / tagged, 5), "score": score(rows), "notes": NOTES, "rows": rows}


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
    ap.add_argument("--rescore", type=Path, nargs="+", metavar="FILE",
                    help="print the figures of saved eval files again with the current scoring (offline: no key, no calls)")
    args = ap.parse_args(argv)
    if args.rescore:
        return rescore(args.rescore)
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
