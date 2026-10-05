"""D1: collect book candidates for the first 200-book pool from YES24 lists and search.

For each slot (🍃 genre / 🎯 topic) in docs/book-pool.md:
  1. pull YES24 bestseller + steadyseller lists of mapped categories, and keyword searches
  2. drop items that are not general books (study guides, children, sets, adult, out of print ...)
  3. keep items whose title + introduction match the slot's keyword rule
  4. pick in rank order, alternating steady / bestseller sources, max 2 books per author overall
  5. fetch item detail for picked + reserve books and require rating, pages, TOC, introduction

Usage:  python src/collect_candidates.py
Output: data/raw/yes24/lists/*.json            (raw list responses, cached)
        data/raw/yes24/detail/<isbn>.json      (raw detail responses, cached)
        data/processed/d1_candidates.json      (every candidate with slot, rank, status)
        data/processed/d1_selected.csv         (the picked books, for a quick look)
The API key is read from .env and never printed.
"""
import csv
import json
import re
import time
import urllib.parse
from pathlib import Path

from compare_apis import get_json, load_env

ROOT = Path(__file__).resolve().parents[1]
RAW = ROOT / "data" / "raw" / "yes24"
OUT_JSON = ROOT / "data" / "processed" / "d1_candidates.json"
OUT_CSV = ROOT / "data" / "processed" / "d1_selected.csv"
API = "https://apis.yes24.com/v1"
RESERVE_RATIO = 0.5  # fetch detail for picks + 50% reserves per slot
MAX_PER_AUTHOR = 2

# slot: entry, target count, YES24 categories, search queries, include / exclude regex (title + intro)
NOVEL = r"소설"
FICTION_GUIDE = r"쓰기|작법|필독서|의 모든 것|가이드|입문|읽기"
SLOTS: dict[str, dict] = {
    # 🍃  inc/exc match the title + first 300 chars of the introduction; sort = required goodsSortNm pattern
    "한국 소설": {"entry": "leaf", "n": 12, "cats": ["001001046001"], "q": [], "sort": NOVEL,
               "inc": r".", "exc": r"추리|미스터리|스릴러|살인|탐정|SF|판타지|우주|외계", "exc_title": FICTION_GUIDE},
    "외국 소설": {"entry": "leaf", "n": 12,
               "cats": ["001001046002", "001001046003", "001001046005", "001001046006",
                        "001001046007", "001001046008", "001001046009", "001001046010"],
               "q": [], "sort": NOVEL,
               "inc": r".", "exc": r"추리|미스터리|스릴러|살인|탐정|SF|판타지|우주|외계", "exc_title": FICTION_GUIDE},
    "SF·판타지": {"entry": "leaf", "n": 14, "cats": ["001001046011", "001001046001", "001001046002"],
                "q": ["SF 소설", "판타지 소설", "SF 단편집"], "sort": NOVEL,
                "inc": r"SF|에스에프|과학소설|판타지|우주|행성|외계|로봇|안드로이드|마법|시간 ?여행|디스토피아|평행 ?세계",
                "exc": r"추리|미스터리|살인|탐정", "exc_title": FICTION_GUIDE},
    "추리·스릴러": {"entry": "leaf", "n": 14, "cats": ["001001046011", "001001046003", "001001046002"],
                "q": ["추리 소설", "스릴러 소설", "미스터리 소설"], "sort": NOVEL,
                "inc": r"추리|미스터리|스릴러|살인|탐정|형사|범인|사건", "exc": r"SF|판타지|마법",
                "exc_title": FICTION_GUIDE},
    "에세이": {"entry": "leaf", "n": 18, "cats": ["001001047"], "q": [], "sort": r"에세이",
            "inc": r".", "exc": r"여행|예술|그림 ?에세이"},
    "시": {"entry": "leaf", "n": 5, "cats": ["001001046014"], "q": ["시집"], "sort": r"소설/시/희곡",
          "inc": r"시집|시인", "exc": r"희곡|철학|차라투스트라"},
    "인문": {"entry": "leaf", "n": 10, "cats": ["001001019001", "001001019004", "001001019003"], "q": [],
           "sort": r"인문", "inc": r".", "exc": r"명리|주역|풍수|사주|다크"},
    "과학 교양": {"entry": "leaf", "n": 10,
               "cats": ["001001002014", "001001002006", "001001002011", "001001002018", "001001002016"],
               "q": [], "sort": r"자연과학", "inc": r".", "exc": r"수학\s?[12]|교과|문제집"},
    "예술·여행": {"entry": "leaf", "n": 5, "cats": ["001001007002", "001001007003", "001001047012", "001001009007"],
               "q": [], "sort": r"예술|여행|에세이", "inc": r".", "exc": r"화보|가이드북|지도"},
    # 🎯  inc and exc match the TITLE only (intro mentions are too loose for study books)
    "데이터 분석": {"entry": "target", "n": 17, "cats": [], "title_only": True, "sort": r"IT|경제|자연과학|인문|사회",
               "q": ["데이터 분석", "데이터 분석 입문", "SQL 입문", "파이썬 데이터 분석", "데이터 시각화",
                     "엑셀 데이터 분석", "데이터 리터러시", "데이터 분석가"],
               "inc": r"데이터|SQL|시각화|분석|대시보드",
               "exc": r"백엔드|네트워크|시스템 설계|튜닝|LLM|자동매매|MOS|자격|통계학|자동화|중심 애플리케이션"},
    "통계": {"entry": "target", "n": 17, "cats": [], "title_only": True, "sort": r"IT|경제|자연과학|인문|사회|자기계발",
           "q": ["통계", "통계학", "통계 입문", "통계학 입문", "확률", "베이즈", "통계 교양", "숫자 감각",
                 "데이터 과학 통계"],
           "inc": r"통계|확률|베이즈|숫자|수치", "exc": r"수능|EBS|기출|수학\s?[12]|고등|중학|개념원리|쎈|언어학자"},
    "AI 활용": {"entry": "target", "n": 17, "cats": [], "title_only": True, "sort": r"IT|경제|자기계발|인문",
              "q": ["챗GPT 활용", "생성형 AI 활용", "AI 활용법", "프롬프트 엔지니어링", "클로드", "제미나이",
                    "AI 입문", "바이브 코딩"],
              "inc": r"(?<![A-Za-z])AI(?![A-Za-z])|인공지능|챗GPT|GPT|프롬프트|생성형|제미나이|클로드|LLM|바이브 ?코딩",
              "exc": r"교사|선생님|학교|공무원|에듀테크|투자|유튜브|쇼츠|영상 편집|딥러닝|자동화|엑셀"},
    "업무 자동화": {"entry": "target", "n": 17, "cats": [], "title_only": True, "sort": r"IT|경제|자기계발",
               "q": ["업무 자동화", "엑셀 자동화", "파이썬 업무 자동화", "노션 업무", "구글 스프레드시트",
                     "AI 업무 자동화", "코파일럿", "실무 엑셀"],
               "inc": r"자동화|엑셀|노션|스프레드시트|코파일럿|RPA|업무",
               "exc": r"교사|선생님|학교|공무원|한글|MOS|자격|컴활|ITQ|파워포인트"},
    "습관·집중": {"entry": "target", "n": 16, "cats": ["001001026008", "001001026010"], "title_only": True,
               "sort": r"자기계발|인문|자연과학|건강", "q": ["습관", "집중력", "몰입", "도파민", "루틴"],
               "inc": r"습관|집중|몰입|루틴|도파민|뇌|의지|자제력|시스템", "exc": r"시간 ?관리|메모|부자|운명"},
    "시간·생산성": {"entry": "target", "n": 16, "cats": ["001001026003"], "title_only": True,
                "sort": r"자기계발|경제|인문",
                "q": ["시간 관리", "생산성", "메모 습관", "기록하는 습관", "일 잘하는 법", "세컨드 브레인"],
                "inc": r"시간|생산성|메모|기록|노트|일하는|일 ?잘|효율|계획|브레인",
                "exc": r"공문서|공부법|시험|후킹|콘텐츠|다이어리|플래너"},
}
CURATION = ROOT / "data" / "processed" / "d1_curation.json"
FAILURES: list[str] = []  # API calls that returned an error or no items (printed at the end)
LATER_VOLUME = re.compile(r"\s(?:[2-9]|1\d)$|\s(?:[2-9]|1\d)권")  # series volume 2+ (a first meeting needs vol. 1)
NOT_BOOK_SORT = re.compile(r"학습서|수험서|어린이|유아|청소년|만화|잡지|대학교재|외국도서|중고")
NOT_BOOK_TITLE = re.compile(r"세트|전집|(?<![가-힣])박스|합본|굿즈|다이어리|플래너|필사|컬러링|워크북|\(전\s?\d+권\)|기출|자격증|핸드북")


def slug(text: str) -> str:
    return re.sub(r"[^0-9A-Za-z가-힣]+", "_", text).strip("_")


def cached_get(env: dict, path: str, cache: Path) -> dict:
    if cache.exists():
        return json.loads(cache.read_text(encoding="utf-8"))
    key = env["YES24_API_KEY"]
    resp = get_json(API + path, headers={"X-Api-Key": key, "Accept": "application/json"}, secret=key)
    if "error" in resp or not (resp.get("data") or {}).get("items"):
        FAILURES.append(f"{path.split('?')[0]} -> {resp.get('error') or resp.get('message') or 'no items'}")
    else:
        cache.parent.mkdir(parents=True, exist_ok=True)
        tmp = cache.with_suffix(".tmp")
        tmp.write_text(json.dumps(resp, ensure_ascii=False), encoding="utf-8")
        tmp.replace(cache)
    time.sleep(0.15)
    return resp


PAGE_SIZE = 100
# depth 1 is D1's reach (category pages 1-2, search page 1); the daily pipeline goes one depth deeper only when a slot's
# earlier pages did not give enough usable candidates and a list still has pages left (pipeline/candidates.find, 10-05).
# Index = depth - 1. The deepest read is category pages 1-5 and search pages 1-3.
CAT_PAGES = (2, 3, 4, 5)
SEARCH_PAGES = (1, 2, 3, 3)
MAX_DEPTH = len(CAT_PAGES)
_MORE: dict[str, bool] = {}  # a list (its first page's cache file) → it may go on past the last page read


def paged(env: dict, path_of, cache_of, pages: int) -> list[tuple[int, dict]]:
    """(page, item) rows of pages 1..`pages` of one list; stops at the list's end (totalCount, a short page, or a page
    that failed or listed nothing), so a page past the end is never asked for. `path_of(page)` / `cache_of(page)`: the
    page's API path and cache file. Whether the list may go on is kept for has_more()."""
    rows, more = [], True
    for page in range(1, pages + 1):
        resp = cached_get(env, path_of(page), cache_of(page))
        data = resp.get("data") or {}
        items = data.get("items") or []
        rows += [(page, it) for it in items]
        total = data.get("totalCount")
        if len(items) < PAGE_SIZE or (isinstance(total, int) and page * PAGE_SIZE >= total):
            more = False
            break
    _MORE[str(cache_of(1))] = more
    return rows


def _cat_cache(cat: str, ep: str, page: int) -> Path:
    return RAW / "lists" / f"{cat}_{ep}_{page}.json"


def _search_cache(q: str, page: int) -> Path:
    s = slug(q)
    return RAW / "lists" / (f"search_{s}.json" if page == 1 else f"search_{s}_p{page}.json")


def has_more(slot: dict, depth: int) -> bool:
    """Would reading the slot `depth + 1` deep ask for any page not read at `depth`? Only a list that came back full at
    `depth` and gets more pages one depth deeper counts (read after list_items(env, slot, depth))."""
    if depth >= MAX_DEPTH:
        return False
    cats = CAT_PAGES[depth] > CAT_PAGES[depth - 1] and any(
        _MORE.get(str(_cat_cache(c, ep, 1))) for c in slot["cats"] for ep in ("bestsellerSteady", "bestseller"))
    search = SEARCH_PAGES[depth] > SEARCH_PAGES[depth - 1] and any(
        _MORE.get(str(_search_cache(q, 1))) for q in slot["q"])
    return cats or search


def list_items(env: dict, slot: dict, depth: int = 1) -> list[dict]:
    """(item, source, rank) rows from category lists and searches, read `depth` deep (CAT_PAGES / SEARCH_PAGES)."""
    if not 1 <= depth <= MAX_DEPTH:
        raise ValueError(f"depth must be 1..{MAX_DEPTH}")
    rows = []
    for cat in slot["cats"]:
        for ep, src in (("bestsellerSteady", "steady"), ("bestseller", "best")):
            path = lambda p, c=cat, e=ep: f"/category/{e}?categoryId={c}&page={p}&pageSize={PAGE_SIZE}"  # noqa: E731
            cache = lambda p, c=cat, e=ep: _cat_cache(c, e, p)  # noqa: E731
            for page, it in paged(env, path, cache, CAT_PAGES[depth - 1]):
                rows.append({"item": it, "source": src, "rank": (page - 1) * PAGE_SIZE + it.get("sortOrder", 999)})
    for q in slot["q"]:
        path = lambda p, q=q: "/goods/itemList?" + urllib.parse.urlencode(  # noqa: E731
            {"query": q, "page": p, "pageSize": PAGE_SIZE})
        cache = lambda p, q=q: _search_cache(q, p)  # noqa: E731
        for page, it in paged(env, path, cache, SEARCH_PAGES[depth - 1]):
            rows.append({"item": it, "source": "search", "rank": (page - 1) * PAGE_SIZE + it.get("sortOrder", 999)})
    return rows


def first_author(author: str) -> str:
    return re.split(r"\s*(?:저|글|지음|著)\b|[,/]", author or "")[0].strip()


def norm_title_spaced(title: str) -> str:
    """Title without bracketed editions / subtitles, spaces kept (for volume numbers)."""
    return re.sub(r"\s*[\(\[].*?[\)\]]|\s*:.*$", "", title).strip()


def norm_title(title: str) -> str:
    return re.sub(r"\s*[\(\[].*?[\)\]]|\s*:.*$|\s+", "", title or "")


def is_book(it: dict) -> bool:
    return (it.get("goodsType") == "도서" and it.get("adultYn") != "Y"
            and it.get("itemStatus") in (None, "판매중")
            and not NOT_BOOK_SORT.search(it.get("goodsSortNm") or "")
            and not NOT_BOOK_TITLE.search(it.get("title") or "")
            and not LATER_VOLUME.search(norm_title_spaced(it.get("title") or "")))


def intro_of(it: dict) -> str:
    return ((it.get("contentDetail") or {}).get("bookIntroduction") or "")


def matches(slot: dict, it: dict) -> bool:
    title = it.get("title") or ""
    if slot.get("sort") and not re.search(slot["sort"], it.get("goodsSortNm") or ""):
        return False
    text = title if slot.get("title_only") else f"{title} {intro_of(it)[:300]}"
    if slot.get("exc_title") and re.search(slot["exc_title"], title):
        return False
    if slot.get("exc_publisher") and re.search(slot["exc_publisher"], it.get("publisher") or ""):
        return False  # 10-05: 로맨스 leaves genre romance paperback lines out by publisher
    return bool(re.search(slot["inc"], text)) and not re.search(slot["exc"], text)


def candidates_for(env: dict, name: str, slot: dict, excluded: dict[str, str],
                   depth: int = 1) -> tuple[list[dict], list[dict]]:
    """(kept candidates in rank order, curation-excluded candidates), lists read `depth` deep."""
    best: dict[str, dict] = {}
    for row in list_items(env, slot, depth):
        it = row["item"]
        isbn = it.get("isbn13")
        if not isbn or not is_book(it) or len(intro_of(it)) < 100 or not matches(slot, it):
            continue
        prev = best.get(isbn)
        if prev is None or row["rank"] < prev["rank"]:
            best[isbn] = {"isbn": isbn, "title": it.get("title"), "author": it.get("author"),
                          "first_author": first_author(it.get("author") or ""), "publisher": it.get("publisher"),
                          "publish_date": it.get("publishDate"), "category": it.get("goodsSortNm"),
                          "slot": name, "entry": slot["entry"], "source": row["source"], "rank": row["rank"]}
    removed = [dict(c, status="excluded", excluded_reason=excluded[c["isbn"]])
               for c in best.values() if c["isbn"] in excluded]
    seen, out = set(), []
    for c in sorted(best.values(), key=lambda c: c["rank"]):
        if c["isbn"] in excluded:
            continue
        t = norm_title(c["title"])
        keys = {t, (c["first_author"], re.sub(r"\d+일?", "", t)[:6])} if t else set()
        if keys & seen:
            continue
        seen |= keys
        out.append(c)
    return out, removed


def interleave(cands: list[dict]) -> list[dict]:
    """Alternate steady / best / search sources so a slot is not only this month's bestsellers."""
    by_src = {s: [c for c in cands if c["source"] == s] for s in ("steady", "best", "search")}
    order, i = [], 0
    while any(by_src.values()):
        src = ("steady", "best", "search")[i % 3]
        if by_src[src]:
            order.append(by_src[src].pop(0))
        i += 1
    return order


def detail(env: dict, isbn: str) -> dict:
    path = "/goods/itemDetail?" + urllib.parse.urlencode({"searchType": "ISBN13", "query": isbn, "detail": "Y"})
    resp = cached_get(env, path, RAW / "detail" / f"{isbn}.json")
    items = (resp.get("data") or {}).get("items") or []
    return items[0] if items else {}


def usable(d: dict) -> bool:
    cd = d.get("contentDetail") or {}
    return bool(d.get("starScore")) and bool(d.get("pages")) and bool(cd.get("tableOfContents")) \
        and len(cd.get("bookIntroduction") or "") >= 100


def main() -> None:
    env = load_env()
    curation = json.loads(CURATION.read_text(encoding="utf-8")) if CURATION.exists() else {"exclude": {}}
    excluded = curation.get("exclude", {})
    author_count: dict[str, int] = {}
    taken: set[str] = set()      # picked anywhere
    reserved: set[str] = set()   # reserve anywhere, never reused by another slot
    all_rows = []
    for name, slot in SLOTS.items():
        kept, removed = candidates_for(env, name, slot, excluded)
        all_rows.extend(removed)
        pool = interleave(kept)
        want = slot["n"]
        picked = reserve = 0
        for c in pool:
            if c["isbn"] in taken or c["isbn"] in reserved:
                continue
            status = "extra"
            if picked < want or reserve < int(want * RESERVE_RATIO):
                if author_count.get(c["first_author"], 0) >= MAX_PER_AUTHOR:
                    status = "author_cap"
                else:
                    d = detail(env, c["isbn"])
                    c.update({"star": d.get("starScore"), "pages": d.get("pages"), "link": d.get("link"),
                              "toc_len": len((d.get("contentDetail") or {}).get("tableOfContents") or "")})
                    if not usable(d):
                        status = "incomplete"
                    elif picked < want:
                        status, picked = "picked", picked + 1
                        author_count[c["first_author"]] = author_count.get(c["first_author"], 0) + 1
                        taken.add(c["isbn"])
                    else:
                        status, reserve = "reserve", reserve + 1
                        reserved.add(c["isbn"])
            c["status"] = status
            all_rows.append(c)
        print(f"{name:<8} 후보 {len(pool):>4}  선정 {picked:>2}/{want}  예비 {reserve}")

    OUT_JSON.write_text(json.dumps(all_rows, ensure_ascii=False, indent=1), encoding="utf-8")
    sel = [r for r in all_rows if r["status"] == "picked"]
    with OUT_CSV.open("w", encoding="utf-8-sig", newline="") as f:
        w = csv.writer(f)
        w.writerow(["entry", "slot", "title", "author", "publisher", "year", "pages", "star", "source", "rank", "isbn", "link"])
        for r in sel:
            w.writerow([r["entry"], r["slot"], r["title"], r["author"], r["publisher"], (r["publish_date"] or "")[:4],
                        r.get("pages"), r.get("star"), r["source"], r["rank"], r["isbn"], r.get("link")])
    print(f"\n선정 {len(sel)}권 · saved: {OUT_JSON.relative_to(ROOT)}, {OUT_CSV.relative_to(ROOT)}")
    if FAILURES:
        print(f"API 실패·빈 응답 {len(FAILURES)}건 (캐시하지 않음):")
        for f in FAILURES[:20]:
            print("  ", f)


if __name__ == "__main__":
    main()
