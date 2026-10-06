"""Pipeline: agreement of each pass with a person's gold labels (src/pipeline/gold_score.py)."""
import sys
from pathlib import Path

import pytest

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from pipeline import gold_score as gs  # noqa: E402

GOLD = [{"isbn": "1", "title": "소설", "entry": "leaf", "slot": "한국 소설"},
        {"isbn": "2", "title": "역사책", "entry": "leaf", "slot": "역사"},
        {"isbn": "3", "title": "주식", "entry": "target", "slot": "돈 관리·투자"},
        {"isbn": "4", "title": "안 한 책", "entry": "leaf", "slot": "시"}]
SIG = {"temp": "끝맺음 +", "pull": "몰입", "gain": "마음", "world": "현실 배경"}


def leaf_rec(isbn, axes, fits=True, missing=(), second=None, second_missing=(), second_fits=True):
    return {"isbn": isbn, "entry": "leaf", "axes": axes, "signals": SIG, "missing": list(missing), "fits": fits,
            "evidence": "근거1", "rules_version": "v3",
            "second": {"fits": second_fits, "axes": second or axes, "signals": {**SIG, "temp": "서늘한 끝"},
                       "missing": list(second_missing), "why": "이유2"}}


def target_rec(isbn, kws, way, fits=True, second=None):
    return {"isbn": isbn, "entry": "target", "keywords": kws, "way": way, "fits": fits, "evidence": "근거1",
            "second": {"fits": True, "keywords": (second or {}).get("keywords", kws), "way": (second or {}).get("way", way),
                       "why": "이유2"}}


AX = {"temp": 1, "pull": -1, "gain": 0, "world": 1}
LABELS = {"1": {"genre": "한국 소설", "axes": {**AX}, "missing": [], "reasons": {"temp": "따뜻한 끝"}},
          "2": {"genre": "사회·시사", "axes": {**AX, "temp": None}, "missing": ["temp"]},
          "3": {"topic": "돈 관리·투자", "keywords": ["주식", "배당"], "way": "개념"}}
RESULTS = [{"run": 1, "isbn": "1", "record": leaf_rec("1", AX, second={**AX, "temp": -1})},
           {"run": 1, "isbn": "2", "record": leaf_rec("2", {**AX, "temp": 0}, fits=True, missing=["temp"], second_fits=False)},
           {"run": 1, "isbn": "3", "record": target_rec("3", ["배당", "주식"], "개념", second={"way": "사례"})}]


def test_agreement_per_field_counts_each_pass_against_the_person():
    s = gs.score(GOLD, LABELS, RESULTS)
    f = s["fields"]
    assert f["temp"] == {"ai1": [1, 1], "ai2": [0, 1]}            # book 2's temp: no value from the person — not counted
    assert f["pull"] == {"ai1": [2, 2], "ai2": [2, 2]}
    assert f["genre"] == {"ai1": [1, 2], "ai2": [2, 2]}           # book 2: person moved it, so "fits 역사" is wrong
    assert f["keywords"] == {"ai1": [1, 1], "ai2": [1, 1]}        # order does not matter
    assert f["way"] == {"ai1": [1, 1], "ai2": [0, 1]} and f["topic"] == {"ai1": [1, 1], "ai2": [1, 1]}
    assert s["labelled"] == 3 and s["unlabelled"] == ["4"]


def test_agreement_per_slot_adds_every_field_of_its_books():
    s = gs.score(GOLD, LABELS, RESULTS)
    assert s["slots"]["한국 소설"] == {"ai1": [5, 5], "ai2": [4, 5]}
    assert s["slots"]["돈 관리·투자"] == {"ai1": [3, 3], "ai2": [2, 3]}


def test_every_mismatch_lists_the_person_both_ais_their_reasons_and_no_info_marks():
    rows = {(m["isbn"], m["field"]): m for m in gs.score(GOLD, LABELS, RESULTS)["mismatches"]}
    assert set(rows) == {("1", "temp"), ("2", "genre"), ("3", "way")}
    t = rows[("1", "temp")]
    assert t["person"] == 1 and t["person_reason"] == "따뜻한 끝" and t["key"] == "1|temp"
    run = t["runs"][0]
    assert (run["ai1"], run["ai2"], run["why1"], run["why2"]) == (1, -1, "끝맺음 +", "서늘한 끝")
    g = rows[("2", "genre")]
    assert g["person"] == "사회·시사" and g["runs"][0]["ai1"] == "역사" and g["runs"][0]["ai2"] == "역사 아님"
    assert g["runs"][0]["why1"] == "근거1" and g["runs"][0]["why2"] == "이유2"
    assert rows[("3", "way")]["runs"][0]["ai2"] == "사례"


def test_no_info_marks_are_tallied_and_shown_on_axis_mismatches():
    s = gs.score(GOLD, LABELS, RESULTS)
    assert s["missing"] == {"person": 1, "ai1_too": 1, "ai2_too": 0, "ai1_only": 0, "ai2_only": 0}
    labels = {**LABELS, "2": {**LABELS["2"], "axes": {**AX, "temp": 1}}}
    row = next(m for m in gs.score(GOLD, labels, RESULTS)["mismatches"] if m["key"] == "2|temp")
    assert row["person_missing"] and row["runs"][0]["miss1"] and not row["runs"][0]["miss2"]


def test_several_runs_count_every_run_and_keep_one_row_per_book_and_field():
    second = [{**r, "run": 2} for r in RESULTS]
    s = gs.score(GOLD, LABELS, RESULTS + second)
    assert s["fields"]["pull"] == {"ai1": [4, 4], "ai2": [4, 4]} and s["runs"] == 2
    row = next(m for m in s["mismatches"] if m["key"] == "1|temp")
    assert [r["run"] for r in row["runs"]] == [1, 2]


def test_labels_for_books_outside_the_gold_set_are_refused():
    with pytest.raises(gs.GoldError):
        gs.check_labels(GOLD, {"99": {"genre": "시"}})
    assert gs.check_labels(GOLD, {"labels": LABELS}) == LABELS and gs.check_labels(GOLD, LABELS) == LABELS


def test_a_suggested_slot_is_compared_with_the_persons_genre_or_topic():
    """10-06 calibration: a pass that says the book does not fit names where it belongs; that suggestion must be the
    person's genre / topic. A record from before suggestions keeps the old rule (not the slot = agrees with a move)."""
    gold = GOLD[:2]
    rec = leaf_rec("2", AX, fits=False, second_fits=False)
    rec["suggest"], rec["second"]["suggest"] = "사회·시사", "인문"
    s = gs.score(gold, LABELS, [{"run": 1, "isbn": "2", "record": rec}])
    assert s["fields"]["genre"] == {"ai1": [1, 1], "ai2": [0, 1]}
    row = next(m for m in s["mismatches"] if m["key"] == "2|genre")
    assert row["runs"][0]["ai1"] == "사회·시사" and row["runs"][0]["ai2"] == "인문"
    rec["second"]["suggest"] = ""                       # "no genre fits" is right only when the person said so too
    assert gs.score(gold, LABELS, [{"run": 1, "isbn": "2", "record": rec}])["fields"]["genre"]["ai2"] == [0, 1]
    none = {**LABELS, "2": {**LABELS["2"], "genre": ""}}
    assert gs.score(gold, none, [{"run": 1, "isbn": "2", "record": rec}])["fields"]["genre"]["ai2"] == [1, 1]


def test_keywords_of_a_moved_book_count_only_when_the_ai_suggested_the_persons_topic():
    gold = [GOLD[2]]
    labels = {"3": {"topic": "경제 상식", "keywords": ["금리·환율"], "way": "개념"}}
    rec = target_rec("3", ["주식"], "개념", fits=False)
    rec |= {"suggest": "경제 상식", "suggest_keywords": ["금리·환율"]}
    rec["second"] |= {"fits": False, "suggest": "마케팅·브랜딩", "suggest_keywords": ["고객 이해"]}
    s = gs.score(gold, labels, [{"run": 1, "isbn": "3", "record": rec}])
    assert s["fields"]["keywords"] == {"ai1": [1, 1], "ai2": [0, 0]}       # AI-2 named another topic: not compared
    assert s["fields"]["topic"] == {"ai1": [1, 1], "ai2": [0, 1]}
    old = target_rec("3", ["주식"], "개념", fits=False)                       # no suggestion: the slot's keywords are moot
    assert gs.score(gold, labels, [{"run": 1, "isbn": "3", "record": old}])["fields"].get("keywords") is None
    kept = {"3": {"topic": "돈 관리·투자", "keywords": ["주식"], "way": "개념"}}  # the person kept it: compared as before
    assert gs.score(gold, kept, [{"run": 1, "isbn": "3", "record": rec}])["fields"]["keywords"] == {"ai1": [1, 1], "ai2": [1, 1]}
