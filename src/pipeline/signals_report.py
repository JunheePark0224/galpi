"""Before → after figures of a re-tagged batch (10-06 label signals, plans/2026-10-06-label-signals.md 6절).

Usage (from the checkout):
  PYTHONIOENCODING=utf-8 python -m src.pipeline.signals_report 2026-10-05-2 --gold <gold.json> [--out <report.md>]
Compares data/processed/additions/<batch>.json (before) with <batch>.v2.json (after) on the books both hold:
  A. share of 🍃 books whose two passes chose differently, per axis
  B. agreement of AI-1 and AI-2 with a person's answers (the review download: answers{isbn: {axes|keywords|way|genre|topic,
     status}}), per field — counts, not just shares (n is small)
  C. books with at least one question for a person, and questions in all (checks.needs_person: split fields + a held line)
  D. pass A's 온도 on non-fiction 🍃 books: + / 0 / − shares
The report holds counts and our tags only — no YES24 text.
"""
import argparse
import json
import sys
from collections import Counter
from pathlib import Path

from . import ADDITIONS
from .checks import needs_person
from .prompt import AXES

FICTION = ("한국 소설", "외국 소설", "SF·판타지", "추리·스릴러", "호러·괴담", "로맨스", "시")
AXIS_NAME = {"temp": "온도", "pull": "끌림", "gain": "얻는 것", "world": "세계"}


def live(doc: dict) -> dict[str, dict]:
    return {b["isbn"]: b for b in doc["books"] if b["status"] != "dropped"}


def splits(books: list[dict]) -> dict[str, tuple[int, int]]:
    """{axis: (books whose passes differ, 🍃 books)}."""
    leaves = [b for b in books if b["entry"] == "leaf"]
    return {a: (sum(b["axes"][a] != b["second"]["axes"][a] for b in leaves), len(leaves)) for a in AXES}


def answer_of(b: dict, who: int) -> dict:
    """One pass's answer of a stored book: AI-1 = the book's own tags, AI-2 = `second`."""
    src = b if who == 1 else b["second"]
    if b["entry"] == "leaf":
        return {**src["axes"], "slot": src["fits"]}
    return {"keywords": sorted(src["keywords"]), "way": src["way"], "slot": src["fits"]}


def gold_of(b: dict, g: dict) -> dict:
    keep = g.get("status") not in ("dropped", "requeue")
    if b["entry"] == "leaf":
        return {**g["axes"], "slot": keep and g.get("genre") == b["genre"]}
    return {"keywords": sorted(g.get("keywords") or []), "way": g.get("way"),
            "slot": keep and g.get("topic") == b["topic"]}


def gold_agreement(books: dict[str, dict], gold: dict[str, dict], who: int) -> dict[str, tuple[int, int]]:
    """{field: (same as the person, books compared)} over the gold books this file holds. `slot` = genre / topic: the pass
    says the book fits its slot exactly when the person kept it in that slot."""
    out: dict[str, list[int]] = {}
    for isbn, g in gold.items():
        if isbn not in books:
            continue
        mine, theirs = answer_of(books[isbn], who), gold_of(books[isbn], g)
        for field, value in mine.items():
            hit = out.setdefault(field, [0, 0])
            hit[0] += value == theirs[field]
            hit[1] += 1
    return {f: (k, n) for f, (k, n) in out.items()}


def questions(books: list[dict]) -> dict[str, int]:
    """Books with a question for a person (any / on a 🍃 axis) and questions in all (a held line is one question)."""
    asked = [(b, *needs_person(b.get("flags") or [], b.get("issues") or [])) for b in books]
    return {"books": len(books), "asked": sum(bool(f or i) for _, f, i in asked),
            "leaf": sum(b["entry"] == "leaf" for b in books),
            "leaf_axis_asked": sum(b["entry"] == "leaf" and any(x in AXES for x in f) for b, f, _ in asked),
            "questions": sum(len(f) + bool(i) for _, f, i in asked)}


def nonfiction_temp(books: list[dict]) -> Counter:
    return Counter(b["axes"]["temp"] for b in books if b["entry"] == "leaf" and b["genre"] not in FICTION)


def pct(k: int, n: int) -> str:
    return f"{k}/{n} ({k / n:.0%})" if n else "0/0"


def report(before: dict, after: dict, gold: dict[str, dict]) -> str:
    new = live(after)
    old = {i: b for i, b in live(before).items() if i in new}
    lines = [f"# {after.get('retag_of', '')} 신호 기준 다시 태그 — 전 → 후", "",
             f"비교한 책: 두 파일에 다 있는 {len(old)}권 (전의 빼기·다시 태그 실패·글 없음 제외)", "",
             "## A. 두 AI가 다르게 고른 🍃 책", "", "| 축 | 전 | 후 |", "|---|---|---|"]
    sa, sb = splits(list(old.values())), splits(list(new.values()))
    lines += [f"| {AXIS_NAME[a]} | {pct(*sa[a])} | {pct(*sb[a])} |" for a in AXES]
    lines += ["", f"## B. 사람 답({len(gold)}권)과 같은 비율", "", "| 칸 | AI-1 전 | AI-1 후 | AI-2 전 | AI-2 후 |", "|---|---|---|---|---|"]
    ga = {(w, t): gold_agreement(d, gold, w) for w in (1, 2) for t, d in (("전", old), ("후", new))}
    fields = [f for f in (*AXES, "keywords", "way", "slot") if any(f in v for v in ga.values())]
    label = {**AXIS_NAME, "keywords": "키워드", "way": "방식", "slot": "장르/주제"}
    for f in fields:
        cells = [pct(*ga[(w, t)].get(f, (0, 0))) for w in (1, 2) for t in ("전", "후")]
        lines.append(f"| {label[f]} | " + " | ".join(cells) + " |")
    qa, qb = questions(list(old.values())), questions(list(new.values()))
    lines += ["", "## C. 사람에게 묻는 것", "", "| | 전 | 후 |", "|---|---|---|",
              f"| 묻는 게 있는 책 | {pct(qa['asked'], qa['books'])} | {pct(qb['asked'], qb['books'])} |",
              f"| 🍃 축 '확인 필요'가 있는 책 | {pct(qa['leaf_axis_asked'], qa['leaf'])} | {pct(qb['leaf_axis_asked'], qb['leaf'])} |",
              f"| 질문 수 (칸 + 걸린 한 줄) | {qa['questions']} | {qb['questions']} |",
              f"| '정보 없음' 표시가 있는 🍃 책 (후) | — | {pct(missing_books(list(new.values())), qb['leaf'])} |",
              "", "## D. 비소설 🍃 온도 (AI-1)", "", "| | + | 0 | − |", "|---|---|---|---|"]
    for name, books in (("전", old), ("후", new)):
        c = nonfiction_temp(list(books.values()))
        n = sum(c.values())
        lines.append(f"| {name} (n={n}) | " + " | ".join(pct(c[v], n) for v in (1, 0, -1)) + " |")
    return "\n".join(lines) + "\n"


def missing_books(books: list[dict]) -> int:
    return sum(bool(b.get("missing") or (b.get("second") or {}).get("missing")) for b in books if b["entry"] == "leaf")


def main(argv: list[str] | None = None) -> int:
    ap = argparse.ArgumentParser(description="before → after figures of a re-tagged batch")
    ap.add_argument("batch")
    ap.add_argument("--gold", type=Path, required=True)
    ap.add_argument("--out", type=Path)
    args = ap.parse_args(argv)
    read = lambda p: json.loads(p.read_text(encoding="utf-8"))  # noqa: E731
    text = report(read(ADDITIONS / f"{args.batch}.json"), read(ADDITIONS / f"{args.batch}.v2.json"),
                  read(args.gold).get("answers") or {})
    if args.out:
        args.out.write_text(text, encoding="utf-8")
    print(text)
    return 0


if __name__ == "__main__":
    sys.exit(main())
