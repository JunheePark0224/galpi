"""Pipeline: re-tagging a batch with today's instructions into a new file (src/pipeline/retag.py) — fake client, no keys."""
import json
import sys
from pathlib import Path

import pytest

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from pipeline import retag  # noqa: E402
from pipeline.config import parse_config  # noqa: E402
from pipeline_fakes import INTRO, TOC, FakeClient, agreeing, check_answer, kind_of, message  # noqa: E402

CFG = parse_config({"daily_count": 4, "auto_merge": False, "sample_rate": 0.1, "model": "claude-haiku-4-5",
                    "second_model": "claude-haiku-4-5", "target_phase": "launch"})
VOCAB = {"돈 관리·투자": {"kept": {"주식": {"pattern": "주식|배당"}}}}


def book(isbn, entry, status="picked", **over):
    base = {"isbn": isbn, "title": f"책{isbn}", "author": "가 저", "pages": 200, "entry": entry, "link": "https://y/1",
            "status": status, "fits": True, "flags": [], "issues": [], "one_liner": "옛 한 줄", "evidence": "옛 근거",
            "confidence": 0.9}
    side = {"topic": "돈 관리·투자", "keywords": ["주식"], "way": "개념"} if entry == "target" else \
        {"genre": "에세이", "axes": {"temp": 0, "pull": 0, "gain": 0, "world": 1}}
    return base | side | over


@pytest.fixture
def batch(tmp_path, monkeypatch):
    adds = tmp_path / "additions"
    adds.mkdir()
    doc = {"date": "2026-10-05", "batch_id": "2026-10-05-2", "batch": "daily", "reviewed": False, "model": "m",
           "second_model": "m", "trial_sample": ["2"],
           "books": [book("1", "leaf", "review", flags=["temp", "confidence"]), book("2", "target", auto="ai-agree"),
                     book("3", "leaf", "dropped", fits=False), book("4", "leaf")]}
    (adds / "2026-10-05-2.json").write_text(json.dumps(doc, ensure_ascii=False), encoding="utf-8")
    monkeypatch.setattr(retag, "ADDITIONS", adds)
    return adds, doc


def texts(isbn):
    return ("", "") if isbn == "4" else (INTRO, TOC)


def test_every_non_dropped_book_is_tagged_again_into_a_new_file_and_the_original_is_untouched(batch):
    adds, doc = batch
    before = (adds / "2026-10-05-2.json").read_text(encoding="utf-8")
    new, summary = retag.run("2026-10-05-2", CFG, FakeClient(), VOCAB, texts)
    assert (adds / "2026-10-05-2.json").read_text(encoding="utf-8") == before
    assert [b["isbn"] for b in new["books"]] == ["1", "2"]                 # 3 dropped, 4 has no cached text
    assert summary["skipped_no_text"] == ["4"] and summary["tagged"] == 2 and summary["stopped"] is None
    assert new["trial_sample"] == ["2"] and new["retag_of"] == "2026-10-05-2" and new["batch_id"] == "2026-10-05-2.v2"
    leaf = new["books"][0]
    assert leaf["signals"]["temp"] and leaf["missing"] == [] and "signals" in leaf["second"]
    assert leaf["flags"] == [] and leaf["status"] == "picked" and leaf["one_liner"] != "옛 한 줄"   # today's rules decide
    assert summary["cost_usd"] > 0 and INTRO[:20] not in json.dumps(new, ensure_ascii=False)


def test_the_new_file_is_written_once_and_never_over_an_existing_one(batch, capsys):
    adds, _ = batch
    path = retag.write("2026-10-05-2", *retag.run("2026-10-05-2", CFG, FakeClient(), VOCAB, texts)[:1])
    assert path == adds / "2026-10-05-2.v2.json" and json.loads(path.read_text(encoding="utf-8"))["books"]
    with pytest.raises(FileExistsError):
        retag.write("2026-10-05-2", {"books": []})


def test_a_missing_info_axis_is_asked_even_when_both_passes_agree(batch):
    def answer(kw):
        entry, kind = kind_of(kw)
        if entry == "leaf" and kind == "check":
            return message(check_answer("leaf", missing=["temp"]))
        return agreeing(kw)
    new, _ = retag.run("2026-10-05-2", CFG, FakeClient(answer), VOCAB, texts)
    assert new["books"][0]["flags"] == ["temp"] and new["books"][0]["status"] == "review"


def test_the_run_stops_at_the_cost_cap_and_writes_nothing(batch):
    new, summary = retag.run("2026-10-05-2", CFG, FakeClient(), VOCAB, texts, max_cost=0.0001)
    assert new is None and "cost cap" in summary["stopped"] and summary["tagged"] == 1
