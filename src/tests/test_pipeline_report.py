"""Pipeline: axis balance and the PR body (src/pipeline/report.py)."""
import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from pipeline import report  # noqa: E402
from pipeline_fakes import INTRO  # noqa: E402

LEAF = [{"entry": "leaf", "genre": "SF·판타지", "axes": {"temp": t, "pull": -1, "gain": 1, "world": -1}} for t in (1, 1, -1, 0)]
SIM_OK = {"fill_pct": 98.0, "genres_per_draw": 3.8}
OK = {"auto_agreed": 1, "flagged": 1, "dropped": 0, "candidates": 3, "wanted": 4, "cost_usd": 0.03, "status": "ok", "tagged": 3}
GRAD = {"streak": 3, "graduated": True}


def doc_of(n_agreed=1):
    agreed = [{"title": f"일치 책 {i}", "entry": "target", "topic": "돈 관리·투자", "keywords": ["주식"], "way": "개념",
               "one_liner": "주식의 첫걸음을 알려줘요", "status": "picked", "auto": "ai-agree", "flags": [], "isbn": f"97900{i:08d}"}
              for i in range(n_agreed)]
    return {"date": "2026-10-05", "model": "claude-haiku-4-5", "second_model": "claude-haiku-4-5", "books": [
        *agreed,
        {"title": "별의 집", "entry": "leaf", "genre": "SF·판타지", "axes": {"temp": 1, "pull": -1, "gain": 0, "world": -1},
         "one_liner": "다른 별의 집은 어떤 모양일까요?", "status": "picked", "flags": ["world"], "isbn": "1"},
        {"title": "대기 | 책", "entry": "leaf", "genre": "시", "status": "reserve", "issues": ["짧음(9자)"], "isbn": "2"}]}


def test_axis_shares_and_warnings():
    shares = report.axis_shares(LEAF)
    assert shares["temp"] == (50.0, 25.0) and shares["pull"] == (0.0, 100.0)
    w = report.warnings({"fill_pct": 90.0, "genres_per_draw": 3.8}, shares)
    assert w[0].startswith("🍃 첫 뽑기 채움 90.0%") and any(x.startswith("축 pull") for x in w)
    assert report.warnings(SIM_OK, {"temp": (30.0, 30.0)}) == []


def test_pr_body_is_honest_about_unreviewed_books_and_holds_no_yes24_text():
    body = report.pr_body(OK, doc_of(), LEAF, SIM_OK, False, GRAD)
    assert "넣음 **2권**" in body and "대기 1" in body and "AI 일치(사람 안 봄)" in body and "검수 필요: world" in body
    assert "사람이 본 책(엇갈린 책 + 표본)만으로" in body and "졸업 기준 충족" in body
    assert "SF·판타지 · temp+1 pull-1 gain+0 world-1" in body and "대기 \\| 책 | 짧음(9자)" in body
    assert INTRO[:15] not in body and "⚠ 경고" in body  # the 4 test books leave axes lopsided
    assert "졸업 기준 충족" not in report.pr_body(OK, doc_of(), LEAF, SIM_OK, True, GRAD)
    assert not body.startswith("> ⚠") and "상태:" not in body                  # a normal day has no status banner


def test_the_unseen_share_of_agreed_books_is_stated_with_numbers():
    body = report.pr_body(OK, doc_of(20), LEAF, SIM_OK, False, GRAD, sample_rate=0.1)
    assert "**20권**" in body and "표본은 2권" in body and "**나머지 18권은 사람이 확인하지 않았어요**" in body
    assert "--no-sample" in body
    merged = report.pr_body(OK, doc_of(20), LEAF, SIM_OK, True, GRAD)
    assert "병합돼요" in merged and "나머지 18권" not in merged


def test_a_partial_day_says_so_first_with_how_far_it_got():
    partial = {**OK, "status": "partial", "stopped": "pass B (claude-sonnet-5-5): 5 API failures in a row (http_529)", "tagged": 2}
    body = report.pr_body(partial, doc_of(), LEAF, SIM_OK, False, GRAD)
    first = body.split("\n\n")[1]
    assert first.startswith("> ⚠ **상태: 중간에 멈춤**") and "5 API failures in a row (http_529)" in first
    assert "태그가 끝난 2권만" in first and "멈춤: pass B" in body


def test_report_main_without_a_file_makes_no_pr(tmp_path, monkeypatch, capsys):
    monkeypatch.setattr(report, "ADDITIONS", tmp_path)
    assert report.main(["--date", "2026-10-05", "--out", str(tmp_path / "pr.md")]) == 0
    assert "no PR" in capsys.readouterr().out and not (tmp_path / "pr.md").exists()


def test_report_main_writes_the_body_from_the_files(tmp_path, monkeypatch, capsys):
    (tmp_path / "2026-10-05.json").write_text(json.dumps(doc_of(), ensure_ascii=False), encoding="utf-8")
    (tmp_path / "runs").mkdir()
    (tmp_path / "runs" / "2026-10-05.json").write_text(json.dumps({**OK, "status": "partial", "stopped": "AuthenticationError"}), encoding="utf-8")
    (tmp_path / "books.json").write_text(json.dumps(LEAF), encoding="utf-8")
    for name, value in (("ADDITIONS", tmp_path), ("RUNS", tmp_path / "runs"), ("BOOKS", tmp_path / "books.json"),
                        ("AGREEMENT", tmp_path / "agreement.csv")):
        monkeypatch.setattr(report, name, value)
    monkeypatch.setattr(report, "evaluate", lambda *a: SIM_OK)
    monkeypatch.setattr(report, "leaf_pool", lambda rows: rows)
    monkeypatch.setattr(report, "leaf_users", lambda: [])
    out = tmp_path / "pr.md"
    assert report.main(["--date", "2026-10-05", "--out", str(out)]) == 0
    assert "AuthenticationError" in out.read_text(encoding="utf-8") and "졸업 연속 0/3" in out.read_text(encoding="utf-8")
