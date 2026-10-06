"""retag_library's --tiebreak, --page and --apply (the run itself is retag_library.run).

--tiebreak: pass C (tiebreak.py) for every tagged book with a split a majority may settle → retag/library-v3-tiebreak.json,
  saved after every book, resumable, capped at TIEBREAK_MAX in all (the user's $2 tiebreak budget less the gold validation).
--page: library_review's decisions → the main checkout's data/processed/check/pipeline/library-v3.html (git-ignored: YES24
  intro/TOC), and the counts, per-field change shares and the change table printed.
--apply <download>: library_apply.apply → books_v1.json and the additions files (only files that change are written); a
  dropped books_v1 book goes to retag/removed.json. Then the person runs `cd web && npm run books:import`.
"""
import json
import re
import sys
from collections import Counter
from pathlib import Path

from . import ADDITIONS, VOCAB
from .candidates import Candidate
from .config import Config
from .prompt import system_prompt
from .tagger import Breaker, TaggerStop

TIEBREAK_MAX = 1.7
PER_THIRD = 0.012  # USD a pass-C call (gold validation: $0.27 for 19 books)


def _read(path: Path, default=None):
    return json.loads(path.read_text(encoding="utf-8")) if path.exists() else default


def _cost(ledger: dict) -> float:
    return sum(u.cost(m) for m, u in ledger.items())


def run_tiebreak(doc: dict, tb: dict, cfg: Config, client, vocab: dict, text_of, max_cost: float,
                 save) -> tuple[dict, dict]:
    """(tiebreak doc, summary): pass C for every tagged book that needs one and has no row yet."""
    from .tiebreak import SETTLES, kept_of, needs_third, settle, splits, third
    prompts = {kind: system_prompt(vocab, kind) for kind in ("tag", "check")}
    prior, ledger, breaker, stopped, asked = float(tb.get("cost_usd") or 0), {}, Breaker(), None, 0
    for b in doc["books"]:
        rec = b["record"]
        if b["isbn"] in tb["books"] or not needs_third(rec):
            continue
        if prior + _cost(ledger) > max_cost:
            stopped = f"cost cap ${max_cost} passed (${prior + _cost(ledger):.2f})"
            break
        intro, toc = text_of(b["isbn"])
        cand = Candidate(b["entry"], b["slot"], b["isbn"], rec["title"], rec["author"], rec["pages"],
                         rec.get("link") or "", intro, toc)
        try:
            c = third(client, cfg, vocab, prompts, cand, breaker, ledger)
        except TaggerStop as err:
            stopped = str(err)
            break
        row = {"splits": splits(rec), "third": kept_of(c), "settled": settle(rec, c, SETTLES)}
        tb = {**tb, "books": {**tb["books"], b["isbn"]: row}, "cost_usd": round(prior + _cost(ledger), 4)}
        asked += 1
        save(tb)
    tb = {**tb, "cost_usd": round(prior + _cost(ledger), 4)}
    save(tb)
    return tb, {"asked": asked, "stopped": stopped, "cost_usd": round(_cost(ledger), 4), "total_usd": tb["cost_usd"]}


def cmd_tiebreak(out: Path, tb_path: Path, max_cost: float | None, write) -> int:
    from .config import load_config
    from .candidates import yes24_env
    from .gold import detail_dirs
    from .retag import cached_text
    from .run_daily import anthropic_key
    from .tiebreak import needs_third

    doc = _read(out)
    tb = _read(tb_path, {"note": "pass C (tiebreak.py) per book: values and signal lines only", "cost_usd": 0.0, "books": {}})
    todo = sum(needs_third(b["record"]) and b["isbn"] not in tb["books"] for b in doc["books"])
    cap = TIEBREAK_MAX if max_cost is None else max_cost
    print(f"tiebreak: {todo} books need a third pass · about ${round(todo * PER_THIRD, 2)} "
          f"(spent ${tb['cost_usd']}, stops past ${cap} in all)", flush=True)
    if not todo:
        return 0
    key = anthropic_key()
    if not key:
        print("ERROR: ANTHROPIC_API_KEY not set", file=sys.stderr)
        return 1
    import anthropic
    dirs, env = detail_dirs(), yes24_env()
    tb, summary = run_tiebreak(doc, tb, load_config(), anthropic.Anthropic(api_key=key, max_retries=2, timeout=90),
                               json.loads(VOCAB.read_text(encoding="utf-8")), lambda i: cached_text(i, dirs, env), cap,
                               lambda d: write(d, tb_path))
    print(json.dumps(summary, ensure_ascii=False))
    return 0 if not summary["stopped"] else 1


def review_state(out: Path, tb_path: Path) -> tuple[dict, dict, dict]:
    from .library_review import groups
    doc, tb = _read(out), _read(tb_path, {"books": {}})
    return doc, tb, groups(doc["books"], tb["books"])


def page_entries(doc: dict, tb: dict, decided: dict, text_of) -> list[dict]:
    from build_check_page import short_intro
    entries = []
    for b in doc["books"]:
        d = decided[b["isbn"]]
        if d["group"] == "auto":
            continue
        rec, (intro, toc) = b["record"], text_of(b["isbn"])
        entries.append({k: b[k] for k in ("isbn", "entry", "slot", "title", "source", "current")}
                       | {k: d[k] for k in ("group", "asks", "settled", "line_issues", "changes", "auto")}
                       | {"author": rec["author"], "pages": rec["pages"], "link": rec.get("link") or "",
                          "a": {k: v for k, v in rec.items() if k != "second"}, "b": rec["second"],
                          "c": (tb["books"].get(b["isbn"]) or {}).get("third"),
                          "intro": short_intro(intro, 300), "intro_full": intro, "toc": toc[:1500]})
    return sorted(entries, key=lambda e: (e["group"] != "person", e["entry"], e["slot"], e["title"]))


def render(entries: list[dict], table: list[dict], n: dict, titles: dict, vocab: dict) -> str:
    from build_check_page import js_json
    from build_d4_review import AXIS_LABELS, WAY_LABELS
    from build_pilot_review import keyword_definitions

    from .gaps import GENRES
    from .library_page import TEMPLATE
    slots = {"__BOOKS__": js_json(entries), "__KW__": js_json({t: list(v.get("kept", {})) for t, v in vocab.items()}),
             "__GENRES__": js_json(list(GENRES)), "__DEFS__": js_json(keyword_definitions()),
             "__AXES__": js_json(AXIS_LABELS), "__WAYS__": js_json(WAY_LABELS), "__KEY__": js_json("galpi-library-v3"),
             "__NAME__": js_json("library-v3"), "__TABLE__": js_json(table), "__COUNTS__": js_json(n),
             "__TITLES__": js_json(titles)}
    return re.sub("|".join(slots), lambda m: slots[m.group(0)], TEMPLATE)


def cmd_page(out: Path, tb_path: Path) -> int:
    from .gold import detail_dirs, page_text
    from .library_review import change_table, counts, field_shares
    from .review import PAGES

    doc, tb, decided = review_state(out, tb_path)
    vocab, dirs = json.loads(VOCAB.read_text(encoding="utf-8")), detail_dirs()
    entries = page_entries(doc, tb, decided, lambda i: page_text(i, dirs))
    table = change_table(doc["books"], decided)
    n = counts(decided) | {"skipped": len(doc.get("skipped_no_text") or []) + len(doc.get("failed") or {})}
    page = PAGES / "library-v3.html"
    page.parent.mkdir(parents=True, exist_ok=True)
    page.write_text(render(entries, table, n, {b["isbn"]: b["title"] for b in doc["books"]}, vocab), encoding="utf-8")
    print(json.dumps({"counts": n, "asks": dict(Counter(a for d in decided.values() for a in d["asks"])),
                      "field_shares": field_shares(doc["books"], decided),
                      "table": [{k: r[k] for k in ("field", "change", "count")} for r in table]}, ensure_ascii=False, indent=1))
    print(f"saved: {page} · {len(entries)} books on the page")
    return 0


def cmd_apply(out: Path, tb_path: Path, removed_path: Path, download: Path, write) -> int:
    from apply_review import ReviewError, unwrap

    from .library import V1, library_files
    from .library_apply import apply

    doc, _, decided = review_state(out, tb_path)
    answers = unwrap(_read(download))
    vocab = json.loads(VOCAB.read_text(encoding="utf-8"))
    paths = {p.name: p for p in library_files(ADDITIONS)}
    docs, v1 = {name: _read(p) for name, p in paths.items()}, _read(V1)
    try:
        v1_new, docs_new, removed, tally = apply(doc["books"], decided, answers,
                                                 {t: v.get("kept", {}) for t, v in vocab.items()}, v1, docs)
    except ReviewError as err:
        print(f"ERROR: {err}", file=sys.stderr)
        return 1
    if v1_new != v1:
        write(v1_new, V1)
    for name, new in docs_new.items():
        if new != docs[name]:
            write(new, paths[name])
    if removed:
        old = _read(removed_path, [])
        write([*old, *(r for r in removed if r["isbn"] not in {o["isbn"] for o in old})], removed_path)
    print(json.dumps(tally, ensure_ascii=False))
    print("next: cd web && npm run books:import && npm test, then commit books_v1.json, the additions files and web/src/data/")
    return 0
