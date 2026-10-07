"""The library page's "다른 갈래로" decision (10-07): a 🍃 book that is really a 🎯 topic book — or the other way round —
leaves its slot on --apply and goes to data/pipeline/requeue.json like the daily review page's requeue
(src/pipeline/library_page.py · library_apply.py · library_cli.record_requeue)."""
import json
import re
import shutil
import subprocess
import sys
from pathlib import Path

import pytest

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from apply_review import ReviewError  # noqa: E402
from test_pipeline_library_review import KEPT, setup, v1_rows  # noqa: E402
from test_pipeline_retag_v31 import STUB, VOCAB  # noqa: E402

from pipeline import library_apply, library_cli, library_review, requeue  # noqa: E402
from test_pipeline_library_review import AX, leaf_book, target_book  # noqa: E402


def test_a_requeued_v1_book_leaves_books_v1_and_an_additions_book_is_dropped_with_its_target():
    books, decided, docs = setup()
    ans = {"3": {"entry": "leaf", "status": "requeue", "to_entry": "target", "to_slot": "마음 돌보기", "ok": True},
           "4": {"entry": "target", "status": "requeue", "to_entry": "leaf", "to_slot": "에세이", "ok": True}}
    decided = {**decided, "4": {**decided["4"], "group": "sample"}}
    v1, new_docs, removed, tally = library_apply.apply(books, decided, ans, KEPT, v1_rows(), docs)
    assert [r["isbn"] for r in v1] == ["1"] and removed[0]["isbn"] == "3"
    assert removed[0]["requeued_to"] == {"entry": "target", "slot": "마음 돌보기"} and removed[0]["axes"] == AX
    four = new_docs["2026-10-05-2.json"]["books"][0]
    assert four["status"] == "dropped" and four["requeued_to"] == {"entry": "leaf", "slot": "에세이"}
    assert four["reviewed"] is True and four["draft"]["topic"] == "돈 관리·투자"
    assert tally["requeued"] == [{"isbn": "3", "to_entry": "target", "to_slot": "마음 돌보기"},
                                 {"isbn": "4", "to_entry": "leaf", "to_slot": "에세이"}]
    again = library_apply.apply(books, decided, ans, KEPT, v1, new_docs)
    assert again[1] == new_docs                                          # applying again changes nothing


def test_a_requeue_to_a_genre_needs_the_genre_and_a_topic_may_be_left_to_the_pipeline():
    books, decided, docs = setup()
    decided = {**decided, "4": {**decided["4"], "group": "sample"}}
    with pytest.raises(ReviewError, match="genre"):
        library_apply.apply(books, decided, {"4": {"status": "requeue", "to_slot": "", "ok": True}}, KEPT, v1_rows(), docs)
    _, _, removed, tally = library_apply.apply(books, decided, {"3": {"status": "requeue", "ok": True}}, KEPT, v1_rows(),
                                               docs)
    assert tally["requeued"] == [{"isbn": "3", "to_entry": "target", "to_slot": None}]


def test_record_requeue_adds_rows_once(tmp_path):
    path = tmp_path / "requeue.json"
    rows = [{"isbn": "3", "to_entry": "target", "to_slot": "마음 돌보기"}]
    assert len(library_cli.record_requeue(rows, path, "2026-10-07")) == 1
    assert requeue.load(path) == [{"isbn": "3", "to_entry": "target", "to_slot": "마음 돌보기", "from_batch": "library-v3",
                                   "date": "2026-10-07"}]
    assert library_cli.record_requeue(rows, path, "2026-10-08") == [] and requeue.load(path)[0]["date"] == "2026-10-07"


@pytest.mark.skipif(shutil.which("node") is None, reason="node not installed")
def test_the_page_offers_the_other_branch_with_the_ai_mentions(tmp_path):
    from pipeline_fakes import INTRO, TOC
    leaf = leaf_book("1", b_fits=False)
    leaf["record"]["second"]["why"] = "마음 돌보기 주제에 가깝다"
    t = target_book("2", a_kw=["주식"], b_kw=["ETF·펀드"])
    books = [leaf, t]
    doc = {"books": [b | {"record": b["record"] | {"author": "가", "pages": 100, "title": b["title"]}} for b in books]}
    ans = {"2": {"entry": "target", "status": "requeue", "to_entry": "leaf", "to_slot": "에세이", "ok": True}}
    decided = library_review.groups(doc["books"], {}, answered=set(ans))
    entries = library_cli.page_entries(doc, {"books": {}}, decided, lambda i: (INTRO, TOC))
    vocab = {**VOCAB, "마음 돌보기": {"kept": {}}}
    html = library_cli.render(entries, [], library_review.counts(decided), {}, vocab, ans)
    assert '"galpi-library-v3.1"' in html
    script = re.search(r"<script>(.*)</script>", html, re.S).group(1)
    probe = """
const out={};const b1=BOOKS.find(b=>b.isbn==="1"), b2=BOOKS.find(b=>b.isbn==="2");
const q=ask(b1,cur(b1),"slot"); out.choice=q.includes("다른 갈래로 (🎯 배우기 / 🍃 이야기)");
put(b1,{status:"requeue",to_entry:"target",to_slot:""},"slot");
const q2=ask(b1,cur(b1),"slot"); out.mention=q2.includes("AI-2")&&/마음 돌보기[^<]*AI-2/.test(q2); out.left_open=left(b1,cur(b1)).length;
put(b1,{to_slot:"마음 돌보기"},"slot"); out.answer=answerOf(b1,cur(b1));
out.seeded=cur(b2).status==="requeue"&&cur(b2).to_slot==="에세이"&&cur(b2).ok;
put(b2,{to_slot:""},"slot"); out.left_genre=left(b2,cur(b2)).length;
out.fix=card(b2).includes('value="requeue"');
console.log(JSON.stringify(out));"""
    (tmp_path / "page.js").write_text(STUB + script + probe, encoding="utf-8")
    done = subprocess.run(["node", str(tmp_path / "page.js")], capture_output=True, text=True, encoding="utf-8")
    assert done.returncode == 0, done.stderr
    out = json.loads(done.stdout.strip().splitlines()[-1])
    assert out == {"choice": True, "mention": True, "left_open": 0,
                   "answer": {"entry": "leaf", "status": "requeue", "to_entry": "target", "to_slot": "마음 돌보기", "ok": True},
                   "seeded": True, "left_genre": 1, "fix": True}
