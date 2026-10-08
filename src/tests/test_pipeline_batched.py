"""Message Batches mode (route plan 10-08): the same requests as a direct run, sent as batches at half the price."""
import json
import sys
from pathlib import Path
from types import SimpleNamespace

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from pipeline import batched, run_daily  # noqa: E402
from pipeline.tagger import request  # noqa: E402
from pipeline_fakes import FakeBatchClient, FakeClient, agreeing, kind_of  # noqa: E402
from test_pipeline_run_daily import CFG, ENV, day, mixed  # noqa: E402,F401  (day: the fixture)


def test_the_recorder_answers_from_results_and_holds_any_other_request_back():
    rec = batched.Recorder()
    kwargs = request("claude-haiku-4-5", "S", "U", {"type": "object"})
    rec.begin("1")
    try:
        rec.messages.create(**kwargs)
        raise AssertionError("an unknown request must wait")
    except batched.Waiting:
        pass
    assert list(rec.pending.values()) == [kwargs]
    rec.answers[next(iter(rec.pending))] = "the message"
    rec.begin("1")  # the next round runs the book again
    assert rec.messages.create(**kwargs) == "the message"
    rec.begin("2")  # another edition with the very same text is its own request, as in a direct run
    try:
        rec.messages.create(**kwargs)
        raise AssertionError("another book must not share the answer")
    except batched.Waiting:
        pass


def test_a_request_becomes_batch_params_with_its_sdk_only_options_in_the_body():
    kwargs = request("claude-haiku-4-5", "S", "U", {"type": "object"})
    row = batched.row(batched.key(kwargs), kwargs)
    assert len(row["custom_id"]) <= 64 and row["custom_id"] == batched.key(kwargs)
    assert "extra_body" not in row["params"] and row["params"]["temperature"] == 0
    assert row["params"]["output_config"] == kwargs["output_config"] and "extra_body" in kwargs  # the request is untouched


def test_a_batched_day_writes_what_a_direct_day_writes_at_half_the_price(day):
    direct = run_daily.run("2026-10-05", CFG, ENV, FakeClient(mixed))
    path = day / "2026-10-05.json"
    first = json.loads(path.read_text(encoding="utf-8"))
    path.unlink()  # the same day again, so the same books are offered
    client = FakeBatchClient(mixed)
    batch = run_daily.run("2026-10-05", CFG, ENV, client, batches=True, sleep=lambda s: None)
    assert json.loads(path.read_text(encoding="utf-8")) == first
    assert batch["usage"] == direct["usage"]                         # every call counted once, replays are free
    assert batch["cost_usd"] == round(direct["cost_usd"] * batched.DISCOUNT, 4)
    assert {k: batch[k] for k in ("picked", "review", "reserve", "third_pass")} == \
        {k: direct[k] for k in ("picked", "review", "reserve", "third_pass")}
    sent = client.messages.batches.sent
    # round 1: pass A and, fetched ahead, pass B of all 4 books; round 2: the one-liner retry and pass C
    # round 1: pass A and, fetched ahead, pass B of all 4 books; round 2: the one-liner retry and pass C — pass C asks
    # what pass B asked, word for word, and still gets its own answer (a replay of B's would always side with B)
    assert [sorted(kind_of(r["params"])[1] for r in s) for s in sent] == [["check"] * 4 + ["tag"] * 4, ["check", "fix"]]
    assert batch["batches"]["ids"] == ["msgbatch_1", "msgbatch_2"]


def test_the_same_request_twice_in_one_book_is_two_requests():
    rec = batched.Recorder()
    kwargs = request("claude-haiku-4-5", "S", "U", {"type": "object"})
    rec.begin("1")
    for _ in range(2):
        try:
            rec.messages.create(**kwargs)
        except batched.Waiting:
            pass
    assert len(rec.pending) == 2
    first, second = rec.pending
    rec.answers |= {first: "B", second: "C"}
    rec.pending = {}
    rec.begin("1")  # the book runs again in the next round: the same two answers, in order
    assert [rec.messages.create(**kwargs), rec.messages.create(**kwargs)] == ["B", "C"]


def test_a_request_the_batch_could_not_answer_fails_only_its_book(day):
    def result(params):
        if "주식 배당 입문" in params["messages"][0]["content"]:
            return SimpleNamespace(type="errored", error=SimpleNamespace(type="error"))
        return None
    s = run_daily.run("2026-10-05", CFG, ENV, FakeBatchClient(agreeing, result), batches=True, sleep=lambda x: None)
    assert s["tagged"] == 3 and s["reasons"].get("batch_errored") == 1 and s["status"] == "ok"


def test_a_batch_api_error_stops_the_day_and_keeps_the_finished_books(day):
    import anthropic
    import httpx2 as httpx

    client = FakeBatchClient(agreeing)

    def refused(requests):
        resp = httpx.Response(401, request=httpx.Request("POST", "https://api.anthropic.com/v1/messages/batches"))
        raise anthropic.AuthenticationError("no", response=resp, body=None)
    client.messages.batches.create = refused
    s = run_daily.run("2026-10-05", CFG, ENV, client, batches=True, sleep=lambda x: None)
    assert s["status"] == "anthropic_failed" and "AuthenticationError" in s["stopped"]


def test_main_sends_batches_when_asked(day, monkeypatch, capsys):
    seen = {}
    monkeypatch.setattr(run_daily, "run", lambda *a, **k: seen.update(k) or {"status": "ok"})
    monkeypatch.setattr(run_daily, "anthropic_key", lambda: "not-real")
    monkeypatch.setattr(run_daily, "yes24_env", lambda: ENV)
    assert run_daily.main(["--batch", "2026-10-09", "--batches"]) == 0
    assert seen.get("batches") is True


def test_a_prefetched_pass_b_is_paid_for_even_when_its_book_fails(day):
    def result(params):  # every pass A comes back unanswered; the pass B asked ahead was answered (and billed)
        if "one_liner" in params["output_config"]["format"]["schema"]["properties"]:
            return SimpleNamespace(type="expired")
        return None
    s = run_daily.run("2026-10-05", CFG, ENV, FakeBatchClient(agreeing, result), batches=True, sleep=lambda x: None)
    assert s["tagged"] == 0 and s["usage"]["claude-haiku-4-5"]["calls"] == 8 and s["cost_usd"] > 0


def test_a_passing_network_error_while_waiting_does_not_lose_a_paid_batch(day):
    import anthropic
    import httpx2 as httpx

    client, failures = FakeBatchClient(agreeing), iter([1, 1])
    real = client.messages.batches.retrieve

    def flaky(batch_id):
        if next(failures, None):
            raise anthropic.APIConnectionError(request=httpx.Request("GET", "https://api.anthropic.com/v1/messages/batches"))
        return real(batch_id)
    client.messages.batches.retrieve = flaky
    s = run_daily.run("2026-10-05", CFG, ENV, client, batches=True, sleep=lambda x: None)
    assert s["status"] == "ok" and s["tagged"] == 4
