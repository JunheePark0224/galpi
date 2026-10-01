"""Pipeline: one whole day with a fake YES24 cache and a fake Anthropic client (the design 6절 dry run, keyless)."""
import json
import sys
from pathlib import Path

import anthropic
import httpx2 as httpx
import pytest

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

import collect_candidates  # noqa: E402
from pipeline import run_daily  # noqa: E402
from pipeline.config import load_config, parse_config  # noqa: E402
from pipeline.tagger import Breaker  # noqa: E402
from pipeline_fakes import INTRO, FakeClient, agreeing, kind_of, message, tag_answer, write_cache, yes24_item  # noqa: E402

CFG = parse_config({"daily_count": 4, "auto_merge": False, "sample_rate": 0.1, "model": "claude-haiku-4-5",
                    "second_model": "claude-haiku-4-5"})
MIXED_CFG = parse_config({"daily_count": 4, "auto_merge": False, "sample_rate": 0.1, "model": "claude-sonnet-5-5",
                          "second_model": "claude-haiku-4-5"})
ITEMS = [yes24_item(f"97900000000{i}", t, f"저자{i} 저", i) for i, t in
         enumerate(["처음 주식 공부", "주식 배당 입문", "주식 투자 수업", "주식 마음 공부", "주식 다섯째 책"], start=11)]
ENV = {"YES24_API_KEY": "not-real"}
URL = "https://api.anthropic.com/v1/messages"


def status_error(code: int) -> anthropic.APIStatusError:
    return anthropic.APIStatusError("overloaded", response=httpx.Response(code, request=httpx.Request("POST", URL)), body=None)


@pytest.fixture
def day(tmp_path, monkeypatch):
    raw, adds = tmp_path / "raw", tmp_path / "additions"
    adds.mkdir()
    write_cache(raw, {"주식": ITEMS}, ITEMS)
    (tmp_path / "books.json").write_text("[]", encoding="utf-8")
    (tmp_path / "vocab.json").write_text(json.dumps({"돈 관리·투자": {"kept": {"주식": {"pattern": "주식|배당"}}}}),
                                         encoding="utf-8")
    for name, value in (("BOOKS", tmp_path / "books.json"), ("VOCAB", tmp_path / "vocab.json"), ("ADDITIONS", adds),
                        ("RUNS", tmp_path / "runs")):
        monkeypatch.setattr(run_daily, name, value)
    monkeypatch.setattr(collect_candidates, "RAW", raw)
    monkeypatch.setattr(collect_candidates, "get_json", lambda *a, **k: {"error": "offline in tests"})
    return adds


def mixed(kwargs):
    """Book 2: the second pass reads the way differently. Book 3: pass A writes a one-liner that breaks the rules."""
    entry, kind = kind_of(kwargs)
    text = kwargs["messages"][0]["content"]
    if "주식 배당 입문" in text and kind == "check":
        return message({"fits": True, "keywords": ["주식"], "way": "실습", "why": "따라 하기 중심"})
    if "주식 투자 수업" in text and kind == "tag":
        return message(tag_answer(entry, one_liner="짧아요"))
    return agreeing(kwargs)


def test_a_day_writes_our_tags_and_a_summary(day):
    client = FakeClient(mixed)
    s = run_daily.run("2026-10-05", CFG, ENV, client)
    assert s["status"] == "ok" and s["wanted"] == 4 and s["slots"] == ["돈 관리·투자/주식 4"] and s["candidates"] == 4
    assert (s["picked"], s["reserve"], s["dropped"], s["auto_agreed"], s["flagged"]) == (3, 1, 0, 2, 1)
    assert s["usage"]["claude-haiku-4-5"]["calls"] == 8 and s["cost_usd"] > 0
    doc = json.loads((day / "2026-10-05.json").read_text(encoding="utf-8"))
    by = {b["title"]: b for b in doc["books"]}
    assert by["처음 주식 공부"]["auto"] == "ai-agree" and by["주식 배당 입문"]["flags"] == ["way"]
    assert by["주식 투자 수업"]["status"] == "reserve" and by["주식 투자 수업"]["issues"]
    text = (day / "2026-10-05.json").read_text(encoding="utf-8")
    assert INTRO[:20] not in text and "계좌와 주문" not in text
    assert INTRO[:20] not in json.dumps(s, ensure_ascii=False)
    sent = client.messages.calls[0]
    assert sent["model"] == "claude-haiku-4-5" and INTRO[:20] in sent["messages"][0]["content"]  # text goes to the tagger only


def test_each_pass_uses_its_own_model_from_the_config(day):
    client = FakeClient()
    s = run_daily.run("2026-10-05", MIXED_CFG, ENV, client)
    assert [c["model"] for c in client.messages.calls[:2]] == ["claude-sonnet-5-5", "claude-haiku-4-5"]
    assert s["model"] == "claude-sonnet-5-5" and s["second_model"] == "claude-haiku-4-5"
    assert {m: u["calls"] for m, u in s["usage"].items()} == {"claude-sonnet-5-5": 4, "claude-haiku-4-5": 4}
    assert json.loads((day / "2026-10-05.json").read_text(encoding="utf-8"))["second_model"] == "claude-haiku-4-5"


def test_a_copied_field_never_reaches_the_file(day):
    def copies(kwargs):
        entry, kind = kind_of(kwargs)
        return message(tag_answer(entry, evidence="계좌 만들기부터 배당과 분산")) if kind == "tag" else agreeing(kwargs)
    run_daily.run("2026-10-05", CFG, ENV, FakeClient(copies))
    text = (day / "2026-10-05.json").read_text(encoding="utf-8")
    assert "계좌 만들기부터" not in text and "근거가 책소개를 베낌" in text


def test_nothing_to_fill_costs_nothing(day, monkeypatch):
    monkeypatch.setattr(run_daily, "plan_day", lambda *a: [])
    client = FakeClient()
    assert run_daily.run("2026-10-05", CFG, ENV, client)["status"] == "full" and client.messages.calls == []


def test_a_refused_key_stops_the_day_without_a_file(day):
    def refuse(kwargs):
        raise anthropic.AuthenticationError("bad key", response=httpx.Response(401, request=httpx.Request("POST", URL)), body=None)
    client = FakeClient(refuse)
    s = run_daily.run("2026-10-05", CFG, ENV, client)
    assert s["status"] == "anthropic_failed" and s["stopped"] == "AuthenticationError"
    assert len(client.messages.calls) == 1 and not (day / "2026-10-05.json").exists()


def test_a_dead_second_model_stops_the_day_and_keeps_the_finished_books(day, monkeypatch):
    """Pass A keeps answering, so one shared failure streak would never fill; the breaker counts per model."""
    monkeypatch.setattr(run_daily, "Breaker", lambda: Breaker(2))

    def second_down(kwargs):
        _, kind = kind_of(kwargs)
        text = kwargs["messages"][0]["content"]
        if kind == "check" and ("주식 투자 수업" in text or "주식 마음 공부" in text):
            raise status_error(529)
        return agreeing(kwargs)
    s = run_daily.run("2026-10-05", MIXED_CFG, ENV, FakeClient(second_down))
    assert s["status"] == "partial" and s["stopped"] == "claude-haiku-4-5: 2 API failures in a row (http_529)"
    assert s["tagged"] == 2 and s["reasons"] == {"ok": 2, "http_529": 1}
    assert {m: u["calls"] for m, u in s["usage"].items()} == {"claude-sonnet-5-5": 4, "claude-haiku-4-5": 3}
    # pass A of the interrupted books is counted; the call that tripped the breaker raised before returning (no tokens)
    doc = json.loads((day / "2026-10-05.json").read_text(encoding="utf-8"))
    assert [b["title"] for b in doc["books"]] == ["처음 주식 공부", "주식 배당 입문"]


def test_a_dead_model_before_any_book_is_a_failed_day(day, monkeypatch):
    monkeypatch.setattr(run_daily, "Breaker", lambda: Breaker(2))

    def down(kwargs):
        raise status_error(529)
    s = run_daily.run("2026-10-05", CFG, ENV, FakeClient(down))
    assert s["status"] == "anthropic_failed" and "2 API failures in a row" in s["stopped"]
    assert not (day / "2026-10-05.json").exists()


def test_yes24_failing_ends_the_day(day, monkeypatch, tmp_path):
    monkeypatch.setattr(collect_candidates, "RAW", tmp_path / "empty")
    monkeypatch.setattr(collect_candidates, "time", type("T", (), {"sleep": staticmethod(lambda s: None)}))
    client = FakeClient()
    s = run_daily.run("2026-10-05", CFG, ENV, client)
    assert s["status"] == "yes24_failed" and s["yes24_failed_paths"] == ["/goods/itemList"]
    assert client.messages.calls == [] and not list(day.iterdir())


def test_main_needs_both_keys_and_never_runs_a_day_twice(day, monkeypatch, capsys):
    monkeypatch.setattr(run_daily, "yes24_env", lambda: {})
    monkeypatch.setattr(run_daily, "anthropic_key", lambda: "")
    assert run_daily.main(["--date", "2026-10-05"]) == 1
    assert "YES24_API_KEY, ANTHROPIC_API_KEY not set" in capsys.readouterr().err
    (day / "2026-10-05.json").write_text("{}", encoding="utf-8")
    assert run_daily.main(["--date", "2026-10-05"]) == 0
    assert "already exists" in capsys.readouterr().out


def test_main_runs_a_day_and_prints_no_key_or_book_text(day, monkeypatch, capsys, tmp_path):
    monkeypatch.setattr(run_daily, "yes24_env", lambda: ENV)
    monkeypatch.setattr(run_daily, "anthropic_key", lambda: "sk-test-secret-value")
    monkeypatch.setattr(run_daily, "load_config", lambda count=None: parse_config(
        {"daily_count": count or 4, "auto_merge": False, "sample_rate": 0.1, "model": "claude-haiku-4-5",
         "second_model": "claude-haiku-4-5"}))
    seen = {}
    monkeypatch.setattr(anthropic, "Anthropic", lambda **kw: seen.update(kw) or FakeClient())
    assert run_daily.main(["--date", "2026-10-05", "--count", "3"]) == 0
    out = capsys.readouterr()
    assert "sk-test-secret-value" not in out.out + out.err and INTRO[:20] not in out.out + out.err
    assert json.loads((tmp_path / "runs" / "2026-10-05.json").read_text(encoding="utf-8"))["status"] == "ok"
    assert seen["api_key"] == "sk-test-secret-value" and (day / "2026-10-05.json").exists()


def test_the_shipped_config_is_valid_and_both_passes_run_sonnet_5_5():
    cfg = load_config()
    assert cfg.model == cfg.second_model == "claude-sonnet-5-5"
