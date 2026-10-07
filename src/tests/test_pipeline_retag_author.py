"""Pipeline: re-tag the 한국 / 외국 소설 books now that the tagger reads the author line (src/pipeline/retag_author.py)."""
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from test_pipeline_library_review import AX, leaf_book  # noqa: E402

from pipeline import retag_author  # noqa: E402


def book(isbn, slot="에세이", a_suggest="", b_suggest=""):
    b = leaf_book(isbn, b_fits=not b_suggest, b_suggest=b_suggest)
    b["slot"] = b["current"]["genre"] = b["record"]["genre"] = slot
    b["record"] |= {"suggest": a_suggest, "fits": not a_suggest}
    return b


def test_targets_are_books_a_slot_or_any_pass_puts_in_korean_or_foreign_fiction_never_an_answered_one():
    books = [book("1", "한국 소설"), book("2", "외국 소설"), book("3", a_suggest="한국 소설"),
             book("4", b_suggest="외국 소설"), book("5"), book("6", "SF·판타지", b_suggest="SF·판타지"),
             book("7"), book("8", "한국 소설")]
    tb = {"7": {"third": {"fits": False, "suggest": "외국 소설"}}, "5": {"third": None}}
    assert retag_author.targets(books, tb, answered={"8"}) == ["1", "2", "3", "4", "7"]


def test_merge_keeps_the_earlier_answer_and_its_tiebreak_row_and_an_older_v3_answer():
    old, plain = book("1", "한국 소설"), book("2")
    old |= {"rules_version": "v3.1", "retag_reasons": ["fiction"], "v3": {"record": {"genre": "x"}}}
    fresh = book("3", "외국 소설")  # never re-tagged before: no v3 yet
    doc = {"books": [old, plain, fresh]}
    tb = {"books": {"1": {"third": {"axes": AX}}, "2": {"third": None}}}
    new1, new3 = book("1", "외국 소설"), book("3", "외국 소설")
    doc2, tb2 = retag_author.merge(doc, tb, [new1, new3])
    one, three = doc2["books"][0], doc2["books"][2]
    assert one["record"] == new1["record"] and one["v3"] == {"record": {"genre": "x"}}
    assert one["before_author"] == {"record": old["record"], "tiebreak": {"third": {"axes": AX}}}
    assert one["retag_reasons"] == ["fiction", "author"] and one["rules_version"] == "v3.1"
    assert three["v3"] == {"record": fresh["record"]} and "before_author" not in three
    assert three["retag_reasons"] == ["author"]
    assert doc2["books"][1] == plain and tb2["books"] == {"2": {"third": None}} and "1" in tb["books"]
