"""Backfill of keywords put back on the list (10-02): proposals by the word rule, then a person's choices applied
(src/backfill_keywords.py)."""
import sys
from pathlib import Path

import pytest

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from backfill_keywords import BackfillError, apply_choices, proposals  # noqa: E402

PATTERNS = {"데이터 분석": {"엑셀": "엑셀|Excel|피벗", "파이썬": "파이썬|판다스"}, "AI 활용": {"LLM 원리": "LLM|트랜스포머"}}
BOOKS = [
    {"isbn": "1", "entry": "target", "topic": "데이터 분석", "title": "엑셀 데이터 분석 바이블", "keywords": ["SQL"]},
    {"isbn": "2", "entry": "target", "topic": "데이터 분석", "title": "데이터 읽기", "keywords": []},
    {"isbn": "3", "entry": "target", "topic": "데이터 분석", "title": "판다스 입문", "keywords": ["파이썬"]},
    {"isbn": "4", "entry": "target", "topic": "업무 자동화", "title": "엑셀 매크로", "keywords": []},
    {"isbn": "5", "entry": "target", "topic": "AI 활용", "title": "챗GPT 쓰기", "keywords": []},
    {"isbn": "6", "entry": "leaf", "topic": None, "title": "엑셀 소설", "keywords": []},
]
MATERIAL = {"2": "피벗 테이블로 요약하는 법", "5": "트랜스포머 구조도 간단히 다룬다", "4": "엑셀"}


def test_proposes_a_new_keyword_where_its_word_rule_matches_title_or_material():
    got = proposals(BOOKS, PATTERNS, MATERIAL)
    assert [(p["isbn"], p["keyword"], p["where"], p["word"]) for p in got] == [
        ("1", "엑셀", "제목", "엑셀"), ("2", "엑셀", "소개·목차", "피벗"), ("5", "LLM 원리", "소개·목차", "트랜스포머"),
    ]


def test_never_proposes_across_topics_a_keyword_the_book_has_or_for_leaf_books():
    isbns = {p["isbn"] for p in proposals(BOOKS, PATTERNS, MATERIAL)}
    assert "4" not in isbns    # 엑셀 belongs to 데이터 분석, not 업무 자동화
    assert "3" not in isbns    # already 파이썬
    assert "6" not in isbns    # 🍃 books have no keywords


def test_keeps_only_the_matched_word_never_the_yes24_text():
    got = proposals(BOOKS, PATTERNS, MATERIAL)
    assert all("요약하는" not in str(p) and "구조도" not in str(p) for p in got)


def test_applies_chosen_keywords_to_the_source_rows_without_touching_others():
    rows = [{"isbn": "1", "keywords": ["SQL"]}, {"isbn": "2", "keywords": []}, {"isbn": "9", "keywords": ["x"]}]
    out, changed = apply_choices(rows, {"1": ["엑셀"], "2": ["엑셀", "엑셀"]}, PATTERNS["데이터 분석"].keys() | {"SQL"})
    assert out == [{"isbn": "1", "keywords": ["SQL", "엑셀"]}, {"isbn": "2", "keywords": ["엑셀"]}, {"isbn": "9", "keywords": ["x"]}]
    assert changed == {"1", "2"}
    assert rows[0]["keywords"] == ["SQL"]          # the input is not changed


def test_refuses_a_keyword_that_is_not_on_the_list():
    with pytest.raises(BackfillError, match="not on the keyword list"):
        apply_choices([{"isbn": "1", "keywords": []}], {"1": ["R"]}, {"엑셀"})
