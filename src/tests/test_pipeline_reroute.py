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
