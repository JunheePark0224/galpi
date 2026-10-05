"""Pipeline: one whole day with a fake YES24 cache and a fake Anthropic client (the design 6절 dry run, keyless)."""
import json
import sys
from pathlib import Path

import anthropic
import httpx2 as httpx
import pytest

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

import collect_candidates  # noqa: E402
from apply_review import FIELD_OF_TOPIC  # noqa: E402
from pipeline.gaps import GENRES, PHASES  # noqa: E402
from pipeline.slots import slot_rule  # noqa: E402
from pipeline import run_daily  # noqa: E402
from pipeline.config import load_config, parse_config  # noqa: E402
from pipeline.candidates import Candidate  # noqa: E402
from pipeline.merge import record  # noqa: E402
from pipeline.tagger import Breaker  # noqa: E402
from pipeline_fakes import (INTRO, TOC, FakeClient, agreeing, check_answer, kind_of, message, tag_answer,  # noqa: E402
                            write_cache, yes24_item)

CFG = parse_config({"daily_count": 4, "auto_merge": False, "sample_rate": 0.1, "model": "claude-haiku-4-5",
                    "second_model": "claude-haiku-4-5", "target_phase": "launch"})
MIXED_CFG = parse_config({"daily_count": 4, "auto_merge": False, "sample_rate": 0.1, "model": "claude-sonnet-5-5",
                          "second_model": "claude-haiku-4-5", "target_phase": "launch"})
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
    (tmp_path / "books.json").write_text(json.dumps(full_but_one_keyword()), encoding="utf-8")
    (tmp_path / "vocab.json").write_text(json.dumps({"돈 관리·투자": {"kept": {"주식": {"pattern": "주식|배당"}}}}),
                                         encoding="utf-8")
    for name, value in (("BOOKS", tmp_path / "books.json"), ("VOCAB", tmp_path / "vocab.json"), ("ADDITIONS", adds),
                        ("REQUEUE", tmp_path / "requeue.json"),
                        ("RUNS", tmp_path / "runs")):
        monkeypatch.setattr(run_daily, name, value)
    monkeypatch.setattr(collect_candidates, "RAW", raw)
    monkeypatch.setattr(collect_candidates, "get_json", lambda *a, **k: {"error": "offline in tests"})
    monkeypatch.setattr(collect_candidates, "time", type("T", (), {"sleep": staticmethod(lambda s: None)}))
    return adds


def full_but_one_keyword() -> list[dict]:
    """Every genre and topic at its launch target; 돈 관리·투자 has no 주식 book yet — the one gap (keyword 주식, 5)."""
    target = PHASES["launch"]
    books = [{"entry": "leaf", "genre": g} for g in GENRES for _ in range(target.genre)]
    books += [{"entry": "target", "topic": t, "keywords": []} for t in FIELD_OF_TOPIC for _ in range(target.topic)]
    return [{**b, "isbn": f"x{i}", "title": f"있는 책 {i}", "author": f"저자 {i}"} for i, b in enumerate(books)]


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
    assert (s["picked"], s["review"], s["reserve"], s["dropped"], s["auto_agreed"], s["flagged"]) == (2, 1, 1, 0, 2, 1)
    assert s["usage"]["claude-haiku-4-5"]["calls"] == 8 and s["cost_usd"] > 0
    doc = json.loads((day / "2026-10-05.json").read_text(encoding="utf-8"))
    by = {b["title"]: b for b in doc["books"]}
    assert by["처음 주식 공부"]["auto"] == "ai-agree" and by["주식 배당 입문"]["flags"] == ["way"]
    assert by["처음 주식 공부"]["status"] == "picked" and by["주식 배당 입문"]["status"] == "review"  # flagged: not live until a review
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
    monkeypatch.setattr(run_daily, "plan_day", lambda *a, **k: [])
    client = FakeClient()
    assert run_daily.run("2026-10-05", CFG, ENV, client)["status"] == "full" and client.messages.calls == []


def test_a_refused_key_stops_the_day_without_a_file(day):
    def refuse(kwargs):
        raise anthropic.AuthenticationError("bad key", response=httpx.Response(401, request=httpx.Request("POST", URL)), body=None)
    client = FakeClient(refuse)
    s = run_daily.run("2026-10-05", CFG, ENV, client)
    assert s["status"] == "anthropic_failed" and s["stopped"] == "AuthenticationError"
    assert len(client.messages.calls) == 1 and not (day / "2026-10-05.json").exists()


@pytest.mark.parametrize("dead, kind", [("B", "check"), ("A", "tag")])
def test_a_dead_pass_stops_the_day_and_keeps_the_finished_books(day, monkeypatch, dead, kind):
    """The shipped config runs ONE model on both passes. The other pass keeps answering between the failures, so the streak
    has to be counted per pass or it would be reset every time."""
    monkeypatch.setattr(run_daily, "Breaker", lambda: Breaker(2))

    def one_pass_down(kwargs):
        text = kwargs["messages"][0]["content"]
        if kind_of(kwargs)[1] == kind and ("주식 투자 수업" in text or "주식 마음 공부" in text):
            raise status_error(529)
        return agreeing(kwargs)
    s = run_daily.run("2026-10-05", CFG, ENV, FakeClient(one_pass_down))
    assert s["status"] == "partial" and s["stopped"] == f"pass {dead} (claude-haiku-4-5): 2 API failures in a row (http_529)"
    assert s["tagged"] == 2 and s["reasons"] == {"ok": 2, "http_529": 1}
    # 2 finished books x 2 passes + the dead pass's first failure + (pass B dead: the interrupted books' pass A, 2 calls)
    assert s["usage"]["claude-haiku-4-5"]["calls"] == (7 if dead == "B" else 5)
    doc = json.loads((day / "2026-10-05.json").read_text(encoding="utf-8"))
    assert [b["title"] for b in doc["books"]] == ["처음 주식 공부", "주식 배당 입문"]


def test_the_two_models_of_a_mixed_config_are_billed_apart_when_a_pass_dies(day, monkeypatch):
    monkeypatch.setattr(run_daily, "Breaker", lambda: Breaker(2))

    def second_down(kwargs):
        if kind_of(kwargs)[1] == "check" and ("주식 투자 수업" in kwargs["messages"][0]["content"] or "주식 마음 공부" in kwargs["messages"][0]["content"]):
            raise status_error(529)
        return agreeing(kwargs)
    s = run_daily.run("2026-10-05", MIXED_CFG, ENV, FakeClient(second_down))
    assert s["stopped"] == "pass B (claude-haiku-4-5): 2 API failures in a row (http_529)"
    assert {m: u["calls"] for m, u in s["usage"].items()} == {"claude-sonnet-5-5": 4, "claude-haiku-4-5": 3}


def test_a_dead_model_before_any_book_is_a_failed_day(day, monkeypatch):
    monkeypatch.setattr(run_daily, "Breaker", lambda: Breaker(2))

    def down(kwargs):
        raise status_error(529)
    s = run_daily.run("2026-10-05", CFG, ENV, FakeClient(down))
    assert s["status"] == "anthropic_failed" and "2 API failures in a row" in s["stopped"]
    assert not (day / "2026-10-05.json").exists()


def test_a_refused_key_after_some_books_keeps_the_finished_ones(day):
    def refuse_third(kwargs):
        if "주식 투자 수업" in kwargs["messages"][0]["content"]:
            raise anthropic.PermissionDeniedError("no", response=httpx.Response(403, request=httpx.Request("POST", URL)), body=None)
        return agreeing(kwargs)
    s = run_daily.run("2026-10-05", CFG, ENV, FakeClient(refuse_third))
    assert s["status"] == "partial" and s["stopped"] == "PermissionDeniedError" and s["tagged"] == 2
    assert [b["title"] for b in json.loads((day / "2026-10-05.json").read_text(encoding="utf-8"))["books"]] == ["처음 주식 공부", "주식 배당 입문"]


def test_an_unexpected_error_in_one_book_does_not_lose_the_others(day):
    def odd(kwargs):
        if "주식 배당 입문" in kwargs["messages"][0]["content"]:
            raise ValueError("boom with 계좌와 주문 inside")
        return agreeing(kwargs)
    s = run_daily.run("2026-10-05", CFG, ENV, FakeClient(odd))
    assert s["status"] == "ok" and s["tagged"] == 3 and s["reasons"] == {"ok": 3, "error:ValueError": 1}
    assert "boom" not in json.dumps(s, ensure_ascii=False)               # the class name only, never the message


def test_a_day_where_nothing_could_be_tagged_is_a_failed_run(day, monkeypatch, capsys):
    monkeypatch.setattr(run_daily, "yes24_env", lambda: ENV)
    monkeypatch.setattr(run_daily, "anthropic_key", lambda: "sk-test")
    monkeypatch.setattr(run_daily, "load_config", lambda count=None: CFG)
    monkeypatch.setattr(anthropic, "Anthropic", lambda **kw: FakeClient(lambda kwargs: message(tag_answer(kind_of(kwargs)[0], way="기타"))))
    assert run_daily.main(["--date", "2026-10-05"]) == 1
    out = capsys.readouterr().out
    assert '"status": "no_books"' in out and '"invalid_answer": 4' in out and not (day / "2026-10-05.json").exists()


def test_a_search_that_listed_nothing_is_not_a_yes24_failure(day, monkeypatch, tmp_path):
    monkeypatch.setattr(collect_candidates, "RAW", tmp_path / "empty")
    monkeypatch.setattr(collect_candidates, "get_json", lambda *a, **k: {"data": {"items": []}})
    monkeypatch.setattr(collect_candidates, "time", type("T", (), {"sleep": staticmethod(lambda s: None)}))
    s = run_daily.run("2026-10-05", CFG, ENV, FakeClient())
    lists = 1 + 2 * len(slot_rule("돈 관리·투자")["cats"]) + len(slot_rule("돈 관리·투자")["q"])  # 주식 search + topic lists
    assert s["status"] == "no_candidates" and s["yes24_failures"] == 0 and s["yes24_empty"] == lists


def test_a_candidate_without_author_or_pages_is_not_tagged_and_not_written(day):
    cand = Candidate("target", "돈 관리·투자", "9790000000031", "제목", "", 0, "https://y/1", INTRO, TOC)
    client = FakeClient()
    rec, why = run_daily.tag_one(client, CFG, {}, {"돈 관리·투자": {"kept": {}}}, cand, Breaker(), {})
    assert (rec, why) == (None, "incomplete_candidate") and client.messages.calls == []
    with pytest.raises(ValueError, match="needs an author"):
        record(cand, tag_answer("target"), check_answer("target"), [], [], "picked", None, [])


def test_a_run_whose_books_keep_failing_stops_early_to_save_cost(day, monkeypatch):
    monkeypatch.setattr(run_daily, "MIN_ATTEMPTS", 3)

    def broken_after_the_first(kwargs):
        text = kwargs["messages"][0]["content"]
        if "처음 주식 공부" in text:
            return agreeing(kwargs)
        return message({"fits": True}, stop="max_tokens")                       # book-level failure: the breaker never sees it
    client = FakeClient(broken_after_the_first)
    s = run_daily.run("2026-10-05", CFG, ENV, client)
    assert s["status"] == "partial" and s["tagged"] == 1 and s["reasons"] == {"ok": 1, "max_tokens": 2}
    assert s["stopped"] == "2 of 3 books failed (max_tokens) — over 30%, stopped to save cost"
    assert len(client.messages.calls) == 4                                       # book 4 was never tried
    assert [b["title"] for b in json.loads((day / "2026-10-05.json").read_text(encoding="utf-8"))["books"]] == ["처음 주식 공부"]


def test_a_few_failures_do_not_stop_a_long_enough_run(day, monkeypatch):
    monkeypatch.setattr(run_daily, "MIN_ATTEMPTS", 4)

    def one_bad(kwargs):
        return message({"fits": True}, stop="max_tokens") if "주식 투자 수업" in kwargs["messages"][0]["content"] else agreeing(kwargs)
    s = run_daily.run("2026-10-05", CFG, ENV, FakeClient(one_bad))               # 1 of 4 = 25% <= 30%
    assert s["status"] == "ok" and s["tagged"] == 3 and s["stopped"] is None


def test_yes24_failing_ends_the_day(day, monkeypatch, tmp_path):
    monkeypatch.setattr(collect_candidates, "RAW", tmp_path / "empty")
    monkeypatch.setattr(collect_candidates, "time", type("T", (), {"sleep": staticmethod(lambda s: None)}))
    client = FakeClient()
    s = run_daily.run("2026-10-05", CFG, ENV, client)
    assert s["status"] == "yes24_failed"
    assert s["yes24_failed_paths"] == ["/category/bestseller", "/category/bestsellerSteady", "/goods/itemList"]  # paths only
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
         "second_model": "claude-haiku-4-5", "target_phase": "launch"}))
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


def test_a_target_book_keeps_pass_as_keyword_candidate_or_null(day):
    def names(kwargs):
        entry, kind = kind_of(kwargs)
        text = kwargs["messages"][0]["content"]
        if kind == "tag" and "처음 주식 공부" in text:
            return message(tag_answer(entry, new_keyword=" <배당 투자> "))
        if kind == "tag" and "주식 배당 입문" in text:
            return message(tag_answer(entry, new_keyword="주식"))           # already on the list → no candidate
        return agreeing(kwargs)
    run_daily.run("2026-10-05", CFG, ENV, FakeClient(names))
    by = {b["title"]: b for b in json.loads((day / "2026-10-05.json").read_text(encoding="utf-8"))["books"]}
    assert by["처음 주식 공부"]["keyword_candidate"] == "배당 투자"
    assert by["주식 배당 입문"]["keyword_candidate"] is None and by["주식 투자 수업"]["keyword_candidate"] is None


def test_the_run_passes_the_topics_excluded_names_to_the_parser(day, tmp_path):
    vocab = {"돈 관리·투자": {"kept": {"주식": {"pattern": "주식|배당"}}, "folded": {"코인": 1}}}
    (tmp_path / "vocab.json").write_text(json.dumps(vocab, ensure_ascii=False), encoding="utf-8")
    def coin(kwargs):
        entry, kind = kind_of(kwargs)
        return message(tag_answer(entry, new_keyword="코인")) if kind == "tag" else agreeing(kwargs)
    run_daily.run("2026-10-05", CFG, ENV, FakeClient(coin))
    books = json.loads((day / "2026-10-05.json").read_text(encoding="utf-8"))["books"]
    assert books and all(b["keyword_candidate"] is None for b in books)


def test_a_second_batch_the_same_day_never_offers_a_book_of_the_first(day, monkeypatch, tmp_path):
    first = run_daily.run("2026-10-05", parse_config({**CFG.__dict__, "daily_count": 2}), ENV, FakeClient())
    assert first["status"] == "ok" and first["batch"] == "2026-10-05"
    second = run_daily.run("2026-10-05-2", CFG, ENV, FakeClient())                 # the first batch is merged: its file is on main
    assert second["date"] == "2026-10-05" and second["batch"] == "2026-10-05-2"
    one = json.loads((day / "2026-10-05.json").read_text(encoding="utf-8"))
    two = json.loads((day / "2026-10-05-2.json").read_text(encoding="utf-8"))
    isbns = lambda d: {b["isbn"] for b in d["books"]}  # noqa: E731
    assert len(isbns(one)) == 2 and len(isbns(two)) == 3 and not isbns(one) & isbns(two)
    assert (one["date"], one["batch_id"], two["date"], two["batch_id"]) == ("2026-10-05", "2026-10-05", "2026-10-05", "2026-10-05-2")
    assert two["batch"] == "daily"                                                   # the kind of file, as before


def test_main_keys_a_later_batch_by_its_id_and_checks_it(day, monkeypatch, tmp_path, capsys):
    monkeypatch.setattr(run_daily, "yes24_env", lambda: ENV)
    monkeypatch.setattr(run_daily, "anthropic_key", lambda: "sk-test-secret-value")
    monkeypatch.setattr(run_daily, "load_config", lambda count=None: CFG)
    monkeypatch.setattr(anthropic, "Anthropic", lambda **kw: FakeClient())
    (day / "2026-10-05.json").write_text(json.dumps({"date": "2026-10-05", "books": []}), encoding="utf-8")
    assert run_daily.main(["--batch", "2026-10-05-2"]) == 0
    assert json.loads((tmp_path / "runs" / "2026-10-05-2.json").read_text(encoding="utf-8"))["batch"] == "2026-10-05-2"
    assert (day / "2026-10-05-2.json").exists() and not (tmp_path / "runs" / "2026-10-05.json").exists()
    assert run_daily.main(["--batch", "2026-10-05-2"]) == 0 and "already exists" in capsys.readouterr().out
    for bad in (["--batch", "2026-10-05-1"], ["--batch", "2026-10-05-pilot"], ["--date", "2026-10-04", "--batch", "2026-10-05-2"]):
        with pytest.raises(SystemExit):
            run_daily.main(bad)
