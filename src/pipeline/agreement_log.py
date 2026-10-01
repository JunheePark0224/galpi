"""data/pipeline/agreement.csv — one row per review (date, batch), shared by the pipeline and src/apply_review.py (pilot).

Columns: n (human-reviewed books that stay picked), 🎯 topic · keywords · way, one_liner (both entries), dropped,
auto_agreed (accepted because the two passes agreed — NOT reviewed, not in any share), n_target, n_leaf, 🍃 genre ·
temp · pull · gain · world. Shares are percent; empty = not measured that day (no book of that entry was reviewed).
The one place that knows the header and reads/writes the file: apply_review.py (pilot) uses it too, so there is only one
header. No imports from apply_review, so apply_review can take HEAD from here.

Graduation (design 2-3): the last STREAK daily reviews each have every measured field >= GRADUATE, and together they
measured every field → tell the user; only the user turns auto_merge on. A weekly sample under WARN → suggest turning
auto_merge off.
"""
import csv
from pathlib import Path

TARGET_FIELDS = ("topic", "keywords", "way")
LEAF_FIELDS = ("genre", "temp", "pull", "gain", "world")
FIELDS = (*TARGET_FIELDS, "one_liner", *LEAF_FIELDS)
HEAD = ["date", "batch", "n", *TARGET_FIELDS, "one_liner", "dropped", "auto_agreed", "n_target", "n_leaf", *LEAF_FIELDS]
GRADUATE, WARN, STREAK = 95.0, 90.0, 3


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


def graduation(rows: list[dict]) -> dict:
    """Streak of the latest daily reviews whose measured fields are all >= GRADUATE; graduated when the streak is
    >= STREAK and the last STREAK of them together measured every field."""
    daily = sorted((r for r in rows if r.get("batch") == "daily"), key=lambda r: r["date"])
    streak = []
    for r in reversed(daily):
        m = measured(r)
        if not m:
            continue  # nobody reviewed a book that day: it neither counts nor breaks the streak
        if min(m.values()) < GRADUATE:
            break
        streak.append(r)
    covered = {f for r in streak[:STREAK] for f in measured(r)}
    return {"streak": len(streak), "graduated": len(streak) >= STREAK and covered >= set(FIELDS),
            "missing_fields": sorted(set(FIELDS) - covered)}


def below(row: dict, limit: float = WARN) -> list[str]:
    return [f for f, v in measured(row).items() if v < limit]
