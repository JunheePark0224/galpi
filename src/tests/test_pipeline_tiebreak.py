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


def test_splits_are_fields_with_two_values_and_never_a_no_info_axis():
    rec = leaf(AX, {**AX, "temp": 0, "pull": 1, "world": None}, b_missing=["world", "pull"])
    assert tiebreak.splits(rec) == ["temp"]
    assert tiebreak.splits(leaf(AX, AX, b_fits=False, b_suggest="한국 소설")) == ["slot"]
    assert tiebreak.splits(target(["주식"], ["ETF·펀드", "주식"], b_way="실습")) == ["keywords", "way"]
    assert tiebreak.splits(target(["주식", "ETF·펀드"], ["ETF·펀드", "주식"])) == []


def test_the_majority_settles_a_field_and_a_three_way_split_or_no_info_goes_to_a_person():
    rec = leaf(AX, {**AX, "temp": 0, "gain": 1})
    third = {"fits": True, "axes": {**AX, "temp": -1, "gain": 1}, "missing": []}
    assert tiebreak.settle(rec, third) == {"temp": None, "gain": 1}
    assert tiebreak.settle(rec, {**third, "axes": {**AX, "gain": None}, "missing": ["gain"]}) == {"temp": 1, "gain": None}
    assert tiebreak.settle(rec, None) == {"temp": None, "gain": None}


def test_a_slot_is_settled_only_when_the_majority_keeps_the_book_where_it_is():
    rec = leaf(AX, AX, b_fits=False, b_suggest="한국 소설")
    assert tiebreak.settle(rec, {"fits": True, "axes": AX}) == {"slot": "에세이"}
    assert tiebreak.settle(rec, {"fits": False, "suggest": "한국 소설", "axes": AX}) == {"slot": None}


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
