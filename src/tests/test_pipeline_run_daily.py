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
    """Book 2: the second pass reads the way differently. Book 3: pass A writes a one-liner that breaks the rules, and its
    retry still does."""
    entry, kind = kind_of(kwargs)
    text = kwargs["messages"][0]["content"]
    if "주식 배당 입문" in text and kind == "check":
        return message({"fits": True, "keywords": ["주식"], "way": "실습", "why": "따라 하기 중심"})
    if "주식 투자 수업" in text and kind == "tag":
        return message(tag_answer(entry, one_liner="짧아요"))
    if "주식 투자 수업" in text and kind == "fix":
        return message({"one_liner": "조금 길어졌어요"})
    return agreeing(kwargs)


def test_a_day_writes_our_tags_and_a_summary(day):
    client = FakeClient(mixed)
    s = run_daily.run("2026-10-05", CFG, ENV, client)
    assert s["status"] == "ok" and s["wanted"] == 4 and s["slots"] == ["돈 관리·투자/주식 4"] and s["candidates"] == 4
    # book 2's way split goes to pass C, which reads it like pass B: two of three settle it (route plan 3, 10-08)
    assert (s["picked"], s["review"], s["reserve"], s["dropped"], s["auto_agreed"], s["flagged"]) == (3, 0, 1, 0, 3, 0)
    assert s["third_pass"] == {"books": 1, "settled": 1}
    assert s["usage"]["claude-haiku-4-5"]["calls"] == 10 and s["cost_usd"] > 0  # 4 books × 2 passes + 1 retry + 1 pass C
    assert {k: s["one_liner_retries"][k] for k in ("tried", "fixed", "still_failing", "call_failed")} ==         {"tried": 1, "fixed": 0, "still_failing": 1, "call_failed": 0}
    assert s["one_liner_retries"]["usage"]["claude-haiku-4-5"]["calls"] == 1 and 0 < s["one_liner_retries"]["cost_usd"] < s["cost_usd"]
    doc = json.loads((day / "2026-10-05.json").read_text(encoding="utf-8"))
    by = {b["title"]: b for b in doc["books"]}
    assert by["처음 주식 공부"]["auto"] == "ai-agree" and by["처음 주식 공부"]["status"] == "picked"
    settled = by["주식 배당 입문"]
    assert (settled["way"], settled["a_was"], settled["settled"], settled["flags"]) == ("실습", {"way": "개념"}, {"way": "실습"}, [])
    assert settled["second"]["way"] == "실습" and settled["third"]["way"] == "실습" and "why" not in settled["third"]
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


def test_the_cached_prefix_is_the_same_for_every_book_of_a_kind():
    """Model, system and output_config (the schema is part of the cached prefix) must not depend on the book or the slot:
    a per-topic keyword enum made every 🎯 topic its own ~23k-token cache write (10-06). Only messages may differ."""
    vocab = {"돈 관리·투자": {"kept": {"주식": {"pattern": "주식"}, "ETF·펀드": {"pattern": "ETF"}}},
             "글쓰기": {"kept": {"업무 글": {"pattern": "업무"}, "주식": {"pattern": "주식"}}}}
    prompts = {"tag": "TAG RULES", "check": "CHECK RULES"}
    books = [Candidate("target", "돈 관리·투자", "9790000000011", "주식 첫걸음", "가 저", 200, "https://y/1", INTRO, TOC),
             Candidate("target", "글쓰기", "9790000000012", "업무 글쓰기", "나 저", 180, "https://y/2", "다른 소개 " + INTRO, TOC),
             Candidate("leaf", "한국 소설", "9790000000013", "소설 하나", "다 저", 300, "https://y/3", INTRO, TOC),
             Candidate("leaf", "SF·판타지", "9790000000014", "소설 둘", "라 저", 320, "https://y/4", INTRO + " 끝", TOC)]
    client = FakeClient()
    for cand in books:
        run_daily.tag_one(client, MIXED_CFG, prompts, vocab, cand, Breaker(), {}, rules="v")
    prefix = lambda kw: json.dumps({k: v for k, v in kw.items() if k != "messages"}, ensure_ascii=False, sort_keys=True)  # noqa: E731
    seen: dict = {}
    for kw in client.messages.calls:
        seen.setdefault(kind_of(kw), set()).add(prefix(kw))
    assert {("target", "tag"), ("target", "check"), ("leaf", "tag"), ("leaf", "check")} <= set(seen)
    assert all(len(p) == 1 for p in seen.values()), {k: len(p) for k, p in seen.items()}
    keywords = json.loads(next(iter(seen["target", "tag"])))["output_config"]["format"]["schema"]["properties"]["keywords"]
    assert keywords["items"]["enum"] == ["주식", "ETF·펀드", "업무 글"]


LEAF = Candidate("leaf", "한국 소설", "9790000000021", "소설 하나", "다 저", 300, "https://y/21", INTRO, TOC)
ZEROS = {"temp": 0, "pull": 0, "gain": 0, "world": 0, "signals": {"temp": "", "pull": "", "gain": "", "world": ""}}
FIXED = {"temp": 1, "pull": -1, "gain": 0, "world": 1,
         "signals": {"temp": "끝맺음 +", "pull": "몰입 −: 사건", "gain": "0 반반", "world": "현실"}, "missing": []}


def test_a_pass_with_values_its_signals_do_not_back_is_asked_once_more_and_counted():
    """10-06 calibration: AI-2 gave 넥서스 four 0s with no signal — a failed pass, asked again automatically."""
    from pipeline.one_liner import RetryLog

    def empty_b(kwargs):
        entry, kind = kind_of(kwargs)
        if kind == "check":
            return message(check_answer(entry, **ZEROS))
        if kind == "axisfix":
            return message(FIXED)
        return agreeing(kwargs)
    client, ledger, axis_log = FakeClient(empty_b), {}, RetryLog()
    rec, why = run_daily.tag_one(client, CFG, {"tag": "T", "check": "C"}, {}, LEAF, Breaker(), ledger, RetryLog(), "v",
                                 axis_log)
    assert why == "ok" and rec["second"]["axes"] == {"temp": 1, "pull": -1, "gain": 0, "world": 1}
    assert rec["second"]["signals"]["pull"] == "몰입 −: 사건"
    fix = [kw for kw in client.messages.calls if kind_of(kw)[1] == "axisfix"]
    assert len(fix) == 1 and fix[0]["model"] == CFG.second_model and len(client.messages.calls) == 3
    assert axis_log.summary()["tried"] == 1 and axis_log.summary()["fixed"] == 1
    assert ledger[CFG.model].calls == 3                       # the re-ask is in the run's ledger too (haiku on both passes)


def test_an_axis_one_pass_left_empty_waits_for_a_person_and_both_empty_is_decided_as_empty():
    """v3.1 rule 9 (10-07): one pass empty → the book waits for a person; both passes empty → empty is final, the book
    goes in (the app scores an empty axis 0)."""
    def no_info(passes):
        def answer(kwargs):
            entry, kind = kind_of(kwargs)
            if kind in passes:
                make = tag_answer if kind == "tag" else check_answer
                return message(make(entry, pull=None, missing=["pull"], signals={**FIXED["signals"], "pull": ""}))
            if kind in ("tag", "check"):
                return message((tag_answer if kind == "tag" else check_answer)(entry, **FIXED))
            return agreeing(kwargs)
        return answer
    for cfg in (CFG, parse_config({**CFG.__dict__, "auto_merge": True})):
        rec, why = run_daily.tag_one(FakeClient(no_info(("check",))), cfg, {"tag": "T", "check": "C"}, {}, LEAF, Breaker(),
                                     {}, rules="v")
        assert why == "ok" and rec["second"]["axes"]["pull"] is None and "pull" in rec["flags"]
        assert rec["status"] in ("review", "reserve") and rec["status"] != "picked"
    rec, why = run_daily.tag_one(FakeClient(no_info(("tag", "check"))), CFG, {"tag": "T", "check": "C"}, {}, LEAF, Breaker(),
                                 {}, rules="v")
    assert why == "ok" and rec["axes"]["pull"] is None and "pull" not in rec["flags"]


def test_a_suggested_slot_is_kept_on_the_record_for_the_review_page():
    vocab = {"돈 관리·투자": {"kept": {"주식": {"pattern": "주식"}}}, "경제 상식": {"kept": {"금리·환율": {"pattern": "금리"}}}}
    cand = Candidate("target", "돈 관리·투자", "9790000000022", "경제 이야기", "가 저", 200, "https://y/22", INTRO, TOC)

    def moves(kwargs):
        entry, kind = kind_of(kwargs)
        if kind == "tag":
            return message(tag_answer(entry, fits=False, suggest="경제 상식", suggest_keywords=["금리·환율"]))
        if kind == "check":
            return message(check_answer(entry, fits=False, suggest="경제 상식", suggest_keywords=["금리·환율", "주식"]))
        return agreeing(kwargs)
    rec, _ = run_daily.tag_one(FakeClient(moves), CFG, {"tag": "T", "check": "C"}, vocab, cand, Breaker(), {}, rules="v")
    assert rec["suggest"] == "경제 상식" and rec["suggest_keywords"] == ["금리·환율"]
    assert rec["second"]["suggest"] == "경제 상식" and rec["second"]["suggest_keywords"] == ["금리·환율"]
    rec, _ = run_daily.tag_one(FakeClient(), CFG, {"tag": "T", "check": "C"}, {}, LEAF, Breaker(), {}, rules="v")
    assert rec["suggest"] == "" and rec["second"]["suggest"] == ""


def crossing(slot):
    def answer(kwargs):
        entry, kind = kind_of(kwargs)
        if kind == "tag":
            return message(tag_answer(entry, fits=False, suggest=slot))
        if kind == "check":
            return message(check_answer(entry, fits=False, suggest=slot))
        return agreeing(kwargs)
    return answer


def test_a_book_both_passes_send_to_the_other_entry_is_dropped_here_and_requeued_there(day):
    """10-08: no person needed — both passes name the same 🍃 genre for a 🎯 book; the next batch tags it as 🍃."""
    summary = run_daily.run("2026-10-02", CFG, ENV, FakeClient(crossing("에세이")))
    doc = json.loads((day / "2026-10-02.json").read_text(encoding="utf-8"))
    assert all(b["status"] == "dropped" and b["requeued_to"] == {"entry": "leaf", "slot": "에세이"} for b in doc["books"])
    rows = json.loads(run_daily.REQUEUE.read_text(encoding="utf-8"))
    assert sorted(r["isbn"] for r in rows) == sorted(b["isbn"] for b in doc["books"])
    assert {(r["to_entry"], r["to_slot"], r["from_batch"]) for r in rows} == {("leaf", "에세이", "2026-10-02")}
    assert summary["dropped"] == len(doc["books"]) and summary["crossed"] == len(doc["books"])


def test_a_requeued_book_sent_back_again_waits_for_a_person_instead_of_bouncing(day):
    cand = Candidate("leaf", "에세이", "9790000000011", "처음 주식 공부", "저자11 저", 211, "https://y/11", INTRO, TOC)
    rec, _ = run_daily.tag_one(FakeClient(crossing("돈 관리·투자")), CFG, {"tag": "T", "check": "C"}, {}, cand, Breaker(),
                               {}, rules="v", routed=True, requeued=True)
    assert rec["status"] == "review" and "requeued_to" not in rec and "fits" in rec["flags"]
