"""Samples a person checks (design 2-3): the trial sample of a day and the weekly sample after graduation.

Trial (auto_merge false — a person reviews every day's PR): `trial_sample` = a fixed `sample_rate` share of the day's books
that were accepted because both passes agreed (seeded by the batch id — the date for a day's first batch; stable across applies). review.py shows them by default, so the agreement
figures also say how often an agreed book was still wrong; the PR body says how many agreed books stay unseen.
Weekly (auto_merge true): `sample_rate` of last week's daily additions as a GitHub issue body.

Usage (from the checkout):  python -m src.pipeline.sample [--week 2026-W42] --out issue.md
Does nothing while auto_merge is false (every day is reviewed then). The same week always gives the same books
(seeded by the week id), so `python -m src.pipeline.review --sample 2026-W42` rebuilds the list locally. The issue holds
ISBN, title and our tags only — no YES24 text.
"""
import argparse
import json
import math
import random
import sys
from datetime import date, datetime, timedelta
from pathlib import Path

from . import ADDITIONS, KST
from .checks import AUTO
from .config import load_config


def agreed_isbns(doc: dict) -> list[str]:
    """The day's agreed books: accepted because both passes agreed (`auto`, nobody has looked) or looked at as a sample
    already (`sampled`). A person's answer turns `auto` into `sampled`, so this list — and the draw from it — does not change
    when a review is applied."""
    return sorted(b["isbn"] for b in doc["books"]
                  if b.get("sampled") or (b.get("auto") == AUTO and b["status"] == "picked" and not b.get("reviewed")))


def sample_size(n_agreed: int, rate: float) -> int:
    return math.ceil(rate * n_agreed) if n_agreed and rate else 0


def trial_sample(doc: dict, rate: float) -> list[str]:
    """A fixed share of the batch's agreed books, reviewed by default during the trial. Seeded by the batch id
    (`batch_id`; files from before 10-05 have none and use `date`, which is the same id for a day's first batch). The same
    books come back after a review is applied and the page is built again. A batch re-sorted under a newer rule keeps the
    draw it had (`trial_sample` in the file — review.resorted), so a sample a person has started does not move."""
    if "trial_sample" in doc:
        return list(doc["trial_sample"])
    agreed = agreed_isbns(doc)
    seed = doc.get("batch_id") or doc["date"]
    return sorted(random.Random(seed).sample(agreed, sample_size(len(agreed), rate)))


def last_week(today: date) -> str:
    y, w, _ = (today - timedelta(days=7)).isocalendar()
    return f"{y}-W{w:02d}"


def week_bounds(week: str) -> tuple[date, date]:
    y, w = week.split("-W")
    monday = date.fromisocalendar(int(y), int(w), 1)
    return monday, monday + timedelta(days=6)


def daily_docs() -> list[tuple[Path, dict]]:
    docs = [(p, json.loads(p.read_text(encoding="utf-8"))) for p in sorted(ADDITIONS.glob("*.json"))]
    return [(p, d) for p, d in docs if d.get("batch") == "daily"]


def sample_books(docs: list[tuple[Path, dict]], week: str, rate: float) -> list[tuple[Path, dict]]:
    lo, hi = week_bounds(week)
    pool = sorted(((p, b) for p, d in docs if lo <= date.fromisoformat(d["date"]) <= hi
                   for b in d["books"] if b["status"] == "picked"), key=lambda pb: pb[1]["isbn"])
    return random.Random(week).sample(pool, sample_size(len(pool), rate))


def cell(text: object) -> str:
    """Text for a markdown table cell (PR body, weekly issue): no pipe, no line break."""
    return str(text).replace("|", "\\|").replace("\n", " ")


def tags_of(b: dict) -> str:
    if b["entry"] == "target":
        return f"🎯 {b['topic']} · {', '.join(b['keywords']) or '키워드 없음'} · {b['way']}"
    return f"🍃 {b['genre']} · " + " ".join(f"{k} {v:+d}" for k, v in b["axes"].items())


def issue_body(week: str, picks: list[tuple[Path, dict]], rate: float) -> str:
    way_in = lambda b: "AI 일치" if b.get("auto") else "검수됨" if b.get("reviewed") else "-"  # noqa: E731
    rows = [f"| {b['isbn']} | {cell(b['title'])} | {cell(tags_of(b))} | {cell(b['one_liner'])} | {way_in(b)} |" for _, b in picks]
    return "\n".join([
        f"지난주({week}) 매일 추가분에서 {rate:.0%}를 뽑았어요 — {len(picks)}권.", "",
        "| ISBN | 제목 | 우리 태그 | 한 줄 | 들어온 길 |", "|---|---|---|---|---|", *rows, "",
        f"검수: `PYTHONIOENCODING=utf-8 python -m src.pipeline.review --sample {week}` → 페이지에서 확인 → 내려받기 →",
        f"`python -m src.pipeline.review --sample {week} --apply <내려받은 파일>` → `cd web && npm run books:import` → 커밋·PR.",
        "어느 항목이든 90% 아래면 `data/pipeline/config.json`의 `auto_merge`를 false로 되돌리자고 제안해요(design 2-3).",
    ])


def main(argv: list[str] | None = None) -> int:
    ap = argparse.ArgumentParser(description="weekly sample issue")
    ap.add_argument("--week", default=last_week(datetime.now(KST).date()))
    ap.add_argument("--out", type=Path, required=True)
    args = ap.parse_args(argv)
    cfg = load_config()
    if not cfg.auto_merge:
        print("auto_merge is off — every day is reviewed, no weekly sample")
        return 0
    picks = sample_books(daily_docs(), args.week, cfg.sample_rate)
    if not picks:
        print(f"{args.week}: no daily additions — no sample")
        return 0
    args.out.write_text(issue_body(args.week, picks, cfg.sample_rate) + "\n", encoding="utf-8")
    print(f"{args.week}: {len(picks)} books → {args.out}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
