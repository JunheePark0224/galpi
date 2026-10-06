"""Galpi's library as `npm run books:import` reads it (web/scripts/import-books.ts), for the v3 re-tag
(plans/2026-10-06-calibration.md 5 "서재 전체 다시 태그").

books_v1.json (200 rows; title, author and link from d1_selected.csv) + the picked books of every additions file in file-name
order — only batch files (`YYYY-MM-DD[-N|-pilot].json`): the pilot's second pass (`-ai2`) and experiment copies such as
`<batch>.v2.json` are not library files. For the batches in WHOLE (2026-10-05-2 was still under review when v3 came) every
book that was not dropped counts. Each item carries the book's current values (`current`), which the re-tag compares with.
Our tags, titles and authors only — no YES24 text.
"""
import csv
import io
import re
from pathlib import Path

from . import ROOT

PROCESSED = ROOT / "data" / "processed"
V1 = PROCESSED / "books_v1.json"
D1 = PROCESSED / "d1_selected.csv"
V1_SOURCE = V1.name
WHOLE = ("2026-10-05-2",)
BATCH_FILE = re.compile(r"^\d{4}-\d{2}-\d{2}(-\d+|-pilot)?\.json$")


def bib_of(text: str) -> dict[str, dict]:
    """d1_selected.csv → {isbn: {title, author, link}}."""
    rows = csv.DictReader(io.StringIO(text.lstrip("﻿")))
    return {r["isbn"]: {"title": r["title"], "author": r["author"], "link": r.get("link") or ""} for r in rows}


def library_files(folder: Path) -> list[Path]:
    return sorted(p for p in folder.glob("*.json") if BATCH_FILE.match(p.name))


def values_of(row: dict) -> dict:
    """A row's tags as the re-tag compares them (books_v1 row or additions record)."""
    if row["entry"] == "leaf":
        return {"genre": row.get("genre") or row["slot"], "axes": dict(row.get("axes") or {}), "one_liner": row["one_liner"]}
    return {"topic": row.get("topic") or row["slot"], "keywords": list(row.get("keywords") or []), "way": row.get("way"),
            "one_liner": row["one_liner"]}


def _item(row: dict, source: str, title: str, author: str, link: str, status: str) -> dict:
    cur = values_of(row)
    return {"isbn": row["isbn"], "source": source, "entry": row["entry"],
            "slot": cur["genre"] if row["entry"] == "leaf" else cur["topic"], "title": title, "author": author,
            "pages": row["pages"], "link": link, "status": status, "current": cur}


def library_books(v1_rows: list[dict], bib: dict[str, dict], docs: list[tuple[str, dict]],
                  whole: tuple[str, ...] = WHOLE) -> list[dict]:
    """Every library book in import order. `docs`: (file name, additions doc) in file-name order."""
    out = []
    for r in v1_rows:
        b = bib.get(r["isbn"], {})
        out.append(_item(r, V1_SOURCE, b.get("title", ""), b.get("author", ""), b.get("link", ""), "picked"))
    for name, doc in docs:
        live = Path(name).stem in whole
        for b in doc.get("books") or []:
            if b.get("status") == "picked" or (live and b.get("status") not in (None, "dropped")):
                out.append(_item(b, name, b["title"], b["author"], b.get("link") or "", b["status"]))
    seen: set[str] = set()
    for it in out:
        if it["isbn"] in seen:
            raise ValueError(f"{it['isbn']}: in the library twice")
        seen.add(it["isbn"])
    return out
