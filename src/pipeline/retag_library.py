"""Tag the whole library again with the v3 label dictionary (plans/2026-10-06-calibration.md 5) — resumable.

Usage (from the checkout; real API calls — costs money):
  PYTHONIOENCODING=utf-8 python -m src.pipeline.retag_library --dry-run           counts + estimate, no calls
  PYTHONIOENCODING=utf-8 python -m src.pipeline.retag_library [--max-cost 15]     tag every book not done yet
  PYTHONIOENCODING=utf-8 python -m src.pipeline.retag_library --tiebreak          pass C for split fields (library_cli)
  PYTHONIOENCODING=utf-8 python -m src.pipeline.retag_library --page [--answers <earlier download>]   review page
  PYTHONIOENCODING=utf-8 python -m src.pipeline.retag_library --apply <download> [--answers <earlier download>]
                                                                                 into books_v1 / additions, then books:import
Every library book (library.py: books_v1 + the additions the import reads + every live book of 2026-10-05-2) runs through
run_daily.tag_one — pass A with the one-liner retry, blind pass B, the 🍃 axis re-ask, slot suggestions, the copy checks —
with the models of data/pipeline/config.json, calls one after another so the prompt cache stays warm. The YES24 intro/TOC
come from the local caches (gold.detail_dirs), fetched with the local key only when none has the book; a book with no text
is skipped and listed. Results go to data/processed/retag/library-v3.json, written after every book: a run that stops (the
`--max-cost` cap counts earlier runs too, a TaggerStop) keeps what it did, and the next run skips the books already there.
The additions files and books_v1.json are never touched here. The output holds our tags only — no YES24 text.
"""
import argparse
import json
import os
import sys
from datetime import datetime
from pathlib import Path

from . import ADDITIONS, KST, VOCAB
from .candidates import Candidate
from .config import Config
from .one_liner import RetryLog
from .prompt import system_prompt
from .run_daily import tag_one
from .tagger import Breaker, TaggerStop

OUT = Path(__file__).resolve().parents[2] / "data" / "processed" / "retag" / "library-v3.json"
MAX_COST = 15.0
EST_PER_BOOK = 0.023  # USD: the gold run measured $0.032/book with 5 cache writes over 40 books; amortized over ~480 books
NOTE = ("v3 re-tag of the whole library (plans/2026-10-06-calibration.md 5). `current` = the library's value when tagged, "
        "`record` = run_daily.tag_one's record. Our tags only — no YES24 intro/TOC.")


def empty_doc(cfg: Config, rules: str) -> dict:
    return {"name": "library-v3", "rules_version": rules, "model": cfg.model, "second_model": cfg.second_model,
            "note": NOTE, "cost_usd": 0.0, "runs": [], "skipped_no_text": [], "failed": {}, "books": []}


def remaining(items: list[dict], doc: dict) -> int:
    done = {b["isbn"] for b in doc["books"]}
    return sum(i["isbn"] not in done for i in items)


def estimate(n: int) -> float:
    return round(n * EST_PER_BOOK, 2)


def _cost(ledger: dict) -> float:
    return sum(u.cost(m) for m, u in ledger.items())


def run(items: list[dict], doc: dict, cfg: Config, client, vocab: dict, text_of, max_cost: float, save,
        rules: str) -> tuple[dict, dict]:
    """(doc with this run's books added, run summary). `text_of(isbn)` → (intro, TOC); `save(doc)` after every book."""
    prior, done = float(doc.get("cost_usd") or 0), {b["isbn"] for b in doc["books"]}
    prompts = {kind: system_prompt(vocab, kind) for kind in ("tag", "check")}
    ledger, breaker, retries, axis_retries = {}, Breaker(), RetryLog(), RetryLog()
    no_text, failed, stopped, tagged = [], {}, None, 0
    started = datetime.now(KST).isoformat(timespec="seconds")
    for it in items:
        if it["isbn"] in done:
            continue
        if prior + _cost(ledger) > max_cost:
            stopped = f"cost cap ${max_cost} passed (${prior + _cost(ledger):.2f})"
            break
        intro, toc = text_of(it["isbn"])
        if not intro:
            no_text.append(it["isbn"])
            continue
        cand = Candidate(it["entry"], it["slot"], it["isbn"], it["title"], it["author"], it["pages"], it["link"], intro, toc)
        try:
            rec, why = tag_one(client, cfg, prompts, vocab, cand, breaker, ledger, retries, rules, axis_retries)
        except TaggerStop as err:
            stopped = str(err)
            break
        except Exception as err:  # one odd book must not lose the others; the class name is all that is kept
            rec, why = None, f"error:{type(err).__name__}"
        if rec:
            tagged += 1
            book = {k: it[k] for k in ("isbn", "source", "entry", "slot", "title", "status", "current")} | {"record": rec}
            doc = {**doc, "books": [*doc["books"], book], "cost_usd": round(prior + _cost(ledger), 4)}
        else:
            failed[it["isbn"]] = why
        save(doc)
    summary = {"started": started, "tagged": tagged, "failed": failed, "skipped_no_text": no_text, "stopped": stopped,
               "one_liner_retries": retries.summary(), "axis_retries": axis_retries.summary(),
               "usage": {m: u.__dict__ for m, u in ledger.items()}, "cost_usd": round(_cost(ledger), 4)}
    doc = {**doc, "cost_usd": round(prior + _cost(ledger), 4), "runs": [*doc["runs"], summary],
           "skipped_no_text": no_text, "failed": failed}
    save(doc)
    return doc, summary


def write(doc: dict, path: Path = OUT) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    tmp = path.with_suffix(".tmp")
    tmp.write_text(json.dumps(doc, ensure_ascii=False, indent=1) + "\n", encoding="utf-8", newline="")
    os.replace(tmp, path)


def load_library() -> list[dict]:
    from .library import D1, V1, bib_of, library_books, library_files
    docs = [(p.name, json.loads(p.read_text(encoding="utf-8"))) for p in library_files(ADDITIONS)]
    return library_books(json.loads(V1.read_text(encoding="utf-8")), bib_of(D1.read_text(encoding="utf-8")), docs)


def cmd_run(args) -> int:
    from .candidates import yes24_env
    from .config import load_config
    from .gold import detail_dirs
    from .retag import cached_text
    from .rules_version import rules_version
    from .run_daily import anthropic_key

    items, cfg, rules, dirs = load_library(), load_config(), rules_version(), detail_dirs()
    doc = json.loads(OUT.read_text(encoding="utf-8")) if OUT.exists() else empty_doc(cfg, rules)
    if doc["rules_version"] != rules:
        print(f"ERROR: {OUT.name} was tagged under {doc['rules_version']}, the dictionary is {rules}", file=sys.stderr)
        return 1
    left = remaining(items, doc)
    cached = sum(any((d / f"{i['isbn']}.json").exists() for d in dirs) for i in items)
    print(f"library {len(items)} books (leaf {sum(i['entry'] == 'leaf' for i in items)}) · done {len(items) - left} · "
          f"left {left} · YES24 text cached {cached}/{len(items)} · {cfg.model} + {cfg.second_model} · rules {rules} · "
          f"about ${estimate(left)} (spent so far ${doc['cost_usd']}, stops past ${args.max_cost} in all)", flush=True)
    if args.dry_run or not left:
        return 0
    key = anthropic_key()
    if not key:
        print("ERROR: ANTHROPIC_API_KEY not set", file=sys.stderr)
        return 1
    import anthropic  # the SDK is only needed for a real run
    env = yes24_env()
    doc, summary = run(items, doc, cfg, anthropic.Anthropic(api_key=key, max_retries=2, timeout=90),
                       json.loads(VOCAB.read_text(encoding="utf-8")), lambda isbn: cached_text(isbn, dirs, env),
                       args.max_cost, write, rules)
    print(json.dumps(summary, ensure_ascii=False, indent=1))
    print(f"saved: {OUT} · {len(doc['books'])}/{len(items)} books · total ${doc['cost_usd']}")
    return 0 if not summary["stopped"] else 1


TIEBREAK = OUT.with_name("library-v3-tiebreak.json")
REMOVED = OUT.with_name("removed.json")


def main(argv: list[str] | None = None) -> int:
    ap = argparse.ArgumentParser(description="v3 re-tag of the whole library")
    ap.add_argument("--dry-run", action="store_true")
    ap.add_argument("--max-cost", type=float, help=f"USD in all (run: default {MAX_COST}; tiebreak: default 1.7)")
    ap.add_argument("--tiebreak", action="store_true", help="third pass for split fields (library_cli.py)")
    ap.add_argument("--page", action="store_true", help="build the review page")
    ap.add_argument("--apply", type=Path, metavar="DOWNLOAD", help="write the decided values into the import's files")
    ap.add_argument("--answers", type=Path, metavar="EARLIER",
                    help="--page / --apply: a person's earlier download — those books stay decided as answered")
    args = ap.parse_args(argv)
    from . import library_cli
    from .retag_v31 import answered_of
    earlier = answered_of(args.answers)
    if args.apply:
        return library_cli.cmd_apply(OUT, TIEBREAK, REMOVED, args.apply, write, earlier)
    if args.page:
        return library_cli.cmd_page(OUT, TIEBREAK, earlier)
    if args.tiebreak:
        return library_cli.cmd_tiebreak(OUT, TIEBREAK, args.max_cost, write)
    args.max_cost = MAX_COST if args.max_cost is None else args.max_cost
    return cmd_run(args)


if __name__ == "__main__":
    sys.exit(main())
