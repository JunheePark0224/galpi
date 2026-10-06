"""What the v3 re-tag decides on its own and what it leaves to a person (user 10-06 evening).

Per book (an entry of retag/library-v3.json + its tiebreak row, tiebreak.py):
  asks — a person decides: a field pass A and B split on that the third-pass majority did not settle (keyword splits are
         never settled), an axis either pass marked as having no info (정보 없음), the slot when a pass says the book does
         not belong there (unless the majority keeps it), and the CURRENT one-liner when it breaks a line rule
         (agreement.line_problems — the library keeps its one-liner; the v3 line is offered as a replacement)
  auto — the v3 value of every other field: both passes agreed, or the majority settled it (`settled`)
  changes — auto fields whose v3 value differs from the library's: applied by --apply without a person (old values kept as
         history); summed up in a table (field, old → new, count, ISBNs) on the page and in the report
Groups: "person" (any ask), else auto; a seeded SAMPLE_RATE share of the auto books is shown prefilled as a sample ("sample").
"""
import random
from collections import defaultdict

from .agreement import line_problems
from .prompt import AXES
from .tiebreak import pass_slot, value

SAMPLE_RATE = 0.05
SEED = "library-v3"


def decide(book: dict, tb: dict | None) -> dict:
    rec, cur, slot = book["record"], book["current"], book["slot"]
    a, b, settled = rec, rec.get("second") or {}, (tb or {}).get("settled") or {}
    asks, auto, by_majority = [], {}, []
    if not (pass_slot(a, slot) == pass_slot(b, slot) == slot):
        (by_majority if settled.get("slot") == slot else asks).append("slot")
    fields = AXES if book["entry"] == "leaf" else ("keywords", "way")
    for f in fields:
        va, vb = value(f, a, slot), value(f, b, slot)
        if f in AXES and (va is None or vb is None):
            asks.append(f)
        elif va == vb:
            auto[f] = list(a["keywords"]) if f == "keywords" else va
        elif settled.get(f) is not None:
            auto[f] = settled[f]
            by_majority.append(f)
        else:
            asks.append(f)
    issues = line_problems({"entry": book["entry"], "title": book["title"]}, cur["one_liner"])
    if issues:
        asks.append("line")
    return {"asks": asks, "auto": auto, "settled": by_majority, "line_issues": issues, "changes": changes_of(cur, auto)}


def _now(cur: dict, f: str):
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
        for c in d["changes"]:
            if c["field"] == "keywords":
                old, new = set(c["old"] or []), set(c["new"])
                for k in sorted(new - old):
                    rows[("keywords", f"{b['slot']}: + {k}")].append(b["isbn"])
                for k in sorted(old - new):
                    rows[("keywords", f"{b['slot']}: − {k}")].append(b["isbn"])
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
            "sample": sum(d["group"] == "sample" for d in decided.values()),
            "unchanged_silent": sum(d["group"] == "auto" and not d["changes"] for d in decided.values())}
