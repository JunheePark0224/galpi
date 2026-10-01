"""Tests for applying a review to an additions file (src/apply_review.py), in memory."""
import sys
from pathlib import Path

import pytest

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from apply_review import (CSV_HEAD, ReviewError, apply_answers, line_warnings, unwrap,  # noqa: E402
                          upsert_row)
from build_pilot_review import add_second_opinion, flag_reasons  # noqa: E402

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
                     "way": 100.0, "one_liner": 100.0, "dropped": 0, "auto_agreed": 0}
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
             "way": 90.0, "one_liner": 80.0, "dropped": 0, "auto_agreed": 50}
    rows = upsert_row([{"date": "2026-10-01", "batch": "pilot", "n": "1"}, {"date": "x", "batch": "y"}], stats)
    assert [r["date"] for r in rows] == ["x", "2026-10-01"]
    assert rows[-1]["keywords"] == "" and rows[-1]["n"] == "3" and rows[-1]["auto_agreed"] == "50"


def test_csv_keeps_the_old_columns_and_adds_auto_agreed_last():
    assert CSV_HEAD[:8] == ["date", "batch", "n", "topic", "keywords", "way", "one_liner", "dropped"]
    assert CSV_HEAD[-1] == "auto_agreed"
    old_stats = {"date": "d", "batch": "b", "n": 1, "topic": 1.0, "keywords": 1.0, "way": 1.0, "one_liner": 1.0, "dropped": 0}
    assert upsert_row([], old_stats)[0]["auto_agreed"] == ""  # stats from before the column existed still fit


def auto(b: dict, **over) -> dict:
    return ans(b, auto="ai-agree", **over)


def test_auto_accepted_books_are_not_in_the_agreement_and_are_not_human_reviewed():
    b1, b2, b3 = DOC["books"][:3]
    new, stats = apply_answers(DOC, {"1": ans(b1, way="사례"), "2": auto(b2), "3": auto(b3)}, KEPT)
    assert stats["n"] == 1 and stats["way"] == 0.0 and stats["topic"] == 100.0  # only the human-reviewed book counts
    assert stats["auto_agreed"] == 2
    assert [b.get("reviewed") for b in new["books"][:3]] == [True, False, False]
    assert new["books"][1]["auto"] == "ai-agree" and "auto" not in new["books"][0]
    assert new["reviewed"] is False and new["auto_accepted"] == 2  # a file with auto books is not "fully human reviewed"
    assert new["books"][1]["draft"]["keywords"] == ["주식"] and new["books"][1]["status"] == "picked"


def test_all_auto_gives_no_agreement_figure_instead_of_a_fake_one():
    _, stats = apply_answers(DOC, {"1": auto(DOC["books"][0])}, KEPT)
    assert stats["n"] == 0 and stats["topic"] is None and stats["auto_agreed"] == 1


def test_a_human_answer_replaces_an_earlier_auto_mark_and_is_never_overwritten_by_one():
    b1 = DOC["books"][0]
    once, _ = apply_answers(DOC, {"1": auto(b1)}, KEPT)
    human, stats = apply_answers(once, {"1": ans(b1, way="실습")}, KEPT)
    assert "auto" not in human["books"][0] and human["books"][0]["reviewed"] is True
    assert stats["n"] == 1 and stats["auto_agreed"] == 0 and human["books"][0]["draft"]["way"] == "개념"
    again, stats2 = apply_answers(human, {"1": auto(b1)}, KEPT)  # a stale auto answer must not undo the human one
    assert again["books"][0]["way"] == "실습" and again["books"][0]["reviewed"] is True and stats2["auto_agreed"] == 0


def test_applying_the_same_auto_review_twice_changes_nothing():
    answers = {"1": auto(DOC["books"][0]), "2": ans(DOC["books"][1])}
    once, s1 = apply_answers(DOC, answers, KEPT)
    twice, s2 = apply_answers(once, answers, KEPT)
    assert once == twice and s1 == s2


@pytest.mark.parametrize("over, msg", [({"auto": "maybe"}, "unknown auto mark"),
                                       ({"auto": "ai-agree", "status": "dropped"}, "must stay picked")])
def test_bad_auto_answers_are_refused(over, msg):
    with pytest.raises(ReviewError, match=msg):
        apply_answers(DOC, {"1": {**ans(DOC["books"][0]), **over}}, KEPT)


AI2 = {"keywords": ["주식"], "way": "개념", "topic_fit": "fits", "note": "x"}


def test_flag_reasons_name_each_way_the_two_taggers_can_differ():
    b = book("1", confidence=0.8)
    assert flag_reasons(b, AI2) == []
    assert flag_reasons(b, {**AI2, "keywords": []}) == ["keywords"]
    assert flag_reasons(book("1", keywords=["주식", "ETF·펀드"]), {**AI2, "keywords": ["ETF·펀드", "주식"]}) == []  # order is not a difference
    assert flag_reasons(b, {**AI2, "way": "실습"}) == ["way"]
    assert flag_reasons(b, {**AI2, "topic_fit": "doubtful"}) == ["topic"]
    assert flag_reasons(book("1", confidence=0.69), AI2) == ["confidence"]
    assert flag_reasons(book("1", confidence=0.7), AI2) == []
    assert flag_reasons(book("1", confidence=None), AI2) == ["confidence"]
    assert flag_reasons(book("1", confidence=0.5), {**AI2, "keywords": [], "way": "사례"}) == ["keywords", "way", "confidence"]


def test_second_opinion_attaches_flags_to_picked_books_only_and_drops_text_nobody_must_read():
    entries = [{**book("1", confidence=0.9), "intro": "i", "intro_full": "f", "toc": "t"},
               {**book("2", confidence=0.9), "intro": "i", "intro_full": "f", "toc": "t"},
               {**book("4", status="reserve"), "intro": "i", "intro_full": "f", "toc": "t"}]
    out = add_second_opinion(entries, {"1": AI2, "2": {**AI2, "way": "실습"}})
    assert [e["flags"] for e in out] == [[], ["way"], []]
    assert out[0]["intro"] == "" and out[1]["intro"] == "i" and out[2]["ai2"] is None
    assert out[1]["ai2"]["way"] == "실습" and "keywords" in out[1]["ai2"]
    with pytest.raises(SystemExit, match="AI-2 has no tags"):
        add_second_opinion(entries, {"1": AI2})


def test_line_warnings_flag_length_and_question_marks_only_for_picked_books():
    doc = {"books": [book("1", one_liner="짧아요"), book("2", one_liner="주식 투자의 기본 원칙을 알려줄까요?"),
                     book("3", status="dropped", one_liner="짧아요")]}
    warnings = line_warnings(doc)
    assert len(warnings) == 2 and "짧음" in warnings[0] and "물음표" in warnings[1]
