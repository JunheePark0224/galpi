"""Re-route books dropped before 10-08 (plans/2026-10-08-route-pipeline.md): a book both passes said did not belong in
the slot it was found in, while both named the same other slot, was dropped — now it moves there.

Usage (from the checkout):  PYTHONIOENCODING=utf-8 python -m src.pipeline.reroute [--write]
Per additions file, every `dropped` book whose pass A and pass B name the same other slot (checks.moved_to) is decided
again with today's rules (checks.disagreements on its stored answers → checks.decide): its slot becomes the named one
(a 🎯 book also takes the keywords both passes gave there — merge.moved_keywords), `moved_from` keeps where it was found,
and `history` keeps the old status and slot. Books with no named slot, or different ones, stay dropped. No API call —
the stored answers already hold every tag (prompt COMMON: a pass that says "not here" still tags the book).
Running it again changes nothing. Without --write it only prints the tally.
"""
import argparse
import copy
import json
from collections import Counter

from apply_review import FIELD_OF_TOPIC

from .checks import decide, disagreements, moved_to
from .merge import moved_keywords, write_doc
from .run_daily import ADDITIONS

CHANGE = "reroute-2026-10-08"


def _answers(book: dict) -> tuple[dict, dict]:
    second = book.get("second") or {}
    keep = ("fits", "suggest", "suggest_keywords", "keywords", "way")
    a = {k: book.get(k) for k in keep} | {"axes": book.get("axes") or {}}
    b = {k: second.get(k) for k in keep} | {"axes": second.get("axes") or {}}
    return a, b


def reroute(doc: dict, auto_merge: bool) -> tuple[dict, dict]:
    """(a new document, tally of what changed). The given document is not changed."""
    out, tally = copy.deepcopy(doc), Counter()
    for book in out["books"]:
        if book.get("status") != "dropped":
            continue
        a, b = _answers(book)
        new = moved_to(a, b)
        if not new:
            continue
        old_slot = book.get("genre") if book["entry"] == "leaf" else book.get("topic")
        flags = disagreements(book["entry"], a, b)
        status, auto = decide(a, b, flags, book.get("issues") or [], auto_merge)
        history = {"change": CHANGE, "status": "dropped", ("genre" if book["entry"] == "leaf" else "topic"): old_slot}
        if book["entry"] == "leaf":
            book["genre"] = new
        else:
            book |= {"topic": new, "field": FIELD_OF_TOPIC[new], "keywords": moved_keywords(a, b)}
        book |= {"moved_from": old_slot, "flags": flags, "status": status,
                 "history": [*(book.get("history") or []), history]}
        book.pop("auto", None)
        if auto:
            book["auto"] = auto
        tally["moved"] += 1
        tally[status] += 1
    return out, dict(tally)


def main(argv: list[str] | None = None) -> int:
    ap = argparse.ArgumentParser(description=__doc__.split("\n")[0])
    ap.add_argument("--write", action="store_true", help="write the re-routed files (default: print the tally only)")
    args = ap.parse_args(argv)
    total = Counter()
    for path in sorted(ADDITIONS.glob("*.json")):
        doc = json.loads(path.read_text(encoding="utf-8"))
        new, tally = reroute(doc, auto_merge=False)
        if tally:
            print(f"{path.name}: {tally}")
            total.update(tally)
            if args.write:
                write_doc(path, new)
    print(f"total: {dict(total)}" + ("" if args.write else "  (dry run — add --write)"))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
