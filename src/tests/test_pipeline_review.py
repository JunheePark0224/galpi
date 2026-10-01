"""Pipeline: applying a review, the agreement log, graduation, the review page and the samples
(src/pipeline/agreement.py · agreement_log.py · review.py · review_page.py · sample.py)."""
import json
import re
import shutil
import subprocess
import sys
from collections import Counter
from datetime import date
from pathlib import Path

import pytest

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

import build_pilot_review  # noqa: E402
from apply_review import CSV_HEAD, ReviewError  # noqa: E402
from pipeline import review, sample  # noqa: E402
from pipeline.agreement import apply_answers, stats_row  # noqa: E402
from pipeline.agreement_log import HEAD, below, graduation, read_rows, upsert, write_rows  # noqa: E402
from pipeline.config import parse_config  # noqa: E402
from pipeline_fakes import INTRO, TOC  # noqa: E402

KEPT = {"돈 관리·투자": {"주식": {}, "ETF·펀드": {}}, "경제 상식": {"금리·환율": {}}}
VOCAB = {t: {"kept": k} for t, k in KEPT.items()}
AX = {"temp": 1, "pull": -1, "gain": 0, "world": 1}
SECOND = {"fits": True, "keywords": ["주식"], "way": "실습", "why": "따라 하기 중심"}


def target(isbn, **over):
    return {"isbn": isbn, "title": f"책{isbn}", "author": "가 저", "pages": 200, "entry": "target", "topic": "돈 관리·투자",
            "field": "돈·경제", "keywords": ["주식"], "way": "개념", "one_liner": "주식의 기본을 쉽게 알려줘요",
            "evidence": "입문서", "confidence": 0.9, "fits": True, "second": SECOND, "link": "https://y/1",
            "status": "picked", "flags": ["way"], "issues": [], **over}


def leaf(isbn, **over):
    return {"isbn": isbn, "title": f"책{isbn}", "author": "나 저", "pages": 300, "entry": "leaf", "genre": "SF·판타지",
            "axes": dict(AX), "one_liner": "다른 별에서 집은 어떤 모습일까요?", "evidence": "SF", "confidence": 0.9, "fits": True,
            "second": {"fits": True, "axes": {**AX, "world": 0}, "why": "현실에 가까움"}, "link": "https://y/2",
            "status": "picked", "flags": ["world"], "issues": [], **over}


def doc_of():
    return {"date": "2026-10-05", "batch": "daily", "books": [target("1"), target("2", auto="ai-agree", flags=[]),
                                                              leaf("3"), leaf("4", status="reserve", issues=["짧음(9자)"])]}


DOC = doc_of()


def ans(b, **over):
    keep = ("topic", "keywords", "way") if b["entry"] == "target" else ("genre", "axes")
    return {**{k: b[k] for k in keep}, "one_liner": b["one_liner"], "status": b["status"], "ok": True, **over}


def test_human_answers_count_per_field_and_agreed_books_apart():
    t, lf = DOC["books"][0], DOC["books"][2]
    new, tally = apply_answers(DOC, {"1": ans(t, way="실습"), "3": ans(lf, axes={**AX, "world": -1})}, KEPT)
    assert tally == Counter({"n_target": 1, "n_leaf": 1, "same:topic": 1, "same:keywords": 1, "same:one_liner": 2,
                             "same:genre": 1, "same:temp": 1, "same:pull": 1, "same:gain": 1, "auto_agreed": 1})
    row = stats_row("2026-10-05", "daily", tally)
    assert (row["n"], row["way"], row["world"], row["temp"], row["one_liner"], row["auto_agreed"]) == ("2", "0.0", "0.0", "100.0", "100.0", "1")
    assert new["books"][0]["draft"]["way"] == "개념" and new["books"][0]["reviewed"] is True
    assert new["books"][2]["axes"]["world"] == -1 and new["books"][2]["draft"]["axes"]["world"] == 1
    assert "draft" not in DOC["books"][0]  # input untouched


def test_a_sampled_agreed_book_counts_like_a_reviewed_one_and_says_whether_the_agreement_was_right():
    agreed = target("2", auto="ai-agree", flags=[])
    doc = {"date": "d", "batch": "daily", "books": [agreed, target("5", auto="ai-agree", flags=[])]}
    new, tally = apply_answers(doc, {"2": ans(agreed, way="사례")}, KEPT)
    assert tally["sample_n"] == 1 and tally["sample_changed"] == 1 and tally["n_target"] == 1 and tally["same:way"] == 0
    assert tally["auto_agreed"] == 1                                            # book 5 is still unseen
    assert "auto" not in new["books"][0] and new["books"][0]["sampled"] is True and new["books"][1]["auto"] == "ai-agree"
    again, tally2 = apply_answers(new, {"2": ans(agreed, way="사례")}, KEPT)    # the same download again
    assert again == new and tally2 == tally


def test_a_held_book_can_come_in_and_a_dropped_one_is_counted_apart():
    held, t = DOC["books"][3], DOC["books"][0]
    new, tally = apply_answers(DOC, {"4": ans(held, status="picked", one_liner="다른 별의 집은 어떤 모양일까요?"),
                                     "1": ans(t, status="dropped")}, KEPT)
    assert tally["n_leaf"] == 1 and tally["same:one_liner"] == 0 and tally["dropped"] == 1 and tally["n_target"] == 0
    assert [b["status"] for b in new["books"]] == ["dropped", "picked", "picked", "picked"]


@pytest.mark.parametrize("isbn, over, msg", [
    ("3", {"genre": "요리"}, "unknown genre"), ("3", {"axes": {**AX, "temp": 2}}, "axes must be"),
    ("1", {"keywords": ["금리·환율"]}, "not in 돈 관리·투자"), ("1", {"auto": "ai-agree"}, "human answers only"),
])
def test_bad_answers_are_refused(isbn, over, msg):
    b = next(x for x in DOC["books"] if x["isbn"] == isbn)
    with pytest.raises(ReviewError, match=msg):
        apply_answers(DOC, {isbn: ans(b, **over)}, KEPT)


def test_one_header_for_pilot_and_daily_rows(tmp_path):
    assert CSV_HEAD == HEAD
    path = tmp_path / "agreement.csv"
    pilot = {"date": "2026-10-01", "batch": "pilot", "n": "90", "topic": "97.8"}
    write_rows(path, upsert([], pilot))
    rows = upsert(read_rows(path), {"date": "2026-10-05", "batch": "daily", "n": "3", "world": "66.7"})
    write_rows(path, upsert(rows, {"date": "2026-10-05", "batch": "daily", "n": "4", "world": "75.0"}))
    back = read_rows(path)
    assert [r["n"] for r in back] == ["90", "4"] and back[0]["world"] == "" and back[1]["topic"] == ""


def test_the_pilot_applier_writes_through_the_same_log(tmp_path, monkeypatch):
    import apply_review
    monkeypatch.setattr(apply_review, "AGREEMENT", tmp_path / "agreement.csv")
    write_rows(apply_review.AGREEMENT, [{"date": "2026-10-05", "batch": "daily", "n": "1", "world": "100.0"}])
    old = apply_review.upsert_row(read_rows(apply_review.AGREEMENT), {"date": "2026-10-01", "batch": "pilot", "n": 3, "topic": 100.0})
    write_rows(apply_review.AGREEMENT, old)
    assert [(r["batch"], r["world"]) for r in read_rows(apply_review.AGREEMENT)] == [("daily", "100.0"), ("pilot", "")]


def day(d, **f):
    return {"date": d, "batch": "daily", **{k: str(v) for k, v in f.items()}}


ALL_96 = dict(topic=96, keywords=96, way=96, one_liner=96, genre=96, temp=96, pull=96, gain=96, world=96)
SAMPLED = dict(sample_n=4, sample_changed=0)  # 3 days x 4 = 12 agreed books looked at, none changed


def test_graduation_needs_three_days_over_95_covering_every_field_and_a_clean_sample():
    assert graduation([day("10-01", **ALL_96, **SAMPLED), day("10-02", **ALL_96, **SAMPLED)])["graduated"] is False
    three = [day("10-01", **ALL_96, **SAMPLED), day("10-02", topic=100, **SAMPLED), day("10-03", **ALL_96, **SAMPLED)]
    assert graduation(three) == {"streak": 3, "graduated": True, "missing_fields": [], "sample_n": 12, "sample_changed": 0,
                                 "sample_ok": True}
    broken = [*three, day("10-04", **{**ALL_96, "world": 94}, **SAMPLED)]
    assert graduation(broken)["streak"] == 0
    only_target = [day(f"10-0{i}", topic=100, keywords=100, way=100, one_liner=100, **SAMPLED) for i in (1, 2, 3)]
    assert graduation(only_target)["graduated"] is False and "world" in graduation(only_target)["missing_fields"]
    assert graduation([{**day("10-09", **ALL_96), "batch": "pilot"}])["streak"] == 0  # pilot rows never count
    quiet = [three[0], three[1], day("10-025"), three[2]]                         # a day with no review in between
    assert graduation(quiet)["streak"] == 3
    assert below(day("x", topic=89.9, way=95)) == ["topic"]


def test_the_flagged_books_alone_cannot_graduate_and_a_bad_sample_cannot_be_diluted():
    flagged_only = [day(f"10-0{i}", **ALL_96) for i in (1, 2, 3)]            # no agreed book was ever looked at
    assert graduation(flagged_only) == {"streak": 3, "graduated": False, "missing_fields": [], "sample_n": 0,
                                        "sample_changed": 0, "sample_ok": False}
    small = [day(f"10-0{i}", **ALL_96, sample_n=3, sample_changed=0) for i in (1, 2, 3)]
    assert graduation(small)["sample_ok"] is False and graduation(small)["sample_n"] == 9      # fewer than MIN_SAMPLE
    bad = [day("10-01", **ALL_96, sample_n=7, sample_changed=1), day("10-02", **ALL_96, sample_n=7, sample_changed=1),
           day("10-03", **ALL_96, sample_n=6, sample_changed=1)]                # 3 of 20 changed = 15%
    assert graduation(bad)["graduated"] is False and graduation(bad)["sample_changed"] == 3
    edge = [day(f"10-0{i}", **ALL_96, sample_n=7, sample_changed=0) for i in (1, 2)] + [day("10-03", **ALL_96, sample_n=6, sample_changed=1)]
    assert graduation(edge)["graduated"] is True                              # 1 of 20 = 5%: allowed


def test_the_sample_counts_reach_the_csv(tmp_path):
    agreed = target("2", auto="ai-agree", flags=[])
    other = target("5", auto="ai-agree", flags=[])
    new, tally = apply_answers({"date": "d", "batch": "daily", "books": [agreed, other]}, {"2": ans(agreed, way="사례")}, KEPT)
    row = stats_row("d", "daily", tally)
    assert (row["sample_n"], row["sample_changed"]) == ("1", "1") and set(row) <= set(HEAD)
    write_rows(tmp_path / "a.csv", [row])
    assert read_rows(tmp_path / "a.csv")[0]["sample_changed"] == "1"
    # a sampled book the person dropped counts as changed even though no tag differs
    new2, tally2 = apply_answers({"date": "d", "batch": "daily", "books": [agreed]}, {"2": ans(agreed, status="dropped")}, KEPT)
    assert (tally2["sample_n"], tally2["sample_changed"], tally2["dropped"]) == (1, 1, 1)


def test_which_books_need_a_look_and_how_the_trial_sample_is_drawn():
    assert [b["isbn"] for b in DOC["books"] if review.needs_look(b)] == ["1", "3", "4"]
    assert review.trial_sample is sample.trial_sample                       # one implementation, two callers
    many = {"date": "2026-10-05", "books": [target(str(i), auto="ai-agree", flags=[]) for i in range(20)]}
    assert len(sample.trial_sample(many, 0.1)) == 2 and sample.trial_sample(many, 0.1) == sample.trial_sample(many, 0.1)
    assert sample.trial_sample(many, 0.0) == [] and sample.trial_sample(DOC, 0.1) == ["2"]


@pytest.fixture
def files(tmp_path, monkeypatch):
    adds = tmp_path / "additions"
    adds.mkdir()
    path = adds / "2026-10-05.json"
    path.write_text(json.dumps(doc_of(), ensure_ascii=False), encoding="utf-8")
    (tmp_path / "vocab.json").write_text(json.dumps(VOCAB), encoding="utf-8")
    for mod, name, value in ((review, "ADDITIONS", adds), (sample, "ADDITIONS", adds), (review, "VOCAB", tmp_path / "vocab.json"),
                             (review, "AGREEMENT", tmp_path / "agreement.csv"), (review, "PAGES", tmp_path / "pages"),
                             (build_pilot_review, "DETAIL", tmp_path / "detail")):
        monkeypatch.setattr(mod, name, value)
    monkeypatch.setattr(review, "keyword_definitions", lambda: {})
    monkeypatch.setattr(review, "yes24_env", lambda: {})
    monkeypatch.setattr(review, "load_config", lambda: parse_config(
        {"daily_count": 5, "auto_merge": False, "sample_rate": 0.5, "model": "claude-haiku-4-5", "second_model": "claude-haiku-4-5"}))
    (tmp_path / "detail").mkdir()
    for isbn in "1234":
        item = {"contentDetail": {"bookIntroduction": INTRO, "tableOfContents": TOC}}
        (tmp_path / "detail" / f"{isbn}.json").write_text(json.dumps({"data": {"items": [item]}}, ensure_ascii=False),
                                                          encoding="utf-8")
    return tmp_path, path


def test_the_page_has_the_sample_by_default_and_not_with_no_sample(files, capsys):
    tmp, _ = files
    assert review.main(["2026-10-05"]) == 0
    html = (tmp / "pages" / "2026-10-05.html").read_text(encoding="utf-8")
    assert "__BOOKS__" not in html and "__COMMON__" not in html and "__STYLE__" not in html and "__AXES__" not in html
    books = json.loads(re.search(r"const BOOKS=(.*?), KW=", html, re.S).group(1))
    assert [(b["isbn"], b["sample"]) for b in books] == [("1", False), ("2", True), ("3", False), ("4", False)]
    assert "1 of them sample" in capsys.readouterr().out
    assert books[2]["second"]["axes"]["world"] == 0 and books[0]["second"]["way"] == "실습"   # AI-2 side by side
    assert "따뜻함" in html and "딴 세상" in html and "AI-1이 맞아요" in html and "AI-2가 맞아요" in html
    assert review.main(["2026-10-05", "--no-sample"]) == 0
    html = (tmp / "pages" / "2026-10-05.html").read_text(encoding="utf-8")
    assert [b["isbn"] for b in json.loads(re.search(r"const BOOKS=(.*?), KW=", html, re.S).group(1))] == ["1", "3", "4"]


@pytest.mark.skipif(shutil.which("node") is None, reason="node not installed")
def test_the_page_script_is_valid_javascript(files):
    tmp, _ = files
    review.main(["2026-10-05"])
    html = (tmp / "pages" / "2026-10-05.html").read_text(encoding="utf-8")
    script = tmp / "page.js"
    script.write_text(re.search(r"<script>(.*)</script>", html, re.S).group(1), encoding="utf-8")
    done = subprocess.run(["node", "--check", str(script)], capture_output=True, text=True, check=False)
    assert done.returncode == 0, done.stderr


def test_the_pilot_page_still_renders_from_the_shared_parts():
    doc = json.loads(build_pilot_review.DEFAULT.read_text(encoding="utf-8"))
    vocab = json.loads(build_pilot_review.VOCAB.read_text(encoding="utf-8"))
    html = build_pilot_review.render(doc, build_pilot_review.build_entries(doc), vocab, "x.json")
    assert "__STYLE__" not in html and "__COMMON__" not in html and "function baseIssues" in html


def test_review_apply_writes_the_file_and_one_agreement_row_and_applying_again_changes_nothing(files):
    tmp, path = files
    d = doc_of()
    download = tmp / "dl.json"
    download.write_text(json.dumps({"answers": {"1": ans(d["books"][0]), "2": ans(d["books"][1], way="사례"),
                                                "3": {**ans(d["books"][2]), "ok": False}}}), encoding="utf-8")
    assert review.main(["2026-10-05", "--apply", str(download)]) == 0
    saved = json.loads(path.read_text(encoding="utf-8"))
    assert saved["books"][0]["reviewed"] is True and saved["books"][1]["sampled"] is True and "auto" not in saved["books"][1]
    rows = read_rows(tmp / "agreement.csv")
    assert len(rows) == 1 and rows[0]["n"] == "2" and rows[0]["way"] == "50.0" and rows[0]["auto_agreed"] == "0"
    assert review.main(["2026-10-05", "--apply", str(download)]) == 0               # the same file once more
    assert json.loads(path.read_text(encoding="utf-8")) == saved and len(read_rows(tmp / "agreement.csv")) == 1


def test_review_apply_refuses_strays_empty_downloads_and_a_missing_file(files, capsys):
    tmp, _ = files
    stray = tmp / "stray.json"
    stray.write_text(json.dumps({"answers": {"99": ans(target("99"))}}), encoding="utf-8")
    assert review.main(["2026-10-05", "--apply", str(stray)]) == 1 and "not on this page" in capsys.readouterr().err
    empty = tmp / "empty.json"
    empty.write_text(json.dumps({"answers": {}}), encoding="utf-8")
    assert review.main(["2026-10-05", "--apply", str(empty)]) == 1 and "no confirmed answers" in capsys.readouterr().err
    assert review.main(["2026-12-31"]) == 1 and "no additions file" in capsys.readouterr().err


def test_no_yes24_text_is_written_to_the_additions_file_by_a_review(files):
    tmp, path = files
    review.main(["2026-10-05"])  # the page reads the cache ...
    d = doc_of()
    download = tmp / "dl.json"
    download.write_text(json.dumps({"answers": {"1": ans(d["books"][0])}}), encoding="utf-8")
    review.main(["2026-10-05", "--apply", str(download)])
    text = path.read_text(encoding="utf-8")                                         # ... but the file never gets it
    assert INTRO[:20] not in text and "계좌와 주문" not in text


def test_weekly_sample_is_fixed_by_the_week():
    assert sample.last_week(date(2026, 10, 19)) == "2026-W42"
    assert sample.week_bounds("2026-W42") == (date(2026, 10, 12), date(2026, 10, 18))
    docs = [(Path(f"{d}.json"), {"date": d, "batch": "daily", "books": [target(f"{d}-{i}", flags=[]) for i in range(10)]})
            for d in ("2026-10-11", "2026-10-12", "2026-10-18")]
    one = sample.sample_books(docs, "2026-W42", 0.1)
    assert len(one) == 2 and one == sample.sample_books(docs, "2026-W42", 0.1)
    assert all(not b["isbn"].startswith("2026-10-11") for _, b in one)
    body = sample.issue_body("2026-W42", one, 0.1)
    assert "--sample 2026-W42" in body and "10%" in body and "| ISBN |" in body


def test_no_weekly_sample_while_people_review_every_day(tmp_path, capsys):
    assert sample.main(["--out", str(tmp_path / "issue.md")]) == 0  # saved config: auto_merge false
    assert not (tmp_path / "issue.md").exists() and "auto_merge is off" in capsys.readouterr().out


def test_the_trial_sample_stays_the_same_after_a_review_is_applied():
    doc = {"date": "2026-10-05", "batch": "daily", "books": [target(str(i), auto="ai-agree", flags=[]) for i in range(35)]}
    first = sample.trial_sample(doc, 0.1)
    assert len(first) == 4
    answers = {i: ans(next(b for b in doc["books"] if b["isbn"] == i)) for i in first}
    after, _ = apply_answers(doc, answers, KEPT)
    assert sample.trial_sample(after, 0.1) == first                  # the same books come back on a rebuilt page
    assert all(b["sampled"] for b in after["books"] if b["isbn"] in first) and len(sample.agreed_isbns(after)) == 35


def test_the_day_row_covers_every_reviewed_book_of_the_file_not_just_the_latest_download(files):
    tmp, path = files
    d = doc_of()
    for name, isbn, over in (("a.json", "1", {"way": "사례"}), ("b.json", "3", {})):    # two sittings
        (tmp / name).write_text(json.dumps({"answers": {isbn: ans(next(b for b in d["books"] if b["isbn"] == isbn), **over)}}),
                                encoding="utf-8")
        assert review.main(["2026-10-05", "--apply", str(tmp / name)]) == 0
    row = read_rows(tmp / "agreement.csv")[0]
    assert row["n"] == "2" and row["n_target"] == "1" and row["n_leaf"] == "1" and row["way"] == "0.0" and row["world"] == "100.0"
    review.main(["2026-10-05", "--apply", str(tmp / "a.json")])                          # the first one again
    again = read_rows(tmp / "agreement.csv")
    assert len(again) == 1 and again[0] == row


def test_a_weekly_sample_row_counts_only_the_books_answered_now(files, monkeypatch):
    tmp, path = files
    d = doc_of()
    (tmp / "a.json").write_text(json.dumps({"answers": {"1": ans(d["books"][0], way="사례")}}), encoding="utf-8")
    review.main(["2026-10-05", "--apply", str(tmp / "a.json")])                          # book 1 is human reviewed
    picks = [(path, json.loads(path.read_text(encoding="utf-8")), ["1", "2"])]
    (tmp / "w.json").write_text(json.dumps({"answers": {"2": ans(d["books"][1])}}), encoding="utf-8")
    row, tally, _ = review.apply("2026-W41", "sample-2026-W41", picks, tmp / "w.json", VOCAB)
    assert row["n"] == "1" and row["way"] == "100.0" and row["sample_n"] == "1" and row["auto_agreed"] == "0"   # not book 1 (way 0.0)


def test_a_pick_with_a_failing_line_is_refused_but_the_rest_of_the_download_is_applied(files, capsys):
    tmp, path = files
    d = doc_of()
    held = d["books"][3]                                                                # reserve: its line is 9 chars
    short = ans(held, status="picked", one_liner="짧은 한 줄?")
    fine = ans(d["books"][2], axes={**AX, "world": -1})
    (tmp / "dl.json").write_text(json.dumps({"answers": {"4": short, "3": fine}}), encoding="utf-8")
    assert review.main(["2026-10-05", "--apply", str(tmp / "dl.json")]) == 0
    out = capsys.readouterr().out
    assert "REFUSED 4" in out and "짧음" in out
    saved = {b["isbn"]: b for b in json.loads(path.read_text(encoding="utf-8"))["books"]}
    assert saved["4"]["status"] == "reserve" and "reviewed" not in saved["4"]            # stays held, untouched
    assert saved["3"]["reviewed"] is True and saved["3"]["axes"]["world"] == -1           # the other answer went through
    # a blank line on a dropped / held book is fine (it never goes into the app); on a pick it is refused, not a crash
    scrubbed = doc_of()
    scrubbed["books"][0] = {**scrubbed["books"][0], "one_liner": ""}
    path.write_text(json.dumps(scrubbed, ensure_ascii=False), encoding="utf-8")
    (tmp / "dl2.json").write_text(json.dumps({"answers": {"1": ans(scrubbed["books"][0], status="dropped")}}), encoding="utf-8")
    assert review.main(["2026-10-05", "--apply", str(tmp / "dl2.json")]) == 0
    assert json.loads(path.read_text(encoding="utf-8"))["books"][0]["status"] == "dropped"
    (tmp / "dl3.json").write_text(json.dumps({"answers": {"2": ans(scrubbed["books"][1], one_liner="")}}), encoding="utf-8")
    assert review.main(["2026-10-05", "--apply", str(tmp / "dl3.json")]) == 0 and "REFUSED 2" in capsys.readouterr().out


def test_the_pick_buttons_never_promote_a_held_book_and_the_page_keeps_open_details(files):
    tmp, _ = files
    review.main(["2026-10-05"])
    script = (tmp / "pages" / "2026-10-05.html").read_text(encoding="utf-8")
    assert 'status:o.fits===false?"dropped":cur(b).status' in script                  # keep the decision, drop only when AI says no fit
    assert 'status:o.fits===false?"dropped":"picked"' not in script
    assert 'querySelectorAll("details[open]")' in script and "d.open=true" in script   # a re-render keeps the open details


def test_a_flagged_book_waits_with_status_review_until_a_person_applies_a_review(files):
    tmp, path = files
    flagged = doc_of()
    flagged["books"][0] = {**flagged["books"][0], "status": "review"}
    flagged["books"][2] = {**flagged["books"][2], "status": "review"}
    path.write_text(json.dumps(flagged, ensure_ascii=False), encoding="utf-8")
    assert [b["isbn"] for b in flagged["books"] if review.needs_look(b)] == ["1", "3", "4"]       # still on the page
    assert "1" not in sample.agreed_isbns(flagged)
    assert [b["isbn"] for _, b in sample.sample_books([(path, flagged)], "2026-W41", 1.0)] == ["2"]   # waiting books are not sampled
    (tmp / "dl.json").write_text(json.dumps({"answers": {"1": ans(flagged["books"][0], status="picked")}}), encoding="utf-8")
    assert review.main(["2026-10-05", "--apply", str(tmp / "dl.json")]) == 0
    saved = json.loads(path.read_text(encoding="utf-8"))
    assert [b["status"] for b in saved["books"]] == ["picked", "picked", "review", "reserve"]         # book 3 still waits
    assert saved["reviewed"] is False                                                                # a waiting book is not reviewed
    kept = {t: v.get("kept", {}) for t, v in VOCAB.items()}
    dropped, tally = apply_answers(saved, {"3": ans(saved["books"][2], status="dropped")}, kept)
    assert dropped["books"][2]["status"] == "dropped" and tally["dropped"] == 1


def test_the_page_defaults_a_waiting_book_to_picked_so_one_confirm_puts_it_in(files):
    tmp, _ = files
    review.main(["2026-10-05"])
    script = (tmp / "pages" / "2026-10-05.html").read_text(encoding="utf-8")
    assert 'status:b.status==="reserve"?"reserve":"picked"' in script                 # review → picked in the form


def test_the_weekly_issue_table_escapes_pipes_and_line_breaks():
    book = target("1", title="제목 | 둘\n셋", one_liner="한 줄 | 또 한 줄")
    body = sample.issue_body("2026-W42", [(Path("x.json"), book)], 0.1)
    row = next(line for line in body.splitlines() if line.startswith("| 1 |"))
    escaped = chr(92) + "|"
    assert f"제목 {escaped} 둘 셋" in row and f"한 줄 {escaped} 또 한 줄" in row and row.count("|") - row.count(escaped) == 6
