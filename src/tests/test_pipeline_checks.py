"""Pipeline: rule checks, the two-pass decision and the additions record (src/pipeline/checks.py · merge.py)."""
import json
import sys
from pathlib import Path

import pytest

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from pipeline.candidates import Candidate  # noqa: E402
from pipeline.checks import AUTO, copied_run, decide, disagreements, rule_issues, scrub, split_issues  # noqa: E402
from pipeline.merge import additions_doc, keyword_hints, record, write_doc  # noqa: E402
from pipeline.tagger import parse  # noqa: E402
from pipeline_fakes import INTRO, TOC, check_answer, tag_answer  # noqa: E402

MATERIAL = f"{INTRO} {TOC}"
CAND = Candidate("target", "돈 관리·투자", "9790000000011", "처음 주식 공부", "김하나 저", 280, "https://y/1", INTRO, TOC)


def test_copied_run_ignores_spaces():
    assert copied_run("계좌 만들기부터 배당과", MATERIAL) == len("계좌만들기부터배당과")
    assert copied_run("", MATERIAL) == 0


def test_a_clean_tag_has_no_issues():
    assert rule_issues("target", tag_answer("target"), CAND.title, MATERIAL, check_answer("target")) == []
    assert rule_issues("leaf", tag_answer("leaf"), "투자 이야기", MATERIAL, check_answer("leaf")) == []


@pytest.mark.parametrize("entry, over, issue", [
    ("target", {"one_liner": "주식의 기본을 알려줄까요? 배당도요?"}, "물음표"),
    ("leaf", {"one_liner": "투자 실수 앞에서 사람은 무엇을 배워요"}, "?로 끝나지"),
    ("target", {"evidence": "가" * 31}, "근거 김(31자)"),
    ("target", {"evidence": ""}, "근거 없음"),
    ("target", {"evidence": "계좌 만들기부터 배당과 분산"}, "근거가 책소개를 베낌"),
    ("target", {"one_liner": "계좌 만들기부터 배당과 분산 투자까지 알려줘요"}, "한 줄이 책소개를 베낌"),
    ("target", {"one_liner": "최고의 주식 배당 입문서예요"}, "과장 표현"),
])
def test_rule_issues(entry, over, issue):
    assert any(issue in i for i in rule_issues(entry, tag_answer(entry, **over), "제목", MATERIAL, check_answer(entry)))


def test_the_second_opinion_cannot_be_left_out_of_the_copy_check():
    with pytest.raises(TypeError):
        rule_issues("target", tag_answer("target"), CAND.title, MATERIAL)  # type: ignore[call-arg]


def test_disagreements_name_each_field():
    a, b = tag_answer("target"), check_answer("target")
    assert disagreements("target", a, b) == []
    assert disagreements("target", a, check_answer("target", keywords=["ETF·펀드"], way="실습", fits=False)) == ["fits", "keywords", "way"]
    leaf_a = parse(tag_answer("leaf", confidence=0.5), "leaf", "tag", [])
    leaf_b = parse(check_answer("leaf", world=-1), "leaf", "check", [])
    assert disagreements("leaf", leaf_a, leaf_b) == ["world", "confidence"]


def test_decide():
    a, b = tag_answer("target"), check_answer("target")
    assert decide(a, b, [], [], auto_merge=False) == ("picked", AUTO)
    assert decide(a, b, ["way"], [], auto_merge=False) == ("review", None)      # waits in the file until a person applies a review
    assert decide(a, b, ["way"], [], auto_merge=True) == ("reserve", None)      # nobody looks before merge → waits
    assert decide(a, b, [], ["짧음(5자)"], auto_merge=False) == ("reserve", None)
    assert decide({**a, "fits": False}, {**b, "fits": False}, ["fits"], [], False) == ("dropped", None)


def test_record_holds_our_tags_only(tmp_path):
    a, b = tag_answer("target"), check_answer("target", way="실습")
    rec = record(CAND, a, b, ["way"], [], "picked", None, keyword_hints(CAND, {"주식": {"pattern": "주식"}, "연금·노후": {"pattern": "연금"}}))
    assert rec["topic"] == "돈 관리·투자" and rec["field"] == "돈·경제" and rec["keywords_regex"] == ["주식"]
    assert rec["second"] == {"fits": True, "keywords": ["주식"], "way": "실습", "why": "주식 입문서"} and "auto" not in rec
    path = tmp_path / "2026-10-05.json"
    write_doc(path, additions_doc("2026-10-05", "claude-haiku-4-5", "claude-haiku-4-5", [rec]))
    text = path.read_text(encoding="utf-8")
    assert json.loads(text)["batch"] == "daily" and "\r\n" not in text
    assert INTRO[:20] not in text and "계좌와 주문" not in text   # no YES24 text in the repo


def test_the_second_opinions_reason_gets_the_same_copy_check_and_copied_fields_are_scrubbed():
    a = tag_answer("target", evidence="계좌 만들기부터 배당과 분산")
    b = check_answer("target", why="계좌 만들기부터 배당과 분산 투자까지 차근차근")
    issues = rule_issues("target", a, "제목", MATERIAL, b)
    assert "판단 이유가 책소개를 베낌" in issues and "근거가 책소개를 베낌" in issues
    safe_a, safe_b = scrub(a, b, issues)
    assert safe_a["evidence"] == "" and safe_b["why"] == "" and safe_a["one_liner"] == a["one_liner"]
    assert a["evidence"] and b["why"]                                      # the inputs are not changed
    clean_a, clean_b = tag_answer("target"), check_answer("target")
    assert rule_issues("target", clean_a, "제목", MATERIAL, clean_b) == []
    assert scrub(clean_a, clean_b, []) == (clean_a, clean_b)


def test_record_never_stores_words_that_failed_the_copy_check():
    a = tag_answer("target", evidence="계좌 만들기부터 배당과 분산")
    b = check_answer("target", why="계좌 만들기부터 배당과 분산 투자까지 차근차근")
    issues = rule_issues("target", a, CAND.title, MATERIAL, b)
    rec = record(CAND, a, b, [], issues, "reserve", None, [])
    assert rec["evidence"] == "" and rec["second"]["why"] == "" and "근거가 책소개를 베낌" in rec["issues"]
    assert "계좌 만들기" not in json.dumps(rec, ensure_ascii=False)


def test_split_issues_separates_the_one_liner_rules_from_the_evidence_rules():
    line, evidence = split_issues(["짧음(5자)", "근거 약함(겹치는 단어 1개)", "근거 김(41자)", "근거 없음",
                                   "근거가 책소개를 베낌", "판단 이유가 책소개를 베낌", "한 줄이 책소개를 베낌", "과장 표현: 최고"])
    assert line == ["짧음(5자)", "근거 약함(겹치는 단어 1개)", "한 줄이 책소개를 베낌", "과장 표현: 최고"]   # 근거 약함 = the line is not grounded
    assert evidence == ["근거 김(41자)", "근거 없음", "근거가 책소개를 베낌", "판단 이유가 책소개를 베낌"]
    assert split_issues([]) == ([], [])
