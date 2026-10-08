"""Re-route books dropped before 10-08 (plans/2026-10-08-route-pipeline.md): a book both passes said did not belong in
the slot it was found in, while both named the same other slot, was dropped — now it moves there.

Usage (from the checkout):  PYTHONIOENCODING=utf-8 python -m src.pipeline.reroute [--write]
Per additions file, every `dropped` book whose pass A and pass B name the same other slot (checks.moved_to) is decided
again with today's rules (checks.disagreements on its stored answers → checks.decide): its slot becomes the named one
(a 🎯 book also takes the keywords both passes gave there — merge.moved_keywords), `moved_from` keeps where it was found,
and `history` keeps the old status and slot. Its one-liner is checked against today's rules (agreement.line_problems) —
one that breaks them holds the book (reserve) for a person. Books with no named slot, or different ones, stay dropped. No API call —
the stored answers already hold every tag (prompt COMMON: a pass that says "not here" still tags the book).
Running it again changes nothing. Without --write it only prints the tally.
"""
import argparse
import copy
import json
from collections import Counter
from pathlib import Path

from apply_review import FIELD_OF_TOPIC

from . import requeue
from .agreement import line_problems
from .checks import decide, disagreements, moved_to, needs_person
from .merge import moved_keywords, write_doc
from .run_daily import ADDITIONS, REQUEUE

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
        if book.get("status") != "dropped" or book.get("requeued_to") or _seen(book, "reroute-check"):
            continue                                   # a person already decided it (sent to the other entry, or dropped)
        a, b = _answers(book)
        new = moved_to(a, b)
        if not new:
            continue
        old_slot = book.get("genre") if book["entry"] == "leaf" else book.get("topic")
        flags = disagreements(book["entry"], a, b)
        # the one-liner against today's rules (10-08: books dropped before the question rule were never checked by it); a
        # line blanked for copying the YES24 text keeps that issue only
        line = book.get("one_liner") or ""
        issues = [*(book.get("issues") or []), *(p for p in (line_problems(book, line) if line else [])
                                                 if p not in (book.get("issues") or []))]
        status, auto = decide(a, b, flags, issues, auto_merge)
        history = {"change": CHANGE, "status": "dropped", ("genre" if book["entry"] == "leaf" else "topic"): old_slot}
        if book["entry"] == "leaf":
            book["genre"] = new
        else:
            book |= {"topic": new, "field": FIELD_OF_TOPIC[new], "keywords": moved_keywords(a, b)}
        book |= {"moved_from": old_slot, "flags": flags, "issues": issues, "status": status,
                 "history": [*(book.get("history") or []), history]}
        book.pop("auto", None)
        if auto:
            book["auto"] = auto
        tally["moved"] += 1
        tally[status] += 1
    return out, dict(tally)


def _seen(book: dict, change: str) -> bool:
    return any(h.get("change", "").startswith(change) for h in book.get("history") or [])


LINE_ISSUES = ("질문형", "요약형", "한 줄", "짧음", "김(", "과장", "제목 반복")  # what a new one-liner answers


def _line_free(issues: list[str]) -> list[str]:
    return [i for i in issues if not i.startswith(LINE_ISSUES)]


def apply_check(doc: dict, wrong: dict, lines: dict, today: str) -> tuple[dict, list[dict], dict]:
    """(a new document, requeue rows, tally) after a person's check of the re-routed books (10-08):
    `wrong` {isbn: {"to": slot | "🎯topic" | "drop"}} — a slot keeps (or puts) the book there, the person's word
    over the two passes ("reviewed", no auto mark); "🎯topic" sends it to the other entry (requeue.json, tagged there next
    run); `lines` {isbn: one-liner} — an approved line replaces the stored one (old kept in history) and the line's
    issues are checked again. Books not named stay as reroute left them."""
    out, rows, tally = copy.deepcopy(doc), [], Counter()
    for book in out["books"]:
        isbn, line = book["isbn"], lines.get(book["isbn"])
        if line is not None and line != book.get("one_liner"):
            old = book.get("one_liner") or ""
            issues = _line_free(book.get("issues") or [])
            issues += [p for p in line_problems(book, line) if p not in issues]
            book |= {"one_liner": line, "issues": issues,
                     "history": [*(book.get("history") or []), {"change": "reroute-lines-2026-10-08", "one_liner": old}]}
            a, b = _answers(book)
            if book.get("status") != "dropped":
                status, auto = decide(a, b, book.get("flags") or [], issues, auto_merge=False)
                book["status"] = status
                book.pop("auto", None)
                if auto:
                    book["auto"] = auto
            tally["lines"] += 1
        to = (wrong.get(isbn) or {}).get("to")
        if not to or _seen(book, "reroute-check"):
            continue
        slot_key = "genre" if book["entry"] == "leaf" else "topic"
        history = {"change": "reroute-check-2026-10-08", "status": book.get("status"), slot_key: book.get(slot_key)}
        book["history"] = [*(book.get("history") or []), history]
        book.pop("auto", None)
        if to.startswith("🎯") or to == "drop":
            book["status"] = "dropped"
            if to.startswith("🎯"):
                topic = to[1:]
                book["requeued_to"] = {"entry": "target", "slot": topic}
                rows.append({"isbn": isbn, "to_entry": "target", "to_slot": topic,
                             "from_batch": out.get("batch_id", ""), "date": today})
                tally["requeued"] += 1
            else:
                tally["dropped"] += 1
            continue
        if book["entry"] == "leaf":
            book["genre"] = to
        if to == book.get("moved_from"):
            book.pop("moved_from")
        flags = [f for f in book.get("flags") or [] if f != "fits"]  # the person settled the slot
        _, issues = needs_person([], book.get("issues") or [])
        book |= {"flags": flags, "status": "reserve" if issues else "review" if flags else "picked", "reviewed": True}
        tally["kept"] += 1
    return out, rows, dict(tally)


def main(argv: list[str] | None = None) -> int:
    ap = argparse.ArgumentParser(description=__doc__.split("\n")[0])
    ap.add_argument("--check", type=Path, help="the check page's download (reroute-check-*.json): {wrong: {isbn: {to}}}")
    ap.add_argument("--lines", type=Path, help="approved one-liners ({answers: {isbn: {one_liner}}})")
    ap.add_argument("--today", default="2026-10-08")
    ap.add_argument("--write", action="store_true", help="write the files (default: print the tally only)")
    args = ap.parse_args(argv)
    wrong = json.loads(args.check.read_text(encoding="utf-8"))["wrong"] if args.check else {}
    lines = ({i: a["one_liner"] for i, a in json.loads(args.lines.read_text(encoding="utf-8"))["answers"].items()}
             if args.lines else {})
    total, queued = Counter(), []
    for path in sorted(ADDITIONS.glob("*.json")):
        doc = json.loads(path.read_text(encoding="utf-8"))
        new, tally = reroute(doc, auto_merge=False)
        new, rows, done = apply_check(new, wrong, lines, args.today)
        tally = Counter(tally) + Counter(done)
        if new != doc:
            print(f"{path.name}: {dict(tally)}")
            total.update(tally)
            queued += rows
            if args.write:
                write_doc(path, new)
    if queued and args.write:
        requeue.save(REQUEUE, requeue.added(requeue.load(REQUEUE), queued))
    print(f"total: {dict(total)}; requeue +{len(queued)}" + ("" if args.write else "  (dry run — add --write)"))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
