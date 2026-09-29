"""Compare book metadata from 도서관 정보나루 and Kakao book search for the same ISBNs.

Usage:  python src/compare_apis.py
Output: data/raw/api_compare/compare_<date>.json + summary printed to stdout.
Keys are read from .env and never printed.
"""
import json
import urllib.parse
import urllib.request
from datetime import date
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
OUT_DIR = ROOT / "data" / "raw" / "api_compare"

KEYWORD_STOPWORDS = {"Chapter", "Part", "아주", "가지", "최고", "사람", "생각", "자신", "필요", "사용", "방법", "세계"}


def load_env() -> dict:
    env = {}
    for line in (ROOT / ".env").read_text(encoding="utf-8-sig").splitlines():
        if "=" in line and not line.startswith("#"):
            k, v = line.split("=", 1)
            env[k.strip()] = v.strip().strip("\"'")
    return env


def get_json(url: str, headers: dict | None = None, secret: str = "") -> dict:
    req = urllib.request.Request(url, headers=headers or {})
    try:
        with urllib.request.urlopen(req, timeout=25) as r:
            return json.loads(r.read().decode("utf-8"))
    except Exception as e:  # report without leaking keys
        msg = str(e)
        if secret:
            msg = msg.replace(secret, "***")
        return {"error": msg}


def d4l(env: dict, endpoint: str, **params) -> dict:
    key = env["DATA4LIBRARY_KEY"]
    params.update(authKey=key, format="json")
    return get_json(f"http://data4library.kr/api/{endpoint}?{urllib.parse.urlencode(params)}", secret=key)


def kakao_by_isbn(env: dict, isbn: str) -> dict:
    key = env["KAKAO_REST_KEY"]
    url = "https://dapi.kakao.com/v3/search/book?" + urllib.parse.urlencode({"target": "isbn", "query": isbn})
    return get_json(url, headers={"Authorization": f"KakaoAK {key}"}, secret=key)


def top_isbn(env: dict, dtl_kdc: str, class_contains: str) -> tuple[str, str] | None:
    r = d4l(env, "loanItemSrch", startDt="2026-03-01", endDt="2026-08-31", dtl_kdc=dtl_kdc, pageNo=1, pageSize=50)
    for d in r.get("response", {}).get("docs", []):
        doc = d["doc"]
        if class_contains in (doc.get("class_nm") or ""):
            return doc["isbn13"], doc["bookname"]
    return None


def summarize_d4l(env: dict, isbn: str) -> dict:
    detail = d4l(env, "srchDtlList", isbn13=isbn, loaninfoYN="N")
    try:
        book = detail["response"]["detail"][0]["book"]
    except (KeyError, IndexError, TypeError):
        return {"found": False, "raw_error": str(detail)[:200]}
    kw = d4l(env, "keywordList", isbn13=isbn, additionalYN="N")
    words = [x["item"]["word"] for x in kw.get("response", {}).get("items", [])]
    clean = [w for w in words if w not in KEYWORD_STOPWORDS]
    desc = book.get("description") or ""
    return {
        "found": True,
        "title": book.get("bookname"),
        "class_nm": book.get("class_nm"),
        "has_image": bool(book.get("bookImageURL")),
        "description_len": len(desc),
        "description": desc,
        "keyword_count": len(words),
        "keywords_top": clean[:8],
    }


def summarize_kakao(env: dict, isbn: str) -> dict:
    r = kakao_by_isbn(env, isbn)
    if "error" in r:
        return {"found": False, "error": r["error"]}
    docs = r.get("documents", [])
    if not docs:
        return {"found": False}
    b = docs[0]
    contents = b.get("contents") or ""
    return {
        "found": True,
        "title": b.get("title"),
        "has_image": bool(b.get("thumbnail")),
        "contents_len": len(contents),
        "contents": contents,
        "price": b.get("price"),
        "sale_price": b.get("sale_price"),
        "status": b.get("status"),
        "url": b.get("url"),
    }


def main() -> None:
    env = load_env()
    isbns = [
        ("9788987999364", "새빨간 거짓말, 통계"),
        ("9788963220598", "통계의 힘"),
        ("9791194383796", "제미나이 활용법"),
        ("9791162540640", "아주 작은 습관의 힘"),
        ("9791162544327", "렛뎀 이론"),
        ("9791167740984", "도둑맞은 집중력"),
        ("9791191056372", "돈의 심리학"),
        ("9788936434120", "소년이 온다"),
    ]
    for dtl_kdc, cls in [("00", "전산학"), ("81", "수필")]:
        found = top_isbn(env, dtl_kdc, cls)
        if found:
            isbns.append(found)

    rows = []
    for isbn, label in isbns:
        rows.append({"isbn": isbn, "label": label, "d4l": summarize_d4l(env, isbn), "kakao": summarize_kakao(env, isbn)})

    OUT_DIR.mkdir(parents=True, exist_ok=True)
    out = OUT_DIR / f"compare_{date.today():%Y%m%d}.json"
    out.write_text(json.dumps(rows, ensure_ascii=False, indent=1), encoding="utf-8")

    print(f"{'책':<22} | 정보나루 소개 | 카카오 소개 | 카카오 가격 | 표지(나/카) | 키워드 상위")
    for row in rows:
        d, k = row["d4l"], row["kakao"]
        price = f"{k.get('price')}/{k.get('sale_price')}" if k.get("found") else "-"
        print(
            f"{row['label'][:22]:<22} | "
            f"{d.get('description_len', '-')!s:>6}자 | "
            f"{k.get('contents_len', '-')!s:>6}자 | "
            f"{price:>13} | "
            f"{'O' if d.get('has_image') else 'X'}/{'O' if k.get('has_image') else 'X'} | "
            f"{', '.join(d.get('keywords_top', [])[:6])}"
        )
        if not k.get("found"):
            print(f"    kakao: {k.get('error', 'not found')}")
    print(f"\nsaved: {out.relative_to(ROOT)}")


if __name__ == "__main__":
    main()
