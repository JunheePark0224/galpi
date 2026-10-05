"""Requeue: a book fetched for the wrong 갈래 goes back in as the other entry (10-05).

A 🎯 book that is really a 🍃 genre book (『뇌』, fetched for 습관·집중 / 뇌과학, is 과학 교양) — or the other way round —
could only be dropped on the review page, and a dropped ISBN is never offered again. The page's "다른 갈래로 (다시 태그)"
decision sends `status: "requeue"` with the target entry (and for a 🎯 → 🍃 book the genre). `review --apply` keeps the book
out of books.json (it is stored as `dropped` with `requeued_to`) and adds a row to data/pipeline/requeue.json:
  {isbn, to_entry, to_slot, from_batch, date}   to_slot = the 🍃 genre, or the 🎯 topic / null (left to the pipeline)
The next batch takes those ISBNs first: their detail is read again in memory (the same `usable` and page-count rules, no
YES24 text written anywhere), they are tagged as the target entry and slot, and a row leaves the file once its book is
tagged. Only the requeued ISBN skips the "never offered twice" rule, and only through this file.
A 🍃 → 🎯 row without a topic gets the topic whose rules the book matches best (guess_topic: the topic's YES24 title rule
and its keyword word patterns over title + intro + TOC); no match leaves the row waiting and the run summary says so.
"""
import json
import re
from pathlib import Path

from apply_review import FIELD_OF_TOPIC
from collect_candidates import detail, usable
from pick_pilot import clean

from .candidates import INTRO_MAX, TOC_MAX, Candidate, pages_of
from .gaps import GENRES
from .slots import slot_rule

KEYS = ("isbn", "to_entry", "to_slot", "from_batch", "date")


class RequeueError(ValueError):
    """A requeue row or answer that cannot be used (unknown entry, genre or topic)."""


def checked(row: dict) -> dict:
    """The row with its keys in order; raises RequeueError when the target is not one of ours."""
    isbn, entry, slot = str(row.get("isbn") or ""), row.get("to_entry"), row.get("to_slot") or None
    if not isbn.strip():
        raise RequeueError(f"requeue: bad isbn {isbn!r}")
    if entry not in ("leaf", "target"):
        raise RequeueError(f"{isbn}: to_entry must be leaf or target")
    if entry == "leaf" and slot not in GENRES:
        raise RequeueError(f"{isbn}: a 🍃 requeue needs one of our genres, got {slot!r}")
    if entry == "target" and slot is not None and slot not in FIELD_OF_TOPIC:
        raise RequeueError(f"{isbn}: unknown topic {slot!r}")
    return {"isbn": isbn, "to_entry": entry, "to_slot": slot, "from_batch": str(row.get("from_batch") or ""),
            "date": str(row.get("date") or "")}


def load(path: Path) -> list[dict]:
    if not path.exists():
        return []
    rows = json.loads(path.read_text(encoding="utf-8"))
    if not isinstance(rows, list):
        raise RequeueError(f"{path.name} must be a JSON list")
    return [checked(r) for r in rows]


def save(path: Path, rows: list[dict]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps([checked(r) for r in rows], ensure_ascii=False, indent=1) + "\n", encoding="utf-8",
                    newline="")


def added(rows: list[dict], new: list[dict]) -> list[dict]:
    """`rows` with `new` added; a newer row for the same ISBN replaces the older one (the input is not changed)."""
    fresh = {r["isbn"]: checked(r) for r in new}
    return [r for r in rows if r["isbn"] not in fresh] + list(fresh.values())


def without(rows: list[dict], isbns: set[str]) -> list[dict]:
    return [r for r in rows if r["isbn"] not in isbns]


def guess_topic(title: str, text: str, vocab: dict) -> str | None:
    """The 🎯 topic a book fits best by our own rules: 2 points when the topic's YES24 title rule matches the title, 1 per
    keyword of the topic whose word pattern is in title + text. Ties go to the earlier topic; no point → None."""
    best, score = None, 0
    for topic in FIELD_OF_TOPIC:
        rule = slot_rule(topic)
        points = 2 * bool(re.search(rule["inc"], title) and not re.search(rule["exc"], title))
        kept = (vocab.get(topic) or {}).get("kept", {})
        points += sum(bool(re.search(v["pattern"], f"{title} {text}", re.I)) for v in kept.values())
        if points > score:
            best, score = topic, points
    return best


def candidates(env: dict, rows: list[dict], vocab: dict) -> tuple[list[Candidate], dict[str, str]]:
    """(candidates for the requeued books, {isbn: why it waits}). Detail is read like find() reads it (cached raw response,
    text in memory only); a book that is not usable or has no page count waits — it is never offered half-filled."""
    out, waiting = [], {}
    for r in rows:
        d = detail(env, r["isbn"])
        if not usable(d) or pages_of(d) <= 0 or not (d.get("author") or "").strip():
            waiting[r["isbn"]] = "detail_unusable"
            continue
        cd = d.get("contentDetail") or {}
        intro, toc = clean(cd.get("bookIntroduction") or "", INTRO_MAX), clean(cd.get("tableOfContents") or "", TOC_MAX)
        slot = r["to_slot"] or guess_topic(d.get("title") or "", f"{intro} {toc}", vocab)
        if slot is None:
            waiting[r["isbn"]] = "no_topic"
            continue
        out.append(Candidate(r["to_entry"], slot, r["isbn"], d.get("title") or "", d.get("author") or "", pages_of(d),
                             d.get("link") or "", intro, toc))
    return out, waiting
