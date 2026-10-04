"""data/pipeline/agreement.csv — one row per review (date, batch), shared by the pipeline and src/apply_review.py (pilot).

Columns: n (human-reviewed books that stay picked), 🎯 topic · keywords · way, one_liner (both entries), dropped,
auto_agreed (accepted because the two passes agreed — NOT reviewed, not in any share), n_target, n_leaf, 🍃 genre ·
temp · pull · gain · world, sample_n / sample_changed (the AI-agreed books a person looked at that day, and how many of
them the person changed — the clean answer to "how often is an agreed book wrong"). Shares are percent; empty = not
measured that day (no book of that entry was reviewed).
The one place that knows the header and reads/writes the file: apply_review.py (pilot) uses it too, so there is only one
header. No imports from apply_review, so apply_review can take HEAD from here.
`date` of a daily row is the batch id (pipeline/batch.py): the plain date for a day's first batch, `2026-10-06-2` … for a
later run that day; `batch` stays "daily". No new column, so the pilot rows and apply_review's header are untouched.

Graduation (design 2-3 + the review of 10-01): the last STREAK daily reviews each have every measured field >= GRADUATE,
together they measured every field, AND the AI-agreed books a person looked at in those reviews were changed in at most
MAX_SAMPLE_CHANGED percent of cases over at least MIN_SAMPLE books. The first rows mix hard (flagged) books and the sample,
so their shares alone cannot say how often an agreed book is wrong — and agreed books are all that auto_merge lets through.
→ tell the user (both figures); only the user turns auto_merge on. A weekly sample under WARN → suggest turning auto_merge off.
"""
import csv
from pathlib import Path

from .batch import sort_key

TARGET_FIELDS = ("topic", "keywords", "way")
LEAF_FIELDS = ("genre", "temp", "pull", "gain", "world")
FIELDS = (*TARGET_FIELDS, "one_liner", *LEAF_FIELDS)
HEAD = ["date", "batch", "n", *TARGET_FIELDS, "one_liner", "dropped", "auto_agreed", "n_target", "n_leaf", *LEAF_FIELDS,
        "sample_n", "sample_changed"]
GRADUATE, WARN, STREAK = 95.0, 90.0, 3
MIN_SAMPLE, MAX_SAMPLE_CHANGED = 10, 5.0  # agreed books looked at over the streak, and the most that may have been changed (%)


def read_rows(path: Path) -> list[dict]:
    if not path.exists():
        return []
    with path.open(encoding="utf-8", newline="") as f:
        return list(csv.DictReader(f))


def write_rows(path: Path, rows: list[dict]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("w", encoding="utf-8", newline="") as f:
        w = csv.DictWriter(f, fieldnames=HEAD, restval="")
        w.writeheader()
        w.writerows(rows)


def upsert(rows: list[dict], row: dict) -> list[dict]:
    """Rows with the (date, batch) row replaced or appended — applying again does not add a second row."""
    key = (row["date"], row["batch"])
    return [*(r for r in rows if (r.get("date"), r.get("batch")) != key), row]


def measured(row: dict) -> dict[str, float]:
    return {f: float(row[f]) for f in FIELDS if row.get(f) not in (None, "")}


def count(row: dict, field: str) -> int:
    value = row.get(field)
    return int(value) if value not in (None, "") else 0


def graduation(rows: list[dict]) -> dict:
    """Streak of the latest daily reviews whose measured fields are all >= GRADUATE; graduated when the streak is
    >= STREAK, the last STREAK of them together measured every field, and the agreed-book sample of those reviews is big
    enough (MIN_SAMPLE) and changed in at most MAX_SAMPLE_CHANGED percent."""
    daily = sorted((r for r in rows if r.get("batch") == "daily"), key=lambda r: sort_key(r["date"]))  # '-10' after '-9'
    streak = []
    for r in reversed(daily):
        m = measured(r)
        if not m:
            continue  # nobody reviewed a book that day: it neither counts nor breaks the streak
        if min(m.values()) < GRADUATE:
            break
        streak.append(r)
    last = streak[:STREAK]
    covered = {f for r in last for f in measured(r)}
    n, changed = sum(count(r, "sample_n") for r in last), sum(count(r, "sample_changed") for r in last)
    sample_ok = n >= MIN_SAMPLE and 100 * changed / n <= MAX_SAMPLE_CHANGED
    return {"streak": len(streak), "graduated": len(streak) >= STREAK and covered >= set(FIELDS) and sample_ok,
            "missing_fields": sorted(set(FIELDS) - covered), "sample_n": n, "sample_changed": changed, "sample_ok": sample_ok}


def below(row: dict, limit: float = WARN) -> list[str]:
    return [f for f, v in measured(row).items() if v < limit]
