"""Apply a downloaded review (local review page) to an additions file and log per-field agreement.

The additions file (data/processed/additions/<date>-<batch>.json) holds our draft tags. The review page
(src/build_pilot_review.py) downloads {saved_at, file, answers: {isbn: {topic, keywords, way, one_liner,
status, ok}}}. Only ok=true answers apply. The first time a book is reviewed its draft tags are kept under
"draft", so agreement is always "human answer vs our draft", and applying the same review again changes nothing.

Agreement (design 2-3): per field, the share of reviewed books the person did not change — topic, keywords
(same set), way, one_liner (same text). Books the person dropped are counted apart (`dropped`), not in the
field shares; reserves the person moved in are counted like the others. One row per (date, batch) in
data/pipeline/agreement.csv: date, batch, n, topic, keywords, way, one_liner (percent), dropped, auto_agreed.

Second tagging pass (build_pilot_review.py --flagged): books where our draft (AI-1) and a blind second tagger (AI-2)
agreed are sent as ok answers with `auto: "ai-agree"` — accepted WITHOUT human review. They are kept apart:
`n` and the percentages cover human-reviewed books only, `auto_agreed` counts the auto-accepted ones, and such a
book is stored with reviewed=false + auto="ai-agree" (a human answer for the same book always wins and removes
the mark). So the figures say how often a human agreed with our draft where a human looked; they say nothing
about the books nobody looked at.

Usage:  PYTHONIOENCODING=utf-8 python src/apply_review.py data/processed/additions/2026-10-01-pilot.json <review.json>
Then:   cd web && npm run books:import
"""
import csv
import json
import sys
from pathlib import Path

from check_one_liners import check_line

ROOT = Path(__file__).resolve().parents[1]
VOCAB = ROOT / "data" / "processed" / "keyword_vocab.json"
AGREEMENT = ROOT / "data" / "pipeline" / "agreement.csv"
FIELDS = ("topic", "keywords", "way", "one_liner")
WAYS = ("개념", "실습", "사례")
STATUSES = ("picked", "reserve", "dropped")
AUTO = "ai-agree"
CSV_HEAD = ["date", "batch", "n", *FIELDS, "dropped", "auto_agreed"]
FIELD_OF_TOPIC = {
    "데이터 분석": "데이터·통계", "통계": "데이터·통계", "AI 활용": "AI·IT 활용", "업무 자동화": "AI·IT 활용",
    "습관·집중": "습관·자기계발", "시간·생산성": "습관·자기계발", "돈 관리·투자": "돈·경제", "경제 상식": "돈·경제",
    "마음 돌보기": "마음·관계", "대화·관계": "마음·관계", "취업·커리어": "일·커리어", "글쓰기": "일·커리어",
}


class ReviewError(ValueError):
    """An answer that cannot be applied (unknown topic, keyword outside the closed list, …)."""


def unwrap(raw: dict) -> dict[str, dict]:
    answers = raw.get("answers") if isinstance(raw.get("answers"), dict) else raw
    return {k: v for k, v in answers.items() if isinstance(v, dict) and v.get("ok") is True}


def draft_of(book: dict) -> dict:
    """Our tags before any review (kept under "draft" once a book has been reviewed)."""
    if isinstance(book.get("draft"), dict):
        return book["draft"]
    return {"topic": book["topic"], "keywords": list(book.get("keywords") or []), "way": book["way"],
            "one_liner": book["one_liner"], "status": book["status"]}


def checked_answer(isbn: str, ans: dict, kept: dict[str, dict]) -> dict:
    topic = ans.get("topic")
    if topic not in FIELD_OF_TOPIC:
        raise ReviewError(f"{isbn}: unknown topic {topic}")
    keywords = list(dict.fromkeys(ans.get("keywords") or []))
    outside = [k for k in keywords if k not in kept.get(topic, {})]
    if outside:
        raise ReviewError(f"{isbn}: keywords {outside} are not in {topic}")
    if ans.get("way") not in WAYS:
        raise ReviewError(f"{isbn}: way must be one of {WAYS}")
    line = str(ans.get("one_liner") or "").strip()
    if not line:
        raise ReviewError(f"{isbn}: one_liner is empty")
    status = ans.get("status", "picked")
    if status not in STATUSES:
        raise ReviewError(f"{isbn}: unknown status {status}")
    if ans.get("auto") not in (None, AUTO):
        raise ReviewError(f"{isbn}: unknown auto mark {ans.get('auto')}")
    if ans.get("auto") and status != "picked":
        raise ReviewError(f"{isbn}: an auto-accepted book must stay picked")
    return {"topic": topic, "keywords": keywords, "way": ans["way"], "one_liner": line, "status": status}


def apply_answers(doc: dict, answers: dict[str, dict], kept: dict[str, dict]) -> tuple[dict, dict]:
    """New additions doc with the answers applied + agreement stats. The input doc is not changed."""
    books, same = [], {f: 0 for f in FIELDS}
    n = dropped = auto = 0
    for book in doc["books"]:
        ans = answers.get(book["isbn"])
        if ans is None:
            books.append(dict(book))
            continue
        a = checked_answer(book["isbn"], ans, kept)
        draft = draft_of(book)
        if ans.get("auto"):  # accepted without a human look: never counted as agreement, never over a human answer
            if book.get("reviewed") is True:
                books.append(dict(book))
                continue
            books.append({**book, **a, "field": FIELD_OF_TOPIC[a["topic"]], "draft": draft, "reviewed": False, "auto": AUTO})
            auto += 1
            continue
        human = {k: v for k, v in book.items() if k != "auto"}
        books.append({**human, **a, "field": FIELD_OF_TOPIC[a["topic"]], "draft": draft, "reviewed": True})
        if a["status"] == "dropped":
            dropped += 1
            continue
        if a["status"] == "reserve":
            continue
        n += 1
        same["topic"] += a["topic"] == draft["topic"]
        same["keywords"] += set(a["keywords"]) == set(draft["keywords"])
        same["way"] += a["way"] == draft["way"]
        same["one_liner"] += a["one_liner"] == draft["one_liner"].strip()
    live = [b for b in books if b["status"] == "picked"]
    new_doc = {**doc, "books": books, "reviewed": bool(live) and all(b.get("reviewed") for b in live),
               "auto_accepted": sum(b.get("auto") == AUTO for b in books)}
    shares = {f: round(100 * same[f] / n, 1) if n else None for f in FIELDS}
    return new_doc, {"date": doc.get("date", ""), "batch": doc.get("batch", ""), "n": n, **shares, "dropped": dropped,
                     "auto_agreed": new_doc["auto_accepted"]}


def upsert_row(rows: list[dict], stats: dict) -> list[dict]:
    """Rows with the (date, batch) row replaced or appended — applying again does not add a second row."""
    key = (str(stats["date"]), str(stats["batch"]))
    row = {k: "" if stats.get(k) is None else str(stats[k]) for k in CSV_HEAD}
    out = [r for r in rows if (r.get("date"), r.get("batch")) != key]
    return [*out, row]


def line_warnings(doc: dict) -> list[str]:
    """Rule check of the one-liners after review (length, hype words, title repeat). Grounding needs YES24 text,
    which this file does not hold, so it is checked on the review page's draft only."""
    out = []
    for b in doc["books"]:
        if b["status"] != "picked":
            continue
        issues = [i for i in check_line(b["one_liner"], b.get("title", ""), b["one_liner"])["issues"]
                  if not i.startswith("근거")]
        if b["one_liner"].rstrip().endswith("?"):
            issues.append("요약형인데 물음표로 끝남")
        if issues:
            out.append(f"{b['isbn']} {b.get('title', '')[:20]}: {', '.join(issues)}")
    return out


def main() -> int:
    if len(sys.argv) != 3:
        print(__doc__)
        return 2
    path, review = Path(sys.argv[1]), Path(sys.argv[2])
    doc = json.loads(path.read_text(encoding="utf-8"))
    vocab = json.loads(VOCAB.read_text(encoding="utf-8"))
    kept = {t: v.get("kept", {}) for t, v in vocab.items()}
    answers = unwrap(json.loads(review.read_text(encoding="utf-8")))
    unknown = sorted(set(answers) - {b["isbn"] for b in doc["books"]})
    if unknown:
        print(f"ERROR: review has books not in {path.name}: {unknown[:5]}", file=sys.stderr)
        return 1
    try:
        new_doc, stats = apply_answers(doc, answers, kept)
    except ReviewError as err:
        print(f"ERROR: {err}", file=sys.stderr)
        return 1
    path.write_text(json.dumps(new_doc, ensure_ascii=False, indent=1) + "\n", encoding="utf-8")
    AGREEMENT.parent.mkdir(parents=True, exist_ok=True)
    rows = list(csv.DictReader(AGREEMENT.open(encoding="utf-8"))) if AGREEMENT.exists() else []
    with AGREEMENT.open("w", encoding="utf-8", newline="") as f:
        w = csv.DictWriter(f, fieldnames=CSV_HEAD)
        w.writeheader()
        w.writerows(upsert_row(rows, stats))
    picked = sum(b["status"] == "picked" for b in new_doc["books"])
    print(f"applied {len(answers)} answers · picked {picked} · reviewed file: {new_doc['reviewed']}")
    print("agreement (human-reviewed books only) " + " · ".join(f"{f} {stats[f]}%" for f in FIELDS)
          + f" (n={stats['n']}, dropped {stats['dropped']})")
    print(f"auto-accepted without human review (AI-1 = AI-2): {stats['auto_agreed']} — not in the agreement figures")
    for w_ in line_warnings(new_doc):
        print("  check:", w_)
    print(f"saved: {path.relative_to(ROOT)} · {AGREEMENT.relative_to(ROOT)} — next: cd web && npm run books:import")
    return 0


if __name__ == "__main__":
    sys.exit(main())
