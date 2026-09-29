"""D1-2: collect 정보나루 keywords for the 🎯 books and count them per topic.

The counts are the raw material for the closed keyword vocabulary (docs/target-chips.md 2절):
a keyword is kept only if at least MIN_BOOKS books of one topic carry it.

Usage:  python src/collect_keywords.py
Input:  data/processed/d1_candidates.json (picked + reserve 🎯 books)
Output: data/raw/d4l_keywords/<isbn>.json            (raw responses, cached)
        data/processed/d1_keyword_counts.json          (topic -> keyword -> book count, top words)
The API key is read from .env and never printed.
"""
import json
import time
from collections import Counter, defaultdict
from pathlib import Path

from compare_apis import KEYWORD_STOPWORDS, d4l, load_env

ROOT = Path(__file__).resolve().parents[1]
CANDIDATES = ROOT / "data" / "processed" / "d1_candidates.json"
RAW = ROOT / "data" / "raw" / "d4l_keywords"
OUT = ROOT / "data" / "processed" / "d1_keyword_counts.json"
TOP_PER_BOOK = 15   # only the strongest keywords of each book
MIN_BOOKS = 3       # show candidates from 3 books up (vocabulary rule is 5, decided by a person)
GENERIC = KEYWORD_STOPWORDS | {"방법", "필요", "생각", "사용", "자신", "제시", "이해", "활용", "기본", "내용",
                               "시작", "경우", "정도", "문제", "소개", "설명", "과정", "책", "저자", "독자"}


def keywords(env: dict, isbn: str) -> list[tuple[str, int]]:
    cache = RAW / f"{isbn}.json"
    if cache.exists():
        resp = json.loads(cache.read_text(encoding="utf-8"))
    else:
        resp = d4l(env, "keywordList", isbn13=isbn, additionalYN="N")
        time.sleep(0.2)
        if "error" in resp:
            print(f"  {isbn}: {resp['error']}")
            return []
        RAW.mkdir(parents=True, exist_ok=True)
        cache.write_text(json.dumps(resp, ensure_ascii=False), encoding="utf-8")
    items = (resp.get("response") or {}).get("items") or []
    pairs = [(i["item"]["word"], int(i["item"]["weight"])) for i in items if i.get("item")]
    pairs = [(w, n) for w, n in pairs if w not in GENERIC and len(w) >= 2]
    return sorted(pairs, key=lambda p: -p[1])[:TOP_PER_BOOK]


def main() -> None:
    env = load_env()
    rows = json.loads(CANDIDATES.read_text(encoding="utf-8"))
    books = [r for r in rows if r["entry"] == "target" and r["status"] in ("picked", "reserve")]
    per_topic: dict[str, Counter] = defaultdict(Counter)
    per_book: dict[str, list[str]] = {}
    missing = []
    for b in books:
        kws = keywords(env, b["isbn"])
        if not kws:
            missing.append(b["title"])
        per_book[b["isbn"]] = [w for w, _ in kws]
        if b["status"] == "picked":
            per_topic[b["slot"]].update(set(per_book[b["isbn"]]))
    out = {"books": {b["isbn"]: {"title": b["title"], "slot": b["slot"], "status": b["status"],
                                 "keywords": per_book[b["isbn"]]} for b in books},
           "topics": {t: [[w, n] for w, n in c.most_common() if n >= MIN_BOOKS] for t, c in per_topic.items()},
           "missing": missing}
    OUT.write_text(json.dumps(out, ensure_ascii=False, indent=1), encoding="utf-8")
    for t, lst in out["topics"].items():
        print(f"{t:<8} " + ", ".join(f"{w}({n})" for w, n in lst[:25]))
    print(f"\n키워드 없음 {len(missing)}권 · saved: {OUT.relative_to(ROOT)}")


if __name__ == "__main__":
    main()
