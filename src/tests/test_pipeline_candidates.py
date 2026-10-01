"""Pipeline: candidates from a fake YES24 cache (src/pipeline/candidates.py) — no key, no network."""
import sys
from pathlib import Path

import pytest

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

import collect_candidates  # noqa: E402
from pipeline.candidates import Known, author_key, find, known_from  # noqa: E402
from pipeline.gaps import Want  # noqa: E402
from pipeline.slots import keyword_rule  # noqa: E402
from pipeline_fakes import write_cache, yes24_item  # noqa: E402

ITEMS = [yes24_item("9790000000011", "처음 주식 공부", "김하나 저", 1),
         yes24_item("9790000000012", "주식 배당 입문", "이둘 저", 2),
         yes24_item("9790000000013", "주식 투자 수업", "박셋 저", 3),
         yes24_item("9790000000014", "또 주식 이야기", "박셋 저", 4),
         yes24_item("9790000000015", "주식 마음 공부", "최넷 저", 5)]


@pytest.fixture
def cache(tmp_path, monkeypatch):
    monkeypatch.setattr(collect_candidates, "RAW", tmp_path)
    monkeypatch.setattr(collect_candidates, "get_json", lambda *a, **k: {"error": "offline in tests"})
    monkeypatch.setattr(collect_candidates, "time", type("T", (), {"sleep": staticmethod(lambda s: None)}))
    details = [i for i in ITEMS if i["isbn13"] != "9790000000015"]  # no detail → not usable
    write_cache(tmp_path, {"주식": ITEMS}, details)
    return tmp_path


RULE = keyword_rule("돈 관리·투자", "주식", "주식|배당")
WANT = Want("target", "돈 관리·투자", 5, "주식")
ENV = {"YES24_API_KEY": "not-real"}  # get_json is offline in these tests: a cache miss is a recorded failure


def test_find_keeps_rank_order_and_reads_detail_text_into_memory(cache):
    out = find(ENV, WANT, RULE, Known(frozenset(), frozenset(), {}))
    assert [c.isbn for c in out] == ["9790000000011", "9790000000012", "9790000000013", "9790000000014"]
    first = out[0]
    assert first.pages == 280 and first.intro.startswith("주식 투자를") and "2장 계좌와 주문" in first.toc
    assert "intro" not in repr(first)  # YES24 text never shows up in a log line


def test_find_skips_what_we_have_other_editions_and_a_third_book_by_one_author(cache):
    books = [{"isbn": "9790000000011", "title": "x", "author": "a"},
             {"isbn": "9799999999999", "title": "주식 배당 입문 (개정판)", "author": "b"},
             {"isbn": "9798888888888", "title": "y", "author": "박셋, 다른 사람"}]
    out = find(ENV, WANT, RULE, known_from(books, [{"books": [{"isbn": "9790000000015"}]}]))
    assert [c.isbn for c in out] == ["9790000000013"]  # 박셋 had 1 → one more allowed (max 2)


def test_known_grows_without_changing_the_old_value(cache):
    k = Known(frozenset(), frozenset(), {})
    out = find(ENV, WANT, RULE, k)
    k2 = k.plus(out)
    assert k.isbns == frozenset() and len(k2.isbns) == 4 and k2.authors["박셋"] == 2


def test_author_key_reads_both_spellings():
    assert author_key("김승호 저") == author_key("김승호") == "김승호"
    assert author_key("천선란, 임솔아") == "천선란" and author_key("피터 브루스 외") == "피터 브루스"


def test_a_failed_list_is_recorded_not_raised(tmp_path, monkeypatch):
    monkeypatch.setattr(collect_candidates, "RAW", tmp_path)
    monkeypatch.setattr(collect_candidates, "get_json", lambda *a, **k: {"error": "HTTP 500"})
    monkeypatch.setattr(collect_candidates, "time", type("T", (), {"sleep": staticmethod(lambda s: None)}))
    before = len(collect_candidates.FAILURES)
    assert find(ENV, WANT, RULE, Known(frozenset(), frozenset(), {})) == []
    assert len(collect_candidates.FAILURES) == before + 1


def test_books_with_no_author_on_our_side_do_not_share_one_counter():
    assert author_key("") == ""
    known = known_from([{"isbn": f"x{i}", "title": f"t{i}", "author": ""} for i in range(3)], [])
    assert known.authors == {}                                   # nothing counted for "no author"


def test_a_candidate_without_author_or_pages_is_never_offered(cache):
    items = [yes24_item("9790000000021", "주식 기초 다지기", "", 1), yes24_item("9790000000022", "배당주 이야기", "   ", 2),
             yes24_item("9790000000023", "주식 투자 수업 노트", "가 저", 3, pages="쪽수 미상"),
             yes24_item("9790000000024", "주식 차트 읽기", "나 저", 4)]
    write_cache(cache, {"주식": items}, items)
    details = [{**i, "pages": "쪽수 미상" if i["isbn13"].endswith("23") else 200} for i in items]
    write_cache(cache, {"주식": items}, details)
    assert [c.isbn for c in find(ENV, WANT, RULE, Known(frozenset(), frozenset(), {}))] == ["9790000000024"]
