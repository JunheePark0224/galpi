"""Pipeline: one retry for a pass-A one-liner that breaks a rule (src/pipeline/one_liner.py) — fake client, no API."""
import json
import sys
from pathlib import Path

import anthropic
import httpx2 as httpx

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from pipeline.checks import rule_issues  # noqa: E402
from pipeline.one_liner import SCHEMA, RetryLog, problems, retry  # noqa: E402
from pipeline.tagger import Breaker, Usage, parse  # noqa: E402
from pipeline_fakes import FakeClient, check_answer, message, tag_answer  # noqa: E402

MODEL, SYSTEM, USER, TITLE = "claude-sonnet-5-5", "system", "책소개 …", "주식 투자 수업"
GOOD_LEAF = "투자 실수 앞에서 사람은 무엇을 배울까요?"
LONG_TARGET = "배당과 분산 투자로 주식의 첫걸음을 차근차근 알려 주고 흔한 실수를 피하는 법까지 짚어 줘요"  # 38 chars w/o spaces


def first(entry: str, line: str) -> tuple[dict, dict]:
    raw = tag_answer(entry, one_liner=line)
    return raw, parse(raw, entry, "tag", ["주식"], "돈 관리·투자")


def fixing(line):
    return FakeClient(lambda kw: message({"one_liner": line}))


def test_a_line_that_passes_is_not_retried():
    raw, a = first("leaf", GOOD_LEAF)
    client = FakeClient()
    out, used, outcome = retry(client, MODEL, SYSTEM, USER, "leaf", raw, a, TITLE)
    assert (out, used, outcome) == (a, Usage(), "ok") and client.messages.calls == []


def test_problems_name_each_broken_rule_in_korean():
    assert len(LONG_TARGET.replace(" ", "")) == 38
    assert problems("target", LONG_TARGET, TITLE) == ["공백 빼고 36자 이하로 줄여 주세요(지금 38자)"]
    assert problems("leaf", "투자 실수 앞에서 사람은 무엇을 배우게 될까요", TITLE) == ["질문형이어야 해요(?로 끝나게)"]
    assert problems("target", "주식을 처음 시작하면 무엇부터 할까요?", TITLE) == ["요약형이어야 해요(물음표 없이)"]
    assert problems("target", "짧아요", TITLE) == ["공백 빼고 12자 이상으로 늘려 주세요(지금 3자)"]
    assert problems("target", "주식 투자 수업에서 배당과 분산의 기본을 배워요", TITLE) == ["책 제목을 되풀이하지 말아 주세요"]
    assert problems("target", "최고의 배당 투자 입문서로 기초를 다져요", TITLE) == ["과장 표현을 빼 주세요(최고)"]
    assert problems("target", "완벽주의를 내려놓고 배당 투자의 기초를 다져요", TITLE) == []  # HYPE_OK words pass


def test_the_same_model_is_asked_once_for_just_the_line_and_the_retry_fixes_it():
    raw, a = first("leaf", "투자 실수 앞에서 사람은 무엇을 배우게 될까요")
    client = fixing(GOOD_LEAF)
    out, used, outcome = retry(client, MODEL, SYSTEM, USER, "leaf", raw, a, TITLE, Breaker())
    assert outcome == "fixed" and out == a | {"one_liner": GOOD_LEAF} and used.calls == 1
    (sent,) = client.messages.calls
    assert sent["model"] == MODEL and sent["system"][0]["text"] == SYSTEM
    assert sent["output_config"]["format"]["schema"] == SCHEMA
    user, back, ask = sent["messages"]
    assert user == {"role": "user", "content": USER}
    assert back["role"] == "assistant" and json.loads(back["content"]) == raw
    assert ask["role"] == "user" and "질문형이어야 해요(?로 끝나게)" in ask["content"] and "one_liner만" in ask["content"]
    assert {k: v for k, v in out.items() if k != "one_liner"} == {k: v for k, v in a.items() if k != "one_liner"}


def test_a_38_character_summary_is_shortened():
    raw, a = first("target", LONG_TARGET)
    client = fixing("배당과 분산 투자로 주식의 첫걸음을 알려줘요")
    out, _, outcome = retry(client, MODEL, SYSTEM, USER, "target", raw, a, TITLE)
    assert outcome == "fixed" and out["one_liner"] == "배당과 분산 투자로 주식의 첫걸음을 알려줘요"
    assert "36자 이하로 줄여 주세요(지금 38자)" in client.messages.calls[0]["messages"][2]["content"]


def test_a_retry_that_still_fails_keeps_the_better_line_and_the_issue_stays():
    raw, a = first("target", LONG_TARGET)
    worse = "주식 투자 수업으로 배당과 분산 투자를 끝까지 하나하나 차근차근 알려 주고 실수도 짚어 줘요"  # long + title
    out, _, outcome = retry(fixing(worse), MODEL, SYSTEM, USER, "target", raw, a, TITLE)
    assert outcome == "still_failing" and out == a  # more problems: the first line is kept
    issues = rule_issues("target", out, TITLE, "배당 분산 투자 주식", check_answer("target"))
    assert "김(38자)" in issues  # the review page flags it as before
    better = "주식이 처음이라면 무엇부터 하면 좋을까요?"  # right length, still a question
    out, _, outcome = retry(fixing(better), MODEL, SYSTEM, USER, "target", *first("target", "짧아요?"), TITLE)
    assert outcome == "still_failing" and out["one_liner"] == better  # one problem left instead of two
    assert "요약형인데 물음표로 끝남" in rule_issues("target", out, TITLE, "주식 처음", check_answer("target"))


def test_a_failed_retry_call_keeps_the_first_line():
    raw, a = first("target", LONG_TARGET)
    url = "https://api.anthropic.com/v1/messages"
    err = anthropic.APIStatusError("overloaded", response=httpx.Response(529, request=httpx.Request("POST", url)), body=None)
    client = FakeClient(lambda kw: (_ for _ in ()).throw(err))
    out, used, outcome = retry(client, MODEL, SYSTEM, USER, "target", raw, a, TITLE, Breaker())
    assert (out, outcome, used.failed) == (a, "http_529", 1)
    out, _, outcome = retry(FakeClient(lambda kw: message({"one_liner": " "})), MODEL, SYSTEM, USER, "target", raw, a, TITLE)
    assert (out, outcome) == (a, "invalid_answer")


def test_the_retry_log_counts_outcomes_and_cost_per_model():
    log = RetryLog()
    for outcome in ("ok", "fixed", "fixed", "still_failing", "http_529"):
        log.note(MODEL, Usage(1, 0, 1000, 50) if outcome != "ok" else Usage(), outcome)
    s = log.summary()
    assert (s["tried"], s["fixed"], s["still_failing"], s["call_failed"]) == (4, 2, 1, 1)
    assert s["usage"][MODEL]["calls"] == 4 and s["cost_usd"] == round(Usage(4, 0, 4000, 200).cost(MODEL), 4)
