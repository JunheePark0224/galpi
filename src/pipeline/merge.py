"""Today's additions file (design 2-1 "merge"): data/processed/additions/YYYY-MM-DD.json.

Our tags only — ISBN, title, author, pages, link, tags, one-liner, evidence, confidence, for a 🍃 book each pass's signal line
per axis and the axes it found no info for (10-06), the second pass's opinion and why a
book was flagged / held, and for a 🎯 book the short name of a keyword missing from its topic's list (`keyword_candidate`,
pipeline/keyword_candidates.py; null when none), and the slot each pass names for a book it says does not fit
(`suggest`, a 🎯 one with `suggest_keywords`; "" when none — 10-06). A 🍃 axis may be null (no info, always flagged, so
such a book waits for a person and never reaches books.json as is). No YES24 intro or TOC (YES24 terms). `npm run books:import` then appends the picked books to
web/src/data/books.json (web/src/lib/books/additions.ts) — the same path the 10-01 pilot file takes.
"""
import json
import re
from pathlib import Path

from apply_review import FIELD_OF_TOPIC

from .candidates import Candidate
from .prompt import MAX_KEYWORDS
from .checks import crossed_to, moved_to, scrub

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
    moved = moved_to(a, b, cand.entry)  # 10-08: both passes place it in another slot — written there, the old one kept
    slot = moved or cand.slot
    out = {"isbn": cand.isbn, "title": cand.title, "author": cand.author, "pages": cand.pages, "entry": cand.entry}
    if cand.entry == "target":
        keywords = moved_keywords(a, b) if moved else a["keywords"]
        out |= {"topic": slot, "field": FIELD_OF_TOPIC[slot], "keywords": keywords,
                "keywords_regex": hints, "way": a["way"], "keyword_candidate": a.get("keyword_candidate"),
                "suggest": a.get("suggest", ""), "suggest_keywords": a.get("suggest_keywords", []),
                "one_liner_style": "summary"}
        second = {k: b[k] for k in ("fits", "keywords", "way", "why")} | {
            "suggest": b.get("suggest", ""), "suggest_keywords": b.get("suggest_keywords", [])}
    else:
        out |= {"genre": slot, "axes": a["axes"], "signals": a.get("signals", {}), "missing": a.get("missing", []),
                "suggest": a.get("suggest", ""), "one_liner_style": "question"}
        second = {"fits": b["fits"], "axes": b["axes"], "signals": b.get("signals", {}), "missing": b.get("missing", []),
                  "suggest": b.get("suggest", ""), "why": b["why"]}
    out |= {"one_liner": a["one_liner"], "evidence": a["evidence"], "confidence": a["confidence"], "fits": a["fits"],
            "second": second, "flags": flags, "issues": issues, "status": status, "link": cand.link}
    out |= {"moved_from": cand.slot} if moved else {}
    crossed = crossed_to(cand.entry, a, b) if status == "dropped" else None  # run_daily requeues it (tagged there next)
    out |= {"requeued_to": crossed} if crossed else {}
    return out | ({"auto": auto} if auto else {})


def moved_keywords(a: dict, b: dict) -> list[str]:
    """A 🎯 book moved to another topic: the keywords both passes gave there (pass A's order, at most MAX_KEYWORDS) —
    empty when they share none (run_daily then flags "keywords" for a person)."""
    common = [k for k in a.get("suggest_keywords") or [] if k in (b.get("suggest_keywords") or [])]
    return common[:MAX_KEYWORDS]


def additions_doc(date: str, model: str, second_model: str, books: list[dict], batch_id: str | None = None) -> dict:
    """`date` = the calendar day; `batch_id` = the file's key (the day, or `<day>-N` for a later run that day —
    pipeline/batch.py). `batch` stays "daily": it is the kind of file, not its id."""
    return {"date": date, "batch_id": batch_id or date, "batch": "daily", "reviewed": False, "model": model,
            "second_model": second_model, "note": NOTE, "books": books}


def write_doc(path: Path, doc: dict) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(doc, ensure_ascii=False, indent=1) + "\n", encoding="utf-8", newline="")
