"""What the v3 re-tag decides on its own and what it leaves to a person (user 10-06 evening).

Per book (an entry of retag/library-v3.json + its tiebreak row, tiebreak.py):
  asks — a person decides: a field pass A and B split on that the third-pass majority did not settle (keyword splits are
         never settled), an axis exactly one pass left empty (null, 비움 — v3.1 rule 9, 10-07), the slot when a pass says
         the book does not belong there (unless the majority keeps it), and the CURRENT one-liner when it breaks a line rule
         (agreement.line_problems — the library keeps its one-liner; the v3 line is offered as a replacement)
  auto — the v3 value of every other field: both passes agreed, or the majority settled it (`settled`); an axis both passes
         left empty is decided as empty (None, listed in `emptied`) — the app scores it 0 and never filters by it
  changes — auto fields whose v3 value differs from the library's: applied by --apply without a person (old values kept as
         history); summed up in a table (field, old → new, count, ISBNs) on the page and in the report
Groups: "person" (any ask), else auto; a seeded SAMPLE_RATE share of the auto books is shown prefilled as a sample ("sample").
"""
import random
from collections import defaultdict

from .agreement import line_problems
from .prompt import AXES, MAX_KEYWORDS
from .tiebreak import SETTLES, pass_slot, settle, value

SAMPLE_RATE = 0.05
SEED = "library-v3"
TIEBREAK_SAMPLE = 3  # books whose slot the third pass settled, always in the sample (user 10-06)


def slot_decision(book: dict, a: dict, b: dict, settled: dict) -> tuple[str | None, str | None]:
    """(new slot or None when it stays, how): "agreed" — both passes say "not here" and name the same slot; "majority" —
    one pass kept the book and the third pass settled it (stay or move); "ask" — a person decides; None — both kept it."""
    slot = book["slot"]
    pa, pb = pass_slot(a, slot), pass_slot(b, slot)
    if pa == pb == slot:
        return None, None
    if pa == pb and pa:
        return pa, "agreed"
    if slot in (pa, pb) and settled.get("slot"):
        return (None if settled["slot"] == slot else settled["slot"]), "majority"
    return None, "ask"


def moved_keywords(book: dict, a: dict, b: dict, new: str) -> list[str] | None:
    """The keywords of a 🎯 book moved to topic `new`: what every pass that named `new` gave as its keywords there
    (intersection, pass A's order, at most MAX_KEYWORDS); None when they named some but share none (a person picks)."""
    lists = [s.get("suggest_keywords") or [] for s in (a, b) if not s.get("fits") and s.get("suggest") == new]
    common = [k for k in (lists[0] if lists else []) if all(k in other for other in lists[1:])]
    return common[:MAX_KEYWORDS] if common or not any(lists) else None


def decide(book: dict, tb: dict | None) -> dict:
    rec, cur = book["record"], book["current"]
    a, b = rec, rec.get("second") or {}
    third = (tb or {}).get("third")
    settled = settle(rec, third, SETTLES) if third else {}
    asks, auto, by_majority, keywords_by, emptied = [], {}, [], None, []
    new_slot, slot_by = slot_decision(book, a, b, settled)
    if slot_by == "ask":
        asks.append("slot")
    elif slot_by == "majority":
        by_majority.append("slot")
    if new_slot:
        auto["slot"] = new_slot
    fields = AXES if book["entry"] == "leaf" else ("keywords", "way")
    for f in fields:
        va, vb = value(f, a, book["slot"]), value(f, b, book["slot"])
        if f == "keywords" and new_slot:
            kws = moved_keywords(book, a, b, new_slot)
            if kws is None:
                asks.append(f)
            else:
                auto[f] = kws
        elif f in AXES and va is None and vb is None:
            auto[f] = None
            emptied.append(f)
        elif f in AXES and (va is None or vb is None):
            asks.append(f)
        elif va == vb:
            auto[f] = list(a["keywords"]) if f == "keywords" else va
        elif f == "keywords":
            common = [k for k in a["keywords"] if k in set(b.get("keywords") or [])][:MAX_KEYWORDS]
            if common:
                auto[f], keywords_by = common, "intersection"
            else:
                asks.append(f)
        elif settled.get(f) is not None:
            auto[f] = settled[f]
            by_majority.append(f)
        else:
            asks.append(f)
    issues = line_problems({"entry": book["entry"], "title": book["title"]}, cur["one_liner"])
    if issues:
        asks.append("line")
    one_fit = book["slot"] in (pass_slot(a, book["slot"]), pass_slot(b, book["slot"])) and slot_by is not None
    return {"asks": asks, "auto": auto, "settled": by_majority, "slot_by": slot_by, "keywords_by": keywords_by,
            "one_fit": one_fit, "emptied": emptied,
            "line_issues": issues, "changes": changes_of(cur, auto)}


def _now(cur: dict, f: str):
    if f == "slot":
        return cur.get("genre") or cur.get("topic")
    return (cur.get("axes") or {}).get(f) if f in AXES else cur.get(f)


def changes_of(cur: dict, auto: dict) -> list[dict]:
    out = []
    for f, new in auto.items():
        old = _now(cur, f)
        if f == "keywords" and sorted(old or []) == sorted(new):
            continue
        if f != "keywords" and old == new:
            continue
        out.append({"field": f, "old": old, "new": new})
    return out


def groups(books: list[dict], tiebreaks: dict[str, dict], rate: float = SAMPLE_RATE) -> dict[str, dict]:
    """{isbn: decide(...) + group}: "person", "sample" (seeded share of the auto books) or "auto"."""
    out = {b["isbn"]: decide(b, tiebreaks.get(b["isbn"])) for b in books}
    auto = sorted(i for i, d in out.items() if not d["asks"])
    k = min(len(auto), max(1, round(rate * len(auto)))) if auto else 0
    sample = set(random.Random(SEED).sample(auto, k))
    by_third = sorted(i for i in auto if out[i]["slot_by"] == "majority" and i not in sample)
    sample |= set(random.Random(f"{SEED}-slot").sample(by_third, min(TIEBREAK_SAMPLE, len(by_third))))
    return {i: d | {"group": "person" if d["asks"] else "sample" if i in sample else "auto"} for i, d in out.items()}


def _label(v) -> str:
    return "(비어 있음)" if v is None else str(v)


def change_table(books: list[dict], decided: dict[str, dict]) -> list[dict]:
    """Rows {field, change, count, isbns} over the books decided without a person, biggest first. Keywords are rows per
    keyword added (+) or taken off (−) within the topic."""
    rows = defaultdict(list)
    for b in books:
        d = decided[b["isbn"]]
        if d["asks"]:
            continue
        topic = d["auto"].get("slot") or b["slot"]
        for c in d["changes"]:
            if c["field"] == "keywords":
                old, new = set(c["old"] or []), set(c["new"])
                for k in sorted(new - old):
                    rows[("keywords", f"{topic}: + {k}")].append(b["isbn"])
                for k in sorted(old - new):
                    rows[("keywords", f"{topic}: − {k}")].append(b["isbn"])
            else:
                rows[(c["field"], f"{_label(c['old'])} → {_label(c['new'])}")].append(b["isbn"])
    out = [{"field": f, "change": ch, "count": len(i), "isbns": i} for (f, ch), i in rows.items()]
    return sorted(out, key=lambda r: (-r["count"], r["field"], r["change"]))


def field_shares(books: list[dict], decided: dict[str, dict]) -> dict[str, dict]:
    """Per field: of the books where v3 decided it without a person, how many it changed."""
    out = defaultdict(lambda: {"auto": 0, "changed": 0})
    for b in books:
        d = decided[b["isbn"]]
        if d["asks"]:
            continue
        changed = {c["field"] for c in d["changes"]}
        for f in d["auto"]:
            out[f]["auto"] += 1
            out[f]["changed"] += f in changed
    return dict(out)


def counts(decided: dict[str, dict]) -> dict[str, int]:
    auto = [d for d in decided.values() if not d["asks"]]
    return {"books": len(decided), "to_person": sum(bool(d["asks"]) for d in decided.values()),
            "settled_by_tiebreak": sum(bool(d["settled"]) for d in auto),
            "changed_auto": sum(bool(d["changes"]) for d in auto),
            "moved_auto": sum("slot" in d["auto"] for d in auto),
            "keyword_intersection": sum(d["keywords_by"] == "intersection" for d in auto),
            "slot_tiebreak_settled": sum(d["slot_by"] == "majority" for d in auto),
            "slot_tiebreak_unsettled": sum(d["slot_by"] == "ask" and d["one_fit"] for d in decided.values()),
            "sample": sum(d["group"] == "sample" for d in decided.values()),
            "empty_confirmed_books": sum(bool(d.get("emptied")) for d in decided.values()),
            "empty_confirmed_axes": sum(len(d.get("emptied") or []) for d in decided.values()),
            "unchanged_silent": sum(d["group"] == "auto" and not d["changes"] for d in decided.values())}
