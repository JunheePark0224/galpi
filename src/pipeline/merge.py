"""Today's additions file (design 2-1 "merge"): data/processed/additions/YYYY-MM-DD.json.

Our tags only — ISBN, title, author, pages, link, tags, one-liner, evidence, confidence, the second pass's opinion and why a
book was flagged / held, and for a 🎯 book the short name of a keyword missing from its topic's list (`keyword_candidate`,
pipeline/keyword_candidates.py; null when none). No YES24 intro or TOC (YES24 terms). `npm run books:import` then appends the picked books to
web/src/data/books.json (web/src/lib/books/additions.ts) — the same path the 10-01 pilot file takes.
"""
import json
import re
from pathlib import Path

from apply_review import FIELD_OF_TOPIC

from .candidates import Candidate
from .checks import scrub

NOTE = ("Daily pipeline: pass A (model) tags, pass B (second_model) checks blind. Our tags only — no YES24 intro/TOC. "
        "auto=ai-agree: both passes agreed, accepted without human review (not in the agreement figures).")


def keyword_hints(cand: Candidate, kept: dict[str, dict]) -> list[str]:
    """The topic's keywords whose word pattern appears in the title, intro or TOC (a hint for the tagger, kept as
    `keywords_regex` like the pilot)."""
    text = f"{cand.title} {cand.intro} {cand.toc}"
    return [k for k, v in kept.items() if re.search(v["pattern"], text, re.I)]


def record(cand: Candidate, a: dict, b: dict, flags: list[str], issues: list[str], status: str, auto: str | None,
           hints: list[str]) -> dict:
    if not cand.author.strip() or cand.pages <= 0:  # books:import rejects such a book for the whole run — never write one
        raise ValueError(f"{cand.isbn}: a book needs an author and a page count")
    a, b = scrub(a, b, issues)  # a field that copied the YES24 text is stored blank, only its issue flag stays
    out = {"isbn": cand.isbn, "title": cand.title, "author": cand.author, "pages": cand.pages, "entry": cand.entry}
    if cand.entry == "target":
        out |= {"topic": cand.slot, "field": FIELD_OF_TOPIC[cand.slot], "keywords": a["keywords"],
                "keywords_regex": hints, "way": a["way"], "keyword_candidate": a.get("keyword_candidate"),
                "one_liner_style": "summary"}
        second = {k: b[k] for k in ("fits", "keywords", "way", "why")}
    else:
        out |= {"genre": cand.slot, "axes": a["axes"], "one_liner_style": "question"}
        second = {k: b[k] for k in ("fits", "axes", "why")}
    out |= {"one_liner": a["one_liner"], "evidence": a["evidence"], "confidence": a["confidence"], "fits": a["fits"],
            "second": second, "flags": flags, "issues": issues, "status": status, "link": cand.link}
    return out | ({"auto": auto} if auto else {})


def additions_doc(date: str, model: str, second_model: str, books: list[dict]) -> dict:
    return {"date": date, "batch": "daily", "reviewed": False, "model": model, "second_model": second_model,
            "note": NOTE, "books": books}


def write_doc(path: Path, doc: dict) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(doc, ensure_ascii=False, indent=1) + "\n", encoding="utf-8", newline="")
