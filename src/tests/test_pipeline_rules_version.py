"""Pipeline: the rules version stamped on every tagged record (src/pipeline/rules_version.py, plans/2026-10-06-calibration.md 5)."""
import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from pipeline_fakes import INTRO, TOC, FakeClient  # noqa: E402
from test_pipeline_retag import CFG, VOCAB, batch, texts  # noqa: E402,F401 — the fixture is reused

from pipeline import retag, run_daily  # noqa: E402
from pipeline import rules_version as rv  # noqa: E402
from pipeline.candidates import Candidate  # noqa: E402
from pipeline.tagger import Breaker  # noqa: E402


def test_the_version_is_read_from_the_dictionary_heading(tmp_path):
    doc = tmp_path / "label-dictionary.md"
    doc.write_text("# 라벨 정의서 v3 (2026-10-06)\n\n## 온도\n", encoding="utf-8")
    assert rv.rules_version(doc) == "v3"


def test_a_version_line_also_counts_and_minor_versions_are_kept(tmp_path):
    doc = tmp_path / "label-dictionary.md"
    doc.write_text("# 라벨 정의서\n\n버전: v3.1 · 2026-10-07\n\n## 세계 v9 예시\n", encoding="utf-8")
    assert rv.rules_version(doc) == "v3.1"


def test_no_dictionary_or_no_version_gives_the_fallback(tmp_path):
    assert rv.rules_version(tmp_path / "none.md") == rv.FALLBACK
    doc = tmp_path / "label-dictionary.md"
    doc.write_text("# 라벨 정의서\n\n본문만 있어요\n", encoding="utf-8")
    assert rv.rules_version(doc) == rv.FALLBACK


def test_tag_one_stamps_the_version_given_or_read(monkeypatch):
    cand = Candidate("target", "돈 관리·투자", "9791100000001", "주식 첫걸음", "가 저", 200, "", INTRO, TOC)
    rec, why = run_daily.tag_one(FakeClient(), CFG, {"tag": "", "check": ""}, VOCAB, cand, Breaker(), {}, rules="v7")
    assert why == "ok" and rec["rules_version"] == "v7"
    monkeypatch.setattr(run_daily, "rules_version", lambda: "v5")
    rec, _ = run_daily.tag_one(FakeClient(), CFG, {"tag": "", "check": ""}, VOCAB, cand, Breaker(), {})
    assert rec["rules_version"] == "v5"


def test_a_retagged_batch_carries_the_version_on_every_book(batch, monkeypatch):  # noqa: F811
    monkeypatch.setattr(retag, "rules_version", lambda: "v3")
    new, summary = retag.run("2026-10-05-2", CFG, FakeClient(), VOCAB, texts)
    assert {b["rules_version"] for b in new["books"]} == {"v3"} and summary["rules_version"] == "v3"
    assert new["rules_version"] == "v3" and "v3" in json.dumps(summary)
