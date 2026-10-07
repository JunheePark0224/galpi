"""Does the third-pass majority (tiebreak.py) get the split fields right? Measured on the gold set before the library uses it.

Usage (from the checkout; real API calls, ≈ $0.01 a book with a split):
  PYTHONIOENCODING=utf-8 python -m src.pipeline.tiebreak_gold --labels <gold-v3.1.json> --run <run-….json>
For every gold book of the run's first pass pair with a split field, pass C is asked once; per field it reports how many
splits the majority settled and how many of those match the person's label (`accuracy`), and how many stay with a person.
The result goes next to the run (git-ignored); the library tiebreak is used only when the settled accuracy is >= LINE.
"""
import argparse
import json
import sys
from collections import defaultdict
from datetime import datetime
from pathlib import Path

from . import KST, VOCAB
from .candidates import Candidate
from .prompt import AXES
from .tiebreak import kept_of, own_slot, settle, splits, third

LINE = 0.9


def person(field: str, lab: dict):
    if field == "slot":
        v = lab.get("genre") if lab.get("entry") == "leaf" else lab.get("topic")
        return v if isinstance(v, str) else None
    if field in AXES:
        return (lab.get("axes") or {}).get(field)
    if field == "keywords":
        return sorted(lab["keywords"]) if isinstance(lab.get("keywords"), list) else None
    return lab.get(field) or None


def score(rows: list[dict], labels: dict[str, dict]) -> dict:
    """rows: [{isbn, settled: {field: value|None}}] → per field {splits, settled, right, person} + overall."""
    out = defaultdict(lambda: {"splits": 0, "settled": 0, "right": 0, "to_person": 0})
    for r in rows:
        lab = labels.get(r["isbn"]) or {}
        for f, v in r["settled"].items():
            want = person(f, lab)
            if want is None:
                continue
            t = out[f]
            t["splits"] += 1
            if v is None:
                t["to_person"] += 1
            else:
                t["settled"] += 1
                t["right"] += v == want
    total = {k: sum(t[k] for t in out.values()) for k in ("splits", "settled", "right", "to_person")}
    acc = round(total["right"] / total["settled"], 3) if total["settled"] else None
    return {"fields": dict(out), "total": total, "accuracy": acc, "passes": acc is not None and acc >= LINE}


def main(argv: list[str] | None = None) -> int:
    from .candidates import yes24_env
    from .config import load_config
    from .gold import RUN_DIR, detail_dirs
    from .one_liner import RetryLog  # noqa: F401  (same import path as the runs)
    from .prompt import system_prompt
    from .retag import cached_text
    from .run_daily import anthropic_key
    from .tagger import Breaker

    ap = argparse.ArgumentParser(description="validate the third-pass tiebreak on the gold set")
    ap.add_argument("--labels", type=Path, required=True)
    ap.add_argument("--run", type=Path, required=True)
    ap.add_argument("--max-cost", type=float, default=1.0)
    args = ap.parse_args(argv)
    raw = json.loads(args.labels.read_text(encoding="utf-8"))
    labels = raw.get("labels") or raw
    results = [r for r in json.loads(args.run.read_text(encoding="utf-8"))["results"] if r["run"] == 1]
    todo = [r for r in results if splits(r["record"]) and r["isbn"] in labels]
    key = anthropic_key()
    if not key:
        print("ERROR: ANTHROPIC_API_KEY not set", file=sys.stderr)
        return 1
    import anthropic
    cfg, vocab, dirs, env = load_config(), json.loads(VOCAB.read_text(encoding="utf-8")), detail_dirs(), yes24_env()
    prompts = {k: system_prompt(vocab, k) for k in ("tag", "check")}
    client, breaker, ledger, rows = anthropic.Anthropic(api_key=key, max_retries=2, timeout=90), Breaker(), {}, []
    print(f"gold books with a split field: {len(todo)} of {len(results)} · about ${round(len(todo) * 0.012, 2)}", flush=True)
    for r in todo:
        rec = r["record"]
        intro, toc = cached_text(r["isbn"], dirs, env)
        cand = Candidate(rec["entry"], own_slot(rec), r["isbn"], rec["title"], rec["author"], rec["pages"],
                         rec.get("link") or "", intro, toc)
        c = third(client, cfg, vocab, prompts, cand, breaker, ledger)
        rows.append({"isbn": r["isbn"], "entry": rec["entry"], "splits": splits(rec), "third": kept_of(c),
                     "settled": settle(rec, c)})
        if sum(u.cost(m) for m, u in ledger.items()) > args.max_cost:
            print("cost cap passed — stopping", file=sys.stderr)
            break
    cost = round(sum(u.cost(m) for m, u in ledger.items()), 4)
    result = {"labels": args.labels.name, "run": args.run.name, "cost_usd": cost, **score(rows, labels), "rows": rows}
    out = RUN_DIR / f"tiebreak-{datetime.now(KST).strftime('%Y%m%d-%H%M%S')}.json"
    out.write_text(json.dumps(result, ensure_ascii=False, indent=1) + "\n", encoding="utf-8")
    print(json.dumps({k: result[k] for k in ("cost_usd", "fields", "total", "accuracy", "passes")}, ensure_ascii=False, indent=1))
    print(f"saved: {out}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
