"""Rule checks for bookmark one-liners (첫인상 한 줄).

Rules are code so every line gets the same check before human review:
  - length: fits on a bookmark
  - no hype words (과장 금지)
  - does not repeat the book title (the bookmark already shows it)
  - grounded: shares at least one content word with its source materials
    (정보나루 소개 + YES24 목차), so it was not made up

Usage:  python src/check_one_liners.py
Input:  data/processed/one_liners_sample.json
        data/raw/api_compare/compare_20260928.json  (정보나루 소개)
        data/raw/api_compare/yes24_20260929.json    (YES24 목차)
Output: data/processed/one_liners_checked.json + summary printed to stdout.
"""
import json
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SAMPLE = ROOT / "data" / "processed" / "one_liners_sample.json"
D4L = ROOT / "data" / "raw" / "api_compare" / "compare_20260928.json"
YES24 = ROOT / "data" / "raw" / "api_compare" / "yes24_20260929.json"
OUT = ROOT / "data" / "processed" / "one_liners_checked.json"

MIN_LEN, MAX_LEN = 12, 36
HYPE_WORDS = ["최고", "필독", "반드시", "완벽", "인생책", "미친", "역대급", "무조건", "1위", "베스트셀러", "강력 추천", "꼭 읽어야"]
# Plain words that only contain a hype word (10-03: "완벽주의" was read as "완벽"): taken out before the hype check.
HYPE_OK = ["완벽주의", "최고경영자", "최고점", "최고치"]
# A title this short is a common word ("생산성"), not a title to repeat (10-03): the title check needs at least this many.
TITLE_MIN = 4
STOP_TOKENS = {"있어요", "말해요", "때", "까요", "어떻게", "무엇이", "뭐가", "정말", "다를까요", "되면", "하는", "하고", "싶을", "해보는", "담았어요"}


# 🍃 질문형 asks the reader — …까요? …나요? …ㄹ래요? …세요? (10-08, user: "…쉽게 알게 돼요?" reads oddly). A statement with
# "?" stuck on its ending is not a question: 31 of 395 lines did that, because the rule only asked for a final "?".
STATEMENT_Q = re.compile(r"(봐|줘|돼|해|혀|려|져|워)요\?$|에요\?$")


def form_issue(entry: str, line: str) -> str | None:
    """The style of a one-liner's entry: 🍃 leaf a real question, 🎯 target a summary with no "?". None when it fits."""
    line = line.strip()
    if entry == "leaf" and not line.endswith("?"):
        return "질문형인데 ?로 끝나지 않음"
    if entry == "leaf" and STATEMENT_Q.search(line):
        return "질문형인데 평서문에 ?만 붙음"
    if entry == "target" and line.endswith("?"):
        return "요약형인데 물음표로 끝남"
    return None


def tokens(text: str) -> set[str]:
    words = re.findall(r"[가-힣A-Za-z0-9]{2,}", text)
    return {w for w in words if w not in STOP_TOKENS}


def stem_overlap(line: str, material: str) -> list[str]:
    """Content words of the line (first 2 chars as a crude Korean stem) that appear in the material."""
    hits = []
    for w in tokens(line):
        stem = w[:2]
        if stem in material:
            hits.append(w)
    return sorted(hits)


def check_line(text: str, title: str, material: str) -> dict:
    issues = []
    n = len(text.replace(" ", ""))
    if n < MIN_LEN:
        issues.append(f"짧음({n}자)")
    if n > MAX_LEN:
        issues.append(f"김({n}자)")
    plain = text
    for word in HYPE_OK:
        plain = plain.replace(word, " ")
    hype = [w for w in HYPE_WORDS if w in plain]
    if hype:
        issues.append("과장 표현: " + ", ".join(hype))
    title_core = re.split(r"[:=(]", title)[0].strip()
    if len(title_core.replace(" ", "")) >= TITLE_MIN and title_core.replace(" ", "") in text.replace(" ", ""):
        issues.append("제목 반복")
    grounded = stem_overlap(text, material)
    if len(grounded) < 2:
        issues.append(f"근거 약함(겹치는 단어 {len(grounded)}개)")
    return {"chars": n, "issues": issues, "grounded_words": grounded}


def main() -> None:
    d4l = {r["isbn"]: r["d4l"].get("description", "") for r in json.loads(D4L.read_text(encoding="utf-8"))}
    toc = {r["isbn"]: r["yes24"].get("toc", "") + " " + r["yes24"].get("intro", "")
           for r in json.loads(YES24.read_text(encoding="utf-8"))}
    books = json.loads(SAMPLE.read_text(encoding="utf-8"))

    results, total, flagged = [], 0, 0
    for b in books:
        material = d4l.get(b["isbn"], "") + " " + toc.get(b["isbn"], "")
        for line in b["lines"]:
            r = check_line(line["text"], b["title"], material)
            total += 1
            flagged += bool(r["issues"])
            results.append({"isbn": b["isbn"], "title": b["title"], "genre": b["genre"], **line, **r})

    OUT.write_text(json.dumps(results, ensure_ascii=False, indent=1), encoding="utf-8")
    for r in results:
        mark = "OK " if not r["issues"] else "CHK"
        print(f"[{mark}] {r['title'][:12]:<12} {r['style']} {r['chars']:>2}자 | {r['text']}" + (f"  ← {'; '.join(r['issues'])}" if r["issues"] else ""))
    print(f"\n{total}줄 중 규칙 통과 {total - flagged}줄, 검수 필요 {flagged}줄 · saved: {OUT.relative_to(ROOT)}")


if __name__ == "__main__":
    main()
