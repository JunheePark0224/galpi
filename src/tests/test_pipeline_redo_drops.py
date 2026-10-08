"""redo_drops: books the pipeline dropped by itself are tagged again and replace their own record."""
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from pipeline import redo_drops  # noqa: E402

DROPPED = {"isbn": "1", "entry": "leaf", "genre": "에세이", "status": "dropped"}


def test_only_books_no_person_decided_are_taken():
    assert redo_drops.taken(DROPPED)
    assert not redo_drops.taken({**DROPPED, "status": "picked"})
    assert not redo_drops.taken({**DROPPED, "reviewed": True})
    assert not redo_drops.taken({**DROPPED, "requeued_to": {"entry": "target", "slot": "마음 돌보기"}})
    assert not redo_drops.taken({**DROPPED, "history": [{"change": "redo-drops-2026-10-08"}]})  # once only


def test_a_redone_book_replaces_its_record_and_a_crossing_one_is_queued():
    doc = {"batch_id": "2026-10-02", "books": [DROPPED, {**DROPPED, "isbn": "2"}, {**DROPPED, "isbn": "3", "status": "picked"}]}
    recs = {"1": {"isbn": "1", "entry": "leaf", "genre": "인문", "status": "picked"},
            "2": {"isbn": "2", "entry": "leaf", "genre": "에세이", "status": "dropped",
                  "requeued_to": {"entry": "target", "slot": "마음 돌보기"}},
            "3": {"isbn": "3", "status": "review"}}
    new, rows = redo_drops.replaced(doc, recs)
    assert new["books"][0]["genre"] == "인문" and new["books"][0]["history"] == [
        {"change": redo_drops.CHANGE, "status": "dropped", "genre": "에세이"}]
    assert new["books"][2] == doc["books"][2]                       # not a dropped book: untouched
    assert rows == [{"isbn": "2", "to_entry": "target", "to_slot": "마음 돌보기", "from_batch": "2026-10-02",
                     "date": redo_drops.TODAY}]
    assert doc["books"][0] == DROPPED                               # the given doc is not changed
    assert redo_drops.replaced(doc, {}) == (doc, [])                # a book whose tagging failed stays as it was
