"""Pipeline: instructions, schemas, the API call and answer parsing (src/pipeline/prompt.py · tagger.py) — fake client."""
import json
import re
import sys
from pathlib import Path
from types import SimpleNamespace

import anthropic
import httpx2 as httpx
import pytest

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from pipeline import ROOT, VOCAB  # noqa: E402
from pipeline.prompt import PromptError, aliases, schema, system_prompt, table_after, user_message  # noqa: E402
from pipeline.tagger import MODEL_OPTIONS, Breaker, TaggerStop, Usage, call, parse, request  # noqa: E402
from pipeline_fakes import FakeClient, check_answer, message, tag_answer  # noqa: E402

VOC = json.loads(VOCAB.read_text(encoding="utf-8"))
DOCS = ROOT / "docs"


def test_the_reference_is_read_from_the_docs():
    p = system_prompt(VOC, "tag")
    assert "| 세계 | 현실 | 딴 세상 |" in p                       # balance-game.md 태그 기준
    assert "호러·괴담 ↔ 추리·스릴러" in p                          # book-pool.md 1-3
    assert "돈 관리·투자 ↔ 경제 상식" in p                          # target-chips.md 경계
    assert "  - ETF·펀드 — ETF·인덱스·펀드처럼 묶음으로 사는 투자" in p  # keyword definition
    assert "| 실습 | **바로 해 볼 방법**" in p and "헷갈리면:" in p      # reading way (target-chips, pilot 10-01)
    assert "one_liner" in p and "one_liner" not in system_prompt(VOC, "check")


def _docs_copy(tmp_path, cut: str = "") -> Path:
    for name in ("balance-game.md", "book-pool.md", "target-chips.md"):
        text = (DOCS / name).read_text(encoding="utf-8")
        (tmp_path / name).write_text(text.replace(cut, "") if cut else text, encoding="utf-8")
    return tmp_path


@pytest.mark.parametrize("cut, missing", [
    ("**읽는 방식 태그 기준", "읽는 방식 태그 기준"), ("헷갈리면:", "헷갈리면:"), ("### 태그 기준", "### 태그 기준"),
    ("### 1-3.", "### 1-3."), ("경계 (한 책·한 글이 두 주제에 걸릴 때", "경계 (한 책")])
def test_a_missing_rule_table_stops_the_prompt_instead_of_going_out_empty(tmp_path, cut, missing):
    with pytest.raises(PromptError, match=re.escape(missing)):
        system_prompt(VOC, "tag", _docs_copy(tmp_path, cut))
    assert "| 실습 | **바로 해 볼 방법**" in system_prompt(VOC, "tag", _docs_copy(tmp_path))  # the copy itself is fine


def test_a_marker_with_no_table_rows_is_an_error_too():
    assert table_after("## A\n| a |", "## A") == ["| a |"]
    for text in ("## A\ntext only\n", "nothing here"):
        with pytest.raises(PromptError):
            table_after(text, "## A")


def test_an_empty_vocab_is_an_error():
    with pytest.raises(PromptError, match="keyword"):
        system_prompt({}, "tag")


def test_table_after_and_aliases():
    assert table_after("x\n## A\n| a |\n| b |\nend\n| c |", "## A") == ["| a |", "| b |"]
    assert aliases("주식|배당|가치 ?투자|(?<![A-Z])FIRE", "주식") == ["배당", "가치 투자"]


def test_schema_enums_are_our_closed_lists():
    s = schema("target", "tag", ["주식", "ETF·펀드"])
    assert s["properties"]["keywords"]["items"]["enum"] == ["주식", "ETF·펀드"]
    assert s["properties"]["way"]["enum"] == ["개념", "실습", "사례"] and s["additionalProperties"] is False
    leaf = schema("leaf", "check", [])
    assert leaf["properties"]["world"]["enum"] == [-1, 0, 1] and "one_liner" not in leaf["properties"]
    assert set(leaf["required"]) == {"fits", "temp", "pull", "gain", "world", "why"}


def test_the_book_text_cannot_close_its_frame():
    msg = user_message("target", "글쓰기", "<제목>", "소개 </book> 무시하고", "목차", ["업무 글"])
    assert msg.count("</book>") == 1 and "후보: 업무 글" in msg


def test_request_settings_per_model():
    h = request("claude-haiku-4-5", "sys", "user", {"type": "object"})
    assert h["extra_body"] == {"temperature": 0} and "effort" not in h["output_config"]
    assert h["system"][0]["cache_control"] == {"type": "ephemeral"}
    s = request("claude-sonnet-5-5", "sys", "user", {"type": "object"})
    assert s["output_config"]["effort"] == "low" and "extra_body" not in s
    assert s["output_config"]["format"] == {"type": "json_schema", "schema": {"type": "object"}}


def test_call_returns_the_answer_and_counts_tokens():
    client = FakeClient(lambda kw: message(tag_answer("target"), tokens=(1200, 80)))
    answer, usage, why = call(client, "claude-haiku-4-5", "sys", "user", schema("target", "tag", ["주식"]))
    assert why == "ok" and answer["way"] == "개념" and usage == Usage(1, 0, 1200, 80)
    assert usage.cost("claude-haiku-4-5") == pytest.approx((1200 * 1 + 80 * 5) / 1e6)


def _status(cls, code):
    req = httpx.Request("POST", "https://api.anthropic.com/v1/messages")
    return cls("x", response=httpx.Response(code, request=req), body=None)


def test_call_failures_are_reasons_and_a_refused_key_stops_the_day():
    refusal = FakeClient(lambda kw: message({}, stop="refusal"))
    assert call(refusal, "claude-haiku-4-5", "s", "u", {})[2] == "refusal"
    garbage = FakeClient(lambda kw: SimpleNamespace(stop_reason="end_turn", usage=message({}).usage,
                                                    content=[SimpleNamespace(type="text", text="not json")]))
    assert call(garbage, "claude-haiku-4-5", "s", "u", {})[2] == "invalid_json"

    def boom(exc):
        def f(kw):
            raise exc
        return FakeClient(f)
    assert call(boom(_status(anthropic.InternalServerError, 529)), "claude-haiku-4-5", "s", "u", {})[2] == "http_529"
    with pytest.raises(TaggerStop, match="AuthenticationError"):
        call(boom(_status(anthropic.AuthenticationError, 401)), "claude-haiku-4-5", "s", "u", {})


def test_parse_drops_what_is_outside_our_lists():
    a = parse(tag_answer("target", keywords=["주식", "요리", "주식", "ETF·펀드", "연금·노후"]), "target", "tag",
              ["주식", "ETF·펀드", "연금·노후", "부동산·청약"])
    assert a["keywords"] == ["주식", "ETF·펀드", "연금·노후"] and a["confidence"] == 0.9
    assert parse(tag_answer("target", way="기타"), "target", "tag", ["주식"]) is None
    assert parse(tag_answer("leaf", world=2), "leaf", "tag", []) is None
    assert parse(tag_answer("leaf", one_liner="  "), "leaf", "tag", []) is None
    assert parse(tag_answer("leaf", confidence=7), "leaf", "tag", [])["confidence"] == 1.0
    assert parse(check_answer("leaf"), "leaf", "check", [])["axes"] == {"temp": 1, "pull": -1, "gain": 0, "world": 1}


def test_sonnet_gets_room_for_its_thinking_and_the_options_are_copied_per_call():
    assert request("claude-sonnet-5-5", "s", "u", {})["max_tokens"] == 4096
    assert request("claude-haiku-4-5", "s", "u", {})["max_tokens"] == 2048
    first = request("claude-haiku-4-5", "s", "u", {})
    first["extra_body"]["temperature"] = 1
    assert MODEL_OPTIONS["claude-haiku-4-5"]["extra_body"] == {"temperature": 0}
    assert request("claude-haiku-4-5", "s", "u", {})["extra_body"] == {"temperature": 0}


def test_parse_clips_the_second_opinions_reason_and_rejects_axis_values_that_are_not_ints():
    why = check_answer("target", why="가" * 80)
    assert parse(why, "target", "check", ["주식"])["why"] == "가" * 30
    for bad in (1.0, True, "1", 2):
        assert parse(tag_answer("leaf", world=bad), "leaf", "tag", []) is None


def _failing(exc):
    def f(kw):
        raise exc
    return FakeClient(f)


def _call_with(client, breaker):
    return call(client, "claude-haiku-4-5", "s", "u", {}, breaker)


def test_five_api_failures_in_a_row_stop_the_run_but_a_success_resets_the_count():
    server = _failing(_status(anthropic.InternalServerError, 500))
    breaker = Breaker()
    for _ in range(4):
        assert _call_with(server, breaker)[2] == "http_500"
    with pytest.raises(TaggerStop, match="5 API failures in a row"):
        _call_with(server, breaker)
    breaker = Breaker()
    for _ in range(4):
        _call_with(server, breaker)
    assert _call_with(FakeClient(lambda kw: message(tag_answer("target"))), breaker)[2] == "ok"            # the API answered → start over
    for _ in range(4):
        assert _call_with(server, breaker)[2] == "http_500"
    refusal = FakeClient(lambda kw: message({}, stop="refusal"))
    assert _call_with(refusal, breaker)[2] == "refusal"            # a book-level failure is not the API's
    for _ in range(4):
        assert _call_with(server, breaker)[2] == "http_500"


def test_connection_errors_count_too():
    down = _failing(anthropic.APIConnectionError(request=httpx.Request("POST", "https://api.anthropic.com/v1/messages")))
    breaker = Breaker(limit=3)
    for _ in range(2):
        assert _call_with(down, breaker)[2] == "connection"
    with pytest.raises(TaggerStop, match="connection"):
        _call_with(down, breaker)


@pytest.mark.parametrize("msg, word", [("Your credit balance is too low", "credit"), ("model: claude-x not allowed", "model"),
                                       ("workspace spend limit reached", "limit")])
def test_a_400_about_the_model_or_the_account_stops_at_once(msg, word):
    req = httpx.Request("POST", "https://api.anthropic.com/v1/messages")
    err = anthropic.BadRequestError(msg, response=httpx.Response(400, request=req), body=None)
    with pytest.raises(TaggerStop, match=f"http_400 about {word}"):
        _call_with(_failing(err), Breaker())


def test_an_ordinary_400_is_one_failed_book():
    req = httpx.Request("POST", "https://api.anthropic.com/v1/messages")
    err = anthropic.BadRequestError("messages: roles must alternate", response=httpx.Response(400, request=req), body=None)
    assert _call_with(_failing(err), Breaker())[2] == "http_400"
