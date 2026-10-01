"""Applying a human review to additions files (design 2-3) — the counting side of the agreement log (agreement_log.py).

Agreement = per field, the share of human-reviewed books whose pass-A tag the person did not change: 🎯 topic · keywords
(same set) · way, 🍃 genre · temp · pull · gain · world, both one_liner (same text). Only books a person confirmed count —
books accepted because the two passes agreed (`auto: "ai-agree"`) are counted apart (`auto_agreed`) and say nothing
about accuracy. Dropped books are counted apart (`dropped`); a book the person keeps as a reserve is not counted.

The trial sample: a person also looks at a share of the agreed books. Such a book loses its auto mark, keeps `sampled: true`
and is counted like any reviewed book (so the figures also say how often an agreed book was still wrong); the tally
`sample_n` / `sample_changed` reports them apart. 🎯 answers are checked by apply_review.checked_answer, the pilot's rules.
"""
from collections import Counter

from apply_review import FIELD_OF_TOPIC, ReviewError, draft_of
from apply_review import checked_answer as checked_target

from .agreement_log import LEAF_FIELDS, TARGET_FIELDS
from .checks import AUTO
from .gaps import GENRE_TARGET
from .prompt import AXES

STATUSES = ("picked", "reserve", "dropped")


def checked_leaf(isbn: str, ans: dict) -> dict:
    if ans.get("genre") not in GENRE_TARGET:
        raise ReviewError(f"{isbn}: unknown genre {ans.get('genre')}")
    axes = ans.get("axes") if isinstance(ans.get("axes"), dict) else {}
    if any(axes.get(a) not in (-1, 0, 1) or isinstance(axes.get(a), bool) for a in AXES):
        raise ReviewError(f"{isbn}: axes must be -1, 0 or 1 for {', '.join(AXES)}")
    line = str(ans.get("one_liner") or "").strip()
    if not line:
        raise ReviewError(f"{isbn}: one_liner is empty")
    if ans.get("status", "picked") not in STATUSES:
        raise ReviewError(f"{isbn}: unknown status {ans.get('status')}")
    return {"genre": ans["genre"], "axes": {a: axes[a] for a in AXES}, "one_liner": line,
            "status": ans.get("status", "picked")}


def same_fields(entry: str, a: dict, d: dict) -> dict[str, bool]:
    if entry == "target":
        return {"topic": a["topic"] == d["topic"], "keywords": set(a["keywords"]) == set(d["keywords"]),
                "way": a["way"] == d["way"], "one_liner": a["one_liner"] == d["one_liner"].strip()}
    return {"genre": a["genre"] == d["genre"], **{x: a["axes"][x] == d["axes"][x] for x in AXES},
            "one_liner": a["one_liner"] == d["one_liner"].strip()}


def apply_answers(doc: dict, answers: dict[str, dict], kept: dict[str, dict]) -> tuple[dict, Counter]:
    """New doc with the human answers applied (the input is not changed) + a tally: n_target, n_leaf, dropped,
    same:<field> counts over the books that stay picked, sample_n / sample_changed over the agreed books a person looked
    at, and auto_agreed (books still accepted without a human look)."""
    books, tally = [], Counter()
    for book in doc["books"]:
        ans = answers.get(book["isbn"])
        if ans is None:
            books.append(dict(book))
            continue
        if ans.get("auto"):
            raise ReviewError(f"{book['isbn']}: this page sends human answers only")
        if book["entry"] == "target":
            a = checked_target(book["isbn"], ans, kept)
            a = {**a, "field": FIELD_OF_TOPIC[a["topic"]]}
        else:
            a = checked_leaf(book["isbn"], ans)
        draft = draft_of(book)
        sampled = book.get("auto") == AUTO or bool(book.get("sampled"))
        books.append({**{k: v for k, v in book.items() if k != "auto"}, **a, "draft": draft, "reviewed": True,
                      **({"sampled": True} if sampled else {})})
        same = same_fields(book["entry"], a, draft)
        if sampled:
            tally["sample_n"] += 1
            tally["sample_changed"] += not all(same.values())
        if a["status"] != "picked":
            tally["dropped"] += a["status"] == "dropped"
            continue
        tally[f"n_{book['entry']}"] += 1
        tally.update(f"same:{f}" for f, ok in same.items() if ok)
    live = [b for b in books if b["status"] == "picked"]
    new_doc = {**doc, "books": books, "reviewed": bool(live) and all(b.get("reviewed") for b in live)}
    tally["auto_agreed"] = sum(b.get("auto") == AUTO and b["status"] == "picked" for b in books)
    return new_doc, tally


def stats_row(date: str, batch: str, tally: Counter) -> dict:
    nt, nl = tally["n_target"], tally["n_leaf"]
    share = lambda f, n: "" if not n else str(round(100 * tally[f"same:{f}"] / n, 1))  # noqa: E731
    return {"date": date, "batch": batch, "n": str(nt + nl), **{f: share(f, nt) for f in TARGET_FIELDS},
            "one_liner": share("one_liner", nt + nl), "dropped": str(tally["dropped"]),
            "auto_agreed": str(tally["auto_agreed"]), "n_target": str(nt), "n_leaf": str(nl),
            **{f: share(f, nl) for f in LEAF_FIELDS}}
