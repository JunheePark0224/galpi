"""Query YES24 item detail for the same books used in compare_apis.py and summarize field coverage.

Usage:  python src/compare_yes24.py
Input:  data/raw/api_compare/compare_20260928.json (ISBN list + 정보나루 description)
Output: data/raw/api_compare/yes24_<date>.json + summary printed to stdout.
The API key is read from .env and never printed.
"""
import json
import time
import urllib.parse
import urllib.request
from datetime import date
from pathlib import Path

from compare_apis import get_json, load_env

ROOT = Path(__file__).resolve().parents[1]
COMPARE_DIR = ROOT / "data" / "raw" / "api_compare"
BASELINE = COMPARE_DIR / "compare_20260928.json"


def yes24_detail(env: dict, isbn: str) -> dict:
    key = env["YES24_API_KEY"]
    params = urllib.parse.urlencode({"searchType": "ISBN13", "query": isbn, "detail": "Y"})
    url = f"https://apis.yes24.com/v1/goods/itemDetail?{params}"
    return get_json(url, headers={"X-Api-Key": key, "Accept": "application/json"}, secret=key)


def summarize(resp: dict) -> dict:
    if "error" in resp:
        return {"found": False, "error": resp["error"]}
    if not resp.get("success"):
        return {"found": False, "error": f"{resp.get('errorCode')} {resp.get('message')}"}
    items = (resp.get("data") or {}).get("items") or []
    if not items:
        return {"found": False, "error": "no items"}
    b = items[0]
    content = b.get("contentDetail") or {}
    intro = content.get("bookIntroduction") or ""
    summary = content.get("bookSummary") or ""
    toc = content.get("tableOfContents") or ""
    return {
        "found": True,
        "title": b.get("title"),
        "sale_price": b.get("salePrice"),
        "shop_price": b.get("shopPrice"),
        "pages": b.get("pages"),
        "star_score": b.get("starScore"),
        "sale_point": b.get("salePoint"),
        "has_cover": bool(b.get("cover")),
        "cover": b.get("cover"),
        "link": b.get("link"),
        "intro_len": len(intro),
        "summary_len": len(summary),
        "toc_len": len(toc),
        "toc_lines": len([line for line in toc.splitlines() if line.strip()]),
        "intro": intro,
        "summary": summary,
        "toc": toc,
    }


def main() -> None:
    env = load_env()
    baseline = json.loads(BASELINE.read_text(encoding="utf-8"))
    rows = []
    for row in baseline:
        rows.append({"isbn": row["isbn"], "label": row["label"],
                     "d4l_desc_len": row["d4l"].get("description_len"),
                     "yes24": summarize(yes24_detail(env, row["isbn"]))})
        time.sleep(0.3)

    out = COMPARE_DIR / f"yes24_{date.today():%Y%m%d}.json"
    out.write_text(json.dumps(rows, ensure_ascii=False, indent=1), encoding="utf-8")

    print(f"{'책':<20} | 책소개 | 줄거리 | 목차(줄) | 쪽수 | 평점 | 판매가 | 정보나루 소개")
    for r in rows:
        y = r["yes24"]
        if not y.get("found"):
            print(f"{r['label'][:20]:<20} | 조회 실패: {y.get('error')}")
            continue
        print(f"{r['label'][:20]:<20} | {y['intro_len']:>5}자 | {y['summary_len']:>5}자 | "
              f"{y['toc_len']:>5}자({y['toc_lines']}) | {y['pages']!s:>4} | {y['star_score']!s:>4} | "
              f"{y['sale_price']!s:>6} | {r['d4l_desc_len']}자")
    found = [r["yes24"] for r in rows if r["yes24"].get("found")]
    n = len(found)
    if n:
        print(f"\n조회 성공 {n}/{len(rows)} · 책소개 있음 {sum(1 for y in found if y['intro_len'])}/{n} · "
              f"목차 있음 {sum(1 for y in found if y['toc_len'])}/{n} · 줄거리 있음 {sum(1 for y in found if y['summary_len'])}/{n} · "
              f"쪽수 있음 {sum(1 for y in found if y['pages'])}/{n} · 평점 있음 {sum(1 for y in found if y['star_score'])}/{n}")
    print(f"saved: {out.relative_to(ROOT)}")


if __name__ == "__main__":
    main()
