"""D3-1: split the 200 selected books into 4 input bundles for AI tagging.

Each book carries its YES24 intro and TOC so a tagger can read it one by one.
Bundles mix 🍃 (leaf) and 🎯 (target) evenly: books are sorted by (entry, slot, isbn)
and dealt round-robin into 4 batches of 50.
The bundles contain YES24 text, so they live only under data/processed/check/ (git-ignored).

Usage:  PYTHONIOENCODING=utf-8 python src/build_d3_bundles.py
Input:  data/processed/d1_selected.csv
        data/processed/keyword_tags_draft.json  (🎯 keywords, status "picked" only)
        data/raw/yes24/detail/<isbn>.json
Output: data/processed/check/d3_bundles/batch_1.json ... batch_4.json
        (isbn, entry, slot, title, author, pages, intro, toc, keywords, missing_detail)
"""
import csv
import json
import re
from pathlib import Path

from build_check_page import DETAIL, OUT_DIR, clean, detail, toc_lines

ROOT = Path(__file__).resolve().parents[1]
SELECTED = ROOT / "data" / "processed" / "d1_selected.csv"
DRAFT = ROOT / "data" / "processed" / "keyword_tags_draft.json"
BUNDLE_DIR = OUT_DIR / "d3_bundles"
N_BATCHES = 4
TOC_LINES = 60


def load_selected() -> list[dict]:
    with SELECTED.open(encoding="utf-8-sig", newline="") as f:
        return list(csv.DictReader(f))


def load_keywords() -> dict[str, list[str]]:
    draft = json.loads(DRAFT.read_text(encoding="utf-8"))
    return {isbn: list(v.get("keywords") or []) for isbn, v in draft.items() if v.get("status") == "picked"}


def make_book(row: dict, keywords: dict[str, list[str]]) -> dict:
    isbn = row["isbn"]
    has_file = (DETAIL / f"{isbn}.json").exists()
    content = (detail(isbn).get("contentDetail") or {}) if has_file else {}
    intro = re.sub(r"\s+", " ", clean(content.get("bookIntroduction") or "")).strip()
    toc = toc_lines(content.get("tableOfContents") or "", n=TOC_LINES)
    return {
        "isbn": isbn,
        "entry": row["entry"],
        "slot": row["slot"],
        "title": row["title"],
        "author": row["author"],
        "pages": int(row["pages"]) if (row["pages"] or "").strip().isdigit() else None,
        "intro": intro,
        "toc": toc,
        "keywords": keywords.get(isbn, []) if row["entry"] == "target" else [],
        "missing_detail": not has_file or (not intro and not toc),
    }


def deal(books: list[dict], n: int) -> list[list[dict]]:
    ordered = sorted(books, key=lambda b: (b["entry"], b["slot"], b["isbn"]))
    return [ordered[i::n] for i in range(n)]


def main() -> None:
    keywords = load_keywords()
    books = [make_book(r, keywords) for r in load_selected()]
    batches = deal(books, N_BATCHES)
    BUNDLE_DIR.mkdir(parents=True, exist_ok=True)
    for i, batch in enumerate(batches, start=1):
        path = BUNDLE_DIR / f"batch_{i}.json"
        path.write_text(json.dumps(batch, ensure_ascii=False, indent=1), encoding="utf-8")
        leaf = sum(b["entry"] == "leaf" for b in batch)
        print(f"batch_{i}: {len(batch)} books · leaf {leaf} / target {len(batch) - leaf} "
              f"· missing_detail {sum(b['missing_detail'] for b in batch)}")
    missing = [b for b in books if b["missing_detail"]]
    print(f"total: {len(books)} books · missing_detail {len(missing)}")
    for b in missing:
        print(f"  missing: {b['isbn']} [{b['entry']}] {b['title']}")


if __name__ == "__main__":
    main()
