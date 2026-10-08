"""Validation of the route pipeline (plans/2026-10-08-route-pipeline.md, step 4) before more books go through it.

Usage (from the checkout):
  PYTHONIOENCODING=utf-8 python -m src.pipeline.route_check                → the cases and the estimate, no API call
  PYTHONIOENCODING=utf-8 python -m src.pipeline.route_check --run          → REAL API CALLS through the Message Batches API
The gold set (data/pipeline/gold/gold-set.json) with a person's labels (gold-v3.1.json, git-ignored) is tagged as the daily
run tags (run_daily.tag_all: two passes, the third on a split, a slot of the other 갈래 requeued): each book in the slot it
was found in ("own"), and WRONG of them again in a slot a person did not give — CROSSING of those in the other 갈래.
A case is right when the book ends where the person put it (a 🍃 book with no genre: anywhere in 🎯; "서재에 넣지 않음":
dropped); a slot left to a person is counted apart. Passes when the decided cases are LINE right. The tags of the own
cases are scored like gold.calibrate (gold_score) next to an earlier gold run. Our tags only in the saved run.
"""
import argparse
import json
import random
import sys
import time
from datetime import datetime
from pathlib import Path

from apply_review import FIELD_OF_TOPIC

from . import KST, VOCAB, gold_score
from .batched import DISCOUNT
from .candidates import Candidate, yes24_env
from .config import load_config
from .gaps import GENRES
from .gold import GOLD_SET, RUN_DIR, detail_dirs, load_pool
from .prompt import system_prompt
from .retag import cached_text
from .rules_version import rules_version
from .run_daily import anthropic_key, tag_all
from .tiebreak import own_slot

SEED = 20261008
WRONG, CROSSING = 20, 6
LINE = 0.95
OUT = ("서재에 넣지 않음",)  # a 🎯 label that keeps the book out of the library
LABELS = RUN_DIR / "gold-v3.1.json"
BASELINE = RUN_DIR / "run-20261007-152829.json"  # the last gold run (v3.2, two passes, no routing)
EST_PER_CASE = 0.036 * DISCOUNT * 1.25  # 10-07 gold run $1.44 / 40 books, batch price, + third passes and retries


def expected(label: dict) -> tuple[str, str]:
    """(entry, slot) where the person put the book: ("target", "*") a 🍃 book with no genre, ("drop", "") one kept out."""
    if label["entry"] == "leaf":
        return ("leaf", label["genre"]) if label.get("genre") else ("target", "*")
    topic = label.get("topic") or ""
    return ("drop", "") if not topic or topic in OUT else ("target", topic)


def ended(rec: dict) -> tuple[str, str]:
    """(entry, slot) where the run left the book: its slot, the requeued slot, ("drop", ""), or ("person", "") when the
    slot waits for a person."""
    if rec.get("requeued_to"):
        return rec["requeued_to"]["entry"], rec["requeued_to"]["slot"]
    if rec["status"] == "dropped":
        return "drop", ""
    if "fits" in (rec.get("flags") or []):
        return "person", ""
    return rec["entry"], own_slot(rec)


def cases(rows: list[dict], labels: dict[str, dict], wrong: int = WRONG, crossing: int = CROSSING,
          seed: int = SEED) -> list[dict]:
    """Every labelled book in the slot it was found in, then `wrong` of those with a real slot in a wrong one (the first
    `crossing` in the other 갈래); a wrong case's isbn ends in "-w"."""
    own = [{"isbn": r["isbn"], "title": r["title"], "entry": r["entry"], "slot": r["slot"], "kind": "own",
            "expect": expected(labels[r["isbn"]])} for r in rows if r["isbn"] in labels]
    rng = random.Random(seed)
    pool = [c for c in own if c["expect"][0] in ("leaf", "target") and c["expect"][1] != "*"]
    out = []
    for i, c in enumerate(rng.sample(pool, min(wrong, len(pool)))):
        crosses = i < crossing
        entry = ("target" if c["expect"][0] == "leaf" else "leaf") if crosses else c["expect"][0]
        slots = [s for s in (GENRES if entry == "leaf" else FIELD_OF_TOPIC) if s not in (c["expect"][1], c["slot"])]
        out.append({**c, "isbn": f"{c['isbn']}-w", "entry": entry, "slot": rng.choice(sorted(slots)),
                    "kind": "crossing" if crosses else "same"})
    return own + out


def _right(expect: tuple[str, str], end: tuple[str, str]) -> bool:
    return end == expect or (expect[1] == "*" and end[0] == expect[0])


def _tally(rows: list[tuple[dict, tuple[str, str]]]) -> dict:
    right = sum(_right(c["expect"], e) for c, e in rows)
    person = sum(e[0] == "person" for _, e in rows)
    decided = len(rows) - person
    return {"cases": len(rows), "decided": decided, "right": right, "person": person,
            "accuracy": round(right / decided, 3) if decided else None}


def score(all_cases: list[dict], ends: dict[str, tuple[str, str]]) -> dict:
    """Right / decided / left to a person, in all and per kind (own, same, crossing); `wrong` lists the misses."""
    rows = [(c, tuple(ends[c["isbn"]])) for c in all_cases if c["isbn"] in ends]
    kinds = {k: _tally([r for r in rows if r[0]["kind"] == k]) for k in ("own", "same", "crossing")}
    total = _tally(rows)
    misses = [{"isbn": c["isbn"], "title": c.get("title", ""), "kind": c["kind"], "found_in": c.get("slot", ""),
               "expect": list(c["expect"]), "ended": list(e)}
              for c, e in rows if e[0] != "person" and not _right(c["expect"], e)]
    return {"all": total, "by_kind": kinds, "wrong": misses,
            "passes": total["accuracy"] is not None and total["accuracy"] >= LINE}


def _candidates(all_cases: list[dict], books: dict, text_of) -> tuple[list[Candidate], list[str]]:
    out, skipped = [], []
    for c in all_cases:
        real = c["isbn"].removesuffix("-w")
        intro, toc = text_of(real)
        if not intro:
            skipped.append(c["isbn"])
            continue
        b = books.get(real, {})
        out.append(Candidate(c["entry"], c["slot"], c["isbn"], c["title"], b.get("author") or "?", b.get("pages") or 1,
                             b.get("link") or "", intro, toc))
    return out, skipped


def _read(path: Path):
    return json.loads(path.read_text(encoding="utf-8"))


def _fields(scored: dict) -> dict:
    return {f: {w: f"{k}/{n}" for w, (k, n) in pair.items()} for f, pair in scored["fields"].items()}


def _waiting(seconds: float) -> None:
    print(".", end="", flush=True)
    time.sleep(seconds)


def main(argv: list[str] | None = None) -> int:
    ap = argparse.ArgumentParser(description=__doc__.split("\n")[0])
    ap.add_argument("--run", action="store_true", help="tag for real (Message Batches API)")
    ap.add_argument("--labels", type=Path, default=LABELS)
    ap.add_argument("--baseline", type=Path, default=BASELINE)
    args = ap.parse_args(argv)
    rows = _read(GOLD_SET)["books"]
    labels = gold_score.check_labels(rows, _read(args.labels))
    all_cases = cases(rows, labels)
    dirs, env = detail_dirs(), yes24_env()
    cands, skipped = _candidates(all_cases, load_pool(), lambda isbn: cached_text(isbn, dirs, env))
    kinds = {k: sum(c["kind"] == k for c in all_cases) for k in ("own", "same", "crossing")}
    print(f"{len(cands)} cases {kinds}, no text: {skipped} · about ${round(len(cands) * EST_PER_CASE, 2)}", flush=True)
    if not args.run:
        return 0
    key = anthropic_key()
    if not key:
        print("ERROR: ANTHROPIC_API_KEY not set", file=sys.stderr)
        return 1
    import anthropic  # the SDK is only needed for a real run
    cfg, vocab, started = load_config(), _read(VOCAB), time.time()
    prompts = {kind: system_prompt(vocab, kind) for kind in ("tag", "check")}
    t = tag_all(anthropic.Anthropic(api_key=key, max_retries=2, timeout=60), cfg, prompts, vocab, cands,
                rules_version(), batches=True, sleep=_waiting)
    ends = {r["isbn"]: ended(r) for r in t.recs}
    routed = score(all_cases, ends)
    own = [{"run": 1, "isbn": r["isbn"], "record": r} for r in t.recs if not r["isbn"].endswith("-w")]
    tags = _fields(gold_score.score(rows, labels, own))
    base = _fields(gold_score.score(rows, labels, _read(args.baseline)["results"])) if args.baseline.exists() else {}
    doc = {"made": datetime.now(KST).isoformat(timespec="seconds"), "rules_version": rules_version(),
           "cost_usd": round(sum(u.cost(m) for m, u in t.ledger.items()) * DISCOUNT, 4),
           "minutes": round((time.time() - started) / 60, 1), "batches": t.sent, "stopped": t.stopped,
           "reasons": dict(t.reasons), "route": routed, "tags": tags, "tags_baseline": base,
           "results": [{"isbn": r["isbn"], "ended": list(ends[r["isbn"]]), "record": r} for r in t.recs]}
    RUN_DIR.mkdir(parents=True, exist_ok=True)
    out = RUN_DIR / f"route-{datetime.now(KST).strftime('%Y%m%d-%H%M%S')}.json"
    out.write_text(json.dumps(doc, ensure_ascii=False, indent=1) + "\n", encoding="utf-8")
    print()
    print(json.dumps({k: doc[k] for k in ("cost_usd", "minutes", "batches", "stopped", "reasons", "route", "tags",
                                          "tags_baseline")}, ensure_ascii=False, indent=1))
    print(f"saved: {out}")
    return 0 if routed["passes"] else 2


if __name__ == "__main__":
    raise SystemExit(main())
