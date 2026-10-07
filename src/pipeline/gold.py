"""Gold set: 40 books a person labels blind, to measure the tagger against (plans/2026-10-06-calibration.md 2–4).

Usage (from the checkout):
  PYTHONIOENCODING=utf-8 python -m src.pipeline.gold pick [--force]
      → data/pipeline/gold/gold-set.json (tracked: ISBN, title, entry, slot — no YES24 text)
  PYTHONIOENCODING=utf-8 python -m src.pipeline.gold page
      → data/processed/check/pipeline/gold-v3.html (git-ignored: YES24 intro/TOC from the local cache, no AI answers);
        the page downloads gold-v3.json ({labels: {isbn: …}})
  PYTHONIOENCODING=utf-8 python -m src.pipeline.gold calibrate --labels <gold-v3.json> [--runs N] [--max-cost USD]
      → REAL API CALLS (≈$0.8 a run): both passes tag the 40 books through run_daily.tag_one with today's instructions
        (prompt.py), results in data/processed/check/gold/run-<time>.json (git-ignored), page gold-calibration.html
  PYTHONIOENCODING=utf-8 python -m src.pipeline.gold calibrate --labels <gold-v3.json> --reuse <run-….json>
      → the page again from a saved run (no API call), e.g. after fixing labels
Pick: from web/src/data/books.json and additions/2026-10-05-2.json — 🍃 LEAF_N books over the 13 genres (every genre with
books at least one, then more for big genres), 🎯 TARGET_N over as many topics as possible; the books a person already
reviewed (the 11 of 2026-10-05-2) always go in and count in their slot. Inside a slot, books whose YES24 text is cached
come first; the order is a seeded shuffle, so the same data and seed give the same set.
Pages and runs go to the MAIN checkout's data/processed/check/ (review.PAGES), also from a worktree.
"""
import argparse
import json
import random
import re
import sys
from collections import Counter
from datetime import datetime
from pathlib import Path

from build_check_page import DETAIL, clean
from build_pilot_review import keyword_definitions

from . import ADDITIONS, BOOKS, KST, PIPELINE, ROOT, VOCAB, gold_page, gold_score
from .candidates import Candidate, yes24_env
from .config import Config, load_config
from .gaps import GENRES
from .one_liner import RetryLog
from .prompt import system_prompt
from .retag import cached_text
from .review import PAGES, main_checkout
from .rules_version import DICTIONARY, rules_version
from .run_daily import anthropic_key, tag_one
from .tagger import Breaker, TaggerStop

SEED = 20261006
LEAF_N, TARGET_N = 28, 12
ROW_KEYS = ("isbn", "title", "entry", "slot")
EST_PER_BOOK = 0.02  # USD, both passes + the odd one-liner retry (plan 4: ≈ $0.8 for 40 books)
MAX_COST_PER_RUN = 1.5
BATCH = "2026-10-05-2"  # the batch the gold set also draws from
GOLD_SET = PIPELINE / "gold" / "gold-set.json"
RUN_DIR = PAGES.parent / "gold"  # the main checkout's data/processed/check/gold (git-ignored)
REVIEWED = main_checkout() / "data" / "processed" / "check" / f"{BATCH}-gold-11.json"
DOCS = ROOT / "docs"


def _row(b: dict, dropped: bool) -> dict:
    slot = b.get("genre") if b["entry"] == "leaf" else b.get("topic")
    return {"isbn": b["isbn"], "title": b["title"], "author": b.get("author") or "", "pages": b.get("pages") or 0,
            "link": b.get("link") or "", "entry": b["entry"], "slot": slot or "", "dropped": dropped}


def pool(books: list[dict], additions: list[dict]) -> dict[str, dict]:
    """{isbn: book} over the library and a batch's books (the library row wins); batch books keep their `dropped` mark."""
    out = {b["isbn"]: _row(b, False) for b in books}
    for b in additions:
        out.setdefault(b["isbn"], _row(b, b.get("status") == "dropped"))
    return out


def quotas(sizes: dict[str, int], forced: dict[str, int], total: int, order: list[str]) -> dict[str, int]:
    """Books per slot: the forced counts, then one for every slot that has books and none yet (big slots first), then by
    the largest size / (count + 1) (D'Hondt) — never more than a slot holds (a forced count may be more)."""
    q = {s: forced.get(s, 0) for s in order}
    rank = {s: i for i, s in enumerate(order)}
    for s in sorted((s for s in order if sizes.get(s, 0) and not q[s]), key=lambda s: (-sizes[s], rank[s])):
        if sum(q.values()) >= total:
            break
        q[s] = 1
    while sum(q.values()) < total:
        room = [s for s in order if q[s] < sizes.get(s, 0)]
        if not room:
            break
        best = max(room, key=lambda s: (sizes[s] / (q[s] + 1), -rank[s]))
        q[best] += 1
    return q


def _slots(entry: str, books: list[dict]) -> list[str]:
    if entry == "leaf":
        return list(GENRES)
    return list(dict.fromkeys(b["slot"] for b in sorted(books, key=lambda b: b["isbn"])))


def pick(books: dict[str, dict], keep: list[str], cached: set[str], seed: int = SEED,
         leaf_n: int = LEAF_N, target_n: int = TARGET_N) -> list[dict]:
    """The gold rows (ROW_KEYS only): `keep` always, the rest by quotas(); dropped batch books only when kept."""
    kept = [books[i] for i in dict.fromkeys(keep) if i in books]
    out = []
    for entry, total in (("leaf", leaf_n), ("target", target_n)):
        live = [b for b in books.values() if b["entry"] == entry and b["slot"] and not b["dropped"]]
        mine = [b for b in kept if b["entry"] == entry]
        order = _slots(entry, live + mine)
        sizes = Counter(b["slot"] for b in live if b["isbn"] not in keep) + Counter(b["slot"] for b in mine)
        q = quotas(dict(sizes), dict(Counter(b["slot"] for b in mine)), total, order)
        for slot in order:
            rng = random.Random(f"{seed}:{entry}:{slot}")
            rest = sorted((b for b in live if b["slot"] == slot and b["isbn"] not in keep), key=lambda b: b["isbn"])
            warm, cold = [b for b in rest if b["isbn"] in cached], [b for b in rest if b["isbn"] not in cached]
            rng.shuffle(warm)
            rng.shuffle(cold)
            chosen = [b for b in mine if b["slot"] == slot] + (warm + cold)
            out += [{k: b[k] for k in ROW_KEYS} for b in chosen[:q[slot]]]  # q counts the kept books of the slot
    return out


def gold_doc(rows: list[dict], seed: int, kept: list[str]) -> dict:
    order = {g: i for i, g in enumerate(GENRES)}
    ranked = sorted(rows, key=lambda r: (r["entry"], order.get(r["slot"], len(order)) if r["entry"] == "leaf" else 0,
                                         r["slot"], r["title"]))
    return {"name": "gold-v3", "seed": seed, "note": "Gold set for calibration (plans/2026-10-06-calibration.md). "
            "ISBN, title, entry, slot only — labels live in the person's download (git-ignored).",
            "reviewed_before": [i for i in kept if i in {r["isbn"] for r in rows}],
            "counts": dict(Counter(r["entry"] for r in rows)), "books": ranked}


def estimate(books: int, runs: int) -> float:
    return round(books * runs * EST_PER_BOOK, 2)


def calibrate(rows: list[dict], books: dict[str, dict], cfg: Config, client, vocab: dict, text_of, runs: int = 1,
              rules: str = "", max_cost: float | None = None) -> tuple[dict, dict]:
    """(run doc, summary): every gold book with cached text through run_daily.tag_one (pass A + blind pass B, today's
    prompt.py instructions), `runs` times, the gold slot as the slot. A TaggerStop or the cost cap (default
    MAX_COST_PER_RUN a run) stops it — what was tagged is kept. The doc holds our tags and the AI lines only."""
    cap = MAX_COST_PER_RUN * runs if max_cost is None else max_cost
    prompts = {kind: system_prompt(vocab, kind) for kind in ("tag", "check")}
    texts = {r["isbn"]: text_of(r["isbn"]) for r in rows}
    results, failed, ledger, breaker, retries, stopped = [], {}, {}, Breaker(), RetryLog(), None
    axis_retries = RetryLog()
    for run in range(1, runs + 1):
        for r in rows:
            intro, toc = texts[r["isbn"]]
            if not intro:
                continue
            b = books.get(r["isbn"], {})
            cand = Candidate(r["entry"], r["slot"], r["isbn"], r["title"], b.get("author") or "?", b.get("pages") or 1,
                             b.get("link") or "", intro, toc)
            try:
                rec, why = tag_one(client, cfg, prompts, vocab, cand, breaker, ledger, retries, rules, axis_retries)
            except TaggerStop as err:
                stopped = str(err)
                break
            if rec:
                results.append({"run": run, "isbn": r["isbn"], "record": rec})
            else:
                failed[f"{run}:{r['isbn']}"] = why
            spent = sum(u.cost(m) for m, u in ledger.items())
            if spent > cap:
                stopped = f"cost cap ${cap} passed (${spent:.2f})"
                break
        if stopped:
            break
    cost = round(sum(u.cost(m) for m, u in ledger.items()), 4)
    summary = {"rules_version": rules, "model": cfg.model, "second_model": cfg.second_model, "runs": runs,
               "tagged": len(results), "failed": failed, "stopped": stopped, "cost_usd": cost,
               "one_liner_retries": retries.summary(), "axis_retries": axis_retries.summary(), "usage": {m: u.__dict__ for m, u in ledger.items()}}
    doc = {**summary, "made": datetime.now(KST).isoformat(timespec="seconds"),
           "skipped_no_text": [r["isbn"] for r in rows if not texts[r["isbn"]][0]], "results": results}
    return doc, summary


def detail_dirs() -> list[Path]:
    """The YES24 detail caches: this checkout's, the main checkout's, then every worktree's (a batch tagged in a worktree
    cached its books there — the 2026-10-05-2 books live in .worktrees/books-b2)."""
    main, rel = main_checkout(), DETAIL.relative_to(ROOT)
    return list(dict.fromkeys([DETAIL, main / rel, *sorted((main / ".worktrees").glob(f"*/{rel.as_posix()}"))]))


def cached_isbns(dirs: list[Path]) -> set[str]:
    return {p.stem for d in dirs if d.exists() for p in d.glob("*.json")}


def page_text(isbn: str, dirs: list[Path]) -> tuple[str, str]:
    """(intro, TOC) in full from the first cache that has the book, cleaned of YES24 markup; ("", "") when none has it."""
    path = next((d / f"{isbn}.json" for d in dirs if (d / f"{isbn}.json").exists()), None)
    if path is None:
        return "", ""
    items = (json.loads(path.read_text(encoding="utf-8")).get("data") or {}).get("items") or []
    cd = (items[0].get("contentDetail") or {}) if items else {}
    toc = re.sub(r"\s*<br\s*/?>\s*", "\n", cd.get("tableOfContents") or "")
    return clean(cd.get("bookIntroduction") or "").strip(), clean(toc).strip()


def page_entries(rows: list[dict], books: dict[str, dict], text_of) -> list[dict]:
    """What the labelling page shows of each book — no slot, no tags, no AI line (blind)."""
    out = []
    for r in rows:
        b, (intro, toc) = books.get(r["isbn"], {}), text_of(r["isbn"])
        out.append({"isbn": r["isbn"], "title": r["title"], "author": b.get("author") or "", "pages": b.get("pages") or 0,
                    "link": b.get("link") or "", "entry": r["entry"], "intro": intro, "toc": toc})
    return out


def _read(path: Path):
    return json.loads(path.read_text(encoding="utf-8"))


def load_pool() -> dict[str, dict]:
    return pool(_read(BOOKS), _read(ADDITIONS / f"{BATCH}.json")["books"])


def cmd_pick(args) -> int:
    if GOLD_SET.exists() and not args.force:
        print(f"ERROR: {GOLD_SET} already exists (--force to pick again)", file=sys.stderr)
        return 1
    keep = list(_read(args.keep).get("answers") or {}) if args.keep.exists() else []
    if not keep:
        print(f"WARNING: no reviewed books found at {args.keep} — picking without them", file=sys.stderr)
    books, warm = load_pool(), cached_isbns(detail_dirs())
    doc = gold_doc(pick(books, keep, warm, args.seed), args.seed, keep)
    GOLD_SET.parent.mkdir(parents=True, exist_ok=True)
    GOLD_SET.write_text(json.dumps(doc, ensure_ascii=False, indent=1) + "\n", encoding="utf-8", newline="")
    slots = Counter(f"{'🍃' if r['entry'] == 'leaf' else '🎯'} {r['slot']}" for r in doc["books"])
    print(f"saved: {GOLD_SET} · {doc['counts']} · reviewed before {len(doc['reviewed_before'])}/{len(keep)} · "
          f"text cached {sum(r['isbn'] in warm for r in doc['books'])}/{len(doc['books'])}")
    print(" · ".join(f"{s} {n}" for s, n in slots.items()))
    return 0


def cmd_page(args) -> int:
    rows, books, dirs = _read(GOLD_SET)["books"], load_pool(), detail_dirs()
    vocab, rules = _read(VOCAB), rules_version()
    entries = page_entries(rows, books, lambda isbn: page_text(isbn, dirs))
    html = gold_page.label_page(entries, vocab, keyword_definitions(), gold_page.guide(DICTIONARY, DOCS, rules), rules)
    out = PAGES / "gold-v3.html"
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text(html, encoding="utf-8")
    no_text = [e["isbn"] for e in entries if not e["intro"]]
    print(f"saved: {out} · {len(entries)} books · rules {rules}" + (f" · no cached intro: {no_text}" if no_text else ""))
    return 0


def cmd_calibrate(args) -> int:
    rows = _read(GOLD_SET)["books"]
    try:
        labels = gold_score.check_labels(rows, _read(args.labels))
    except gold_score.GoldError as err:
        print(f"ERROR: {err}", file=sys.stderr)
        return 1
    if args.reuse:
        doc, name = _read(args.reuse), args.reuse.name
    else:
        key = anthropic_key()
        if not key:
            print("ERROR: ANTHROPIC_API_KEY not set", file=sys.stderr)
            return 1
        books, dirs, env, cfg = load_pool(), detail_dirs(), yes24_env(), load_config()
        cap = args.max_cost if args.max_cost is not None else MAX_COST_PER_RUN * args.runs
        print(f"about to tag {len(rows)} books x {args.runs} run(s) with {cfg.model} + {cfg.second_model}: "
              f"about ${estimate(len(rows), args.runs)} (stops past ${cap})", flush=True)
        import anthropic  # the SDK is only needed for a real run
        client = anthropic.Anthropic(api_key=key, max_retries=2, timeout=60)
        doc, summary = calibrate(rows, books, cfg, client, _read(VOCAB), lambda isbn: cached_text(isbn, dirs, env),
                                 args.runs, rules_version(), cap)
        RUN_DIR.mkdir(parents=True, exist_ok=True)
        name = f"run-{datetime.now(KST).strftime('%Y%m%d-%H%M%S')}.json"
        (RUN_DIR / name).write_text(json.dumps(doc, ensure_ascii=False, indent=1) + "\n", encoding="utf-8")
        print(json.dumps(summary, ensure_ascii=False, indent=1))
        print(f"saved: {RUN_DIR / name}")
    scored = gold_score.score(rows, labels, doc["results"])
    out = PAGES / "gold-calibration.html"
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text(gold_page.calibration_page(scored, name, doc.get("rules_version") or ""), encoding="utf-8")
    for field, pair in scored["fields"].items():
        print(f"{field}: " + " · ".join(f"{who} {k}/{n}" for who, (k, n) in pair.items()))
    print(f"saved: {out} · mismatches {len(scored['mismatches'])}")
    return 0


def main(argv: list[str] | None = None) -> int:
    ap = argparse.ArgumentParser(description="gold set: pick, label page, calibrate")
    sub = ap.add_subparsers(dest="cmd", required=True)
    p = sub.add_parser("pick")
    p.add_argument("--force", action="store_true")
    p.add_argument("--seed", type=int, default=SEED)
    p.add_argument("--keep", type=Path, default=REVIEWED, help="a review download whose books always go in")
    sub.add_parser("page")
    c = sub.add_parser("calibrate")
    c.add_argument("--labels", type=Path, required=True)
    c.add_argument("--runs", type=int, default=1)
    c.add_argument("--max-cost", type=float)
    c.add_argument("--reuse", type=Path, help="a saved run-….json: build the page again, no API call")
    args = ap.parse_args(argv)
    return {"pick": cmd_pick, "page": cmd_page, "calibrate": cmd_calibrate}[args.cmd](args)


if __name__ == "__main__":
    sys.exit(main())
