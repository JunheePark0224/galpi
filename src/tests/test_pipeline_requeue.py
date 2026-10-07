"""Pipeline: a book fetched for the wrong 갈래 goes back in as the other entry (src/pipeline/requeue.py, 10-05)."""
import json
import sys
from pathlib import Path

import pytest

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

import collect_candidates  # noqa: E402
from apply_review import ReviewError  # noqa: E402
from pipeline import ADDITIONS, REQUEUE, requeue, review, run_daily  # noqa: E402
from pipeline.agreement import apply_answers  # noqa: E402
from pipeline.config import parse_config  # noqa: E402
from pipeline_fakes import INTRO, TOC, FakeClient, write_cache, yes24_item  # noqa: E402

BRAIN = "9788931558210"
ROW = {"isbn": BRAIN, "to_entry": "leaf", "to_slot": "과학 교양", "from_batch": "2026-10-05", "date": "2026-10-05"}


def test_the_brain_book_went_to_science_once():
    """『뇌』 (모기 겐이치로): 🎯 습관·집중 / 뇌과학 → 🍃 과학 교양. Seeded on 10-05, used up by the next batch (2026-10-05-2):
    the row either still waits in the file or the book is in an additions file as 🍃 과학 교양 (a data test must not assume
    the queue never moves)."""
    rows = requeue.load(REQUEUE)
    tagged = [b for p in sorted(ADDITIONS.glob("*.json")) for b in json.loads(p.read_text(encoding="utf-8"))["books"]
              if b["isbn"] == BRAIN and b["entry"] == "leaf" and b.get("genre") == "과학 교양"]
    assert rows == [ROW] or (BRAIN not in {r["isbn"] for r in rows} and tagged)


@pytest.mark.parametrize("row, msg", [
    ({**ROW, "to_slot": None}, "genre"), ({**ROW, "to_slot": "뇌과학"}, "genre"), ({**ROW, "to_entry": "both"}, "leaf or target"),
    ({**ROW, "to_entry": "target", "to_slot": "요리"}, "unknown topic"), ({**ROW, "isbn": ""}, "isbn"),
])
def test_rows_must_name_one_of_our_slots(row, msg):
    with pytest.raises(requeue.RequeueError, match=msg):
        requeue.checked(row)


def test_rows_are_added_and_removed_without_changing_the_old_list():
    rows = [ROW]
    newer = {**ROW, "to_slot": "인문", "date": "2026-10-06"}
    other = {"isbn": "9790000000099", "to_entry": "target", "to_slot": None, "from_batch": "x", "date": "y"}
    both = requeue.added(rows, [newer, other])
    assert rows == [ROW] and both == [newer, other]                     # same ISBN: the newer row replaces it
    assert requeue.without(both, {BRAIN}) == [other] and len(both) == 2


def test_save_and_load_round_trip(tmp_path):
    path = tmp_path / "requeue.json"
    assert requeue.load(path) == []
    requeue.save(path, [ROW])
    assert requeue.load(path) == [ROW] and path.read_text(encoding="utf-8").endswith("\n")


VOCAB = {"습관·집중": {"kept": {"뇌과학": {"pattern": "뇌과학|신경과학"}}},
         "돈 관리·투자": {"kept": {"주식": {"pattern": "주식|배당"}}}}


def test_a_book_going_to_target_without_a_topic_gets_the_best_matching_one():
    assert requeue.guess_topic("주식 처음 공부", "배당과 주식 이야기", VOCAB) == "돈 관리·투자"
    assert requeue.guess_topic("바다의 노래", "파도와 바람", VOCAB) is None


@pytest.fixture
def yes24(tmp_path, monkeypatch):
    monkeypatch.setattr(collect_candidates, "RAW", tmp_path / "raw")
    monkeypatch.setattr(collect_candidates, "get_json", lambda *a, **k: {"error": "offline in tests"})
    monkeypatch.setattr(collect_candidates, "time", type("T", (), {"sleep": staticmethod(lambda s: None)}))
    brain = yes24_item(BRAIN, "뇌", "모기 겐이치로 저", 1, goodsSortNm="국내도서-자연과학")
    write_cache(tmp_path / "raw", {}, [brain])
    return tmp_path


def test_candidates_read_the_detail_in_memory_as_the_target_entry_and_slot(yes24):
    out, waiting = requeue.candidates({"YES24_API_KEY": "x"}, [ROW, {**ROW, "isbn": "9790000000098"}], VOCAB)
    assert waiting == {"9790000000098": "detail_unusable"}               # no detail: waits, never half-filled
    (c,) = out
    assert (c.entry, c.slot, c.isbn, c.title, c.pages) == ("leaf", "과학 교양", BRAIN, "뇌", 280)
    assert c.intro.startswith(INTRO[:10]) and "계좌와 주문" in c.toc and "intro" not in repr(c)


def target_book(isbn, **over):
    return {"isbn": isbn, "title": "뇌", "author": "모기 겐이치로 저", "pages": 280, "entry": "target", "topic": "습관·집중",
            "field": "습관·자기계발", "keywords": ["뇌과학"], "way": "개념", "one_liner": "뇌가 일하는 방식을 알려줘요",
            "evidence": "뇌과학 교양", "confidence": 0.6, "fits": True, "link": "https://y/1", "status": "review",
            "second": {"fits": False, "keywords": [], "way": "개념", "why": "과학 교양"}, "flags": ["fits"], "issues": [], **over}


def test_apply_stores_a_requeued_book_as_dropped_with_where_it_goes():
    doc = {"date": "2026-10-05", "books": [target_book(BRAIN)]}
    new, tally = apply_answers(doc, {BRAIN: {"status": "requeue", "to_entry": "leaf", "to_slot": "과학 교양", "ok": True}},
                               {"습관·집중": {"뇌과학": {}}})
    (b,) = new["books"]
    assert b["status"] == "dropped" and b["requeued_to"] == {"entry": "leaf", "slot": "과학 교양"} and b["reviewed"]
    assert b["draft"]["topic"] == "습관·집중" and tally["dropped"] == 1 and doc["books"][0]["status"] == "review"
    with pytest.raises(ReviewError, match="genre"):
        apply_answers(doc, {BRAIN: {"status": "requeue", "ok": True}}, {})
    with pytest.raises(ReviewError, match="other entry"):
        apply_answers(doc, {BRAIN: {"status": "requeue", "to_entry": "target", "ok": True}}, {})


def test_review_apply_writes_the_requeue_row_once(tmp_path, monkeypatch, capsys):
    adds = tmp_path / "additions"
    adds.mkdir()
    path = adds / "2026-10-05.json"
    path.write_text(json.dumps({"date": "2026-10-05", "batch_id": "2026-10-05", "batch": "daily",
                                "books": [target_book(BRAIN)]}, ensure_ascii=False), encoding="utf-8")
    (tmp_path / "vocab.json").write_text(json.dumps({"습관·집중": {"kept": {"뇌과학": {"pattern": "뇌과학"}}}}), encoding="utf-8")
    for name, value in (("ADDITIONS", adds), ("VOCAB", tmp_path / "vocab.json"), ("AGREEMENT", tmp_path / "agreement.csv"),
                        ("REQUEUE", tmp_path / "requeue.json")):
        monkeypatch.setattr(review, name, value)
    monkeypatch.setattr("pipeline.sample.ADDITIONS", adds)
    monkeypatch.setattr(review, "load_config", lambda: parse_config(
        {"daily_count": 5, "auto_merge": False, "sample_rate": 0.1, "model": "claude-haiku-4-5",
         "second_model": "claude-haiku-4-5", "target_phase": "launch"}))
    download = tmp_path / "dl.json"
    download.write_text(json.dumps({"answers": {BRAIN: {"status": "requeue", "to_entry": "leaf", "to_slot": "과학 교양",
                                                         "one_liner": "", "ok": True}}}), encoding="utf-8")
    assert review.main(["2026-10-05", "--apply", str(download)]) == 0
    rows = requeue.load(tmp_path / "requeue.json")
    assert [(r["isbn"], r["to_entry"], r["to_slot"], r["from_batch"]) for r in rows] == [(BRAIN, "leaf", "과학 교양", "2026-10-05")]
    assert "REQUEUE 9788931558210" in capsys.readouterr().out
    saved = json.loads(path.read_text(encoding="utf-8"))["books"][0]
    assert saved["status"] == "dropped" and INTRO[:20] not in path.read_text(encoding="utf-8")  # no YES24 text
    assert review.main(["2026-10-05", "--apply", str(download)]) == 0  # again: same file, no second row, no message
    assert requeue.load(tmp_path / "requeue.json") == rows and "REQUEUE" not in capsys.readouterr().out


def test_the_next_batch_tags_a_requeued_book_first_as_its_new_entry_and_clears_the_row(yes24, monkeypatch):
    tmp = yes24
    adds = tmp / "additions"
    adds.mkdir()
    (adds / "2026-10-05.json").write_text(json.dumps({"date": "2026-10-05", "books": [
        {**target_book(BRAIN), "status": "dropped", "requeued_to": {"entry": "leaf", "slot": "과학 교양"}}]},
        ensure_ascii=False), encoding="utf-8")                           # the ISBN is already ours: never offered twice…
    (tmp / "books.json").write_text("[]", encoding="utf-8")
    (tmp / "vocab.json").write_text(json.dumps(VOCAB), encoding="utf-8")
    requeue.save(tmp / "requeue.json", [ROW])
    for name, value in (("BOOKS", tmp / "books.json"), ("VOCAB", tmp / "vocab.json"), ("ADDITIONS", adds),
                        ("RUNS", tmp / "runs"), ("REQUEUE", tmp / "requeue.json")):
        monkeypatch.setattr(run_daily, name, value)
    monkeypatch.setattr(run_daily, "plan_day", lambda books, kept, n, **k: [])  # nothing else today: only the requeue
    cfg = parse_config({"daily_count": 1, "auto_merge": False, "sample_rate": 0.1, "model": "claude-haiku-4-5",
                        "second_model": "claude-haiku-4-5", "target_phase": "launch"})
    s = run_daily.run("2026-10-06", cfg, {"YES24_API_KEY": "x"}, FakeClient())   # …except through the requeue file
    assert s["status"] == "ok" and s["slots"][0] == "과학 교양 (다시 태그) 1" and s["requeued"] == [BRAIN]
    (book,) = json.loads((adds / "2026-10-06.json").read_text(encoding="utf-8"))["books"]
    assert (book["isbn"], book["entry"], book["genre"]) == (BRAIN, "leaf", "과학 교양")
    assert requeue.load(tmp / "requeue.json") == []                       # tagged: the row is gone
    assert INTRO[:20] not in (adds / "2026-10-06.json").read_text(encoding="utf-8") and TOC[:10] not in json.dumps(s)


def test_a_requeue_takes_its_place_in_the_days_count(yes24, monkeypatch):
    tmp = yes24
    (tmp / "books.json").write_text("[]", encoding="utf-8")
    (tmp / "vocab.json").write_text(json.dumps(VOCAB), encoding="utf-8")
    (tmp / "adds").mkdir()
    requeue.save(tmp / "requeue.json", [ROW])
    seen = {}
    for name, value in (("BOOKS", tmp / "books.json"), ("VOCAB", tmp / "vocab.json"), ("ADDITIONS", tmp / "adds"),
                        ("RUNS", tmp / "runs"), ("REQUEUE", tmp / "requeue.json")):
        monkeypatch.setattr(run_daily, name, value)
    monkeypatch.setattr(run_daily, "plan_day", lambda books, kept, n, **k: seen.update(n=n) or [])
    cfg = parse_config({"daily_count": 5, "auto_merge": False, "sample_rate": 0.1, "model": "claude-haiku-4-5",
                        "second_model": "claude-haiku-4-5", "target_phase": "launch"})
    run_daily.run("2026-10-06", cfg, {"YES24_API_KEY": "x"}, FakeClient())
    assert seen["n"] == 4


def test_the_review_page_offers_the_requeue_decision():
    html = review.render([], {"습관·집중": {"kept": {}}}, "2026-10-05")
    assert '["requeue","다른 갈래로 (다시 태그)"]' in html and "장르를 골라 주세요" in html and "AI가 정해요" in html
