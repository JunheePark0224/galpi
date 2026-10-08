"""Pipeline: what the v3 library re-tag decides alone, and --apply into the import's files
(src/pipeline/library_review.py · library_apply.py)."""
import sys
from pathlib import Path

import pytest

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from apply_review import ReviewError  # noqa: E402
from pipeline import library_apply, library_review  # noqa: E402

AX = {"temp": 1, "pull": -1, "gain": 0, "world": 1}
LINE = "잃어버린 하루는 어디로 갈까요?"
KEPT = {"돈 관리·투자": {"주식": {}, "ETF·펀드": {}}}


def leaf_book(isbn, a=AX, b=AX, cur=AX, source="books_v1.json", line=LINE, status="picked", a_missing=(), b_fits=True,
              b_suggest=""):
    rec = {"entry": "leaf", "genre": "에세이", "axes": dict(a), "missing": list(a_missing), "fits": True, "suggest": "",
           "one_liner": "새 한 줄은 무엇을 남길까요?",
           "second": {"fits": b_fits, "axes": dict(b), "missing": [], "suggest": b_suggest}}
    return {"isbn": isbn, "source": source, "entry": "leaf", "slot": "에세이", "title": f"책{isbn}", "status": status,
            "current": {"genre": "에세이", "axes": dict(cur), "one_liner": line}, "record": rec}


def target_book(isbn, a_kw=("주식",), b_kw=("주식",), cur_kw=("주식",), way=("개념", "개념"), cur_way="개념",
                source="2026-10-01.json"):
    rec = {"entry": "target", "topic": "돈 관리·투자", "keywords": list(a_kw), "way": way[0], "fits": True, "suggest": "",
           "one_liner": "주식의 기본을 쉽게 알려줘요",
           "second": {"fits": True, "keywords": list(b_kw), "way": way[1], "suggest": ""}}
    return {"isbn": isbn, "source": source, "entry": "target", "slot": "돈 관리·투자", "title": f"책{isbn}", "status": "picked",
            "current": {"topic": "돈 관리·투자", "keywords": list(cur_kw), "way": cur_way,
                        "one_liner": "배당과 분산으로 주식의 기본을 알려줘요"}, "record": rec}


def test_agreed_values_are_auto_and_their_differences_from_the_library_are_changes():
    d = library_review.decide(leaf_book("1", a={**AX, "temp": 0}, b={**AX, "temp": 0}), None)
    assert d["asks"] == [] and d["auto"] == {**AX, "temp": 0}
    assert d["changes"] == [{"field": "temp", "old": 1, "new": 0}]


def test_a_person_gets_unsettled_splits_no_info_slot_disputes_and_a_current_line_that_breaks_a_rule():
    d = library_review.decide(leaf_book("1", a={**AX, "temp": 0, "world": None}, a_missing=["world"], b_fits=False,
                                        b_suggest="한국 소설", line="짧아요?"), None)
    assert d["asks"] == ["slot", "temp", "world", "line"] and d["line_issues"]
    t = library_review.decide(target_book("2", a_kw=["주식"], b_kw=["ETF·펀드"], way=("개념", "실습")),
                              {"third": {"fits": True, "keywords": ["ETF·펀드"], "way": "실습"}})
    assert t["asks"] == ["keywords"] and t["auto"] == {"way": "실습"} and t["settled"] == ["way"]


def test_rule_9_both_passes_empty_is_final_one_empty_is_asked_and_a_no_info_mark_alone_is_not():
    """v3.1 rule 9 (10-07): both passes left an axis empty (null) → it stays empty, decided, nobody asked; one pass empty →
    a person; a value both gave with a no-info mark is that value (the mark alone asks nothing)."""
    empty = {**AX, "temp": None}
    both = library_review.decide(leaf_book("1", a=empty, b=empty, a_missing=["temp"]), None)
    assert both["asks"] == [] and both["auto"]["temp"] is None and both["emptied"] == ["temp"]
    assert {"field": "temp", "old": 1, "new": None} in both["changes"]
    one = library_review.decide(leaf_book("2", a=empty, a_missing=["temp"]), None)
    assert one["asks"] == ["temp"] and "temp" not in one["auto"] and one["emptied"] == []
    marked = library_review.decide(leaf_book("3", a_missing=["gain"]), None)
    assert marked["asks"] == [] and marked["auto"]["gain"] == 0
    g = library_review.groups([leaf_book("1", a=empty, b=empty, cur=empty), leaf_book("2", a=empty)], {})
    n = library_review.counts(g)
    assert n["empty_confirmed_books"] == 1 and n["empty_confirmed_axes"] == 1 and n["to_person"] == 1


def test_the_majority_keeps_a_disputed_slot_and_settles_an_axis():
    book = leaf_book("1", a={**AX, "temp": 0}, b_fits=False, b_suggest="한국 소설")
    d = library_review.decide(book, {"third": {"fits": True, "axes": {**AX, "temp": 0}, "missing": []}})
    assert d["asks"] == [] and d["settled"] == ["slot", "temp"] and d["auto"]["temp"] == 0 and "slot" not in d["auto"]
    moved = library_review.decide(book, {"third": {"fits": False, "suggest": "한국 소설", "axes": AX, "missing": []}})
    assert moved["auto"]["slot"] == "한국 소설" and moved["slot_by"] == "majority"
    assert {"field": "slot", "old": "에세이", "new": "한국 소설"} in moved["changes"]


def test_both_passes_naming_the_same_other_slot_move_the_book_and_different_names_go_to_a_person():
    same = leaf_book("1", b_fits=False, b_suggest="한국 소설")
    same["record"] |= {"fits": False, "suggest": "한국 소설"}
    d = library_review.decide(same, None)
    assert d["asks"] == [] and d["auto"]["slot"] == "한국 소설" and d["slot_by"] == "agreed"
    diff = leaf_book("2", b_fits=False, b_suggest="한국 소설")
    diff["record"] |= {"fits": False, "suggest": "SF·판타지"}
    assert library_review.decide(diff, None)["asks"] == ["slot"]


def test_a_moved_target_book_takes_the_keywords_both_movers_named():
    book = target_book("1")
    book["record"] |= {"fits": False, "suggest": "경제 상식", "suggest_keywords": ["금리·환율", "물가"]}
    book["record"]["second"] |= {"fits": False, "suggest": "경제 상식", "suggest_keywords": ["금리·환율"]}
    d = library_review.decide(book, None)
    assert d["auto"]["slot"] == "경제 상식" and d["auto"]["keywords"] == ["금리·환율"] and d["asks"] == []


def test_split_keywords_take_the_intersection_and_only_an_empty_one_goes_to_a_person():
    d = library_review.decide(target_book("1", a_kw=["주식", "ETF·펀드"], b_kw=["주식"]), None)
    assert d["asks"] == [] and d["auto"]["keywords"] == ["주식"] and d["keywords_by"] == "intersection"
    e = library_review.decide(target_book("2", a_kw=["주식"], b_kw=["ETF·펀드"]), None)
    assert e["asks"] == ["keywords"]


def test_three_tiebreak_slot_books_join_the_sample():
    books = []
    for i in range(6):
        b = leaf_book(f"s{i}", b_fits=False, b_suggest="한국 소설")
        books.append(b)
    tbs = {b["isbn"]: {"third": {"fits": True, "axes": AX, "missing": []}} for b in books}
    g = library_review.groups(books, tbs, rate=0.0001)
    assert sum(d["group"] == "sample" for d in g.values()) == 4   # 1 (5% rounds up to one) + 3 tiebreak books
    assert library_review.counts(g)["slot_tiebreak_settled"] == 6
    left = leaf_book("u", b_fits=False, b_suggest="한국 소설")
    one = library_review.groups([left], {"u": {"third": {"fits": False, "suggest": "SF·판타지", "axes": AX, "missing": []}}})
    assert library_review.counts(one)["slot_tiebreak_unsettled"] == 1


def test_groups_sample_five_percent_of_the_auto_books_with_a_seed_and_the_table_counts_changes():
    books = [leaf_book(str(i), a={**AX, "temp": 0}, b={**AX, "temp": 0}) for i in range(40)] + [
        leaf_book("x", a={**AX, "temp": 0})]
    g1, g2 = library_review.groups(books, {}), library_review.groups(books, {})
    assert g1 == g2 and sum(d["group"] == "sample" for d in g1.values()) == 2 and g1["x"]["group"] == "person"
    table = library_review.change_table(books, g1)
    assert table == [{"field": "temp", "change": "1 → 0", "count": 40, "isbns": [str(i) for i in range(40)]}]
    assert library_review.field_shares(books, g1)["temp"] == {"auto": 40, "changed": 40}
    c = library_review.counts(g1)
    assert c["to_person"] == 1 and c["changed_auto"] == 40 and c["sample"] == 2


def test_keyword_changes_are_rows_per_keyword_added_or_taken_off():
    books = [target_book("1", a_kw=["주식", "ETF·펀드"], b_kw=["ETF·펀드", "주식"])]
    rows = library_review.change_table(books, library_review.groups(books, {}))
    assert [r["change"] for r in rows] == ["돈 관리·투자: + ETF·펀드"]


def v1_rows():
    return [{"isbn": "1", "entry": "leaf", "slot": "에세이", "genre": "에세이", "topic": None, "field": None, "pages": 200,
             "way": None, "axes": dict(AX), "keywords": [], "one_liner": LINE, "one_liner_style": "question"},
            {"isbn": "3", "entry": "leaf", "slot": "에세이", "genre": "에세이", "topic": None, "field": None, "pages": 200,
             "way": None, "axes": dict(AX), "keywords": [], "one_liner": LINE, "one_liner_style": "question"}]


def addition(isbn, status="picked", **over):
    return {"isbn": isbn, "title": f"책{isbn}", "author": "가 저", "pages": 200, "entry": "target", "topic": "돈 관리·투자",
            "field": "돈·경제", "keywords": ["주식"], "way": "개념", "one_liner": "배당과 분산으로 주식의 기본을 알려줘요",
            "status": status, **over}


def setup():
    books = [leaf_book("1", a={**AX, "temp": 0}, b={**AX, "temp": 0}),
             leaf_book("3", a={**AX, "temp": 0}),                      # split → person
             target_book("2", way=("실습", "실습")),
             target_book("4", source="2026-10-05-2.json")]
    books[3]["status"] = "review"
    docs = {"2026-10-01.json": {"books": [addition("2"), addition("9", status="reserve")]},
            "2026-10-05-2.json": {"books": [addition("4", status="review")]}}
    return books, library_review.groups(books, {}, rate=0.0001), docs


def test_apply_writes_auto_values_with_history_and_stamps_unchanged_books():
    books, decided, docs = setup()
    v1, new_docs, removed, tally = library_apply.apply(books, decided, {}, KEPT, v1_rows(), docs)
    one = v1[0]
    assert one["axes"]["temp"] == 0 and one["rules_version"] == "v3" and one["slot"] == "에세이"
    assert one["history"] == [{"rules_version": "before-v3", "genre": "에세이", "axes": AX, "one_liner": LINE}]
    assert v1[1] == v1_rows()[1]                                         # waits for a person
    two = new_docs["2026-10-01.json"]["books"][0]
    assert two["way"] == "실습" and two["draft"]["way"] == "개념" and two["history"][0]["way"] == "개념"
    assert new_docs["2026-10-01.json"]["books"][1]["status"] == "reserve"    # not a library book
    four = new_docs["2026-10-05-2.json"]["books"][0]
    assert four["status"] == "picked" and four["auto"] == "ai-agree" and "history" not in four
    assert four["rules_version"] == "v3" and removed == [] and tally["skipped_edited"] == []
    again = library_apply.apply(books, decided, {}, KEPT, v1, new_docs)
    assert again[0] == v1 and again[1] == new_docs                       # applying again changes nothing


def test_apply_takes_a_persons_answer_and_a_dropped_v1_book_leaves_books_v1():
    books, decided, docs = setup()
    ans = {"3": {"genre": "에세이", "axes": {**AX, "temp": -1}, "one_liner": LINE, "status": "dropped", "ok": True}}
    v1, _, removed, tally = library_apply.apply(books, decided, ans, KEPT, v1_rows(), docs)
    assert [r["isbn"] for r in v1] == ["1"] and removed[0]["isbn"] == "3" and removed[0]["axes"]["temp"] == -1
    assert tally["dropped"] == 1


def test_apply_refuses_stray_answers_bad_lines_and_skips_rows_edited_since_the_run():
    books, decided, docs = setup()
    with pytest.raises(ReviewError, match="not on this page"):
        library_apply.apply(books, decided, {"1": {"ok": True}}, KEPT, v1_rows(), docs)
    with pytest.raises(ReviewError, match="one-liner"):
        library_apply.apply(books, decided, {"3": {"genre": "에세이", "axes": AX, "one_liner": "짧아요?", "ok": True}},
                            KEPT, v1_rows(), docs)
    edited = [{**v1_rows()[0], "axes": {**AX, "pull": 1}}, v1_rows()[1]]
    v1, _, _, tally = library_apply.apply(books, decided, {}, KEPT, edited, docs)
    assert tally["skipped_edited"] == ["1"] and v1[0] == edited[0]


def test_apply_moves_a_book_both_passes_sent_elsewhere_and_keeps_the_old_slot_as_history():
    leaf_moved = leaf_book("1", b_fits=False, b_suggest="한국 소설")
    leaf_moved["record"] |= {"fits": False, "suggest": "한국 소설"}
    t = target_book("2")
    t["record"] |= {"fits": False, "suggest": "경제 상식", "suggest_keywords": ["금리·환율"]}
    t["record"]["second"] |= {"fits": False, "suggest": "경제 상식", "suggest_keywords": ["금리·환율"]}
    books = [leaf_moved, t]
    decided = library_review.groups(books, {}, rate=0.0001)
    decided = {i: d | {"group": "auto"} for i, d in decided.items()}
    docs = {"2026-10-01.json": {"books": [addition("2")]}}
    v1, new_docs, _, _ = library_apply.apply(books, decided, {}, {**KEPT, "경제 상식": {"금리·환율": {}}}, v1_rows()[:1], docs)
    assert v1[0]["slot"] == v1[0]["genre"] == "한국 소설" and v1[0]["history"][0]["genre"] == "에세이"
    moved = new_docs["2026-10-01.json"]["books"][0]
    assert moved["topic"] == "경제 상식" and moved["field"] == "돈·경제" and moved["keywords"] == ["금리·환율"]
    assert moved["history"][0]["topic"] == "돈 관리·투자"
    rows = library_review.change_table(books, decided)
    assert {"field": "slot", "change": "에세이 → 한국 소설", "count": 1, "isbns": ["1"]} in rows


def test_apply_writes_an_empty_axis_both_passes_left_and_takes_a_persons_empty_answer():
    """v3.1 rule 9: both passes empty → the library row's axis becomes null (history kept); a person may answer 비움 (null)
    too. A book re-tagged under v3.1 is stamped with that version."""
    empty = {**AX, "temp": None}
    both = leaf_book("1", a=empty, b=empty)
    both["rules_version"] = "v3.1"
    asked = leaf_book("3", a=empty)
    decided = library_review.groups([both, asked], {}, rate=0.0001)
    decided = {i: d | {"group": "auto" if i == "1" else "person"} for i, d in decided.items()}
    ans = {"3": {"genre": "에세이", "axes": empty, "one_liner": LINE, "status": "picked", "ok": True}}
    v1, _, _, _ = library_apply.apply([both, asked], decided, ans, KEPT, v1_rows(), {})
    assert v1[0]["axes"] == empty and v1[0]["history"][0]["axes"] == AX and v1[0]["rules_version"] == "v3.1"
    assert v1[1]["axes"] == empty and v1[1]["rules_version"] == "v3"
    with pytest.raises(ReviewError, match="axes must be"):
        library_apply.apply([both, asked], decided, {"3": {**ans["3"], "axes": {**AX, "temp": "x"}}}, KEPT, v1_rows(), {})


def test_the_library_never_applies_a_slot_of_the_other_entry():
    """10-08: passes may name a 🎯 topic for a 🍃 book; the library re-tag asks a person ("다른 갈래로") instead of writing a
    topic as a genre."""
    from pipeline.library_review import slot_decision
    book = {"slot": "사회·시사", "entry": "leaf"}
    out = {"fits": False, "suggest": "마음 돌보기"}
    assert slot_decision(book, out, out, {}) == (None, "ask")
    assert slot_decision(book, {"fits": True}, out, {"slot": "마음 돌보기"}) == (None, "ask")
    assert slot_decision(book, {"fits": True}, {"fits": False, "suggest": "인문"}, {"slot": "인문"}) == ("인문", "majority")
