"""Targeted re-tag under label-dictionary v3.1 (plans/2026-10-07-dictionary-v3.1.md: "그 규칙에 걸리는 책만 다시 태그").

Which books (targets): of retag/library-v3.json, never a book a person already answered (their download, e.g.
check/library/library-v3-partial-1.json — those stay decided as answered), and
  person   — still left to a person (library_review group "person")
  sample   — in the unconfirmed sample (group "sample")
  fiction  — a 🍃 novel / poem decided alone whose 온도·끌림·얻는 것 is 0 or empty, or was settled by the third pass
             (rules 2-5, 7-8 move exactly those values)
  anthology — a 🍃 book with 선집 / 작품집 in its title or intro (rule 1)
  essay    — a 🍃 book whose intro names a field before 에세이 ("과학 에세이", "여행 에세이" — rule 6)
  moved    — a 🍃 book the agreed / majority slot move takes from or to 에세이 (rule 6)
Each target runs through retag_library.run (both passes, the one-liner and axis retries), then the merged file keeps the v3
answer of every re-tagged book under `v3` (record + its tiebreak row) and stamps the book `rules_version: "v3.1"`; its
tiebreak row is dropped so library_cli.run_tiebreak asks pass C again where the new passes split. Our tags only.

Usage (real API calls — costs money; the key from web/.env.local or the environment):
  PYTHONIOENCODING=utf-8 python -m src.pipeline.retag_v31 --answers <download> --dry-run     targets + estimate
  PYTHONIOENCODING=utf-8 python -m src.pipeline.retag_v31 --answers <download> [--max-cost 6] re-tag, merge, tiebreak, page
"""
import argparse
import json
import re
import sys
from collections import Counter
from pathlib import Path

from .signals_report import FICTION

RULES = "v3.1"
MAX_COST = 6.0
STORY = ("temp", "pull", "gain")
PROGRESS = "library-v3.1-retag.json"
FORMS = re.compile(r"선집|작품집")
ESSAY = re.compile(r"([가-힣A-Za-z]+) ?에세이")
# a word before 에세이 that names no field: determiners, praise, sales words, adjective endings (다정한·화제의·독보적)
NOT_FIELD = {"이", "그", "한", "첫", "새", "두", "이번", "스테디셀러", "베스트셀러", "장편", "산문"}


def field_essay(intro: str) -> bool:
    """True when the intro names a field before 에세이 ("과학 에세이", "여행에세이")."""
    return any(m.group(1) not in NOT_FIELD and not m.group(1).endswith(("한", "의", "적", "인", "운", "은", "는"))
               for m in ESSAY.finditer(intro))


def reasons_of(book: dict, d: dict, intro: str) -> list[str]:
    out = [d["group"]] if d["group"] in ("person", "sample") else []
    if book["entry"] != "leaf":
        return out
    genre = d["auto"].get("slot") or book["slot"]
    if d["group"] == "auto" and genre in FICTION and (any(d["auto"].get(a, 1) in (0, None) for a in STORY)
                                                       or any(a in d["settled"] for a in STORY)):
        out.append("fiction")
    if FORMS.search(book["title"]) or FORMS.search(intro):
        out.append("anthology")
    if field_essay(intro):
        out.append("essay")
    if "slot" in d["auto"] and "에세이" in (book["slot"], d["auto"]["slot"]):
        out.append("moved")
    return out


def targets(books: list[dict], decided: dict[str, dict], answered: set[str], text_of) -> dict[str, list[str]]:
    """{isbn: reasons} in library order; `text_of(isbn)` → (intro, TOC)."""
    out = {}
    for b in books:
        if b["isbn"] in answered:
            continue
        why = reasons_of(b, decided[b["isbn"]], text_of(b["isbn"])[0] if b["entry"] == "leaf" else "")
        if why:
            out[b["isbn"]] = why
    return out


def merge(doc: dict, tb: dict, new_books: list[dict], why: dict[str, list[str]]) -> tuple[dict, dict]:
    """(library doc, tiebreak doc) with each re-tagged book replaced; the v3 record and tiebreak row kept under `v3`."""
    new = {b["isbn"]: b for b in new_books}
    rows = dict(tb["books"])
    books = []
    for b in doc["books"]:
        n = new.get(b["isbn"])
        if n is None:
            books.append(b)
            continue
        old = {"record": b["record"], **({"tiebreak": rows.pop(b["isbn"])} if b["isbn"] in rows else {})}
        books.append({**n, "rules_version": RULES, "retag_reasons": why.get(b["isbn"], []), "v3": old})
    return {**doc, "books": books}, {**tb, "books": rows}


def answered_of(path: Path | None) -> dict[str, dict]:
    if path is None:
        return {}
    from apply_review import unwrap
    return unwrap(json.loads(path.read_text(encoding="utf-8")))


def main(argv: list[str] | None = None) -> int:
    from . import VOCAB, library_cli
    from .config import load_config
    from .gold import detail_dirs, page_text
    from .library_review import groups
    from .retag_library import OUT, TIEBREAK, empty_doc, estimate, load_library, run, write
    from .rules_version import rules_version

    ap = argparse.ArgumentParser(description="re-tag the books the v3.1 rules can change")
    ap.add_argument("--answers", type=Path, help="a person's download of the library page (kept as answered)")
    ap.add_argument("--max-cost", type=float, default=MAX_COST, help=f"USD for re-tag + tiebreak (default {MAX_COST})")
    ap.add_argument("--dry-run", action="store_true")
    args = ap.parse_args(argv)
    if rules_version() != RULES:
        print(f"ERROR: the dictionary is {rules_version()}, this re-tag is {RULES}", file=sys.stderr)
        return 1
    answers = answered_of(args.answers)
    doc, tb = json.loads(OUT.read_text(encoding="utf-8")), json.loads(TIEBREAK.read_text(encoding="utf-8"))
    dirs = detail_dirs()
    done = {b["isbn"] for b in doc["books"] if b.get("rules_version") == RULES}
    decided = groups(doc["books"], tb["books"], answered=set(answers))
    why = {i: r for i, r in targets(doc["books"], decided, set(answers), lambda i: page_text(i, dirs)).items() if i not in done}
    progress_path = OUT.with_name(PROGRESS)
    cfg = load_config()
    progress = json.loads(progress_path.read_text(encoding="utf-8")) if progress_path.exists() else empty_doc(cfg, RULES)
    left = [i for i in why if i not in {b["isbn"] for b in progress["books"]}]
    print(f"v3.1 targets {len(why)} (answered kept: {len(answers)}) · by reason "
          f"{dict(Counter(r for rs in why.values() for r in rs))} · left {len(left)} · about ${estimate(len(left))} "
          f"+ tiebreak · cap ${args.max_cost} (spent ${progress['cost_usd']})", flush=True)
    if args.dry_run:
        return 0
    if left:
        from .candidates import yes24_env
        from .retag import cached_text
        from .run_daily import anthropic_key
        key = anthropic_key()
        if not key:
            print("ERROR: ANTHROPIC_API_KEY not set", file=sys.stderr)
            return 1
        import anthropic
        items = [it for it in load_library() if it["isbn"] in set(left)]
        env = yes24_env()
        progress, summary = run(items, progress, cfg, anthropic.Anthropic(api_key=key, max_retries=2, timeout=90),
                                json.loads(VOCAB.read_text(encoding="utf-8")), lambda i: cached_text(i, dirs, env),
                                args.max_cost, lambda d: write(d, progress_path), RULES)
        print(json.dumps({k: summary[k] for k in ("tagged", "failed", "skipped_no_text", "stopped", "cost_usd")},
                         ensure_ascii=False))
        if summary["stopped"]:
            return 1
    doc, tb = merge(doc, tb, [b for b in progress["books"] if b["isbn"] in why], why)
    doc = {**doc, "rules_version": RULES, "cost_usd": round(doc["cost_usd"] + progress["cost_usd"], 4),
           "note": doc["note"] + " v3.1 (10-07): the books the new rules can change were re-tagged (`rules_version` "
                                 "v3.1, the v3 answer under `v3`); the others keep their v3 tags."}
    write(doc, OUT)
    write(tb, TIEBREAK)
    progress_path.unlink()
    spent = progress["cost_usd"]
    code = library_cli.cmd_tiebreak(OUT, TIEBREAK, tb["cost_usd"] + max(0.0, args.max_cost - spent), write)
    print(f"merged {len(why)} books · re-tag ${spent}")
    return code or library_cli.cmd_page(OUT, TIEBREAK, answers)


if __name__ == "__main__":
    sys.exit(main())
