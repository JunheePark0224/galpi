"""Tag the books the pipeline dropped by itself again, the way the daily run tags today (route plan 10-08, step 5).

Usage (from the checkout):
  PYTHONIOENCODING=utf-8 python -m src.pipeline.redo_drops            → how many books, the estimate; no API call
  PYTHONIOENCODING=utf-8 python -m src.pipeline.redo_drops --write    → REAL API CALLS, then the additions files rewritten
A book is taken when it is `dropped` and no person decided it (not `reviewed`, no `requeued_to`, no history — reroute
already re-decided those with a named slot): before 10-06 the passes were never asked where a book belongs, and until
10-08 two passes naming different slots, or a slot of the other 갈래, could only drop it. Each goes through
run_daily.tag_all from the slot it was found in (two passes, the third on a split, a slot of the other 갈래 requeued),
calls made one by one (the batch mode costs more for a small set — 10-08 route check: its prompt cache missed). Its
record is replaced in its own file — books:import refuses an ISBN in two files — and `history` keeps the old status and
slot. A requeued book gets its requeue.json row. Text from the local YES24 cache (retag.cached_text); a book with none is
skipped and named. Running it again takes nothing (a redone book has history).
"""
import argparse
import json
import sys
from pathlib import Path

from . import ADDITIONS, REQUEUE, VOCAB
from . import requeue
from .candidates import yes24_env
from .config import load_config
from .gold import detail_dirs
from .merge import write_doc
from .prompt import system_prompt
from .retag import cached_text, candidate
from .rules_version import rules_version
from .run_daily import anthropic_key, tag_all

CHANGE = "redo-drops-2026-10-08"
EST_PER_BOOK = 0.036 * 1.2  # 10-07 gold run, direct calls, + third passes and retries
TODAY = "2026-10-08"


def files() -> list[Path]:
    """The library's additions files (a pass-B copy `-ai2` is not one — import-books.ts)."""
    return [p for p in sorted(ADDITIONS.glob("*.json")) if not p.stem.endswith("-ai2")]


def taken(book: dict) -> bool:
    return (book.get("status") == "dropped" and not book.get("reviewed") and not book.get("requeued_to")
            and not book.get("history"))


def replaced(doc: dict, recs: dict[str, dict]) -> tuple[dict, list[dict]]:
    """(the doc with each redone book's record in its place, requeue rows). The given doc is not changed."""
    books, rows = [], []
    for b in doc["books"]:
        rec = recs.get(b["isbn"]) if taken(b) else None
        if rec is None:
            books.append(b)
            continue
        slot_key = "genre" if b["entry"] == "leaf" else "topic"
        books.append({**rec, "history": [{"change": CHANGE, "status": "dropped", slot_key: b.get(slot_key)}]})
        if rec.get("requeued_to"):
            rows.append({"isbn": rec["isbn"], "to_entry": rec["requeued_to"]["entry"], "to_slot": rec["requeued_to"]["slot"],
                         "from_batch": doc.get("batch_id", ""), "date": TODAY})
    return {**doc, "books": books}, rows


def main(argv: list[str] | None = None) -> int:
    ap = argparse.ArgumentParser(description=__doc__.split("\n")[0])
    ap.add_argument("--write", action="store_true", help="tag for real and rewrite the files")
    args = ap.parse_args(argv)
    docs = {p: json.loads(p.read_text(encoding="utf-8")) for p in files()}
    dirs, env = detail_dirs(), yes24_env()
    cands, no_text = [], []
    for doc in docs.values():
        for b in doc["books"]:
            if taken(b):
                intro, toc = cached_text(b["isbn"], dirs, env)
                (cands.append(candidate(b, intro, toc)) if intro else no_text.append(b["isbn"]))
    print(f"{len(cands)} books, no text: {no_text} · about ${round(len(cands) * EST_PER_BOOK, 2)}", flush=True)
    if not args.write:
        return 0
    key = anthropic_key()
    if not key:
        print("ERROR: ANTHROPIC_API_KEY not set", file=sys.stderr)
        return 1
    import anthropic  # the SDK is only needed for a real run
    cfg, vocab = load_config(), json.loads(VOCAB.read_text(encoding="utf-8"))
    prompts = {kind: system_prompt(vocab, kind) for kind in ("tag", "check")}
    t = tag_all(anthropic.Anthropic(api_key=key, max_retries=2, timeout=60), cfg, prompts, vocab, cands, rules_version())
    recs, queued = {r["isbn"]: r for r in t.recs}, []
    for path, doc in docs.items():
        new, rows = replaced(doc, recs)
        if new != doc:
            write_doc(path, new)
            queued += rows
    if queued:
        requeue.save(REQUEUE, requeue.added(requeue.load(REQUEUE), queued))
    status = {s: sum(r["status"] == s for r in t.recs) for s in ("picked", "review", "reserve", "dropped")}
    print(json.dumps({"tagged": len(t.recs), "reasons": dict(t.reasons), "stopped": t.stopped, "status": status,
                      "requeued": len(queued), "third_pass": sum("third" in r for r in t.recs),
                      "cost_usd": round(sum(u.cost(m) for m, u in t.ledger.items()), 4)}, ensure_ascii=False, indent=1))
    return 1 if t.stopped and not t.recs else 0


if __name__ == "__main__":
    raise SystemExit(main())
