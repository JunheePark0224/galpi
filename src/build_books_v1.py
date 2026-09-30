"""D3-3: merge selection + keywords + AI tags (+ human review) into the `books` table, and report.

Merge order per book: AI tags -> world_retag.json -> d4_review.json (human review beats retag beats AI).
Merges, per book (200 in total):
  - data/processed/d1_selected.csv               entry, slot, title, pages
  - data/processed/keyword_tags_draft.json       target keywords (status "picked" only)
  - data/processed/d3/ai_tags_batch_*.json       axes / way / one-liner from the AI taggers
  - data/processed/d3/world_retag.json (optional) {isbn: {world: -1|0|1, ...}} — re-judged world axis
    under the 09-30 rule; overrides axes.world of the AI tags for the listed leaf books
  - data/processed/d4_review.json (optional)     human overrides {isbn: {axes?, way?, one_liner?, ok}}
    (the D4 page saves {saved_at, answers: {...}}; both shapes are accepted; only ok=true applies)

Columns (roadmap 3-3): isbn, entry, slot, field, topic, genre, pages, way, axes, keywords,
one_liner, one_liner_style.
  leaf   : field null, topic null, genre = slot, way null, keywords []
  target : field from slot, topic = slot, genre = topic, axes null

The report checks one-liner rules (check_one_liners.check_line, material = YES24 intro + TOC from
the git-ignored bundles), axis / way distributions vs the D3 criteria, and lists flagged books for D4
(one-liner failures, missing_detail, D1 check, low-confidence AI tags, leaf books with all axes 0).
Nothing with YES24 text is written: only our tags, one-liners, titles and rule results.

Usage:  PYTHONIOENCODING=utf-8 python src/build_books_v1.py [--allow-partial]
Input:  see above + data/processed/d1_curation.json ("check") + d3/low_confidence.json
        (optional {isbn: reason}) + check/d3_bundles/batch_*.json
Output: data/processed/books_v1_draft.json  (no d4_review.json)
        data/processed/books_v1.json        (d4_review.json present)
        data/processed/d3_report.json
Exit 1 with a message when any of the 200 books lack complete tags (unless --allow-partial,
which writes the complete ones only and flags the rest).
"""
import argparse
import json
import sys
from pathlib import Path
from typing import Any

from build_d3_bundles import BUNDLE_DIR, load_keywords, load_selected
from check_one_liners import check_line

ROOT = Path(__file__).resolve().parents[1]
PROCESSED = ROOT / "data" / "processed"
AI_DIR = PROCESSED / "d3"
LOW_CONF = AI_DIR / "low_confidence.json"
CURATION = PROCESSED / "d1_curation.json"
REVIEW = PROCESSED / "d4_review.json"
RETAG = AI_DIR / "world_retag.json"
OUT_DRAFT = PROCESSED / "books_v1_draft.json"
OUT_FINAL = PROCESSED / "books_v1.json"
OUT_REPORT = PROCESSED / "d3_report.json"

AXES = ("temp", "pull", "gain", "world")
WAYS = ("개념", "실습", "사례")
STYLES = ("summary", "question")
DEFAULT_STYLE = {"leaf": "question", "target": "summary"}
FIELD_OF_SLOT = {
    "데이터 분석": "데이터·통계", "통계": "데이터·통계",
    "AI 활용": "AI·IT 활용", "업무 자동화": "AI·IT 활용",
    "습관·집중": "습관·자기계발", "시간·생산성": "습관·자기계발",
}
COLUMNS = ("isbn", "entry", "slot", "field", "topic", "genre", "pages", "way", "axes",
           "keywords", "one_liner", "one_liner_style")
AXIS_MIN_SHARE = 0.25  # D3: each axis needs both sides (+1, -1) at >= 25%
WAY_MIN_SHARE = 0.20   # D3: each reading way >= 20%

Book = dict[str, Any]


class MissingTagsError(Exception):
    """Raised when books lack complete tags; `problems` maps isbn -> reasons."""

    def __init__(self, problems: dict[str, list[str]]) -> None:
        self.problems = problems
        super().__init__(f"{len(problems)} books lack complete tags")


def parse_pages(raw: Any) -> int | None:
    text = str(raw or "").strip()
    return int(text) if text.isdigit() else None


def unwrap_review(raw: dict) -> dict[str, dict]:
    """d4_review.json is {saved_at, answers: {...}}; a bare {isbn: {...}} map is accepted too."""
    answers = raw.get("answers") if isinstance(raw.get("answers"), dict) else raw
    return {k: v for k, v in answers.items() if isinstance(v, dict)}


def apply_world_retag(tag: dict, retag: dict | None, entry: str) -> dict:
    """New tag dict with the re-judged world axis on top (leaf only; a valid -1/0/1 int only)."""
    world = (retag or {}).get("world")
    if entry != "leaf" or type(world) is not int or world not in (-1, 0, 1):
        return dict(tag)
    return {**tag, "axes": {**(tag.get("axes") or {}), "world": world}}


def apply_override(tag: dict, override: dict | None, entry: str) -> dict:
    """New tag dict with the human override on top. Only ok=true overrides apply; entry-specific fields only."""
    if not override or override.get("ok") is not True:
        return dict(tag)
    merged = dict(tag)
    if isinstance(override.get("one_liner"), str) and override["one_liner"].strip():
        merged["one_liner"] = override["one_liner"].strip()
    if entry == "leaf" and isinstance(override.get("axes"), dict):
        merged["axes"] = {**(tag.get("axes") or {}), **override["axes"]}
    if entry == "target" and override.get("way"):
        merged["way"] = override["way"]
    return merged


def tag_problems(entry: str, tag: dict | None) -> list[str]:
    """Reasons a tag is unusable (empty list = complete)."""
    if not tag:
        return ["태그 없음"]
    problems = []
    if tag.get("entry") not in (None, entry):
        problems.append(f"entry 불일치({tag.get('entry')})")
    if entry == "leaf":
        axes = tag.get("axes")
        ok = isinstance(axes, dict) and all(
            type(axes.get(a)) is int and axes.get(a) in (-1, 0, 1) for a in AXES)
        if not ok:
            problems.append("축 태그 불완전")
    elif tag.get("way") not in WAYS:
        problems.append("읽는 방식 없음")
    line = tag.get("one_liner")
    if not isinstance(line, str) or not line.strip():
        problems.append("한 줄 없음")
    if tag.get("one_liner_style") not in (None, *STYLES):
        problems.append("한 줄 말투 값 오류")
    return problems


def make_book(row: dict, keywords: dict[str, list[str]], tag: dict) -> Book:
    entry, slot, isbn = row["entry"], row["slot"], row["isbn"]
    is_leaf = entry == "leaf"
    topic = None if is_leaf else slot
    return {
        "isbn": isbn,
        "entry": entry,
        "slot": slot,
        "field": None if is_leaf else FIELD_OF_SLOT[slot],
        "topic": topic,
        "genre": slot if is_leaf else topic,
        "pages": parse_pages(row.get("pages")),
        "way": None if is_leaf else tag["way"],
        "axes": {a: tag["axes"][a] for a in AXES} if is_leaf else None,
        "keywords": [] if is_leaf else list(keywords.get(isbn, [])),
        "one_liner": tag["one_liner"].strip(),
        "one_liner_style": tag.get("one_liner_style") or DEFAULT_STYLE[entry],
    }


def merge_books(selected: list[dict], keywords: dict[str, list[str]], ai_tags: dict[str, dict],
                overrides: dict[str, dict] | None = None,
                strict: bool = True,
                world_retag: dict[str, dict] | None = None) -> tuple[list[Book], dict[str, list[str]]]:
    """Pure merge. Returns (books with complete tags in selection order, {isbn: problems}).

    strict=True raises MissingTagsError instead of returning problems.
    """
    overrides = overrides or {}
    world_retag = world_retag or {}
    books: list[Book] = []
    problems: dict[str, list[str]] = {}
    for row in selected:
        isbn, entry, slot = row["isbn"], row["entry"], row["slot"]
        retagged = apply_world_retag(ai_tags.get(isbn) or {}, world_retag.get(isbn), entry)
        tag = apply_override(retagged, overrides.get(isbn), entry)
        reasons = tag_problems(entry, tag)
        if entry == "target" and slot not in FIELD_OF_SLOT:
            reasons.append(f"알 수 없는 슬롯({slot})")
        if reasons:
            problems[isbn] = reasons
            continue
        books.append(make_book(row, keywords, tag))
    if problems and strict:
        raise MissingTagsError(problems)
    return books, problems


def style_issues(book: Book) -> list[str]:
    """Leaf lines are questions (end with '?'), target lines are summaries (no '?')."""
    asks = book["one_liner"].rstrip().endswith("?")
    if book["entry"] == "leaf" and not asks:
        return ["질문형 아님(물음표로 끝나지 않음)"]
    if book["entry"] == "target" and asks:
        return ["요약형인데 물음표로 끝남"]
    return []


def shares(counts: dict[Any, int], total: int) -> dict[str, float]:
    return {str(k): round(v / total, 3) if total else 0.0 for k, v in counts.items()}


def axis_distribution(leaf: list[Book]) -> dict[str, dict]:
    out = {}
    for a in AXES:
        counts = {v: sum(b["axes"][a] == v for b in leaf) for v in (1, 0, -1)}
        share = shares(counts, len(leaf))
        out[a] = {"counts": {f"{v:+d}" if v else "0": c for v, c in counts.items()},
                  "shares": {f"{int(k):+d}" if int(k) else "0": s for k, s in share.items()},
                  "pass": bool(leaf) and share["1"] >= AXIS_MIN_SHARE and share["-1"] >= AXIS_MIN_SHARE}
    return out


def way_distribution(target: list[Book]) -> dict:
    counts = {w: sum(b["way"] == w for b in target) for w in WAYS}
    share = shares(counts, len(target))
    return {"counts": counts, "shares": share,
            "pass": bool(target) and all(s >= WAY_MIN_SHARE for s in share.values())}


def build_report(books: list[Book], titles: dict[str, str], materials: dict[str, str],
                 d1_check: dict[str, str], missing_detail: set[str],
                 problems: dict[str, list[str]], expected: int,
                 low_confidence: dict[str, str] | None = None) -> dict:
    """Counts, per-book one-liner results, distributions, D3 criteria and the flag list."""
    leaf = [b for b in books if b["entry"] == "leaf"]
    target = [b for b in books if b["entry"] == "target"]
    results: dict[str, dict] = {}
    reasons: dict[str, list[str]] = {isbn: [f"태그 문제: {', '.join(r)}"] for isbn, r in problems.items()}

    def flag(isbn: str, reason: str) -> None:
        reasons.setdefault(isbn, []).append(reason)

    for b in books:
        isbn = b["isbn"]
        line = check_line(b["one_liner"], titles.get(isbn, ""), materials.get(isbn, ""))
        extra = style_issues(b)
        results[isbn] = {"title": titles.get(isbn, ""), "one_liner": b["one_liner"], **line,
                         "style_issues": extra, "pass": not line["issues"] and not extra}
        for issue in [*line["issues"], *extra]:
            flag(isbn, f"한 줄: {issue}")
        if isbn in missing_detail:
            flag(isbn, "missing_detail (YES24 상세 없음)")
        if isbn in d1_check:
            flag(isbn, f"D1 check: {d1_check[isbn]}")
        if b["entry"] == "leaf" and all(b["axes"][a] == 0 for a in AXES):
            flag(isbn, "축 4개 모두 0")
    for isbn in problems:
        if isbn in missing_detail:
            flag(isbn, "missing_detail (YES24 상세 없음)")
        if isbn in d1_check:
            flag(isbn, f"D1 check: {d1_check[isbn]}")

    for isbn, why in (low_confidence or {}).items():
        if isbn in titles:
            flag(isbn, f"AI 확신 낮음: {why}")

    passed = sum(r["pass"] for r in results.values())
    passed_line = sum(not r["issues"] for r in results.values())
    axes = axis_distribution(leaf)
    ways = way_distribution(target)
    return {
        "counts": {"expected": expected, "complete": len(books), "leaf": len(leaf),
                   "target": len(target), "missing_tags": len(problems)},
        "one_liners": {"checked": len(results), "passed": passed,
                       "pass_rate": round(passed / len(results), 3) if results else 0.0,
                       "passed_check_line_only": passed_line, "results": results},
        "leaf_axes": axes,
        "target_way": ways,
        "criteria": {
            "axes_both_sides_ge_25pct": {a: axes[a]["pass"] for a in AXES},
            "ways_each_ge_20pct": ways["pass"],
            "complete_200": len(books) == expected,
            "note": "leaf first-draw fill >= 95% and genres >= 3.5 are in simulate_real.json",
        },
        "flags": [{"isbn": isbn, "title": titles.get(isbn, ""), "reasons": rs}
                  for isbn, rs in reasons.items()],
    }


def load_ai_tags() -> dict[str, dict]:
    tags: dict[str, dict] = {}
    for path in sorted(AI_DIR.glob("ai_tags_batch_*.json")):
        tags.update(json.loads(path.read_text(encoding="utf-8")))
    return tags


def load_world_retag() -> dict[str, dict]:
    """{isbn: {world, was, evidence}} from the world-axis re-judgement (optional file)."""
    return json.loads(RETAG.read_text(encoding="utf-8")) if RETAG.exists() else {}


def load_low_confidence() -> dict[str, str]:
    """{isbn: reason} the taggers reported as hard / low-confidence (optional file)."""
    return json.loads(LOW_CONF.read_text(encoding="utf-8")) if LOW_CONF.exists() else {}


def load_materials() -> tuple[dict[str, str], set[str]]:
    """isbn -> intro + TOC (for the grounding check) and the isbns whose YES24 detail is missing."""
    materials: dict[str, str] = {}
    missing: set[str] = set()
    paths = sorted(BUNDLE_DIR.glob("batch_*.json"))
    if not paths:
        raise FileNotFoundError(f"no bundles in {BUNDLE_DIR} — run build_d3_bundles.py first")
    for path in paths:
        for b in json.loads(path.read_text(encoding="utf-8")):
            materials[b["isbn"]] = (b.get("intro") or "") + " " + " ".join(b.get("toc") or [])
            if b.get("missing_detail"):
                missing.add(b["isbn"])
    return materials, missing


def print_summary(report: dict, out_path: Path) -> None:
    c, ol = report["counts"], report["one_liners"]
    print(f"books: {c['complete']}/{c['expected']} (leaf {c['leaf']} / target {c['target']}) "
          f"· missing tags {c['missing_tags']}")
    print(f"one-liners: {ol['passed']}/{ol['checked']} pass all rules ({ol['pass_rate']:.1%}); "
          f"check_line only {ol['passed_check_line_only']}/{ol['checked']}")
    for a, d in report["leaf_axes"].items():
        print(f"  axis {a:<5} +1 {d['shares']['+1']:.0%} · 0 {d['shares']['0']:.0%} "
              f"· -1 {d['shares']['-1']:.0%}  {'PASS' if d['pass'] else 'FAIL'}")
    w = report["target_way"]
    print("  way   " + " · ".join(f"{k} {v:.0%}" for k, v in w["shares"].items())
          + f"  {'PASS' if w['pass'] else 'FAIL'}")
    print(f"flags: {len(report['flags'])} books")
    print(f"saved: {out_path.relative_to(ROOT)} · {OUT_REPORT.relative_to(ROOT)}")


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    parser.add_argument("--allow-partial", action="store_true",
                        help="write the complete books only and flag the rest (default: exit 1)")
    args = parser.parse_args()

    selected = load_selected()
    reviewed = REVIEW.exists()
    overrides = unwrap_review(json.loads(REVIEW.read_text(encoding="utf-8"))) if reviewed else {}
    try:
        books, problems = merge_books(selected, load_keywords(), load_ai_tags(), overrides,
                                      strict=not args.allow_partial,
                                      world_retag=load_world_retag())
    except MissingTagsError as err:
        print(f"ERROR: {err}", file=sys.stderr)
        for isbn, reasons in err.problems.items():
            print(f"  {isbn}: {', '.join(reasons)}", file=sys.stderr)
        return 1

    materials, missing_detail = load_materials()
    curation = json.loads(CURATION.read_text(encoding="utf-8"))
    titles = {r["isbn"]: r["title"] for r in selected}
    report = build_report(books, titles, materials, curation.get("check", {}), missing_detail,
                          problems, expected=len(selected), low_confidence=load_low_confidence())
    out_path = OUT_FINAL if reviewed else OUT_DRAFT
    out_path.write_text(json.dumps([{c: b[c] for c in COLUMNS} for b in books],
                                   ensure_ascii=False, indent=1), encoding="utf-8")
    OUT_REPORT.write_text(json.dumps(report, ensure_ascii=False, indent=1), encoding="utf-8")
    print_summary(report, out_path)
    return 0


if __name__ == "__main__":
    sys.exit(main())
