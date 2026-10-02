"""Backfill of keywords put back on the list (10-02): proposals by the word rule, then a person's choices applied
(src/backfill_keywords.py)."""
import re
import sys
from pathlib import Path

import pytest

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

import json  # noqa: E402

from backfill_keywords import BackfillError, apply_choices, promote, proposals  # noqa: E402

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


CHIPS = """# doc
새 키워드 정의 (붙이는 책 — 책의 중심이 이것일 때):

| 주제 | 키워드 | 정의 |
|---|---|---|
| 돈 관리·투자 | 주식 | 개별 주식 |
| AI 활용 (10-02 다시 넣음) | LLM 원리 | LLM이 동작하는 법 |

경계 (한 책·한 글이 두 주제에 걸릴 때):

| 경계 | 규칙 |
|---|---|
| a | b |
"""


def _cand(isbn, name, topic="데이터 분석", **over):
    return {"isbn": isbn, "entry": "target", "topic": topic, "keywords": ["SQL"], "keyword_candidate": name, **over}


@pytest.fixture
def repo(tmp_path):
    processed = tmp_path / "processed"
    (processed / "additions").mkdir(parents=True)
    vocab = {"데이터 분석": {"books": 17, "kept": {"SQL": {"pattern": "SQL", "n": 6}}, "folded": {}},
             "통계": {"books": 9, "kept": {}}}
    (processed / "keyword_vocab.json").write_text(json.dumps(vocab, ensure_ascii=False), encoding="utf-8")
    (processed / "books_v1.json").write_text(json.dumps(
        [_cand("1", "Power BI"), _cand("2", None), _cand("3", "power bi", topic="통계")], ensure_ascii=False), encoding="utf-8")
    (processed / "additions" / "2026-10-05.json").write_text(json.dumps({"date": "2026-10-05", "books": [
        _cand("4", "PowerBI", keywords=["SQL", "Power BI"]), _cand("5", "엑셀")]}, ensure_ascii=False), encoding="utf-8")
    (processed / "additions" / "2026-10-01-pilot-ai2.json").write_text(json.dumps({"books": [_cand("6", "Power BI")]}),
                                                                         encoding="utf-8")
    chips = tmp_path / "target-chips.md"
    chips.write_bytes(CHIPS.encode("utf-8"))  # LF like the repo (.gitattributes eol=lf)
    return processed, chips


def _promote(repo, spec="데이터 분석:Power BI", pattern="Power ?BI|파워 ?BI", definition="파워 BI로 대시보드를 만들어 분석"):
    processed, chips = repo
    return promote(spec, pattern, definition, processed=processed, chips=chips, day="2026-10-06")


def test_promote_adds_the_keyword_its_definition_and_puts_it_on_the_candidate_books(repo, capsys):
    processed, chips = repo
    _promote(repo)
    vocab = json.loads((processed / "keyword_vocab.json").read_text(encoding="utf-8"))
    assert vocab["데이터 분석"]["kept"]["Power BI"] == {"pattern": "Power ?BI|파워 ?BI", "n": 2}
    assert vocab["데이터 분석"]["kept"]["SQL"] == {"pattern": "SQL", "n": 6} and vocab["통계"] == {"books": 9, "kept": {}}
    rows = json.loads((processed / "books_v1.json").read_text(encoding="utf-8"))
    assert rows[0]["keywords"] == ["SQL", "Power BI"] and rows[0]["keyword_candidate"] is None
    assert rows[2]["keyword_candidate"] == "power bi" and rows[2]["keywords"] == ["SQL"]       # another topic stays
    add = json.loads((processed / "additions" / "2026-10-05.json").read_text(encoding="utf-8"))
    assert add["books"][0]["keywords"] == ["SQL", "Power BI"] and add["books"][0]["keyword_candidate"] is None  # no duplicate
    assert add["books"][1]["keyword_candidate"] == "엑셀" and add["date"] == "2026-10-05"
    ai2 = json.loads((processed / "additions" / "2026-10-01-pilot-ai2.json").read_text(encoding="utf-8"))
    assert ai2["books"][0]["keyword_candidate"] == "Power BI"                                    # the AI-2 copy is not touched
    lines = chips.read_text(encoding="utf-8").splitlines()
    i = lines.index("| AI 활용 (10-02 다시 넣음) | LLM 원리 | LLM이 동작하는 법 |")
    assert lines[i + 1] == "| 데이터 분석 (2026-10-06 승인) | Power BI | 파워 BI로 대시보드를 만들어 분석 |"
    assert lines[i + 2] == "" and lines.count("| a | b |") == 1
    out = capsys.readouterr().out
    assert "Power BI" in out and "2 books" in out and "npm run books:import && npx vitest run" in out
    for path in (processed / "keyword_vocab.json", processed / "books_v1.json", chips):
        assert b"\r\n" not in path.read_bytes()


@pytest.mark.parametrize("spec, pattern, definition, msg", [
    ("요리:Power BI", "x", "뜻", "unknown topic"),
    ("데이터 분석:sql", "x", "뜻", "already"),
    ("데이터 분석:Power BI", "(", "뜻", "pattern"),
    ("데이터 분석:", "x", "뜻", "topic:name"),
    ("데이터 분석:Power BI", "x", " ", "definition"),
    ("데이터 분석:Power|BI", "x", "뜻", "|"),
    ("데이터 분석:데이터분석", "x", "뜻", "the topic itself"),
    ("데이터 분석:Power BI", "(?i)power bi", "뜻", "JavaScript"),
    ("데이터 분석:Power BI", "(?P<x>Power) BI", "뜻", "JavaScript"),
    ("데이터 분석:Power BI", "Power|", "뜻", "empty string"),
    ("데이터 분석:Power BI", "(?:BI)?", "뜻", "empty string"),
    ("데이터 분석:Tableau", "Tableau", "뜻", "no 데이터 분석 book"),
])
def test_promote_refuses_and_changes_nothing(repo, spec, pattern, definition, msg):
    processed, chips = repo
    before = {p: p.read_bytes() for p in [*processed.rglob("*.json"), chips]}
    with pytest.raises(BackfillError, match=re.escape(msg)):
        _promote(repo, spec, pattern, definition)
    assert {p: p.read_bytes() for p in before} == before


def test_promote_accepts_lookarounds_non_capturing_groups_and_escaped_parens(repo):
    _promote(repo, pattern=r"(?<![A-Z])Power ?BI(?!\w)|(?:파워) ?BI|\(?PBI\)?")


def test_a_name_the_list_left_out_on_purpose_can_be_promoted(repo):
    processed, _ = repo
    vocab = json.loads((processed / "keyword_vocab.json").read_text(encoding="utf-8"))
    vocab["데이터 분석"]["folded"] = {"Power BI": 1}
    (processed / "keyword_vocab.json").write_text(json.dumps(vocab, ensure_ascii=False), encoding="utf-8")
    _promote(repo)
    assert "Power BI" in json.loads((processed / "keyword_vocab.json").read_text(encoding="utf-8"))["데이터 분석"]["kept"]


def test_a_book_already_at_five_keywords_is_left_for_a_person(repo, capsys):
    processed, _ = repo
    full = _cand("7", "Power BI", keywords=["SQL", "엑셀", "파이썬", "데이터 리터러시", "R"], title="꽉 찬 책")
    (processed / "additions" / "2026-10-06.json").write_text(json.dumps({"books": [full]}, ensure_ascii=False), encoding="utf-8")
    _promote(repo)
    kept = json.loads((processed / "additions" / "2026-10-06.json").read_text(encoding="utf-8"))["books"][0]
    assert kept == full                                                                # not pushed to 6, candidate kept
    vocab = json.loads((processed / "keyword_vocab.json").read_text(encoding="utf-8"))
    assert vocab["데이터 분석"]["kept"]["Power BI"]["n"] == 2
    out = capsys.readouterr().out
    assert "7" in out and "꽉 찬 책" in out and "5 keywords" in out


def test_a_rerun_after_a_failure_before_the_vocab_write_finishes_the_job(repo, monkeypatch):
    import backfill_keywords
    processed, chips = repo
    real = backfill_keywords._write
    def fail_on_vocab(path, data):
        if path.name == "keyword_vocab.json":
            raise OSError("disk full")
        real(path, data)
    monkeypatch.setattr(backfill_keywords, "_write", fail_on_vocab)
    with pytest.raises(OSError):
        _promote(repo)
    assert "Power BI" not in json.loads((processed / "keyword_vocab.json").read_text(encoding="utf-8"))["데이터 분석"]["kept"]
    monkeypatch.setattr(backfill_keywords, "_write", real)
    _promote(repo)                                                                    # the same command again
    vocab = json.loads((processed / "keyword_vocab.json").read_text(encoding="utf-8"))
    assert vocab["데이터 분석"]["kept"]["Power BI"] == {"pattern": "Power ?BI|파워 ?BI", "n": 2}
    assert chips.read_text(encoding="utf-8").count("| Power BI |") == 1
    rows = json.loads((processed / "books_v1.json").read_text(encoding="utf-8"))
    assert rows[0]["keywords"] == ["SQL", "Power BI"] and rows[0]["keyword_candidate"] is None


def test_a_promoted_name_leaves_folded_and_too_common_of_its_topic(repo):
    processed, _ = repo
    vocab = json.loads((processed / "keyword_vocab.json").read_text(encoding="utf-8"))
    vocab["데이터 분석"] |= {"folded": {"power bi": 1, "R": 1}, "too_common": {"PowerBI": 9, "시각화": 11}}
    vocab["통계"]["folded"] = {"Power BI": 2}
    (processed / "keyword_vocab.json").write_text(json.dumps(vocab, ensure_ascii=False), encoding="utf-8")
    _promote(repo)
    after = json.loads((processed / "keyword_vocab.json").read_text(encoding="utf-8"))
    assert after["데이터 분석"]["folded"] == {"R": 1} and after["데이터 분석"]["too_common"] == {"시각화": 11}
    assert after["통계"]["folded"] == {"Power BI": 2}                              # another topic keeps its own
