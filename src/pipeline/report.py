"""After `npm run books:import`: the draw simulation, axis balance and the PR body (design 2-1 "simulate", 2-3).

Usage (from the checkout):  PYTHONIOENCODING=utf-8 python -m src.pipeline.report --batch ID --out pr.md
  (ID = the batch id, pipeline/batch.py: YYYY-MM-DD for a day's first batch, YYYY-MM-DD-N for a later one; --date is the
  old name of the same option)
simulate_real's criteria on the new books.json (🍃 first-draw fill >= 95%, genres per draw >= 3.5) and each axis side
>= 25% of 🍃 books (balance-game 4절) — a miss is a ⚠ line in the PR, not a failure. The body opens with the run's status
(a run that stopped early is `partial` and says why and how many books made it), holds counts, titles and our tags only
(no YES24 text) and says plainly which books a person will see and which they will not: books both passes agreed on were
not reviewed by a person, except the trial sample (sample.trial_sample) that the review page shows by default. Keyword
candidates (names missing from a topic's list, counted over every additions file) close the body; the user decides.
"""
import argparse
import json
import sys
from pathlib import Path

from apply_review import FIELD_OF_TOPIC
from simulate_draws import leaf_users
from simulate_real import FILL_TARGET, GENRES_TARGET, evaluate, leaf_pool

from . import ADDITIONS, AGREEMENT, BOOKS, RUNS
from .agreement_log import MAX_SAMPLE_CHANGED, MIN_SAMPLE, STREAK, graduation, read_rows
from .config import load_config
from .gaps import GENRE_TARGET, TOPIC_TARGET, tally
from .keyword_candidates import count as count_candidates
from .keyword_candidates import load_docs
from .keyword_candidates import section as candidate_section
from .prompt import AXES
from .sample import agreed_isbns, cell, sample_size

AXIS_MIN = 25.0
STATUS_TEXT = {"ok": "정상", "partial": "중간에 멈춤"}


def axis_shares(books: list[dict]) -> dict[str, tuple[float, float]]:
    leaf = [b for b in books if b["entry"] == "leaf"]
    n = len(leaf) or 1
    return {a: (round(100 * sum(b["axes"][a] > 0 for b in leaf) / n, 1),
                round(100 * sum(b["axes"][a] < 0 for b in leaf) / n, 1)) for a in AXES}


def warnings(sim: dict, shares: dict[str, tuple[float, float]]) -> list[str]:
    out = []
    if sim["fill_pct"] < FILL_TARGET:
        out.append(f"🍃 첫 뽑기 채움 {sim['fill_pct']}% < {FILL_TARGET}%")
    if sim["genres_per_draw"] < GENRES_TARGET:
        out.append(f"🍃 뽑기당 장르 {sim['genres_per_draw']} < {GENRES_TARGET}")
    out += [f"축 {a}: + {p}% / − {m}% (한쪽 {AXIS_MIN:.0f}% 미만)" for a, (p, m) in shares.items() if min(p, m) < AXIS_MIN]
    return out


def book_line(b: dict) -> str:
    tags = (f"{b['topic']} · {', '.join(b['keywords']) or '-'} · {b['way']}" if b["entry"] == "target"
            else f"{b['genre']} · " + " ".join(f"{k}{v:+d}" for k, v in b["axes"].items()))
    mark = ("AI 일치(사람 안 봄)" if b.get("auto") else "사람이 확인함" if b.get("reviewed")
            else "검수 필요: " + ", ".join(b.get("flags") or []))
    return f"| {cell(b['title'])} | {cell(tags)} | {cell(b['one_liner'])} | {mark} |"


def held_line(b: dict) -> str:
    why = [*(b.get("issues") or []), *(f"두 AI가 엇갈림: {f}" for f in b.get("flags") or [])]
    return f"| {cell(b['title'])} | {cell(', '.join(why) or '-')} |"


def status_banner(summary: dict) -> list[str]:
    status = summary.get("status", "ok")
    if status == "ok":
        return []
    lines = [f"> ⚠ **상태: {STATUS_TEXT.get(status, status)}** — {summary.get('stopped') or '이유 기록 없음'}.",
             f"> 계획 {summary.get('wanted', 0)}권 중 태그가 끝난 {summary.get('tagged', 0)}권만 들어 있어요. 나머지는 내일 다시 채워요.", ""]
    return lines


def review_notes(doc: dict, auto_merge: bool, rate: float) -> list[str]:
    agreed = len(agreed_isbns(doc))
    looked = sample_size(agreed, rate)
    if auto_merge:
        who = (f"두 AI가 같게 본 {agreed}권은 auto_merge가 켜져 있어 사람이 보기 전에 병합돼요. "
               "맞는지는 주간 표본(이슈)으로만 확인해요.")
    elif agreed:
        who = (f"두 AI가 같게 봐서 바로 넣은 책은 **{agreed}권**이고, 이 중 사람이 보는 표본은 {looked}권(검수 페이지에 기본으로 들어가요, "
               f"`--no-sample`로 끔)이에요. **나머지 {agreed - looked}권은 사람이 확인하지 않았어요** — 맞다는 뜻이 아니에요.")
    else:
        who = "오늘은 두 AI가 같게 봐서 바로 넣은 책이 없어요."
    return [who, "일치율은 사람이 본 책(엇갈린 책 + 표본)만으로 재요. 사람이 안 본 책은 일치율에 들어가지 않아요."]


def pr_body(summary: dict, doc: dict, books: list[dict], sim: dict, auto_merge: bool, grad: dict,
            sample_rate: float = 0.1, candidates: list[dict] | None = None) -> str:
    picked = [b for b in doc["books"] if b["status"] == "picked"]
    waiting = [b for b in doc["books"] if b["status"] == "review"]  # flagged: not in books.json until a person applies a review
    held = [b for b in doc["books"] if b["status"] == "reserve"]
    t = tally(books)
    warn = warnings(sim, axis_shares(books))
    n_auto = sum(bool(b.get("auto")) for b in picked)  # counted from the file, not the run summary (which may be missing)
    batch = doc.get("batch_id") or doc["date"]  # files from before 10-05 have no batch_id: their id is the date
    lines = [
        f"## 오늘의 새 책 {batch}", "", *status_banner(summary),
        f"- 앱에 넣음 **{len(picked)}권** (두 AI 일치·사람 안 봄 {n_auto} · 사람이 확인함 {len(picked) - n_auto}) · "
        f"**검수 대기 {len(waiting)}** (앱에 안 들어감) · 대기 {len(held)} · 뺌 {summary.get('dropped', 0)} · "
        f"후보 {summary.get('candidates', 0)} / 계획 {summary.get('wanted', 0)}",
        f"- 모델 {doc['model']} → 확인 {doc['second_model']} · 비용 약 ${summary.get('cost_usd', 0)}"
        + (f" · 멈춤: {summary['stopped']}" if summary.get("stopped") else ""),
        f"- 책 {len(books)}권 · 🎯 주제 {TOPIC_TARGET}권 미만 {sum(t['topic'][x] < TOPIC_TARGET for x in FIELD_OF_TOPIC)}개 · "
        f"🍃 목표 미만 장르 {sum(t['genre'][g] < n for g, n in GENRE_TARGET.items())}개",
        f"- 🍃 시뮬레이션({sim.get('books', len([b for b in books if b['entry'] == 'leaf']))}권): 첫 뽑기 채움 {sim['fill_pct']}% "
        f"(기준 {FILL_TARGET}%) · 뽑기당 장르 {sim['genres_per_draw']} (기준 {GENRES_TARGET})", "",
        *(["### ⚠ 경고", *[f"- {w}" for w in warn], ""] if warn else []),
        "### 앱에 넣은 책", "| 제목 | 우리 태그 | 한 줄 | 상태 |", "|---|---|---|---|", *map(book_line, picked), "",
        *(["### 검수 대기 — 두 AI가 엇갈렸거나 확신이 낮은 책 (검수 `--apply` 전에는 앱에 안 들어가요)", "| 제목 | 우리 태그 | 한 줄 | 상태 |",
           "|---|---|---|---|", *map(book_line, waiting), ""] if waiting else []),
        *(["### 대기한 책 (규칙 검사에 걸렸거나, 자동 병합 중 두 AI가 엇갈림 — 검수 페이지에서 고쳐 넣을 수 있어요)", "| 제목 | 걸린 이유 |", "|---|---|",
           *map(held_line, held), ""] if held else []),
        *candidate_section(candidates or []),
        "### 검수", f"`PYTHONIOENCODING=utf-8 python -m src.pipeline.review {batch}` → 페이지 → 내려받기 → `--apply` → "
        "`cd web && npm run books:import` → 이 PR 브랜치에 커밋. 검수 없이 이 PR을 병합해도 **검수 대기 책은 앱에 들어가지 않아요**(나중에 검수해 넣을 수 있어요).",
        *review_notes(doc, auto_merge, sample_rate),
        f"졸업 연속 {grad['streak']}/{STREAK} · 일치 책 표본 {grad.get('sample_n', 0)}권 중 바뀐 책 {grad.get('sample_changed', 0)}권 "
        f"(졸업: {MIN_SAMPLE}권 이상, 바뀐 비율 {MAX_SAMPLE_CHANGED:.0f}% 이하)"
        + (" — **졸업 기준 충족(두 가지 모두): auto_merge를 켤지 사용자에게 묻기**" if grad["graduated"] and not auto_merge else ""),
    ]
    return "\n".join(lines) + "\n"


def main(argv: list[str] | None = None) -> int:
    ap = argparse.ArgumentParser(description="PR body for a day of the pipeline")
    ap.add_argument("--batch", "--date", dest="batch", required=True, help="batch id (the day, or YYYY-MM-DD-N)")
    ap.add_argument("--out", type=Path, required=True)
    args = ap.parse_args(argv)
    path = ADDITIONS / f"{args.batch}.json"
    if not path.exists():
        print(f"{args.batch}: no additions file — no PR")
        return 0
    doc = json.loads(path.read_text(encoding="utf-8"))
    summary_path = RUNS / f"{args.batch}.json"
    summary = json.loads(summary_path.read_text(encoding="utf-8")) if summary_path.exists() else {}
    books = json.loads(BOOKS.read_text(encoding="utf-8"))
    sim = evaluate(leaf_pool(books), leaf_users())
    cfg = load_config()
    body = pr_body(summary, doc, books, sim, cfg.auto_merge, graduation(read_rows(AGREEMENT)), cfg.sample_rate,
                   count_candidates(load_docs(ADDITIONS)))
    args.out.write_text(body, encoding="utf-8")
    print(body)
    return 0


if __name__ == "__main__":
    sys.exit(main())
