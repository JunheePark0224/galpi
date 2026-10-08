"""route_check: the route plan's validation (10-08, step 4) — does a book end in the slot a person gave it?"""
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from pipeline import route_check  # noqa: E402

ROWS = [{"isbn": f"97900000000{i:02d}", "title": f"책 {i}", "entry": "leaf" if i < 8 else "target",
         "slot": "에세이" if i < 8 else "경제 상식"} for i in range(10)]
LABELS = {r["isbn"]: ({"entry": "leaf", "genre": "에세이"} if r["entry"] == "leaf" else {"entry": "target", "topic": "경제 상식"})
          for r in ROWS}


def test_the_expected_end_is_the_persons_slot_or_out():
    assert route_check.expected({"entry": "leaf", "genre": "인문"}) == ("leaf", "인문")
    assert route_check.expected({"entry": "target", "topic": "AI 활용"}) == ("target", "AI 활용")
    assert route_check.expected({"entry": "leaf", "genre": ""}) == ("target", "*")       # no genre: a 🎯 book
    assert route_check.expected({"entry": "target", "topic": "서재에 넣지 않음"}) == ("drop", "")


def test_where_a_record_ends():
    leaf = {"entry": "leaf", "genre": "인문", "flags": [], "status": "picked"}
    assert route_check.ended(leaf) == ("leaf", "인문")
    assert route_check.ended({**leaf, "status": "dropped", "requeued_to": {"entry": "target", "slot": "마음 돌보기"}}) \
        == ("target", "마음 돌보기")
    assert route_check.ended({**leaf, "status": "dropped"}) == ("drop", "")
    assert route_check.ended({**leaf, "status": "review", "flags": ["fits", "temp"]}) == ("person", "")
    assert route_check.ended({**leaf, "status": "review", "flags": ["temp"]}) == ("leaf", "인문")


def test_wrong_slot_cases_are_the_same_every_time_and_never_the_right_slot():
    cases = route_check.cases(ROWS, LABELS, wrong=6, crossing=2)
    again = route_check.cases(ROWS, LABELS, wrong=6, crossing=2)
    assert cases == again and len(cases) == 16
    wrong = [c for c in cases if c["kind"] != "own"]
    assert len(wrong) == 6 and sum(c["kind"] == "crossing" for c in wrong) == 2
    for c in wrong:
        assert c["isbn"].endswith("-w") and (c["entry"], c["slot"]) != route_check.expected(LABELS[c["isbn"][:-2]])
        assert (c["entry"] != LABELS[c["isbn"][:-2]]["entry"]) == (c["kind"] == "crossing")


def test_the_score_counts_right_wrong_and_left_to_a_person():
    cases = [{"isbn": "1", "kind": "own", "expect": ("leaf", "인문")}, {"isbn": "2-w", "kind": "same", "expect": ("leaf", "시")},
             {"isbn": "3", "kind": "own", "expect": ("target", "*")}, {"isbn": "4-w", "kind": "crossing", "expect": ("leaf", "시")}]
    ends = {"1": ("leaf", "인문"), "2-w": ("leaf", "에세이"), "3": ("target", "마음 돌보기"), "4-w": ("person", "")}
    out = route_check.score(cases, ends)
    assert out["all"] == {"cases": 4, "decided": 3, "right": 2, "person": 1, "accuracy": 0.667}
    assert out["by_kind"]["crossing"]["person"] == 1 and out["passes"] is False
    assert [w["isbn"] for w in out["wrong"]] == ["2-w"]
