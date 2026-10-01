"""Pilot (10-01): candidate list for the six new 🎯 topics, so a person can pick 15 + 3 reserves each.

Reuses the D1 / expansion-research filters (general books, intro >= 100 chars, no study guides / sets,
title rule per topic) and the cached YES24 lists, then drops books already in books.json, other
editions of their titles, and authors who already have 2 books. Rank order alternates steady / best /
search sources (book-pool.md: not only bestsellers). Detail (rating, pages, TOC) is fetched — cached —
for the first DETAIL_PER_TOPIC per topic.

Usage:  PYTHONIOENCODING=utf-8 python src/pick_pilot.py
        PYTHONIOENCODING=utf-8 python src/pick_pilot.py --add "<topic>" <isbn> ...   (detail for more rows)
Output: data/processed/check/pilot/candidates.json   (git-ignored: holds YES24 intro / TOC excerpts)
The API key is read from .env by collect_candidates and never printed.
"""
import csv
import json
import re
import sys
import urllib.parse
from pathlib import Path

from collect_candidates import (MAX_PER_AUTHOR, detail, first_author, interleave, intro_of, is_book,
                                norm_title, usable)
from compare_apis import load_env
from research_expansion import EXAM, TOPICS, yes24

ROOT = Path(__file__).resolve().parents[1]
BOOKS = ROOT / "web" / "src" / "data" / "books.json"
SELECTED = ROOT / "data" / "processed" / "d1_selected.csv"
OUT = ROOT / "data" / "processed" / "check" / "pilot" / "candidates.json"
PILOT_TOPICS = ("돈 관리·투자", "경제 상식", "마음 돌보기", "대화·관계", "취업·커리어", "글쓰기")
DETAIL_PER_TOPIC = 32
TAG = re.compile(r"<[^>]+>")


def clean(text: str, n: int) -> str:
    return re.sub(r"\s+", " ", TAG.sub(" ", text or "")).strip()[:n]


def source_rows(env: dict, t: dict) -> list[tuple[dict, str, int]]:
    rows = []
    for cat in t["cats"]:
        for ep, src in (("bestsellerSteady", "steady"), ("bestseller", "best")):
            for page in (1, 2):
                resp = yes24(env, f"/category/{ep}?categoryId={cat}&page={page}&pageSize=100", f"{cat}_{ep}_{page}")
                for it in (resp.get("data") or {}).get("items") or []:
                    rows.append((it, src, (page - 1) * 100 + int(it.get("sortOrder") or 999)))
    for q in t["q"]:
        slug = re.sub(r"[^0-9A-Za-z가-힣]+", "_", q).strip("_")
        resp = yes24(env, "/goods/itemList?" + urllib.parse.urlencode({"query": q, "page": 1, "pageSize": 100}),
                     f"search_{slug}")
        for it in (resp.get("data") or {}).get("items") or []:
            rows.append((it, "search", int(it.get("sortOrder") or 999)))
    return rows


def existing() -> tuple[set[str], set[str], dict[str, int]]:
    isbns = {b["isbn"] for b in json.loads(BOOKS.read_text(encoding="utf-8"))}
    with SELECTED.open(encoding="utf-8-sig") as f:
        rows = list(csv.DictReader(f))
    titles = {norm_title(r["title"]) for r in rows}
    authors: dict[str, int] = {}
    for r in rows:
        a = first_author(r["author"])
        authors[a] = authors.get(a, 0) + 1
    return isbns, titles, authors


def topic_candidates(env: dict, t: dict, isbns: set[str], titles: set[str]) -> list[dict]:
    best: dict[str, dict] = {}
    for it, src, rank in source_rows(env, t):
        isbn, title = it.get("isbn13"), it.get("title") or ""
        if not isbn or isbn in isbns or not is_book(it) or len(intro_of(it)) < 100:
            continue
        if not re.search(t["title"], title) or re.search(t["exc"], title) or EXAM.search(title):
            continue
        if norm_title(title) in titles:
            continue
        prev = best.get(isbn)
        if prev is None or rank < prev["rank"]:
            best[isbn] = {"isbn": isbn, "title": title, "author": it.get("author") or "",
                          "first_author": first_author(it.get("author") or ""), "publisher": it.get("publisher"),
                          "year": (it.get("publishDate") or "")[:4], "category": it.get("goodsSortNm"),
                          "source": src, "rank": rank, "link": it.get("link"),
                          "intro": clean(intro_of(it), 420),
                          "toc": clean((it.get("contentDetail") or {}).get("tableOfContents") or "", 260)}
    seen, out = set(), []
    for c in sorted(best.values(), key=lambda c: c["rank"]):
        t_norm = norm_title(c["title"])
        keys = {t_norm, (c["first_author"], re.sub(r"\d+일?", "", t_norm)[:6])}
        if keys & seen:
            continue
        seen |= keys
        out.append(c)
    return interleave(out)


def add(topic: str, wanted: list[str]) -> None:
    """Fetch detail for candidates further down a topic's list and append them to the saved file."""
    env = load_env()
    isbns, titles, _ = existing()
    result = json.loads(OUT.read_text(encoding="utf-8"))
    have = {c["isbn"] for c in result[topic]}
    for c in topic_candidates(env, TOPICS[topic], isbns, titles):
        if c["isbn"] in wanted and c["isbn"] not in have:
            d = detail(env, c["isbn"])
            c.update({"star": d.get("starScore"), "pages": d.get("pages"), "usable": usable(d)})
            print(f"{c['title'][:30]:<30} usable={c['usable']}")
            if c["usable"]:
                result[topic].append(c)
    OUT.write_text(json.dumps(result, ensure_ascii=False, indent=1), encoding="utf-8")


def main() -> None:
    if len(sys.argv) > 2 and sys.argv[1] == "--add":
        add(sys.argv[2], sys.argv[3:])
        return
    env = load_env()
    isbns, titles, authors = existing()
    result = {}
    for name in PILOT_TOPICS:
        rows, fetched = [], 0
        for c in topic_candidates(env, TOPICS[name], isbns, titles):
            if fetched >= DETAIL_PER_TOPIC:
                break
            if authors.get(c["first_author"], 0) >= MAX_PER_AUTHOR:
                continue
            d = detail(env, c["isbn"])
            fetched += 1
            c.update({"star": d.get("starScore"), "pages": d.get("pages"), "usable": usable(d)})
            if c["usable"]:
                rows.append(c)
        result[name] = rows
        print(f"{name:<8} usable {len(rows)}/{fetched}")
    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_text(json.dumps(result, ensure_ascii=False, indent=1), encoding="utf-8")
    print(f"saved: {OUT.relative_to(ROOT)}")


if __name__ == "__main__":
    main()
