"""Pipeline: the targeted v3.1 re-tag (src/pipeline/retag_v31.py) and the answers a person already gave
(library_review.groups answered=…, the page's seeded answers, --apply)."""
import json
import re
import shutil
import subprocess
import sys
from pathlib import Path

import pytest

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from test_pipeline_library_review import AX, KEPT, LINE, leaf_book, target_book, v1_rows  # noqa: E402

from pipeline import library_apply, library_cli, library_review, retag_v31  # noqa: E402

VOCAB = {"돈 관리·투자": {"kept": {"주식": {"pattern": "주식"}, "ETF·펀드": {"pattern": "ETF"}}}}


def novel(isbn, a=AX, b=AX, title=None):
    book = leaf_book(isbn, a=a, b=b)
    book["slot"] = book["current"]["genre"] = book["record"]["genre"] = "한국 소설"
    if title:
        book["title"] = title
    return book


def test_field_essay_names_a_field_not_a_determiner_or_praise():
    assert retag_v31.field_essay("저자의 첫 과학 에세이") and retag_v31.field_essay("여행에세이 한 권")
    for intro in ("이 에세이는", "다정한 에세이", "화제의 에세이", "독보적 에세이", "스테디셀러 에세이", "에세이"):
        assert not retag_v31.field_essay(intro), intro


def test_targets_are_the_books_the_new_rules_can_change_and_never_an_answered_one():
    books = [
        novel("1"),                                              # 0 on gain, decided alone → fiction
        novel("2", a={**AX, "gain": 1}, b={**AX, "gain": 1}),   # every story axis ±1 → untouched
        leaf_book("3", a={**AX, "gain": 1}, b={**AX, "gain": 1}),  # non-fiction, no form word → untouched
        novel("4", a={**AX, "gain": 1}, b={**AX, "gain": 1}, title="세계 단편 선집"),
        leaf_book("5", a={**AX, "gain": 1}, b={**AX, "gain": 1}),  # intro: 과학 에세이
        leaf_book("6", a={**AX, "temp": -1}),                   # split, no tiebreak → person
        target_book("7", a_kw=["주식"], b_kw=["ETF·펀드"]),     # keyword split → person
        leaf_book("8", a={**AX, "temp": -1}),                   # person, but answered → kept
    ]
    moved = leaf_book("9", a={**AX, "gain": 1}, b={**AX, "gain": 1}, b_fits=False, b_suggest="과학 교양")
    moved["record"] |= {"fits": False, "suggest": "과학 교양"}
    books.append(moved)
    settled = novel("10", a={**AX, "gain": 1, "temp": -1}, b={**AX, "gain": 1})
    tb = {"10": {"third": {"fits": True, "axes": {**AX, "gain": 1}, "missing": []}}}
    books.append(settled)
    decided = library_review.groups(books, tb, rate=0.0001, answered={"8"})
    decided = {i: d | ({"group": "auto"} if d["group"] == "sample" else {}) for i, d in decided.items()}
    intro = {"5": "과학자가 쓴 과학 에세이"}
    got = retag_v31.targets(books, decided, {"8"}, lambda i: (intro.get(i, ""), ""))
    assert got == {"1": ["fiction"], "4": ["anthology"], "5": ["essay"], "6": ["person"], "7": ["person"],
                   "9": ["moved"], "10": ["fiction"]}


def test_merge_replaces_a_retagged_book_and_keeps_its_v3_answer_and_tiebreak_row():
    old, other = novel("1"), novel("2")
    doc = {"books": [old, other], "cost_usd": 1.0}
    tb = {"cost_usd": 0.1, "books": {"1": {"third": {"axes": AX}}, "2": {"third": None}}}
    new = novel("1", a={**AX, "gain": -1}, b={**AX, "gain": -1})
    new["record"]["rules_version"] = "v3.1"
    doc2, tb2 = retag_v31.merge(doc, tb, [new], {"1": ["fiction"]})
    one = doc2["books"][0]
    assert one["record"]["axes"]["gain"] == -1 and one["rules_version"] == "v3.1" and one["retag_reasons"] == ["fiction"]
    assert one["v3"] == {"record": old["record"], "tiebreak": {"third": {"axes": AX}}}
    assert doc2["books"][1] == other and tb2["books"] == {"2": {"third": None}} and tb["books"]["1"]  # inputs untouched


def test_answered_books_stay_on_the_page_as_answered_outside_the_sample_and_apply_takes_their_answers():
    books = [leaf_book(str(i)) for i in range(30)] + [leaf_book("x", a={**AX, "temp": -1})]
    decided = library_review.groups(books, {}, answered={"3", "x"})
    assert decided["3"]["group"] == decided["x"]["group"] == "answered"
    assert library_review.counts(decided)["answered"] == 2 and library_review.counts(decided)["to_person"] == 0
    ans = {"3": {"genre": "에세이", "axes": {**AX, "temp": None}, "one_liner": LINE, "status": "picked", "ok": True}}
    v1, _, _, _ = library_apply.apply([b for b in books if b["isbn"] in ("1", "3")], decided, ans, KEPT,
                                      [v1_rows()[0], {**v1_rows()[1], "isbn": "3"}], {})
    assert v1[1]["axes"]["temp"] is None


STUB = """const _el=()=>({textContent:"",innerHTML:"",onclick:null});const _els={};
globalThis.document={getElementById:id=>_els[id]||(_els[id]=_el()),querySelectorAll:()=>[],addEventListener:()=>{}};
globalThis.localStorage={getItem:()=>null,setItem:()=>{}};
"""


@pytest.mark.skipif(shutil.which("node") is None, reason="node not installed")
def test_the_page_seeds_the_answers_as_confirmed_and_offers_empty_for_a_fiction_axis(tmp_path):
    from pipeline_fakes import INTRO, TOC
    books = [novel("1", a={**AX, "temp": None}), leaf_book("2"), novel("3", a={**AX, "temp": None}, b={**AX, "temp": None})]
    doc = {"books": [b | {"record": b["record"] | {"author": "가", "pages": 100, "title": b["title"]}} for b in books]}
    ans = {"2": {"entry": "leaf", "genre": "에세이", "axes": {**AX, "temp": -1}, "one_liner": LINE, "status": "picked",
                 "ok": True}}
    decided = library_review.groups(doc["books"], {}, answered=set(ans))
    entries = library_cli.page_entries(doc, {"books": {}}, decided, lambda i: (INTRO, TOC))
    html = library_cli.render(entries, [], library_review.counts(decided), {}, VOCAB, ans)
    assert '"galpi-library-v3.1"' in html and "__ANSWERS__" not in html and "비움 확정" in html
    script = re.search(r"<script>(.*)</script>", html, re.S).group(1)
    probe = """
const out={};const b1=BOOKS.find(b=>b.isbn==="1"), b2=BOOKS.find(b=>b.isbn==="2");
out.seeded=cur(b2).ok&&cur(b2).axes.temp===-1; out.group=b2.group;
out.empty_option=ask(b1,cur(b1),"temp").includes('value="null"');
put(b1,{axes:{...cur(b1).axes,temp:null}},"temp"); out.left=left(b1,cur(b1)).length;
console.log(JSON.stringify(out));"""
    (tmp_path / "page.js").write_text(STUB + script + probe, encoding="utf-8")
    done = subprocess.run(["node", str(tmp_path / "page.js")], capture_output=True, text=True, encoding="utf-8")
    assert done.returncode == 0, done.stderr
    assert json.loads(done.stdout.strip().splitlines()[-1]) == {"seeded": True, "group": "answered", "empty_option": True,
                                                                "left": 0}
