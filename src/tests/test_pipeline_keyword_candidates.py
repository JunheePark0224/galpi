"""Keyword candidates: counting them over the additions files and the PR section (src/pipeline/keyword_candidates.py)."""
import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from pipeline.keyword_candidates import clean, count, load_docs, normalize, section  # noqa: E402


def book(isbn, name, topic="데이터 분석", status="picked", entry="target"):
    return {"isbn": isbn, "entry": entry, "topic": topic, "status": status, "keyword_candidate": name}


def test_normalize_and_clean():
    assert normalize(" Power  BI ") == "powerbi"
    assert clean("Power BI", "데이터 분석", ["SQL"]) == "Power BI" and clean("sql", "데이터 분석", ["SQL"]) is None


def test_counts_picked_target_books_per_topic_and_name_ignoring_space_and_case():
    docs = [{"books": [book("1", "Power BI"), book("2", "power bi"), book("3", "PowerBI"), book("4", "R"),
                       book("5", "R", topic="통계"), book("6", "R", status="review"), book("7", "R", status="reserve"),
                       book("8", "R", entry="leaf"), book("9", None), book("10", "  ")]},
            {"books": [book("1", "Power BI"), book("11", "power bi")]}]          # the same book twice counts once
    assert count(docs) == [{"topic": "데이터 분석", "name": "power bi", "n": 4}, {"topic": "데이터 분석", "name": "R", "n": 1},
                           {"topic": "통계", "name": "R", "n": 1}]


def test_the_most_common_spelling_names_the_group():
    docs = [{"books": [book("1", "Power BI"), book("2", "Power BI"), book("3", "power bi")]}]
    assert count(docs)[0]["name"] == "Power BI"


def test_load_docs_skips_the_second_tagger_copy_and_files_that_are_not_additions(tmp_path):
    (tmp_path / "2026-10-02.json").write_text(json.dumps({"books": [book("1", "R")]}), encoding="utf-8")
    (tmp_path / "2026-10-01-pilot-ai2.json").write_text(json.dumps({"books": [book("2", "R")]}), encoding="utf-8")
    (tmp_path / "books.json").write_text("[]", encoding="utf-8")
    assert [b["isbn"] for d in load_docs(tmp_path) for b in d["books"]] == ["1"]


def test_section_asks_about_five_or_more_first_then_ten_others_by_count():
    rows = [{"topic": "데이터 분석", "name": "Power BI", "n": 6}, {"topic": "통계", "name": "R", "n": 5},
            *({"topic": "글쓰기", "name": f"이름{i}", "n": 4 - i // 4} for i in range(12))]
    lines = section(rows)
    assert lines[0] == "### 키워드 후보"
    asks = [x for x in lines if x.endswith("**추가할까요?**")]
    assert asks == ["- 데이터 분석 › **Power BI** 6권 — **추가할까요?**", "- 통계 › **R** 5권 — **추가할까요?**"]
    others = [x for x in lines if x.startswith("- ") and x not in asks]
    assert len(others) == 10 and others[0] == "- 글쓰기 › **이름0** 4권" and "이름11" not in "\n".join(lines)
    assert "promote" in "\n".join(lines)
    assert section([]) == []
