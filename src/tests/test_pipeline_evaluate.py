"""Pipeline: the offline tagger eval (src/pipeline/evaluate.py) — fake client, a temp detail cache."""
import json
import sys
from pathlib import Path

import pytest

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from pipeline import evaluate  # noqa: E402
from pipeline_fakes import INTRO, TOC, FakeClient, agreeing, check_answer, kind_of, message, tag_answer  # noqa: E402


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
    assert t["n"] == 2 and t["flagged"]["pct"] == 50.0 and t["agree"]["way"]["pct"] == 50.0
    assert t["flagged"]["k"] == 1 and t["flagged"]["n"] == 2 and t["agree"]["way"]["n"] == 2   # every figure carries its size
    assert t["agreed_n"] == 1 and t["agreed_but_wrong"]["way"]["pct"] == 100.0   # book 2: both AIs say 개념, the person 사례
    assert t["agreed_but_wrong"]["way"]["n"] == 1
    assert lf["agree"]["world"]["pct"] == 0.0 and lf["agree"]["temp"]["pct"] == 100.0
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


def test_gold_books_come_from_books_v1_alone_and_take_the_reviewed_pilot_when_present(tmp_path, monkeypatch):
    monkeypatch.setattr(evaluate, "ADDITIONS", tmp_path)          # no pilot file committed yet
    base = evaluate.gold_books()
    # the D4 books still in books_v1 (200 at D4; a book a person drops later leaves the file — 194 since 10-07)
    v1 = json.loads((evaluate.PROCESSED / "books_v1.json").read_text(encoding="utf-8"))
    assert len(base) == len(v1) > 0 and {g["source"] for g in base} == {"d4"} and all(g["title"] for g in base)
    pilot = {"books": [
        {"isbn": "p1", "title": "파일럿", "status": "picked", "reviewed": True, "topic": "글쓰기", "keywords": ["업무 글"], "way": "실습"},
        {"isbn": "p2", "title": "미검수", "status": "picked", "reviewed": False, "topic": "글쓰기", "keywords": [], "way": "개념"},
        {"isbn": "p3", "title": "대기", "status": "reserve", "reviewed": True, "topic": "글쓰기", "keywords": [], "way": "개념"}]}
    (tmp_path / "2026-10-01-pilot.json").write_text(json.dumps(pilot, ensure_ascii=False), encoding="utf-8")
    both = evaluate.gold_books()
    assert [g["isbn"] for g in both[len(v1):]] == ["p1"] and both[len(v1)]["source"] == "pilot"


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


def test_eval_rows_keep_only_the_issue_flag_for_words_that_copied_the_yes24_text(tmp_path):
    detail = _cache(tmp_path, ["1"])
    copied = "계좌 만들기부터 배당과 분산 투자까지"      # a run taken straight from the fixture's intro

    def copying(kwargs):
        entry, kind = kind_of(kwargs)
        if kind == "tag":
            return message(tag_answer(entry) | {"evidence": copied})
        return message(check_answer(entry) | {"why": copied})

    vocab = {"돈 관리·투자": {"kept": {"주식": {"pattern": "주식"}}}}
    out = evaluate.run_model(FakeClient(copying), "claude-haiku-4-5", "claude-haiku-4-5",
                             [gold("1", "target", keywords=["주식"], way="개념")], vocab, detail)
    row = out["rows"][0]
    assert "근거가 책소개를 베낌" in row["issues"] and "판단 이유가 책소개를 베낌" in row["issues"]
    assert row["tag"]["evidence"] == "" and row["second"]["why"] == ""
    assert "계좌 만들기" not in json.dumps(out, ensure_ascii=False)


def _row(entry="target", wrong=(), flags=(), issues=(), gold_kw_n=1):
    return {"isbn": "x", "entry": entry, "source": "d4", "wrong": list(wrong), "flags": list(flags), "issues": list(issues),
            "gold_kw_n": gold_kw_n if entry == "target" else None}


def test_flagged_and_issue_figures_are_separate_questions():
    rows = [_row(),                                                   # accepted without a person
            _row(flags=["way"]),                                      # the two AIs differ
            _row(flags=["confidence"]),                               # pass A unsure
            _row(issues=["근거 김(41자)"]),                            # long evidence only: the line itself is fine
            _row(issues=["짧음(5자)", "근거 없음"]),                    # both kinds
            _row(issues=["판단 이유가 책소개를 베낌"])]                 # pass B copied
    t = evaluate.score(rows)["target"]
    assert (t["flagged"]["k"], t["flagged"]["n"]) == (2, 6)                      # disagreement / low confidence only
    assert (t["line_rules_ok"]["k"], t["evidence_ok"]["k"]) == (5, 3)           # one-liner rules vs evidence/why rules
    assert (t["not_auto_accepted"]["k"], t["agreed_n"]) == (5, 1)
    assert t["flagged"]["ci95"][0] < t["flagged"]["pct"] < t["flagged"]["ci95"][1]


def test_keyword_agreement_is_also_reported_without_books_the_tagger_cannot_match():
    rows = [_row(gold_kw_n=2), _row(gold_kw_n=3, wrong=["keywords"]),
            _row(gold_kw_n=4, wrong=["keywords"]), _row(gold_kw_n=6, wrong=["keywords"])]   # MAX_KEYWORDS is 3
    t = evaluate.score(rows)["target"]
    assert t["agree"]["keywords"]["pct"] == 25.0                              # the exact-set figure stays
    assert t["keywords_over_cap_n"] == 2
    within = t["agree"]["keywords_within_cap"]
    assert (within["k"], within["n"], within["pct"]) == (1, 2, 50.0)
    assert evaluate.score([_row("leaf")])["leaf"].get("keywords_over_cap_n") is None


def test_an_empty_group_gives_none_not_a_zero_division():
    s = evaluate.score([])
    assert s["target"]["flagged"] == {"pct": None, "k": 0, "n": 0, "ci95": None} and s["leaf"]["agreed_but_wrong"]["world"]["n"] == 0


def test_wilson_interval():
    assert evaluate.wilson(0, 0) is None
    lo, hi = evaluate.wilson(50, 100)
    assert 40 < lo < 41 and 59 < hi < 60
    assert evaluate.wilson(2, 2)[1] == 100.0 and evaluate.wilson(2, 2)[0] < 50


def test_run_model_stops_when_the_primary_model_is_dead_even_though_pass_b_answers(tmp_path):
    import anthropic
    import httpx2
    detail = _cache(tmp_path, [str(i) for i in range(20)])
    golds = [gold(str(i), "target", keywords=["주식"], way="개념") for i in range(20)]
    vocab = {"돈 관리·투자": {"kept": {"주식": {"pattern": "주식"}}}}
    req = httpx2.Request("POST", "https://api.anthropic.com/v1/messages")

    def by_model(kwargs):
        if kwargs["model"] == "claude-sonnet-5-5":
            raise anthropic.InternalServerError("x", response=httpx2.Response(500, request=req), body=None)
        return agreeing(kwargs)

    client = FakeClient(by_model)
    with pytest.raises(evaluate.TaggerStop, match="claude-sonnet-5-5"):
        evaluate.run_model(client, "claude-sonnet-5-5", "claude-haiku-4-5", golds, vocab, detail)
    assert len(client.messages.calls) == 9                                     # 5 books reached, not all 20


def test_an_answer_that_cannot_be_used_is_counted_as_unusable_not_ok(tmp_path):
    detail = _cache(tmp_path, ["1", "2"])
    vocab = {"돈 관리·투자": {"kept": {"주식": {"pattern": "주식"}}}}

    def bad_way(kwargs):
        entry, kind = kind_of(kwargs)
        return message(tag_answer(entry, way="기타")) if kind == "tag" else agreeing(kwargs)

    out = evaluate.run_model(FakeClient(bad_way), "claude-haiku-4-5", "claude-haiku-4-5",
                             [gold("1", "target", keywords=["주식"], way="개념")], vocab, detail)
    assert out["failed"] == {"unusable": 1} and out["score"]["books"] == 0


def test_rescore_recomputes_the_figures_from_a_saved_file_without_a_key_or_any_call(tmp_path, monkeypatch, capsys):
    target = next(g for g in evaluate.gold_books() if g["entry"] == "target")
    vocab = json.loads(evaluate.VOCAB.read_text(encoding="utf-8"))
    kept = list(vocab[target["slot"]]["kept"])
    cut = [k for k in target["keywords"] if k in kept]
    row = {"isbn": target["isbn"], "entry": "target", "source": "d4", "flags": [], "issues": [],
           "tag": {"fits": True, "keywords": cut, "way": target["way"], "one_liner": "", "evidence": "", "confidence": 0.9},
           "second": {}, "wrong": ["keywords", "way"]}                      # the stored `wrong` is stale: rescoring fixes it
    stale = {**row, "isbn": "not-in-gold"}
    saved = tmp_path / "2026-10-01-claude-sonnet-5-5.json"
    saved.write_text(json.dumps({"model": "claude-sonnet-5-5", "second_model": "claude-haiku-4-5", "rows": [row, stale]}),
                     encoding="utf-8")
    monkeypatch.delenv("ANTHROPIC_API_KEY", raising=False)
    monkeypatch.setattr(evaluate, "make_client", lambda key: pytest.fail("rescore must not create a client"))
    assert evaluate.main(["--rescore", str(saved)]) == 0
    out = json.loads(capsys.readouterr().out)
    assert out["rows_in_file"] == 2 and out["rows_scored"] == 1 and out["model"] == "claude-sonnet-5-5"
    t = out["rescored"]["target"]
    assert t["agree"]["keywords"]["pct"] == 100.0 and t["agree"]["way"]["pct"] == 100.0 and t["agree"]["keywords"]["n"] == 1
    assert "rows" not in out and out["notes"]
