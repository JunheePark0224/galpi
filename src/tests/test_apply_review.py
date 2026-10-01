"""Tests for applying a review to an additions file (src/apply_review.py), in memory."""
import sys
from pathlib import Path

import pytest

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from apply_review import (ReviewError, apply_answers, line_warnings, unwrap,  # noqa: E402
                          upsert_row)

KEPT = {"돈 관리·투자": {"주식": {}, "ETF·펀드": {}}, "경제 상식": {"금리·환율": {}}}


def book(isbn: str, **over) -> dict:
    return {"isbn": isbn, "title": f"책 {isbn}", "author": "가 저", "pages": 200, "entry": "target",
            "topic": "돈 관리·투자", "field": "돈·경제", "keywords": ["주식"], "way": "개념",
            "one_liner": "주식 투자의 기본 원칙을 쉽게 알려줘요", "one_liner_style": "summary",
            "evidence": "x", "confidence": 0.8, "status": "picked", **over}


DOC = {"date": "2026-10-01", "batch": "pilot", "reviewed": False,
       "books": [book("1"), book("2"), book("3"), book("4", status="reserve")]}


def ans(b: dict, **over) -> dict:
    return {"topic": b["topic"], "keywords": b["keywords"], "way": b["way"], "one_liner": b["one_liner"],
            "status": b["status"], "ok": True, **over}


def test_unchanged_answers_give_full_agreement_and_keep_the_draft():
    answers = {b["isbn"]: ans(b) for b in DOC["books"][:3]}
    new, stats = apply_answers(DOC, answers, KEPT)
    assert stats == {"date": "2026-10-01", "batch": "pilot", "n": 3, "topic": 100.0, "keywords": 100.0,
                     "way": 100.0, "one_liner": 100.0, "dropped": 0}
    assert new["reviewed"] is True
    assert new["books"][0]["draft"]["keywords"] == ["주식"]
    assert "draft" not in DOC["books"][0] and DOC["reviewed"] is False  # input not mutated


def test_changes_count_per_field_and_move_the_field_with_the_topic():
    b1, b2 = DOC["books"][0], DOC["books"][1]
    answers = {"1": ans(b1, topic="경제 상식", keywords=["금리·환율"]),
               "2": ans(b2, keywords=["주식", "ETF·펀드"], way="실습", one_liner="다른 한 줄로 바꿨어요 정말로요")}
    new, stats = apply_answers(DOC, answers, KEPT)
    assert stats["n"] == 2 and stats["topic"] == 50.0 and stats["keywords"] == 0.0
    assert stats["way"] == 50.0 and stats["one_liner"] == 50.0
    assert new["books"][0]["topic"] == "경제 상식" and new["books"][0]["field"] == "돈·경제"
    assert new["reviewed"] is False  # book 3 has no answer yet


def test_keyword_order_does_not_count_as_a_change():
    b = book("9", keywords=["주식", "ETF·펀드"])
    _, stats = apply_answers({"date": "d", "batch": "b", "books": [b]},
                             {"9": ans(b, keywords=["ETF·펀드", "주식"])}, KEPT)
    assert stats["keywords"] == 100.0


def test_dropped_books_are_counted_apart_and_a_reserve_can_come_in():
    b1, b4 = DOC["books"][0], DOC["books"][3]
    new, stats = apply_answers(DOC, {"1": ans(b1, status="dropped"), "4": ans(b4, status="picked")}, KEPT)
    assert stats["dropped"] == 1 and stats["n"] == 1
    assert [b["status"] for b in new["books"]] == ["dropped", "picked", "picked", "picked"]


def test_applying_the_same_review_twice_compares_with_the_first_draft():
    b1 = DOC["books"][0]
    answers = {"1": ans(b1, way="사례")}
    once, s1 = apply_answers(DOC, answers, KEPT)
    twice, s2 = apply_answers(once, answers, KEPT)
    assert s1 == s2 and twice["books"][0]["draft"]["way"] == "개념"


@pytest.mark.parametrize("over, msg", [
    ({"topic": "요리"}, "unknown topic"),
    ({"keywords": ["금리·환율"]}, "not in 돈 관리·투자"),
    ({"way": "기타"}, "way must be"),
    ({"one_liner": "  "}, "one_liner is empty"),
    ({"status": "maybe"}, "unknown status"),
])
def test_bad_answers_are_refused(over, msg):
    with pytest.raises(ReviewError, match=msg):
        apply_answers(DOC, {"1": ans(DOC["books"][0], **over)}, KEPT)


def test_unwrap_keeps_only_confirmed_answers():
    raw = {"saved_at": "t", "answers": {"1": {"ok": True, "way": "개념"}, "2": {"ok": False}, "3": "x"}}
    assert list(unwrap(raw)) == ["1"]


def test_upsert_replaces_the_row_of_the_same_batch():
    stats = {"date": "2026-10-01", "batch": "pilot", "n": 3, "topic": 100.0, "keywords": None,
             "way": 90.0, "one_liner": 80.0, "dropped": 0}
    rows = upsert_row([{"date": "2026-10-01", "batch": "pilot", "n": "1"}, {"date": "x", "batch": "y"}], stats)
    assert [r["date"] for r in rows] == ["x", "2026-10-01"]
    assert rows[-1]["keywords"] == "" and rows[-1]["n"] == "3"


def test_line_warnings_flag_length_and_question_marks_only_for_picked_books():
    doc = {"books": [book("1", one_liner="짧아요"), book("2", one_liner="주식 투자의 기본 원칙을 알려줄까요?"),
                     book("3", status="dropped", one_liner="짧아요")]}
    warnings = line_warnings(doc)
    assert len(warnings) == 2 and "짧음" in warnings[0] and "물음표" in warnings[1]
