"""Local review page for a day's additions (or a weekly sample) and applying its download (design 2-3).

Usage (from the checkout, on the day's PR branch):
  PYTHONIOENCODING=utf-8 python -m src.pipeline.review 2026-10-05 [--no-sample]     → page
  PYTHONIOENCODING=utf-8 python -m src.pipeline.review 2026-10-05 --apply <download.json>
  (a later batch of the same day: its id, e.g. `review 2026-10-06-2` — pipeline/batch.py; its agreement row has that id
  in the `date` column)
  PYTHONIOENCODING=utf-8 python -m src.pipeline.review --sample 2026-W42 [--apply <download.json>]
  then: cd web && npm run books:import   (and commit to the PR branch)
Shown: books a person must look at — the two passes disagreed or pass A was unsure (flags), or a rule check held the book
(issues) — or every book of a weekly sample. Books the passes agreed on are auto-accepted and counted apart. During the
trial a fixed `sample_rate` share of them (sample.trial_sample, seeded by the batch id) is shown too ("표본") BY DEFAULT, so
the agreement figures also say how often an agreed book was still wrong; `--no-sample` turns that off. The page shows YES24
intro/TOC from the local cache (fetched with the local .env key when missing), so it is written under data/processed/check/
(git-ignored) and never committed — always the MAIN checkout's data/processed/check/pipeline/, also when the command runs
inside a worktree (.worktrees/<name>), so the user finds every page in one place (10-05). `--apply` takes a download path
from anywhere. Applying the same download again changes nothing (any book of the day may be answered).
"""
import argparse
import json
import re
import subprocess
import sys
from collections import Counter
from pathlib import Path

from apply_review import ReviewError, unwrap
from build_check_page import OUT_DIR, js_json, short_intro
from build_d4_review import AXIS_LABELS, WAY_LABELS
from build_pilot_review import keyword_definitions, yes24_text
from collect_candidates import detail

from . import ADDITIONS, AGREEMENT, VOCAB
from .agreement import apply_answers, screened, stats_row
from .agreement_log import MAX_SAMPLE_CHANGED, MIN_SAMPLE, STREAK, below, graduation, read_rows, upsert, write_rows
from .candidates import yes24_env
from .config import load_config
from .gaps import GENRE_TARGET
from .keyword_candidates import excluded_names
from .review_page import TEMPLATE
from .sample import daily_docs, sample_books, trial_sample



def main_checkout(root: Path = OUT_DIR.parents[2], git=subprocess.run) -> Path:
    """The main checkout's root: the parent of `git rev-parse --git-common-dir` (in a worktree that is the main repo's .git;
    in the main checkout, its own .git). `root` itself when git is missing or fails."""
    try:
        res = git(["git", "-C", str(root), "rev-parse", "--git-common-dir"], capture_output=True, text=True, timeout=10)
    except (OSError, subprocess.SubprocessError):
        return root
    common = (res.stdout or "").strip()
    if res.returncode != 0 or not common:
        return root
    path = Path(common)
    return (path if path.is_absolute() else root / path).resolve().parent


PAGES = main_checkout() / OUT_DIR.relative_to(OUT_DIR.parents[2]) / "pipeline"
KEEP = ("isbn", "title", "author", "pages", "link", "entry", "topic", "keywords", "way", "genre", "axes", "one_liner",
        "evidence", "confidence", "fits", "second", "flags", "issues", "status", "keyword_candidate")


def needs_look(b: dict) -> bool:
    return b["status"] != "dropped" and bool(b.get("flags") or b.get("issues")) and not b.get("reviewed")


def text_of(isbn: str, env: dict) -> tuple[str, str]:
    """(intro, TOC) from the local YES24 cache; fetched with the local key first when the cache has nothing."""
    intro, toc = yes24_text(isbn)
    if not intro and env.get("YES24_API_KEY"):
        detail(env, isbn)
        intro, toc = yes24_text(isbn)
    return intro, toc


def entry_of(b: dict, file: str, env: dict, sample: bool = False) -> dict:
    intro, toc = text_of(b["isbn"], env)
    return {k: b.get(k) for k in KEEP} | {"file": file, "sample": sample, "intro": short_intro(intro, 300),
                                          "intro_full": intro, "toc": toc[:1500]}


def render(entries: list[dict], vocab: dict, key: str) -> str:
    slots = {"__BOOKS__": js_json(entries), "__KW__": js_json({t: list(v.get("kept", {})) for t, v in vocab.items()}),
             "__GENRES__": js_json(list(GENRE_TARGET)), "__DEFS__": js_json(keyword_definitions()),
             "__AXES__": js_json(AXIS_LABELS), "__WAYS__": js_json(WAY_LABELS),
             "__KEY__": js_json(f"galpi-pipeline-{key}"), "__NAME__": js_json(key)}
    return re.sub("|".join(slots), lambda m: slots[m.group(0)], TEMPLATE)


def chosen(date: str | None, week: str | None, rate: float = 0.0,
           everything: bool = False) -> list[tuple[Path, dict, list[str]]]:
    """(file, doc, ISBNs) for a day (the books to look at + a `rate` share of its agreed books) or a weekly sample.
    `everything` (for --apply): every book of those files, so a download can be applied again."""
    if week:
        picks = sample_books(daily_docs(), week, load_config().sample_rate)
        docs = {p: json.loads(p.read_text(encoding="utf-8")) for p in {p for p, _ in picks}}
        return [(p, docs[p], [b["isbn"] for b in docs[p]["books"]] if everything else [b["isbn"] for q, b in picks if q == p])
                for p in sorted(docs)]
    path = ADDITIONS / f"{date}.json"
    doc = json.loads(path.read_text(encoding="utf-8"))
    isbns = ([b["isbn"] for b in doc["books"]] if everything
             else [b["isbn"] for b in doc["books"] if needs_look(b)] + trial_sample(doc, rate))
    return [(path, doc, isbns)]


def build_page(name: str, picked: list[tuple[Path, dict, list[str]]], vocab: dict) -> Path:
    env = yes24_env()
    entries = [entry_of(b, p.name, env, sample=not needs_look(b)) for p, doc, isbns in picked
               for b in doc["books"] if b["isbn"] in isbns]
    out = PAGES / f"{name}.html"
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text(render(entries, vocab, name), encoding="utf-8")
    sampled = sum(e["sample"] for e in entries)
    print(f"saved: {out} · {len(entries)} books to look at ({sampled} of them sample)"
          + ("" if env.get("YES24_API_KEY") else " (no YES24 key: intro/TOC only where cached)"))
    return out


def apply(name: str, batch: str, picked: list[tuple[Path, dict, list[str]]], download: Path,
          vocab: dict) -> tuple[dict, Counter, dict[str, list[str]]]:
    """Writes the answers into the additions files and the day's row into agreement.csv. Returns (row, tally, refused).
    The row covers every reviewed book of the day's file (a daily batch) or just the books answered now (a weekly sample),
    so applying in two sittings, or the same download again, gives the same row. A pick whose one-liner breaks the rules is
    refused (the book stays as it was; the rest of the download is still applied)."""
    answers = unwrap(json.loads(download.read_text(encoding="utf-8")))
    if not answers:
        raise ReviewError("no confirmed answers in the download")
    allowed = {i for _, _, isbns in picked for i in isbns}
    stray = sorted(set(answers) - allowed)
    if stray:
        raise ReviewError(f"answers for books not on this page: {stray[:5]}")
    kept = {t: v.get("kept", {}) for t, v in vocab.items()}
    left_out = {t: excluded_names(v) for t, v in vocab.items()}
    total, refused = Counter(), {}
    for path, doc, isbns in picked:
        ok, bad = screened({b["isbn"]: b for b in doc["books"]}, {i: a for i, a in answers.items() if i in isbns})
        refused |= bad
        new_doc, tally = apply_answers(doc, ok, kept, None if batch == "daily" else set(ok), left_out)
        path.write_text(json.dumps(new_doc, ensure_ascii=False, indent=1) + "\n", encoding="utf-8", newline="")
        total += tally
    if batch != "daily":
        total["auto_agreed"] = 0  # a sample row counts only what the person looked at
    row = stats_row(name, batch, total)
    write_rows(AGREEMENT, upsert(read_rows(AGREEMENT), row))
    return row, total, refused


def main(argv: list[str] | None = None) -> int:
    ap = argparse.ArgumentParser(description="review page for the daily pipeline")
    ap.add_argument("date", nargs="?")
    ap.add_argument("--sample", metavar="WEEK", help="weekly sample of the given ISO week instead of a day")
    ap.add_argument("--apply", type=Path, metavar="DOWNLOAD")
    ap.add_argument("--no-sample", action="store_true", help="do not add the trial sample of AI-agreed books to a day's page")
    args = ap.parse_args(argv)
    if bool(args.date) == bool(args.sample):
        ap.error("give a date or --sample WEEK")
    vocab = json.loads(VOCAB.read_text(encoding="utf-8"))
    name, batch = (args.sample, f"sample-{args.sample}") if args.sample else (args.date, "daily")
    rate = 0.0 if args.no_sample else load_config().sample_rate
    try:
        picked = chosen(args.date, args.sample, rate, everything=bool(args.apply))
    except FileNotFoundError:
        print(f"ERROR: no additions file for {name}", file=sys.stderr)
        return 1
    if not args.apply:
        build_page(name, picked, vocab)
        return 0
    try:
        row, tally, refused = apply(name, batch, picked, args.apply, vocab)
    except ReviewError as err:
        print(f"ERROR: {err}", file=sys.stderr)
        return 1
    print("agreement (human-reviewed only): " + ", ".join(f"{k} {v}" for k, v in row.items() if k not in ("date", "batch")))
    for isbn, problems in refused.items():
        print(f"REFUSED {isbn}: not picked, the one-liner must be fixed first — {', '.join(problems)}")
    if tally["sample_n"]:
        print(f"of the AI-agreed books a person looked at: {tally['sample_n']}, changed {tally['sample_changed']}")
    if args.sample and below(row):
        print(f"⚠ below 90%: {', '.join(below(row))} — suggest setting auto_merge back to false (design 2-3)")
    grad = graduation(read_rows(AGREEMENT))
    print(f"graduation: streak {grad['streak']}/{STREAK} (every field >= 95% on the books a person looked at) · agreed books looked at "
          f"over the last {STREAK} reviews: {grad['sample_n']} (need >= {MIN_SAMPLE}), changed {grad['sample_changed']} "
          f"(need <= {MAX_SAMPLE_CHANGED:.0f}%)")
    if grad["graduated"] and not load_config().auto_merge:
        print("GRADUATED on both counts: ask the user before auto_merge true")
    print("next: cd web && npm run books:import, then commit the additions file, agreement.csv and web/src/data/ (books.json, vocab.json, library.json)")
    return 0


if __name__ == "__main__":
    sys.exit(main())
