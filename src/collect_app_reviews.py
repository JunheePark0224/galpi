"""Collect recent App Store (KR) reviews for YES24 apps and pull out ones about AI / recommendation.

Uses Apple's public customer-review RSS feed (up to 10 pages x 50 reviews per app).
Usage:  python src/collect_app_reviews.py
Output: data/raw/app_reviews/<app_id>.json + data/raw/app_reviews/ai_related.json
"""
import json
import re
import time
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
OUT_DIR = ROOT / "data" / "raw" / "app_reviews"

APPS = {
    "360051536": "예스24 도서 서점",
    "1009076561": "예스24 eBook & 크레마클럽",
}
KEYWORDS = re.compile(r"크레마\s*AI|크레마AI|AI|인공지능|챗봇|추천|RBTI|취향|큐레이션|검색", re.IGNORECASE)


def fetch_page(app_id: str, page: int) -> list[dict]:
    url = f"https://itunes.apple.com/kr/rss/customerreviews/page={page}/id={app_id}/sortby=mostrecent/json"
    try:
        with urllib.request.urlopen(url, timeout=20) as r:
            feed = json.loads(r.read().decode("utf-8")).get("feed", {})
    except Exception as e:
        print(f"  page {page}: {e}")
        return []
    entries = feed.get("entry", [])
    if isinstance(entries, dict):
        entries = [entries]
    reviews = []
    for e in entries:
        if "im:rating" not in e:  # first entry can be app metadata
            continue
        reviews.append({
            "date": e.get("updated", {}).get("label", "")[:10],
            "rating": int(e["im:rating"]["label"]),
            "version": e.get("im:version", {}).get("label"),
            "title": e.get("title", {}).get("label", ""),
            "content": e.get("content", {}).get("label", ""),
        })
    return reviews


def main() -> None:
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    related = []
    for app_id, name in APPS.items():
        all_reviews = []
        for page in range(1, 11):
            batch = fetch_page(app_id, page)
            if not batch:
                break
            all_reviews.extend(batch)
            time.sleep(0.5)
        (OUT_DIR / f"{app_id}.json").write_text(json.dumps(all_reviews, ensure_ascii=False, indent=1), encoding="utf-8")
        dates = sorted(r["date"] for r in all_reviews)
        hits = [r | {"app": name} for r in all_reviews if KEYWORDS.search(r["title"] + " " + r["content"])]
        related.extend(hits)
        span = f"{dates[0]} ~ {dates[-1]}" if dates else "-"
        print(f"{name}: 리뷰 {len(all_reviews)}건 ({span}), 키워드 포함 {len(hits)}건")
    (OUT_DIR / "ai_related.json").write_text(json.dumps(related, ensure_ascii=False, indent=1), encoding="utf-8")
    print(f"saved: {(OUT_DIR / 'ai_related.json').relative_to(ROOT)}")


if __name__ == "__main__":
    main()
