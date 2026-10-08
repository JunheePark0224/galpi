"""Re-route books dropped before 10-08 whose two passes named the same other slot (pipeline/reroute.py)."""
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from pipeline.checks import AUTO  # noqa: E402
from pipeline.reroute import reroute  # noqa: E402

AXES = {"temp": 1, "pull": 0, "gain": -1, "world": 0}


def leaf(**over) -> dict:
    base = {"isbn": "1", "entry": "leaf", "genre": "로맨스", "axes": AXES, "fits": False, "suggest": "외국 소설",
            "flags": ["fits"], "issues": [], "status": "dropped", "one_liner": "사랑은 대체 어디서 시작되는 걸까요?",
            "second": {"fits": False, "suggest": "외국 소설", "axes": AXES, "why": "번역 소설"}}
    return base | over


def test_a_dropped_book_both_passes_placed_elsewhere_moves_there_with_its_history():
    doc = {"books": [leaf()]}
    out, tally = reroute(doc, auto_merge=False)
    b = out["books"][0]
    assert (b["genre"], b["status"], b.get("auto"), b["moved_from"]) == ("외국 소설", "picked", AUTO, "로맨스")
    assert b["flags"] == [] and b["history"] == [{"change": "reroute-2026-10-08", "status": "dropped", "genre": "로맨스"}]
    assert tally == {"moved": 1, "picked": 1}
    assert doc["books"][0]["status"] == "dropped"                       # a new document; the given one is untouched
    again, tally = reroute(out, auto_merge=False)                       # running it twice changes nothing
    assert again == out and tally == {}


def test_what_stays_dropped_and_what_waits_for_a_person():
    nowhere = leaf(isbn="2", suggest="", second={"fits": False, "suggest": "", "axes": AXES, "why": "희곡"})
    split = leaf(isbn="3", second={"fits": False, "suggest": "SF·판타지", "axes": AXES, "why": "SF"})
    axes = leaf(isbn="4", second={"fits": False, "suggest": "외국 소설", "axes": {**AXES, "temp": -1}, "why": "번역"})
    out, tally = reroute({"books": [nowhere, split, axes]}, auto_merge=False)
    assert [b["status"] for b in out["books"]] == ["dropped", "dropped", "review"]
    assert out["books"][2]["flags"] == ["temp"] and out["books"][2]["genre"] == "외국 소설"
    assert tally == {"moved": 1, "review": 1}


def test_a_target_book_takes_the_shared_keywords_of_its_new_topic():
    book = {"isbn": "5", "entry": "target", "topic": "경제 상식", "field": "돈·경제", "keywords": ["금리"], "way": "개념",
            "fits": False, "suggest": "돈 관리·투자", "suggest_keywords": ["주식", "ETF·펀드"], "flags": ["fits", "keywords"],
            "issues": [], "status": "dropped",
            "second": {"fits": False, "suggest": "돈 관리·투자", "suggest_keywords": ["주식"], "keywords": ["환율"], "way": "개념",
                       "why": "주식"}}
    b = reroute({"books": [book]}, auto_merge=False)[0]["books"][0]
    assert (b["topic"], b["field"], b["keywords"], b["status"], b["flags"]) == ("돈 관리·투자", "돈·경제", ["주식"], "review", ["keywords"])


def test_a_moved_book_is_held_when_its_one_liner_breaks_todays_rules():
    # 10-08: books dropped before the question rule (check_one_liners.form_issue) were never checked against it
    fake = leaf(isbn="6", one_liner="지금 이 순간에 깨어 있는 법을 안내해요?")
    empty = leaf(isbn="7", one_liner="", issues=["한 줄이 책소개를 베낌"])
    out, tally = reroute({"books": [fake, empty]}, auto_merge=False)
    assert [b["status"] for b in out["books"]] == ["reserve", "reserve"]
    assert "질문형인데 평서문에 ?만 붙음" in out["books"][0]["issues"]
    assert out["books"][1]["issues"] == ["한 줄이 책소개를 베낌"]      # an empty line keeps its copy issue, not a second one
    assert tally == {"moved": 2, "reserve": 2}


from pipeline.reroute import apply_check  # noqa: E402


def test_a_person_keeps_a_book_in_its_slot_or_sends_it_to_the_other_entry():
    keep, target, fine = leaf(isbn="11"), leaf(isbn="12"), leaf(isbn="13")
    moved, _ = reroute({"batch_id": "2026-10-07-3", "books": [keep, target, fine]}, auto_merge=False)
    wrong = {"11": {"to": "로맨스"}, "12": {"to": "🎯마음 돌보기"}}
    out, rows, tally = apply_check(moved, wrong, {}, today="2026-10-08")
    k, t, f = out["books"]
    # kept where it was found: a person overrides the two passes' "not here"
    assert (k["genre"], k["status"], k.get("auto"), k["reviewed"]) == ("로맨스", "picked", None, True) and "moved_from" not in k
    # to the other entry: out of the app until it is tagged as 🎯 (requeue.json)
    assert (t["status"], t["requeued_to"]) == ("dropped", {"entry": "target", "slot": "마음 돌보기"})
    assert rows == [{"isbn": "12", "to_entry": "target", "to_slot": "마음 돌보기", "from_batch": "2026-10-07-3", "date": "2026-10-08"}]
    assert (f["genre"], f["status"]) == ("외국 소설", "picked")          # not marked: stays moved
    assert tally == {"kept": 1, "requeued": 1}


def test_an_approved_one_liner_frees_a_held_book():
    held = leaf(isbn="14", one_liner="지금 이 순간에 깨어 있는 법을 안내해요?")
    blank = leaf(isbn="15", one_liner="", issues=["한 줄이 책소개를 베낌"])
    moved, _ = reroute({"batch_id": "b", "books": [held, blank]}, auto_merge=False)
    lines = {"14": "생각에서 한 걸음 물러나 지금 이 순간에 깨어 있을 수 있을까요?",
             "15": "실수투성이여도 매일을 설레며 사는 앤, 그 비결은 뭘까요?"}
    out, _, tally = apply_check(moved, {}, lines, today="2026-10-08")
    for b, line in zip(out["books"], lines.values()):
        assert (b["status"], b["one_liner"], b["issues"]) == ("picked", line, [])
    assert out["books"][0]["history"][-1] == {"change": "reroute-lines-2026-10-08", "one_liner": "지금 이 순간에 깨어 있는 법을 안내해요?"}
    assert tally == {"lines": 2}


def test_applying_the_check_twice_changes_nothing():
    books = [leaf(isbn="21"), leaf(isbn="22"), leaf(isbn="23", one_liner="지금 이 순간에 깨어 있는 법을 안내해요?")]
    wrong = {"21": {"to": "로맨스"}, "22": {"to": "🎯마음 돌보기"}}
    lines = {"23": "생각에서 한 걸음 물러나 지금 이 순간에 깨어 있을 수 있을까요?"}
    once = apply_check(reroute({"batch_id": "b", "books": books}, False)[0], wrong, lines, "2026-10-08")[0]
    twice, rows, tally = apply_check(reroute(once, False)[0], wrong, lines, "2026-10-08")
    assert twice == once and rows == [] and tally == {}
