"""Tests for the D3 merge (src/build_books_v1.py) using tiny in-memory fixtures."""
import sys
from pathlib import Path

import pytest

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from build_books_v1 import (COLUMNS, MissingTagsError, build_report, merge_books,  # noqa: E402
                            unwrap_review)

SELECTED = [
    {"isbn": "L1", "entry": "leaf", "slot": "한국 소설", "title": "모순", "pages": "308"},
    {"isbn": "T1", "entry": "target", "slot": "통계", "title": "통계 입문", "pages": "250"},
    {"isbn": "T2", "entry": "target", "slot": "업무 자동화", "title": "자동화", "pages": ""},
    {"isbn": "T3", "entry": "target", "slot": "시간·생산성", "title": "시간", "pages": "300"},
]
KEYWORDS = {"T1": ["회귀"], "T2": ["엑셀"]}
AI = {
    "L1": {"entry": "leaf", "axes": {"temp": 1, "pull": -1, "gain": 0, "world": 1},
           "one_liner": "평범한 하루가 무너지면, 사람은 무엇을 붙잡을까요?",
           "one_liner_style": "question", "evidence": "x"},
    "T1": {"entry": "target", "way": "개념", "one_liner": "통계의 기본 원리를 쉽게 알려줘요",
           "one_liner_style": "summary", "evidence": "x"},
    "T2": {"entry": "target", "way": "실습", "one_liner": "엑셀 반복 작업을 자동화하는 법을 알려줘요",
           "one_liner_style": "summary", "evidence": "x"},
    "T3": {"entry": "target", "way": "사례", "one_liner": "시간을 다루는 사례를 보여줘요",
           "one_liner_style": "summary", "evidence": "x"},
}


def by_isbn(books: list[dict]) -> dict[str, dict]:
    return {b["isbn"]: b for b in books}


def test_leaf_columns():
    books, problems = merge_books(SELECTED, KEYWORDS, AI)
    leaf = by_isbn(books)["L1"]
    assert problems == {}
    assert tuple(leaf) == COLUMNS
    assert leaf["field"] is None and leaf["topic"] is None and leaf["way"] is None
    assert leaf["genre"] == "한국 소설" == leaf["slot"]
    assert leaf["keywords"] == []
    assert leaf["axes"] == {"temp": 1, "pull": -1, "gain": 0, "world": 1}
    assert leaf["pages"] == 308 and leaf["one_liner_style"] == "question"


def test_target_columns_and_field_mapping():
    books = by_isbn(merge_books(SELECTED, KEYWORDS, AI)[0])
    t1, t2, t3 = books["T1"], books["T2"], books["T3"]
    assert (t1["field"], t2["field"], t3["field"]) == ("데이터·통계", "AI·IT 활용", "습관·자기계발")
    assert t1["topic"] == "통계" == t1["genre"] == t1["slot"]
    assert t1["axes"] is None and t1["way"] == "개념" and t1["keywords"] == ["회귀"]
    assert t3["keywords"] == []          # no picked keywords -> empty list
    assert t2["pages"] is None           # blank pages stay null


def test_override_applies_only_when_ok():
    overrides = {
        "L1": {"axes": {"temp": -1}, "one_liner": " 다른 질문이 생기면, 무엇을 할까요? ", "ok": True},
        "T1": {"way": "실습", "ok": False},
        "T2": {"way": "사례", "axes": {"temp": 1}, "ok": True},
    }
    books = by_isbn(merge_books(SELECTED, KEYWORDS, AI, overrides)[0])
    assert books["L1"]["axes"] == {"temp": -1, "pull": -1, "gain": 0, "world": 1}
    assert books["L1"]["one_liner"] == "다른 질문이 생기면, 무엇을 할까요?"
    assert books["T1"]["way"] == "개념"              # ok=False ignored
    assert books["T2"]["way"] == "사례" and books["T2"]["axes"] is None  # target ignores axes
    assert AI["L1"]["axes"]["temp"] == 1             # inputs are not mutated


def test_unwrap_review_accepts_both_shapes():
    inner = {"L1": {"ok": True}}
    assert unwrap_review({"saved_at": "x", "answers": inner}) == inner
    assert unwrap_review(inner) == inner


def test_missing_tag_raises_in_strict_mode():
    ai = {k: v for k, v in AI.items() if k != "T2"}
    with pytest.raises(MissingTagsError) as err:
        merge_books(SELECTED, KEYWORDS, ai)
    assert list(err.value.problems) == ["T2"]


def test_incomplete_tags_reported_when_not_strict():
    ai = {**AI, "L1": {**AI["L1"], "axes": {"temp": 1}},
          "T1": {**AI["T1"], "way": "기타"}, "T3": {**AI["T3"], "one_liner": ""}}
    books, problems = merge_books(SELECTED, KEYWORDS, ai, strict=False)
    assert set(problems) == {"L1", "T1", "T3"}
    assert [b["isbn"] for b in books] == ["T2"]


def test_override_can_repair_missing_tag():
    ai = {k: v for k, v in AI.items() if k != "T1"}
    ov = {"T1": {"way": "개념", "one_liner": "통계의 기본 원리를 쉽게 알려줘요", "ok": True}}
    books, problems = merge_books(SELECTED, KEYWORDS, ai, ov)
    assert problems == {} and by_isbn(books)["T1"]["way"] == "개념"


def test_report_flags_and_distributions():
    ai = {**AI, "L1": {**AI["L1"], "axes": {a: 0 for a in ("temp", "pull", "gain", "world")}}}
    books, problems = merge_books(SELECTED, KEYWORDS, ai)
    titles = {r["isbn"]: r["title"] for r in SELECTED}
    materials = {"L1": "평범한 하루 무너지면 사람 붙잡을까", "T1": "통계 기본 원리", "T2": "엑셀 반복 자동화",
                 "T3": "시간 사례"}
    rep = build_report(books, titles, materials, {"T3": "확인 필요"}, {"T2"}, problems, expected=4)
    flags = {f["isbn"]: f["reasons"] for f in rep["flags"]}
    assert any("모두 0" in r for r in flags["L1"])
    assert any("D1 check" in r for r in flags["T3"])
    assert any("missing_detail" in r for r in flags["T2"])
    assert rep["counts"] == {"expected": 4, "complete": 4, "leaf": 1, "target": 3, "missing_tags": 0}
    assert rep["target_way"]["counts"] == {"개념": 1, "실습": 1, "사례": 1}
    assert rep["target_way"]["pass"] is True
    assert rep["leaf_axes"]["temp"]["pass"] is False


def test_report_flags_low_confidence():
    books, problems = merge_books(SELECTED, KEYWORDS, AI)
    titles = {r["isbn"]: r["title"] for r in SELECTED}
    rep = build_report(books, titles, {}, {}, set(), problems, expected=4,
                       low_confidence={"T1": "개념/실습 애매", "ZZ": "not in selection"})
    flags = {f["isbn"]: f["reasons"] for f in rep["flags"]}
    assert "AI 확신 낮음: 개념/실습 애매" in flags["T1"] and "ZZ" not in flags
