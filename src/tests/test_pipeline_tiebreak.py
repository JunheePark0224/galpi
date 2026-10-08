"""Pipeline: the third pass for split fields (src/pipeline/tiebreak.py) — fake client, no keys."""
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from pipeline import tiebreak  # noqa: E402
from pipeline.candidates import Candidate  # noqa: E402
from pipeline.config import parse_config  # noqa: E402
from pipeline.prompt import system_prompt  # noqa: E402
from pipeline.tagger import Breaker  # noqa: E402
from pipeline_fakes import INTRO, TOC, FakeClient, check_answer, message  # noqa: E402

CFG = parse_config({"daily_count": 4, "auto_merge": False, "sample_rate": 0.1, "model": "claude-haiku-4-5",
                    "second_model": "claude-haiku-4-5", "target_phase": "launch"})
VOCAB = {"돈 관리·투자": {"kept": {"주식": {"pattern": "주식|배당"}, "ETF·펀드": {"pattern": "ETF"}}}}
AX = {"temp": 1, "pull": -1, "gain": 0, "world": 1}


def leaf(a_axes, b_axes, a_missing=(), b_missing=(), a_fits=True, b_fits=True, b_suggest=""):
    return {"entry": "leaf", "genre": "에세이", "axes": a_axes, "missing": list(a_missing), "fits": a_fits, "suggest": "",
            "second": {"fits": b_fits, "axes": b_axes, "missing": list(b_missing), "suggest": b_suggest}}


def target(a_kw, b_kw, a_way="개념", b_way="개념"):
    return {"entry": "target", "topic": "돈 관리·투자", "keywords": a_kw, "way": a_way, "fits": True, "suggest": "",
            "second": {"fits": True, "keywords": b_kw, "way": b_way, "suggest": ""}}


def test_splits_are_fields_with_two_values_and_never_an_empty_axis():
    """v3.1 rule 9 (10-07): an axis is empty only when its value is null — a no-info mark on a value is still that value."""
    rec = leaf(AX, {**AX, "temp": 0, "pull": 1, "world": None}, b_missing=["world", "pull"])
    assert tiebreak.splits(rec) == ["temp", "pull"]
    assert tiebreak.splits(leaf({**AX, "temp": None}, {**AX, "temp": None}, ["temp"], ["temp"])) == []
    assert tiebreak.splits(leaf(AX, AX, b_missing=["gain"])) == []
    assert tiebreak.splits(leaf(AX, AX, b_fits=False, b_suggest="한국 소설")) == ["slot"]
    assert tiebreak.splits(target(["주식"], ["ETF·펀드", "주식"], b_way="실습")) == ["keywords", "way"]
    assert tiebreak.splits(target(["주식", "ETF·펀드"], ["ETF·펀드", "주식"])) == []


def test_the_majority_settles_a_field_and_a_three_way_split_or_no_info_goes_to_a_person():
    rec = leaf(AX, {**AX, "temp": 0, "gain": 1})
    third = {"fits": True, "axes": {**AX, "temp": -1, "gain": 1}, "missing": []}
    assert tiebreak.settle(rec, third) == {"temp": None, "gain": 1}
    assert tiebreak.settle(rec, {**third, "axes": {**AX, "gain": None}, "missing": ["gain"]}) == {"temp": 1, "gain": None}
    assert tiebreak.settle(rec, None) == {"temp": None, "gain": None}


def test_a_slot_split_with_one_fitting_pass_is_settled_to_stay_or_to_the_named_slot():
    rec = leaf(AX, AX, b_fits=False, b_suggest="한국 소설")
    assert tiebreak.settle(rec, {"fits": True, "axes": AX}) == {"slot": "에세이"}
    assert tiebreak.settle(rec, {"fits": False, "suggest": "한국 소설", "axes": AX}) == {"slot": "한국 소설"}
    assert tiebreak.settle(rec, {"fits": False, "suggest": "SF·판타지", "axes": AX}) == {"slot": None}
    nowhere = leaf(AX, AX, b_fits=False)
    assert tiebreak.settle(nowhere, {"fits": False, "suggest": "", "axes": AX}) == {"slot": None}
    two = leaf(AX, AX, a_fits=False, b_fits=False, b_suggest="한국 소설") | {"suggest": "SF·판타지"}
    assert tiebreak.settle(two, {"fits": False, "suggest": "한국 소설", "axes": AX}) == {"slot": None}


def test_the_third_pass_is_a_blind_check_call_and_keeps_no_free_text():
    client = FakeClient(lambda kw: message(check_answer("target", keywords=["ETF·펀드"], way="실습")))
    cand = Candidate("target", "돈 관리·투자", "1", "책", "가 저", 200, "", INTRO, TOC)
    prompts = {k: system_prompt(VOCAB, k) for k in ("tag", "check")}
    ledger = {}
    ans = tiebreak.third(client, CFG, VOCAB, prompts, cand, Breaker(), ledger)
    assert ans["keywords"] == ["ETF·펀드"] and ans["way"] == "실습" and len(client.messages.calls) == 1
    assert "one_liner" not in client.messages.calls[0]["output_config"]["format"]["schema"]["properties"]
    assert sum(u.calls for u in ledger.values()) == 1
    kept = tiebreak.kept_of(ans)
    assert "why" not in kept and kept["way"] == "실습"
    rec = target(["주식"], ["ETF·펀드"], b_way="실습")
    assert tiebreak.settle(rec, ans) == {"keywords": ["ETF·펀드"], "way": "실습"}


def test_gold_score_counts_settled_fields_against_the_person_and_the_90_line():
    from pipeline.tiebreak_gold import score
    labels = {"1": {"entry": "leaf", "genre": "에세이", "axes": {**AX, "temp": 0}},
              "2": {"entry": "target", "topic": "돈 관리·투자", "keywords": ["주식"], "way": "실습"}}
    rows = [{"isbn": "1", "settled": {"temp": 0, "gain": None, "slot": "에세이"}},
            {"isbn": "2", "settled": {"keywords": ["주식"], "way": "개념"}}]
    out = score(rows, labels)
    assert out["total"] == {"splits": 5, "settled": 4, "right": 3, "to_person": 1}
    assert out["accuracy"] == 0.75 and out["passes"] is False
    assert out["fields"]["way"] == {"splits": 1, "settled": 1, "right": 0, "to_person": 0}


def test_only_validated_fields_are_settled_and_keyword_splits_alone_need_no_third_pass():
    rec = target(["주식"], ["ETF·펀드"], b_way="실습")
    third = {"fits": True, "keywords": ["ETF·펀드"], "way": "실습"}
    assert tiebreak.settle(rec, third, tiebreak.SETTLES) == {"keywords": None, "way": "실습"}
    assert tiebreak.needs_third(rec) and not tiebreak.needs_third(target(["주식"], ["ETF·펀드"]))


def daily(rec, flags, issues=(), status="review"):
    return rec | {"flags": list(flags), "issues": list(issues), "status": status}


def test_the_daily_run_takes_the_majority_value_and_lets_an_agreed_book_in():
    """route plan 3 (10-08): a split the third pass settles is no longer a person's — the record keeps the majority value,
    what pass A said (`a_was`) and pass C's values (never its free text)."""
    rec = daily(leaf(AX, {**AX, "temp": 0}), ["temp"])
    out = tiebreak.applied(rec, {"fits": True, "axes": {**AX, "temp": 0}, "missing": [], "why": "자유 글"}, auto_merge=False)
    assert out["axes"]["temp"] == 0 and out["a_was"] == {"temp": 1} and out["settled"] == {"temp": 0}
    assert (out["flags"], out["status"], out["auto"]) == ([], "picked", "ai-agree")
    assert out["third"]["axes"]["temp"] == 0 and "why" not in out["third"]
    kept = tiebreak.applied(rec, {"fits": True, "axes": AX, "missing": []}, auto_merge=False)
    assert kept["axes"]["temp"] == 1 and "a_was" not in kept and kept["status"] == "picked"
    held = tiebreak.applied(daily(leaf(AX, {**AX, "temp": 0}), ["temp"], ["짧음(9자)"], "reserve"),
                            {"fits": True, "axes": AX, "missing": []}, auto_merge=False)
    assert held["status"] == "reserve" and "auto" not in held          # a one-liner rule still waits for a person


def test_a_three_way_split_or_a_keyword_split_still_waits_for_a_person():
    rec = daily(leaf(AX, {**AX, "temp": 0}), ["temp"])
    out = tiebreak.applied(rec, {"fits": True, "axes": {**AX, "temp": -1}, "missing": []}, auto_merge=False)
    assert out["flags"] == ["temp"] and out["status"] == "review" and out["settled"] == {}
    rec = daily(target(["주식"], ["ETF·펀드"], b_way="실습"), ["keywords", "way"])
    out = tiebreak.applied(rec, {"fits": True, "keywords": ["ETF·펀드"], "way": "개념"}, auto_merge=False)
    assert out["flags"] == ["keywords"] and out["way"] == "개념" and out["status"] == "review"
    assert tiebreak.applied(rec, None, auto_merge=False)["status"] == "review"  # pass C failed: as it was


def test_a_slot_split_moves_the_book_to_the_slot_two_of_three_name():
    """The plan's slot table: one pass keeps it and two name a slot → there; both out on different slots and pass C names
    one of them → there (route plan 2); "nowhere" by majority is still a person's."""
    rec = daily(leaf(AX, AX, b_fits=False, b_suggest="한국 소설"), ["fits"])
    out = tiebreak.applied(rec, {"fits": False, "suggest": "한국 소설", "axes": AX}, auto_merge=False)
    assert (out["genre"], out["moved_from"], out["flags"], out["status"]) == ("한국 소설", "에세이", [], "picked")
    stay = tiebreak.applied(rec, {"fits": True, "suggest": "", "axes": AX}, auto_merge=False)
    assert stay["genre"] == "에세이" and "moved_from" not in stay and stay["status"] == "picked"
    two = daily(leaf(AX, AX, a_fits=False, b_fits=False, b_suggest="한국 소설") | {"suggest": "SF·판타지"}, ["fits"])
    out = tiebreak.applied(two, {"fits": False, "suggest": "한국 소설", "axes": AX}, auto_merge=False)
    assert out["genre"] == "한국 소설" and out["status"] == "picked"
    nowhere = daily(leaf(AX, AX, b_fits=False), ["fits"])
    assert tiebreak.applied(nowhere, {"fits": False, "suggest": "", "axes": AX}, auto_merge=False)["status"] == "review"


def test_a_slot_the_majority_puts_in_the_other_entry_is_requeued_once():
    rec = daily(leaf(AX, AX, b_fits=False, b_suggest="마음 돌보기"), ["fits"])
    c = {"fits": False, "suggest": "마음 돌보기", "axes": AX}
    out = tiebreak.applied(rec, c, auto_merge=False)
    assert out["status"] == "dropped" and out["requeued_to"] == {"entry": "target", "slot": "마음 돌보기"}
    assert out["genre"] == "에세이"
    back = tiebreak.applied(rec, c, auto_merge=False, requeued=True)
    assert back["status"] == "review" and "fits" in back["flags"] and "requeued_to" not in back


def test_a_target_book_moved_by_the_majority_takes_the_keywords_its_two_voters_share():
    rec = daily(target(["주식"], ["주식"]) | {"second": {"fits": False, "keywords": ["주식"], "way": "개념",
                                                          "suggest": "경제 상식", "suggest_keywords": ["금리·환율"]}},
                ["fits", "keywords"])
    c = {"fits": False, "keywords": [], "way": "개념", "suggest": "경제 상식", "suggest_keywords": ["금리·환율", "물가"]}
    out = tiebreak.applied(rec, c, auto_merge=False)
    assert (out["topic"], out["field"], out["keywords"], out["moved_from"]) == ("경제 상식", "돈·경제", ["금리·환율"], "돈 관리·투자")
    assert out["flags"] == [] and out["status"] == "picked"
    stay = tiebreak.applied(rec, {**c, "fits": True, "suggest": "", "keywords": ["ETF·펀드"]}, auto_merge=False)
    assert stay["topic"] == "돈 관리·투자" and stay["flags"] == ["keywords"]  # a keyword split in the old slot stays
