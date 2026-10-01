"""Pipeline: the offline tagger eval (src/pipeline/evaluate.py) — fake client, a temp detail cache."""
import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from pipeline import evaluate  # noqa: E402
from pipeline_fakes import INTRO, TOC, FakeClient, agreeing, kind_of, message  # noqa: E402


def gold(isbn, entry, **f):
    return {"isbn": isbn, "title": f"책{isbn}", "entry": entry, "slot": "돈 관리·투자" if entry == "target" else "SF·판타지",
            "source": "d4", **f}


def test_eval_scores_against_the_person_and_counts_errors_left_in_agreed_books(tmp_path):
    detail = tmp_path / "detail"
    detail.mkdir()
    for isbn in ("1", "2", "3"):
        item = {"contentDetail": {"bookIntroduction": INTRO, "tableOfContents": TOC}}
        (detail / f"{isbn}.json").write_text(json.dumps({"data": {"items": [item]}}, ensure_ascii=False), encoding="utf-8")
    golds = [gold("1", "target", keywords=["주식"], way="개념"), gold("2", "target", keywords=["주식"], way="사례"),
             gold("3", "leaf", axes={"temp": 1, "pull": -1, "gain": 0, "world": -1}), gold("4", "leaf", axes={})]
    vocab = {"돈 관리·투자": {"kept": {"주식": {"pattern": "주식"}}}}

    def second_differs_on_book_1(kwargs):
        entry, kind = kind_of(kwargs)
        if kind == "check" and "책1" in kwargs["messages"][0]["content"]:
            return message({"fits": True, "keywords": ["주식"], "way": "실습", "why": "실습서"})
        return agreeing(kwargs)

    out = evaluate.run_model(FakeClient(second_differs_on_book_1), "claude-haiku-4-5", "claude-haiku-4-5", golds, vocab, detail)
    assert out["skipped_no_text"] == 1 and out["usage"]["claude-haiku-4-5"]["calls"] == 6
    t, lf = out["score"]["target"], out["score"]["leaf"]
    assert t["n"] == 2 and t["flagged_pct"] == 50.0 and t["agree_pct"]["way"] == 50.0
    assert t["agreed_n"] == 1 and t["agreed_but_wrong_pct"]["way"] == 100.0   # book 2: both AIs say 개념, the person 사례
    assert lf["agree_pct"]["world"] == 0.0 and lf["agree_pct"]["temp"] == 100.0
    assert all("intro" not in json.dumps(r) for r in out["rows"]) and out["cost_per_book_usd"] > 0


def test_eval_subset_is_fixed_and_stratified():
    golds = [gold(str(i), "leaf", axes={}) for i in range(10)] + [gold(f"p{i}", "target") | {"source": "pilot"} for i in range(3)] \
        + [gold(f"d{i}", "target") for i in range(10)]
    picked = evaluate.pick(golds, 8)
    assert len(picked) == 8 and sum(g["entry"] == "leaf" for g in picked) == 4
    assert [g["isbn"] for g in picked[4:7]] == ["p0", "p1", "p2"] and picked == evaluate.pick(golds, 8)


def _cache(tmp_path, isbns):
    detail = tmp_path / "detail"
    detail.mkdir(exist_ok=True)
    for isbn in isbns:
        item = {"contentDetail": {"bookIntroduction": INTRO, "tableOfContents": TOC}}
        (detail / f"{isbn}.json").write_text(json.dumps({"data": {"items": [item]}}, ensure_ascii=False), encoding="utf-8")
    return detail


def test_gold_keywords_are_cut_to_the_closed_list_the_tagger_can_name():
    g = gold("1", "target", keywords=["주식", "옛 키워드"], way="개념")
    assert evaluate.wrong_fields(g, {"fits": True, "keywords": ["주식"], "way": "개념"}, ["주식", "ETF·펀드"]) == []
    assert evaluate.wrong_fields(g, {"fits": True, "keywords": ["주식"], "way": "개념"}) == ["keywords"]


def test_gold_books_come_from_the_200_alone_and_take_the_reviewed_pilot_when_present(tmp_path, monkeypatch):
    monkeypatch.setattr(evaluate, "ADDITIONS", tmp_path)          # no pilot file committed yet
    base = evaluate.gold_books()
    assert len(base) == 200 and {g["source"] for g in base} == {"d4"} and all(g["title"] for g in base)
    pilot = {"books": [
        {"isbn": "p1", "title": "파일럿", "status": "picked", "reviewed": True, "topic": "글쓰기", "keywords": ["업무 글"], "way": "실습"},
        {"isbn": "p2", "title": "미검수", "status": "picked", "reviewed": False, "topic": "글쓰기", "keywords": [], "way": "개념"},
        {"isbn": "p3", "title": "대기", "status": "reserve", "reviewed": True, "topic": "글쓰기", "keywords": [], "way": "개념"}]}
    (tmp_path / "2026-10-01-pilot.json").write_text(json.dumps(pilot, ensure_ascii=False), encoding="utf-8")
    both = evaluate.gold_books()
    assert [g["isbn"] for g in both[200:]] == ["p1"] and both[200]["source"] == "pilot"


def test_estimate_is_a_range_and_covers_every_call(tmp_path):
    detail = _cache(tmp_path, ["1", "2"])
    golds = [gold("1", "target", keywords=[], way="개념"), gold("2", "leaf", axes={}), gold("9", "leaf", axes={})]
    vocab = {"돈 관리·투자": {"kept": {"주식": {"pattern": "주식"}}}}
    est = evaluate.estimate(golds, ["claude-haiku-4-5", "claude-sonnet-5-5"], "claude-haiku-4-5", vocab, detail)
    assert est["books"] == 2 and est["skipped_no_text"] == 1 and est["calls"] == 2 * 2 * 2
    h = est["per_model"]["claude-haiku-4-5"]
    assert h["calls"] == 6 and 0 < h["cost_usd"][0] < h["cost_usd"][1] and h["input_tokens"][0] < h["input_tokens"][1]
    assert est["total_usd"][0] < est["total_usd"][1] and set(est["per_model"]) == {"claude-haiku-4-5", "claude-sonnet-5-5"}


def test_main_dry_run_prints_the_estimate_without_a_key(tmp_path, monkeypatch, capsys):
    detail = _cache(tmp_path, [g["isbn"] for g in evaluate.gold_books()])
    monkeypatch.delenv("ANTHROPIC_API_KEY", raising=False)
    assert evaluate.main(["--dry-run", "--limit", "4", "--detail-dir", str(detail)]) == 0
    assert "cost_usd" in capsys.readouterr().out


def test_main_needs_the_key_in_the_environment_and_never_prints_it(tmp_path, monkeypatch, capsys):
    detail = _cache(tmp_path, [g["isbn"] for g in evaluate.gold_books()])
    monkeypatch.delenv("ANTHROPIC_API_KEY", raising=False)
    assert evaluate.main(["--limit", "4", "--detail-dir", str(detail)]) == 1
    assert "ANTHROPIC_API_KEY" in capsys.readouterr().err


def test_main_runs_prints_estimate_first_then_measured_usage_and_never_prints_the_key(tmp_path, monkeypatch, capsys):
    detail = _cache(tmp_path, [g["isbn"] for g in evaluate.gold_books()])
    monkeypatch.setenv("ANTHROPIC_API_KEY", "sk-test-secret-value")
    monkeypatch.setattr(evaluate, "OUT", tmp_path / "eval")
    monkeypatch.setattr(evaluate, "make_client", lambda key: FakeClient())
    assert evaluate.main(["--models", "claude-haiku-4-5", "--limit", "4", "--detail-dir", str(detail)]) == 0
    captured = capsys.readouterr()
    out = captured.out
    assert out.index("estimate") < out.index("measured") and "input_tokens" in out and "sk-test-secret-value" not in out + captured.err
    saved = json.loads(next((tmp_path / "eval").glob("*-claude-haiku-4-5.json")).read_text(encoding="utf-8"))
    assert saved["estimate"]["total_usd"][1] > 0 and saved["usage"]["claude-haiku-4-5"]["calls"] == 8 and "intro" not in json.dumps(saved)
