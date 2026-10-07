"""Re-tag the books where the writer's country decides the genre, now that the tagger reads the author line (10-07).

Before 10-07 the tagger never saw the author, so "한국 소설 / 외국 소설은 작가의 나라로" was a guess (e.g. 『이상이 일상이 되도록
상상하라』, 유범상 저 → pass C said 외국 소설). Targets in retag/library-v3.json: books whose slot, pass A / B suggestion or
pass C suggestion is 한국 소설 or 외국 소설 — never a book a person already answered (their download stays decided).
Each runs through retag_library.run (both passes, v3.1 dictionary + author line); the merged book keeps the answer it
replaces under `before_author` (record + tiebreak row) — or under `v3` when it had no v3.1 re-tag yet — gets
`retag_reasons` + "author", and its tiebreak row is dropped so library_cli asks pass C again where the new passes split.
Then the page is rebuilt with the same answers and the same browser progress key. Our tags only.

Usage (real API calls — costs money):
  PYTHONIOENCODING=utf-8 python -m src.pipeline.retag_author --answers <download> --dry-run
  PYTHONIOENCODING=utf-8 python -m src.pipeline.retag_author --answers <download> [--max-cost 3]
"""
import argparse
import json
import sys
from collections import Counter
from pathlib import Path

from .retag_v31 import RULES, answered_of

FICTION_BY_COUNTRY = ("한국 소설", "외국 소설")
MAX_COST = 3.0
PROGRESS = "library-v3.1-author.json"
REASON = "author"


def targets(books: list[dict], tb: dict[str, dict], answered: set[str]) -> list[str]:
    """ISBNs in library order whose slot or any pass's suggestion is 한국 / 외국 소설, answered books left out."""
    out = []
    for b in books:
        rec, third = b["record"], (tb.get(b["isbn"]) or {}).get("third") or {}
        names = {b["slot"], rec.get("suggest"), (rec.get("second") or {}).get("suggest"), third.get("suggest")}
        if b["isbn"] not in answered and names & set(FICTION_BY_COUNTRY):
            out.append(b["isbn"])
    return out


def merge(doc: dict, tb: dict, new_books: list[dict]) -> tuple[dict, dict]:
    """(library doc, tiebreak doc) with each re-tagged book replaced; what it replaces is kept (see module doc)."""
    new = {b["isbn"]: b for b in new_books}
    rows = dict(tb["books"])
    books = []
    for b in doc["books"]:
        n = new.get(b["isbn"])
        if n is None:
            books.append(b)
            continue
        old = {"record": b["record"], **({"tiebreak": rows.pop(b["isbn"])} if b["isbn"] in rows else {})}
        keep = {"v3": b["v3"], "before_author": old} if "v3" in b else {"v3": old}
        books.append({**n, "rules_version": RULES, "retag_reasons": [*b.get("retag_reasons", []), REASON], **keep})
    return {**doc, "books": books}, {**tb, "books": rows}


def genre_decisions(books: list[dict], decided: dict[str, dict], isbns: list[str]) -> dict[str, str]:
    """{isbn: the genre the library would take without a person, or "ask" when a person decides the slot}."""
    by = {b["isbn"]: b for b in books}
    return {i: "ask" if "slot" in decided[i]["asks"] else decided[i]["auto"].get("slot") or by[i]["slot"] for i in isbns}


def main(argv: list[str] | None = None) -> int:
    from . import VOCAB, library_cli
    from .config import load_config
    from .library_review import groups
    from .retag_library import OUT, TIEBREAK, empty_doc, estimate, load_library, run, write
    from .rules_version import rules_version

    ap = argparse.ArgumentParser(description="re-tag the 한국 / 외국 소설 books with the author line")
    ap.add_argument("--answers", type=Path, help="a person's download of the library page (kept as answered)")
    ap.add_argument("--max-cost", type=float, default=MAX_COST, help=f"USD for re-tag + tiebreak (default {MAX_COST})")
    ap.add_argument("--dry-run", action="store_true")
    args = ap.parse_args(argv)
    if rules_version() != RULES:
        print(f"ERROR: the dictionary is {rules_version()}, this re-tag is {RULES}", file=sys.stderr)
        return 1
    answers = answered_of(args.answers)
    doc, tb = json.loads(OUT.read_text(encoding="utf-8")), json.loads(TIEBREAK.read_text(encoding="utf-8"))
    done = {b["isbn"] for b in doc["books"] if REASON in b.get("retag_reasons", [])}
    todo = [i for i in targets(doc["books"], tb["books"], set(answers)) if i not in done]
    before = genre_decisions(doc["books"], groups(doc["books"], tb["books"], answered=set(answers)), todo)
    progress_path = OUT.with_name(PROGRESS)
    cfg = load_config()
    progress = json.loads(progress_path.read_text(encoding="utf-8")) if progress_path.exists() else empty_doc(cfg, RULES)
    left = [i for i in todo if i not in {b["isbn"] for b in progress["books"]}]
    print(f"author targets {len(todo)} (answered kept: {len(answers)}) · left {len(left)} · about ${estimate(len(left))} "
          f"+ tiebreak · cap ${args.max_cost} (spent ${progress['cost_usd']})", flush=True)
    if args.dry_run or not todo:
        return 0
    if left:
        from .candidates import yes24_env
        from .gold import detail_dirs
        from .retag import cached_text
        from .run_daily import anthropic_key
        key = anthropic_key()
        if not key:
            print("ERROR: ANTHROPIC_API_KEY not set", file=sys.stderr)
            return 1
        import anthropic
        dirs, env = detail_dirs(), yes24_env()
        items = [it for it in load_library() if it["isbn"] in set(left)]
        progress, summary = run(items, progress, cfg, anthropic.Anthropic(api_key=key, max_retries=2, timeout=90),
                                json.loads(VOCAB.read_text(encoding="utf-8")), lambda i: cached_text(i, dirs, env),
                                args.max_cost, lambda d: write(d, progress_path), RULES)
        print(json.dumps({k: summary[k] for k in ("tagged", "failed", "skipped_no_text", "stopped", "cost_usd")},
                         ensure_ascii=False))
        if summary["stopped"]:
            return 1
    doc, tb = merge(doc, tb, [b for b in progress["books"] if b["isbn"] in set(todo)])
    doc = {**doc, "cost_usd": round(doc["cost_usd"] + progress["cost_usd"], 4),
           "note": doc["note"] + " Author line (10-07): the 한국 / 외국 소설 books were re-tagged with the author line "
                                 "(`retag_reasons` \"author\", the replaced answer under `before_author` or `v3`)."}
    write(doc, OUT)
    write(tb, TIEBREAK)
    progress_path.unlink()
    spent = progress["cost_usd"]
    code = library_cli.cmd_tiebreak(OUT, TIEBREAK, tb["cost_usd"] + max(0.0, args.max_cost - spent), write)
    doc, tb = json.loads(OUT.read_text(encoding="utf-8")), json.loads(TIEBREAK.read_text(encoding="utf-8"))
    after = genre_decisions(doc["books"], groups(doc["books"], tb["books"], answered=set(answers)), todo)
    changed = {i: f"{before[i]} → {after[i]}" for i in todo if before[i] != after[i]}
    print(json.dumps({"re_tagged": len(todo), "retag_usd": spent, "genre_decisions_changed": len(changed),
                      "changes": dict(Counter(changed.values()))}, ensure_ascii=False, indent=1))
    return code or library_cli.cmd_page(OUT, TIEBREAK, answers)


if __name__ == "__main__":
    sys.exit(main())
