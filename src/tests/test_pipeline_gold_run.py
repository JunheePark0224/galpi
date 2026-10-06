"""Pipeline: tagging the gold set with both passes (src/pipeline/gold.py calibrate) — fake client, no keys, no network."""
import json
import sys
from pathlib import Path

import anthropic
import httpx
import pytest

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from pipeline_fakes import INTRO, TOC, FakeClient, agreeing  # noqa: E402
from test_pipeline_retag import CFG, VOCAB  # noqa: E402

from pipeline import gold  # noqa: E402

ROWS = [{"isbn": "1", "title": "주식 첫걸음", "entry": "target", "slot": "돈 관리·투자"},
        {"isbn": "2", "title": "어떤 소설", "entry": "leaf", "slot": "한국 소설"},
        {"isbn": "3", "title": "글 없는 책", "entry": "leaf", "slot": "시"}]
POOL = {r["isbn"]: {**r, "author": "가 저", "pages": 200, "link": "", "dropped": False} for r in ROWS}


def texts(isbn):
    return ("", "") if isbn == "3" else (INTRO, TOC)


def test_both_passes_tag_every_gold_book_with_text_and_each_record_has_the_rules_version():
    doc, summary = gold.calibrate(ROWS, POOL, CFG, FakeClient(), VOCAB, texts, runs=2, rules="v3")
    assert [(r["run"], r["isbn"]) for r in doc["results"]] == [(1, "1"), (1, "2"), (2, "1"), (2, "2")]
    assert all(r["record"]["rules_version"] == "v3" for r in doc["results"])
    leaf = doc["results"][1]["record"]
    assert leaf["axes"] and leaf["signals"]["temp"] and "axes" in leaf["second"]
    assert doc["skipped_no_text"] == ["3"] and doc["rules_version"] == "v3" and doc["runs"] == 2
    assert summary["cost_usd"] > 0 and summary["stopped"] is None and summary["tagged"] == 4
    assert INTRO[:20] not in json.dumps(doc, ensure_ascii=False) and TOC[:10] not in json.dumps(doc, ensure_ascii=False)


def test_the_slot_given_to_the_tagger_is_the_gold_slot():
    client = FakeClient()
    gold.calibrate(ROWS[:1], POOL, CFG, client, VOCAB, texts, runs=1, rules="v3")
    assert "slot: 돈 관리·투자" in client.messages.calls[0]["messages"][0]["content"]


def test_a_dead_key_stops_the_run_and_keeps_what_was_tagged():
    calls = {"n": 0}

    def answer(kw):
        calls["n"] += 1
        if calls["n"] > 2:  # book 1 done (A + B), then the key is refused
            raise anthropic.AuthenticationError("no", response=httpx.Response(401, request=httpx.Request("POST", "http://x")),
                                                body=None)
        return agreeing(kw)
    doc, summary = gold.calibrate(ROWS, POOL, CFG, FakeClient(answer), VOCAB, texts, runs=1, rules="v3")
    assert summary["stopped"] == "AuthenticationError" and [r["isbn"] for r in doc["results"]] == ["1"]


def test_the_cost_cap_stops_the_run():
    doc, summary = gold.calibrate(ROWS, POOL, CFG, FakeClient(), VOCAB, texts, runs=3, rules="v3", max_cost=0.0001)
    assert "cost cap" in summary["stopped"] and len(doc["results"]) == 1


def test_the_estimate_is_about_80_cents_for_40_books_a_run():
    assert 0.7 <= gold.estimate(40, 1) <= 0.9 and gold.estimate(40, 3) == pytest.approx(3 * gold.estimate(40, 1))


def test_a_failed_book_is_named_not_fatal():
    def answer(kw):
        msg = agreeing(kw)
        if "어떤 소설" in kw["messages"][0]["content"]:
            msg.stop_reason = "refusal"
        return msg
    doc, summary = gold.calibrate(ROWS, POOL, CFG, FakeClient(answer), VOCAB, texts, runs=1, rules="v3")
    assert doc["failed"] == {"1:2": "refusal"} and [r["isbn"] for r in doc["results"]] == ["1"]
