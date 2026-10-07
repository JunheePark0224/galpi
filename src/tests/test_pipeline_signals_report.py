"""Pipeline: before → after figures of a re-tagged batch (src/pipeline/signals_report.py)."""
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from pipeline.signals_report import gold_agreement, nonfiction_temp, questions, report, splits  # noqa: E402

AX = {"temp": 1, "pull": -1, "gain": 1, "world": 1}


def leaf(isbn, genre="사회·시사", axes=AX, second=AX, **over):
    return {"isbn": isbn, "entry": "leaf", "genre": genre, "axes": dict(axes), "fits": True, "status": "picked",
            "second": {"fits": True, "axes": dict(second)}, "flags": [], "issues": [], **over}


def target(isbn, **over):
    return {"isbn": isbn, "entry": "target", "topic": "리더십", "keywords": ["팀 이끌기"], "way": "개념", "fits": True,
            "status": "picked", "second": {"fits": False, "keywords": ["팀 이끌기"], "way": "사례"}, "flags": ["fits", "way"],
            "issues": [], **over}


def test_splits_count_each_axis_over_the_leaf_books():
    books = [leaf("1", second={**AX, "temp": 0}), leaf("2"), target("3")]
    assert splits(books) == {"temp": (1, 2), "pull": (0, 2), "gain": (0, 2), "world": (0, 2)}


def test_gold_agreement_per_pass_and_field_with_the_slot_kept_or_not():
    books = {"1": leaf("1", second={**AX, "gain": -1}), "3": target("3")}
    gold = {"1": {"genre": "사회·시사", "axes": AX, "status": "picked"},
            "3": {"topic": "취업·커리어", "keywords": [], "way": "개념", "status": "picked"},
            "9": {"genre": "시", "axes": AX, "status": "picked"}}                    # not in the file: skipped
    one, two = gold_agreement(books, gold, 1), gold_agreement(books, gold, 2)
    assert one["gain"] == (1, 1) and two["gain"] == (0, 1)
    assert one["slot"] == (1, 2) and two["slot"] == (2, 2)   # the person moved book 3: only AI-2 said it does not fit
    assert one["way"] == (1, 1) and two["way"] == (0, 1) and one["keywords"] == (0, 1)


def test_questions_ignore_notes_and_old_confidence_flags():
    books = [leaf("1", flags=["temp", "confidence"], issues=["근거 김(33자)"]), leaf("2", flags=["confidence"]),
             target("3", issues=["짧음(5자)"])]
    assert questions(books) == {"books": 3, "asked": 2, "leaf": 2, "leaf_axis_asked": 1, "questions": 1 + 3}


def test_nonfiction_temp_leaves_fiction_out_and_the_report_has_every_part():
    books = [leaf("1"), leaf("2", genre="한국 소설"), leaf("3", axes={**AX, "temp": 0})]
    assert nonfiction_temp(books) == {1: 1, 0: 1}
    before = {"books": books}
    after = {"retag_of": "b", "books": [leaf("1", missing=["temp"], flags=["temp"]), leaf("3")]}
    text = report(before, after, {"1": {"genre": "사회·시사", "axes": AX, "status": "picked"}})
    for part in ("## A.", "## B.", "## C.", "## D.", "| 온도 |", "비교한 책: 두 파일에 다 있는 2권", "| 1/2 (50%) |"):
        assert part in text, part
