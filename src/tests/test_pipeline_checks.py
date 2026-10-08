"""Pipeline: rule checks, the two-pass decision and the additions record (src/pipeline/checks.py · merge.py)."""
import json
import sys
from pathlib import Path

import pytest

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from pipeline.candidates import Candidate  # noqa: E402
from pipeline.checks import AUTO, copied_run, crossed_to, decide, disagreements, moved_to, needs_person, redecide, rule_issues, scrub, split_issues  # noqa: E402
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
    assert disagreements("leaf", leaf_a, leaf_b) == ["world"]                     # 10-06: pass A unsure is no reason


def test_disagreements_of_a_moved_book_are_about_its_new_slot():
    out = {"fits": False, "suggest": "돈 관리·투자"}
    a = {**tag_answer("target"), **out, "keywords": ["경제 뉴스"], "suggest_keywords": ["주식"]}
    b = {**check_answer("target"), **out, "keywords": ["금리"], "suggest_keywords": ["주식"]}
    assert disagreements("target", a, b) == []                                       # same keywords in the new topic
    assert disagreements("target", a, {**b, "suggest_keywords": ["ETF·펀드"]}) == ["keywords"]
    leaf_out = {"fits": False, "suggest": "외국 소설"}
    assert disagreements("leaf", parse(tag_answer("leaf", **leaf_out), "leaf", "tag", []),
                         parse(check_answer("leaf", world=-1, **leaf_out), "leaf", "check", [])) == ["world"]


def test_decide():
    a, b = tag_answer("target"), check_answer("target")
    assert decide(a, b, [], [], auto_merge=False) == ("picked", AUTO)
    assert decide(a, b, ["way"], [], auto_merge=False) == ("review", None)      # waits in the file until a person applies a review
    assert decide(a, b, ["way"], [], auto_merge=True) == ("reserve", None)      # nobody looks before merge → waits
    assert decide(a, b, [], ["짧음(5자)"], auto_merge=False) == ("reserve", None)
    assert decide({**a, "fits": False}, {**b, "fits": False}, ["fits"], [], False) == ("dropped", None)
    # 10-05: a person is not asked about notes nobody reads (evidence / pass B reason) or about "AI-1 unsure" when both agree
    assert decide(a, b, [], ["근거 김(33자)", "판단 이유가 책소개를 베낌"], auto_merge=False) == ("picked", AUTO)
    assert decide(a, b, ["confidence"], [], auto_merge=False) == ("picked", AUTO)
    assert decide(a, b, ["confidence", "way"], ["근거 김(33자)"], auto_merge=False) == ("review", None)
    assert decide(a, b, [], ["근거 김(33자)", "한 줄이 책소개를 베낌"], auto_merge=False) == ("reserve", None)


# 10-08 (plans/2026-10-08-route-pipeline.md): "which slot?", not "does it fit this slot?" — a book both passes place in the same
# other slot moves there instead of being dropped (the library re-tag's rule, library_review.slot_decision "agreed")
def test_moved_to_needs_both_passes_out_of_the_slot_naming_the_same_one():
    a, b = tag_answer("leaf"), check_answer("leaf")
    out = lambda s: {"fits": False, "suggest": s}  # noqa: E731
    assert moved_to({**a, **out("외국 소설")}, {**b, **out("외국 소설")}) == "외국 소설"
    assert moved_to({**a, **out("외국 소설")}, {**b, **out("SF·판타지")}) is None     # different slots: not a move
    assert moved_to({**a, **out("외국 소설")}, b) is None                             # one keeps it here
    assert moved_to({**a, **out("")}, {**b, **out("")}) is None                       # nowhere
    assert moved_to(a, b) is None


def test_decide_moves_instead_of_dropping():
    a, b = tag_answer("leaf"), check_answer("leaf")
    out = lambda s: {"fits": False, "suggest": s}  # noqa: E731
    # both name the same other genre and agree on the rest: picked there (the "fits" flag was about the old slot)
    assert decide({**a, **out("외국 소설")}, {**b, **out("외국 소설")}, ["fits"], [], False) == ("picked", AUTO)
    assert decide({**a, **out("외국 소설")}, {**b, **out("외국 소설")}, ["fits", "temp"], [], False) == ("review", None)
    # only when both say "nowhere among our slots" is a book dropped
    assert decide({**a, **out("")}, {**b, **out("")}, ["fits"], [], False) == ("dropped", None)
    # they name different slots, or one keeps it: a person (or pass C) decides
    assert decide({**a, **out("외국 소설")}, {**b, **out("SF·판타지")}, ["fits"], [], False) == ("review", None)
    assert decide({**a, **out("외국 소설")}, b, ["fits"], [], False) == ("review", None)


def test_needs_person_names_only_what_a_person_must_decide():
    assert needs_person(["confidence"], ["근거 김(31자)", "근거 없음", "근거가 책소개를 베낌", "판단 이유가 책소개를 베낌"]) == ([], [])
    assert needs_person(["temp", "confidence"], ["근거 김(31자)", "과장 표현: 미친"]) == (["temp"], ["과장 표현: 미친"])


def test_redecide_a_stored_book_with_todays_rules():
    stored = {"fits": True, "second": {"fits": True}, "flags": ["confidence"], "issues": ["근거 김(31자)"], "status": "reserve"}
    assert redecide(stored, auto_merge=False) == ("picked", AUTO)
    assert redecide({**stored, "flags": ["fits"], "second": {"fits": False}}, auto_merge=False) == ("review", None)
    # a book dropped before 10-08 whose two passes named the same other slot comes back, moved there
    dropped = {**stored, "fits": False, "suggest": "인문", "flags": ["fits"], "issues": [], "status": "dropped",
               "second": {"fits": False, "suggest": "인문"}}
    assert redecide(dropped, auto_merge=False) == ("picked", AUTO)


def test_record_holds_our_tags_only(tmp_path):
    a, b = tag_answer("target"), check_answer("target", way="실습")
    rec = record(CAND, a, b, ["way"], [], "picked", None, keyword_hints(CAND, {"주식": {"pattern": "주식"}, "연금·노후": {"pattern": "연금"}}))
    assert rec["topic"] == "돈 관리·투자" and rec["field"] == "돈·경제" and rec["keywords_regex"] == ["주식"]
    assert rec["second"] == {"fits": True, "keywords": ["주식"], "way": "실습", "why": "주식 입문서", "suggest": "",
                             "suggest_keywords": []} and "auto" not in rec
    assert rec["suggest"] == "" and rec["suggest_keywords"] == []
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


# --- 10-06 label signals: who asks a person, per-axis evidence and its copy check ---

def test_an_axis_is_asked_when_the_passes_differ_or_one_left_it_empty_never_for_low_confidence():
    """v3.1 rule 9 (10-07): one pass empty (null) or two different values → a person; both empty → decided as empty;
    a no-info mark on a value both passes gave asks nothing."""
    a = parse(tag_answer("leaf", confidence=0.3), "leaf", "tag", [])
    b = parse(check_answer("leaf"), "leaf", "check", [])
    assert disagreements("leaf", a, b) == []                                      # unsure alone asks nothing
    a2 = parse(tag_answer("leaf", missing=["temp"]), "leaf", "tag", [])
    b2 = parse(check_answer("leaf", world=-1, missing=["gain", "temp"]), "leaf", "check", [])
    assert disagreements("leaf", a2, b2) == ["world"]                             # the marks alone ask nothing
    a3 = parse(tag_answer("leaf", temp=None, pull=None, missing=["temp", "pull"]), "leaf", "tag", [])
    b3 = parse(check_answer("leaf", temp=None, world=-1, missing=["temp"]), "leaf", "check", [])
    assert disagreements("leaf", a3, b3) == ["pull", "world"]                     # AXES order; temp both empty
    assert disagreements("target", tag_answer("target", confidence=0.1), check_answer("target")) == []


def test_a_copied_signal_line_is_an_evidence_issue_and_is_never_stored():
    copied = {"temp": "계좌 만들기부터 배당과 분산", "pull": "몰입: 실패담", "gain": "0", "world": "현실"}
    a, b = tag_answer("leaf"), check_answer("leaf", signals=copied)
    issues = rule_issues("leaf", a, "제목", MATERIAL, b)
    assert issues == ["근거가 책소개를 베낌 (AI-2 temp)"]
    assert split_issues(issues) == ([], issues) and needs_person([], issues) == ([], [])   # a note, not a question
    safe_a, safe_b = scrub(a, b, issues)
    assert safe_b["signals"] == {**copied, "temp": ""} and safe_a == a and b["signals"]["temp"]   # inputs unchanged
    leaf_cand = Candidate("leaf", "에세이", "9790000000028", "투자 이야기", "이둘 저", 220, "https://y/2", INTRO, TOC)
    rec = record(leaf_cand, parse(a, "leaf", "tag", []), parse(b, "leaf", "check", []), [], issues, "picked", AUTO, [])
    assert "계좌 만들기" not in json.dumps(rec, ensure_ascii=False)


def test_record_keeps_both_passes_signals_and_missing_axes():
    leaf_cand = Candidate("leaf", "에세이", "9790000000028", "투자 이야기", "이둘 저", 220, "https://y/2", INTRO, TOC)
    a = parse(tag_answer("leaf", missing=["temp"]), "leaf", "tag", [])
    b = parse(check_answer("leaf"), "leaf", "check", [])
    rec = record(leaf_cand, a, b, ["temp"], [], "review", None, [])
    assert rec["signals"] == a["signals"] and rec["missing"] == ["temp"]
    assert rec["second"]["signals"] == b["signals"] and rec["second"]["missing"] == []


def test_a_moved_book_is_recorded_in_its_new_slot():
    leaf = Candidate("leaf", "로맨스", "9790000000028", "사랑의 기원", "앤 저/김 역", 300, "https://y/2", INTRO, TOC)
    a = parse(tag_answer("leaf", fits=False, suggest="외국 소설"), "leaf", "tag", [])
    b = parse(check_answer("leaf", fits=False, suggest="외국 소설"), "leaf", "check", [])
    rec = record(leaf, a, b, [], [], "picked", AUTO, [])
    assert rec["genre"] == "외국 소설" and rec["moved_from"] == "로맨스"
    kept = record(leaf, parse(tag_answer("leaf"), "leaf", "tag", []), parse(check_answer("leaf"), "leaf", "check", []),
                  [], [], "picked", AUTO, [])
    assert kept["genre"] == "로맨스" and "moved_from" not in kept
    # a 🎯 book takes the new topic, its field, and the keywords both passes gave there
    a = {**tag_answer("target"), "fits": False, "suggest": "돈 관리·투자", "suggest_keywords": ["주식", "ETF·펀드"]}
    b = {**check_answer("target"), "fits": False, "suggest": "돈 관리·투자", "suggest_keywords": ["주식"]}
    cand = Candidate("target", "경제 상식", "9790000000035", "주식의 첫걸음", "김 저", 200, "https://y/3", INTRO, TOC)
    rec = record(cand, a, b, [], [], "picked", AUTO, [])
    assert (rec["topic"], rec["field"], rec["keywords"], rec["moved_from"]) == ("돈 관리·투자", "돈·경제", ["주식"], "경제 상식")


def test_a_book_both_passes_send_to_the_other_entry_goes_there_to_be_tagged_again():
    """10-08 (『과몰입 사회』: found as 🍃 사회·시사, really 🎯 마음 돌보기): both passes naming the same slot of the other 갈래
    send the book there (requeue) — it is tagged again as that entry, whose tags differ (🎯 keywords·way·summary line)."""
    out = {"fits": False, "suggest": "마음 돌보기"}
    assert crossed_to("leaf", out, out) == {"entry": "target", "slot": "마음 돌보기"}
    genre = {"fits": False, "suggest": "과학 교양"}
    assert crossed_to("target", genre, genre) == {"entry": "leaf", "slot": "과학 교양"}
    assert crossed_to("leaf", genre, genre) is None                                     # same 갈래: an ordinary move
    assert crossed_to("leaf", out, {"fits": False, "suggest": "인문"}) is None          # different slots: a person
    assert crossed_to("leaf", out, {"fits": True, "suggest": ""}) is None


def test_a_crossing_book_is_recorded_where_it_was_found_with_where_it_goes():
    leaf = Candidate("leaf", "사회·시사", "9790000000028", "과몰입 사회", "가 저", 300, "https://y/2", INTRO, TOC)
    a = parse(tag_answer("leaf", fits=False, suggest="마음 돌보기"), "leaf", "tag", [])
    b = parse(check_answer("leaf", fits=False, suggest="마음 돌보기"), "leaf", "check", [])
    rec = record(leaf, a, b, [], [], "dropped", None, [])
    assert rec["genre"] == "사회·시사" and "moved_from" not in rec
    assert rec["requeued_to"] == {"entry": "target", "slot": "마음 돌보기"} and rec["status"] == "dropped"
