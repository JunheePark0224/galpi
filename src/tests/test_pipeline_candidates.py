"""Pipeline: candidates from a fake YES24 cache (src/pipeline/candidates.py) — no key, no network."""
import sys
import urllib.parse
from pathlib import Path

import pytest

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

import collect_candidates  # noqa: E402
from pipeline.candidates import Known, author_key, find, known_from  # noqa: E402
from pipeline.gaps import Want  # noqa: E402
from pipeline.slots import keyword_rule, slot_rule  # noqa: E402
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


RULE = {**keyword_rule("돈 관리·투자", "주식", "주식|배당"), "cats": [], "q": ["주식"]}  # the keyword search alone
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


def test_a_keyword_reads_its_name_search_then_the_topic_lists():
    rule = keyword_rule("돈 관리·투자", "주식", "주식|배당")
    topic = slot_rule("돈 관리·투자")
    assert rule["q"][0] == "주식" and rule["q"][1:] == [q for q in topic["q"] if q != "주식"] and rule["cats"] == topic["cats"]
    assert rule["inc"] == "(?i)주식|배당" and rule["exc"] == topic["exc"]


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


def paging_yes24(tmp_path, monkeypatch, search_pages: int, cat_pages: int = 0):
    """A fake YES24: search "주식" has `search_pages` full pages of 100, category "C1" lists have `cat_pages`; every
    item is a usable 주식 book. Returns the list of (kind, page) requested."""
    asked = []

    def items(prefix: str, page: int, n: int) -> list[dict]:
        return [yes24_item(f"979{prefix}{page:02d}{i:04d}", f"주식 책 {prefix}{page}번 {i}호", f"저자{prefix}{page}_{i} 저", i + 1)
                for i in range(n)]

    def get_json(url, headers=None, secret=""):
        q = dict(urllib.parse.parse_qsl(urllib.parse.urlsplit(url).query))
        if "itemDetail" in url:
            return {"data": {"items": [{**yes24_item(q["query"], "x"), "starScore": 9, "pages": 200}]}}
        page = int(q["page"])
        if "itemList" in url:
            asked.append(("search", page))
            return {"data": {"items": items("11", page, 100) if page <= search_pages else [], "totalCount": 100 * search_pages}}
        asked.append((url.split("/category/")[1].split("?")[0], page))
        return {"data": {"items": items("2" + str(len(url) % 10), page, 100) if page <= cat_pages else [],
                         "totalCount": 100 * cat_pages}}

    monkeypatch.setattr(collect_candidates, "RAW", tmp_path)
    monkeypatch.setattr(collect_candidates, "get_json", get_json)
    monkeypatch.setattr(collect_candidates, "time", type("T", (), {"sleep": staticmethod(lambda s: None)}))
    return asked


def test_list_items_reads_category_pages_1_to_5_and_search_pages_1_to_3_at_most(tmp_path, monkeypatch):
    asked = paging_yes24(tmp_path, monkeypatch, search_pages=9, cat_pages=9)
    rule = {**RULE, "cats": ["C1"]}
    collect_candidates.list_items(ENV, rule, 1)
    assert sorted(asked) == [("bestseller", 1), ("bestseller", 2), ("bestsellerSteady", 1), ("bestsellerSteady", 2),
                             ("search", 1)]
    asked.clear()
    rows = collect_candidates.list_items(ENV, rule, collect_candidates.MAX_DEPTH)
    assert sorted(set(asked)) == sorted({("bestseller", p) for p in range(3, 6)} | {("bestsellerSteady", p) for p in range(3, 6)}
                                        | {("search", 2), ("search", 3)})  # pages 1-2 / 1 came from the cache
    assert max(r["rank"] for r in rows if r["source"] == "search") <= 300
    with pytest.raises(ValueError):
        collect_candidates.list_items(ENV, rule, collect_candidates.MAX_DEPTH + 1)


def test_find_goes_deeper_only_when_the_first_pages_are_not_enough(tmp_path, monkeypatch):
    asked = paging_yes24(tmp_path, monkeypatch, search_pages=3)
    find(ENV, Want("target", "돈 관리·투자", 5, "주식"), RULE, Known(frozenset(), frozenset(), {}))
    assert asked == [("search", 1)]                                      # page 1 had enough: page 2 never asked
    known = known_from([{"isbn": f"97911{1:02d}{i:04d}", "title": f"주식 책 111번 {i}호", "author": "a"} for i in range(100)], [])
    out = find(ENV, Want("target", "돈 관리·투자", 3, "주식"), RULE, known)
    assert len(out) == 3 and asked == [("search", 1), ("search", 2)]     # page 1 all ours → page 2, not page 3


def test_find_stops_at_the_end_of_every_list(tmp_path, monkeypatch):
    asked = paging_yes24(tmp_path, monkeypatch, search_pages=1)
    known = known_from([{"isbn": f"97911{1:02d}{i:04d}", "title": f"주식 책 111번 {i}호", "author": "a"} for i in range(100)], [])
    assert find(ENV, Want("target", "돈 관리·투자", 3, "주식"), RULE, known) == []
    assert asked == [("search", 1)]                                      # totalCount 100: no page 2, no deeper depth
    assert not collect_candidates.has_more(RULE, 1)


def test_find_keeps_detail_calls_bounded_over_all_depths(tmp_path, monkeypatch):
    paging_yes24(tmp_path, monkeypatch, search_pages=3)
    calls = []
    monkeypatch.setattr("pipeline.candidates.detail", lambda env, isbn: calls.append(isbn) or {})  # never usable
    assert find(ENV, Want("target", "돈 관리·투자", 4, "주식"), RULE, Known(frozenset(), frozenset(), {})) == []
    assert len(calls) == 3 * 4                                           # DETAIL_TRIES × wanted
