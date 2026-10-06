"""Pipeline: picking the 40-book gold set (src/pipeline/gold.py pick, plans/2026-10-06-calibration.md 2)."""
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from pipeline import gold  # noqa: E402
from pipeline.gaps import GENRES  # noqa: E402


def lib_book(isbn, entry, slot):
    side = {"genre": slot, "topic": None} if entry == "leaf" else {"genre": None, "topic": slot}
    return {"isbn": isbn, "title": f"책{isbn}", "author": "가 저", "pages": 200, "entry": entry, **side}


def add_book(isbn, entry, slot, status="picked"):
    return {**lib_book(isbn, entry, slot), "status": status, "link": f"https://y/{isbn}"}


TOPICS = [f"주제{i}" for i in range(16)]


def library():
    books = []
    for gi, g in enumerate(GENRES):  # genre gi has gi+1 books, so sizes differ
        books += [lib_book(f"L{gi:02d}{n:02d}", "leaf", g) for n in range(gi + 1)]
    for ti, t in enumerate(TOPICS):
        books += [lib_book(f"T{ti:02d}{n:02d}", "target", t) for n in range(3 + ti % 4)]
    adds = [add_book("A0001", "leaf", GENRES[0]), add_book("A0002", "leaf", GENRES[0], "dropped"),
            add_book("A0003", "target", TOPICS[0], "dropped")]
    return books, adds


def test_pool_merges_the_library_and_the_batch_with_one_row_per_isbn():
    books, adds = library()
    p = gold.pool(books, adds + [add_book(books[0]["isbn"], "leaf", GENRES[5])])
    assert p[books[0]["isbn"]]["slot"] == GENRES[0]                # the library row wins
    assert p["A0001"]["link"] == "https://y/A0001" and p["A0002"]["dropped"] and not p["A0001"]["dropped"]
    assert set(p["A0001"]) >= {"isbn", "title", "author", "pages", "entry", "slot", "link"}


def test_quotas_cover_every_slot_with_books_then_favour_big_ones_and_keep_forced_counts():
    sizes = {"a": 10, "b": 1, "c": 0, "d": 4}
    q = gold.quotas(sizes, {"b": 2}, 6, ["a", "b", "c", "d"])
    assert q == {"a": 3, "b": 2, "c": 0, "d": 1} and sum(q.values()) == 6
    assert gold.quotas({"a": 5, "b": 5, "c": 5}, {}, 2, ["a", "b", "c"]) == {"a": 1, "b": 1, "c": 0}


def test_pick_gives_28_leaf_over_all_13_genres_and_12_target_over_12_topics():
    books, adds = library()
    rows = gold.pick(gold.pool(books, adds), keep=[], cached=set(), seed=1)
    leaf = [r for r in rows if r["entry"] == "leaf"]
    target = [r for r in rows if r["entry"] == "target"]
    assert len(leaf) == 28 and {r["slot"] for r in leaf} == set(GENRES)
    assert len(target) == 12 and len({r["slot"] for r in target}) == 12
    assert all(set(r) == {"isbn", "title", "entry", "slot"} for r in rows)
    assert len({r["isbn"] for r in rows}) == 40 and not {"A0002", "A0003"} & {r["isbn"] for r in rows}


def test_pick_keeps_the_reviewed_books_even_dropped_ones_and_counts_them_in_their_slot():
    books, adds = library()
    keep = ["A0002", "A0003", "L0000"]
    rows = gold.pick(gold.pool(books, adds), keep=keep, cached=set(), seed=1)
    assert set(keep) <= {r["isbn"] for r in rows} and len(rows) == 40
    assert sum(r["slot"] == GENRES[0] for r in rows) >= 2


def test_pick_is_reproducible_and_prefers_books_with_cached_text():
    books, adds = library()
    p = gold.pool(books, adds)
    cached = {b["isbn"] for b in books if b["isbn"].endswith(("00", "01"))}
    one, two = gold.pick(p, [], cached, seed=7), gold.pick(p, [], cached, seed=7)
    assert one == two
    big = [r for r in one if r["slot"] == GENRES[-1]]           # 13 books, 2 cached
    assert len(big) >= 2 and {r["isbn"] for r in big[:2]} <= cached
    assert gold.pick(p, [], cached, seed=8) != one


def test_gold_doc_orders_leaf_by_genre_then_target_and_says_how_it_was_made():
    books, adds = library()
    doc = gold.gold_doc(gold.pick(gold.pool(books, adds), [], set(), seed=3), seed=3, kept=[])
    entries = [r["entry"] for r in doc["books"]]
    assert entries == sorted(entries) and doc["seed"] == 3 and doc["counts"] == {"leaf": 28, "target": 12}
    genres = [r["slot"] for r in doc["books"] if r["entry"] == "leaf"]
    assert genres == sorted(genres, key=list(GENRES).index)
