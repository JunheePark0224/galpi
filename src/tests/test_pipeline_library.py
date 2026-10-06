"""Pipeline: the library as the import reads it, and the resumable v3 re-tag of all of it
(src/pipeline/library.py · retag_library.py) — fake client, no keys."""
import json
import sys
from pathlib import Path

import pytest

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from pipeline import library, retag_library  # noqa: E402
from pipeline.config import parse_config  # noqa: E402
from pipeline_fakes import INTRO, TOC, FakeClient  # noqa: E402

CFG = parse_config({"daily_count": 4, "auto_merge": False, "sample_rate": 0.1, "model": "claude-haiku-4-5",
                    "second_model": "claude-haiku-4-5", "target_phase": "launch"})
VOCAB = {"돈 관리·투자": {"kept": {"주식": {"pattern": "주식|배당"}}}}
AX = {"temp": 1, "pull": -1, "gain": 0, "world": 1}
CSV = ("﻿entry,slot,title,author,publisher,year,pages,star,source,rank,isbn,link\n"
       "leaf,에세이,첫 책,가 저,p,2020,200,9,best,1,9780000000001,https://y/1\n"
       "target,돈 관리·투자,둘째 책,나 저,p,2020,200,9,best,1,9780000000002,https://y/2\n")


def v1_rows():
    return [{"isbn": "9780000000001", "entry": "leaf", "slot": "에세이", "field": None, "topic": None, "genre": "에세이",
             "pages": 200, "way": None, "axes": dict(AX), "keywords": [], "one_liner": "잃어버린 하루는 어디로 갈까요?",
             "one_liner_style": "question"},
            {"isbn": "9780000000002", "entry": "target", "slot": "돈 관리·투자", "field": "돈·경제", "topic": "돈 관리·투자",
             "genre": "돈 관리·투자", "pages": 200, "way": "개념", "axes": None, "keywords": ["주식"],
             "one_liner": "배당과 분산으로 주식의 기본을 알려줘요", "one_liner_style": "summary"}]


def add(isbn, entry, status, **over):
    side = ({"topic": "돈 관리·투자", "keywords": ["주식"], "way": "실습"} if entry == "target"
            else {"genre": "에세이", "axes": dict(AX)})
    return {"isbn": isbn, "title": f"책{isbn}", "author": "다 저", "pages": 250, "entry": entry, "link": f"https://y/{isbn}",
            "status": status, "one_liner": "한 줄이에요 한 줄이에요", **side, **over}


def docs():
    return [("2026-10-01.json", {"books": [add("9780000000003", "target", "picked"),
                                            add("9780000000004", "target", "reserve")]}),
            ("2026-10-05-2.json", {"books": [add("9780000000005", "leaf", "review"),
                                              add("9780000000006", "leaf", "dropped"),
                                              add("9780000000007", "target", "picked")]})]


def test_library_is_v1_then_picked_additions_and_every_live_book_of_the_whole_batch():
    items = library.library_books(v1_rows(), library.bib_of(CSV), docs())
    assert [i["isbn"][-1] for i in items] == ["1", "2", "3", "5", "7"]
    first, fifth = items[0], items[3]
    assert first["source"] == "books_v1.json" and first["title"] == "첫 책" and first["link"] == "https://y/1"
    assert first["current"] == {"genre": "에세이", "axes": AX, "one_liner": "잃어버린 하루는 어디로 갈까요?"}
    assert items[1]["current"] == {"topic": "돈 관리·투자", "keywords": ["주식"], "way": "개념",
                                   "one_liner": "배당과 분산으로 주식의 기본을 알려줘요"}
    assert fifth["source"] == "2026-10-05-2.json" and fifth["status"] == "review" and fifth["slot"] == "에세이"


def test_library_files_skip_the_ai2_pass_and_experiment_copies(tmp_path):
    for name in ("2026-10-01-pilot.json", "2026-10-01-pilot-ai2.json", "2026-10-05-2.json", "2026-10-05-2.v2.json",
                 "2026-10-03.json"):
        (tmp_path / name).write_text("{}", encoding="utf-8")
    assert [p.name for p in library.library_files(tmp_path)] == ["2026-10-01-pilot.json", "2026-10-03.json",
                                                                  "2026-10-05-2.json"]


def test_a_book_twice_in_the_library_is_an_error():
    with pytest.raises(ValueError, match="twice"):
        library.library_books(v1_rows(), library.bib_of(CSV), [("x.json", {"books": [add("9780000000001", "leaf", "picked")]})])


def items():
    return library.library_books(v1_rows(), library.bib_of(CSV), docs())


def texts(isbn):
    return ("", "") if isbn.endswith("7") else (INTRO, TOC)


def test_every_book_is_tagged_once_with_its_current_values_and_a_run_resumes_where_it_stopped():
    saved = []
    doc, summary = retag_library.run(items(), retag_library.empty_doc(CFG, "v3"), CFG, FakeClient(), VOCAB, texts,
                                     max_cost=15, save=saved.append, rules="v3")
    assert [b["isbn"][-1] for b in doc["books"]] == ["1", "2", "3", "5"]
    assert doc["skipped_no_text"] == ["9780000000007"] and summary["tagged"] == 4 and summary["stopped"] is None
    b = doc["books"][0]
    assert b["source"] == "books_v1.json" and b["current"]["axes"] == AX and b["record"]["rules_version"] == "v3"
    assert "second" in b["record"] and saved and saved[-1] == doc
    assert INTRO[:20] not in json.dumps(doc, ensure_ascii=False) and TOC[:6] not in json.dumps(doc, ensure_ascii=False)
    client = FakeClient()
    again, summary2 = retag_library.run(items(), doc, CFG, client, VOCAB, texts, max_cost=15, save=saved.append, rules="v3")
    assert client.messages.calls == [] and summary2["tagged"] == 0 and len(again["books"]) == 4
    assert len(again["runs"]) == 2 and again["cost_usd"] == doc["cost_usd"]


def test_the_cost_cap_counts_earlier_runs_and_keeps_what_was_done():
    doc, summary = retag_library.run(items(), retag_library.empty_doc(CFG, "v3") | {"cost_usd": 20.0}, CFG, FakeClient(),
                                     VOCAB, texts, max_cost=15, save=lambda d: None, rules="v3")
    assert "cost cap" in summary["stopped"] and doc["books"] == [] and summary["cost_usd"] == 0


def test_the_estimate_counts_only_books_not_done():
    doc = retag_library.empty_doc(CFG, "v3") | {"books": [{"isbn": "9780000000001"}]}
    assert retag_library.remaining(items(), doc) == 4
    assert retag_library.estimate(4) == pytest.approx(4 * retag_library.EST_PER_BOOK, abs=0.005)
