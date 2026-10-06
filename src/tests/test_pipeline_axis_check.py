"""Pipeline: one automatic re-ask for a 🍃 pass whose axis values are not backed by its signal lines
(src/pipeline/axis_check.py, calibration decisions 10-06) — fake client, no API."""
import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from pipeline.axis_check import SCHEMA, problems, retry, stated  # noqa: E402
from pipeline.one_liner import RetryLog  # noqa: E402
from pipeline.tagger import Breaker, Usage, parse  # noqa: E402
from pipeline_fakes import SIGNALS, FakeClient, check_answer, message, tag_answer  # noqa: E402

MODEL, SYSTEM, USER = "claude-sonnet-5-5", "system", "책소개 …"
EMPTY = {"temp": "", "pull": "", "gain": "", "world": ""}


def answer(kind: str = "tag", **over) -> tuple[dict, dict]:
    raw = (tag_answer if kind == "tag" else check_answer)("leaf", **over)
    return raw, parse(raw, "leaf", kind, [])


def test_the_direction_a_signal_line_states():
    assert stated("temp", "끝맺음 −: 마지막 부가 재난·난민") == {-1}
    assert stated("temp", "약하게 −") == {-1}
    assert stated("temp", "끝맺음 +, 어조 −: 반반") == {1, -1, 0}
    assert stated("temp", "0 해당 없음: 설명 중심") == {0}
    assert stated("temp", "따뜻한 시선") == {1} and stated("temp", "서늘한 여운") == {-1}
    assert stated("pull", "몰입 쪽") == {-1} and stated("pull", "문장 +: 유려한 문체 칭찬") == {1}
    assert stated("gain", "알게 됨: 원리 설명") == {1} and stated("gain", "마음: 성찰") == {-1}
    assert stated("world", "현실: 원룸·아빠") == {1} and stated("world", "딴 세상: 귀신이 실제로 등장") == {-1}
    assert stated("world", "21명 인터뷰, 50년의 기록") == set()      # numbers are not a 0
    assert stated("temp", "AI-2가 본 어조") == set()                  # a hyphen inside a word is not a minus
    assert stated("pull", "인물의 삶이 끌고 감") == set()              # no direction word: nothing to contradict


def test_an_answer_whose_values_follow_its_signals_has_no_problem():
    assert problems(answer()[1]) == []


def test_a_value_without_a_signal_line_and_a_line_that_contradicts_its_value_are_problems():
    _, a = answer(temp=0, signals={**SIGNALS, "temp": "약하게 −: 장면이 아픔"})
    assert problems(a) == ["temp(온도): 근거에 쓴 방향(−1)과 값(0)이 달라요"]
    _, a = answer(pull=0, signals={**SIGNALS, "pull": ""})
    assert problems(a) == ["pull(끌림): 값(0)을 냈는데 근거 신호가 비었어요"]


def test_all_four_axes_zero_with_empty_signals_is_a_failed_pass():
    _, a = answer("check", temp=0, pull=0, gain=0, world=0, signals=EMPTY)
    assert len(problems(a)) == 4


def test_an_empty_value_marked_as_no_info_needs_no_signal_line():
    _, a = answer(pull=None, missing=["pull"], signals={**SIGNALS, "pull": ""})
    assert a["axes"]["pull"] is None and problems(a) == []


def test_a_both_sides_line_with_a_zero_value_is_not_a_contradiction():
    _, a = answer(gain=0, signals={**SIGNALS, "gain": "알게 됨 + 마음 반반"})
    assert problems(a) == []


def test_a_good_answer_is_not_asked_again():
    raw, a = answer()
    client = FakeClient()
    assert retry(client, MODEL, SYSTEM, USER, raw, a, "A") == (a, Usage(), "ok") and client.messages.calls == []


def test_the_same_model_is_asked_once_for_the_axes_and_the_fix_replaces_them():
    raw, a = answer(pull=0, signals={**SIGNALS, "pull": "몰입 쪽: 사건이 이어짐"})
    fixed = {"temp": 1, "pull": -1, "gain": 0, "world": 1, "signals": SIGNALS, "missing": []}
    client = FakeClient(lambda kw: message(fixed))
    out, used, outcome = retry(client, MODEL, SYSTEM, USER, raw, a, "B", Breaker())
    assert outcome == "fixed" and used.calls == 1
    assert out == a | {"axes": {"temp": 1, "pull": -1, "gain": 0, "world": 1}, "signals": SIGNALS, "missing": []}
    (sent,) = client.messages.calls
    assert sent["model"] == MODEL and sent["output_config"]["format"]["schema"] == SCHEMA
    user, back, ask = sent["messages"]
    assert user == {"role": "user", "content": USER} and json.loads(back["content"]) == raw
    assert ask["role"] == "user" and "pull(끌림): 근거에 쓴 방향(−1)과 값(0)이 달라요" in ask["content"]


def test_a_fix_that_is_still_wrong_keeps_the_answer_with_fewer_problems():
    raw, a = answer(temp=0, pull=0, signals={**SIGNALS, "temp": "", "pull": ""})
    half = {"temp": 1, "pull": 0, "gain": 0, "world": 1, "signals": {**SIGNALS, "pull": ""}, "missing": []}
    out, _, outcome = retry(FakeClient(lambda kw: message(half)), MODEL, SYSTEM, USER, raw, a, "A")
    assert outcome == "still_failing" and out["axes"]["temp"] == 1 and out["axes"]["pull"] == 0
    worse = {"temp": 0, "pull": 0, "gain": 0, "world": 0, "signals": EMPTY, "missing": []}
    out, _, outcome = retry(FakeClient(lambda kw: message(worse)), MODEL, SYSTEM, USER, raw, a, "A")
    assert outcome == "still_failing" and out == a


def test_a_failed_or_unusable_retry_keeps_the_first_answer():
    raw, a = answer(pull=0, signals={**SIGNALS, "pull": ""})
    out, used, outcome = retry(FakeClient(lambda kw: message({}, stop="max_tokens")), MODEL, SYSTEM, USER, raw, a, "A")
    assert out == a and outcome == "max_tokens" and used.failed == 1
    out, _, outcome = retry(FakeClient(lambda kw: message({"temp": 5})), MODEL, SYSTEM, USER, raw, a, "A")
    assert out == a and outcome == "invalid_answer"


def test_retries_are_counted_like_one_liner_retries():
    log = RetryLog()
    raw, a = answer(pull=0, signals={**SIGNALS, "pull": ""})
    fixed = {"temp": 1, "pull": -1, "gain": 0, "world": 1, "signals": SIGNALS, "missing": []}
    _, used, outcome = retry(FakeClient(lambda kw: message(fixed)), MODEL, SYSTEM, USER, raw, a, "A")
    log.note(MODEL, used, outcome)
    assert log.summary()["tried"] == 1 and log.summary()["fixed"] == 1
