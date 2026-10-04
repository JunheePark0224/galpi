"""Batch ids: more than one pipeline run on the same day (10-05, for the 10-06 launch fill).

The first batch of a day is the plain date `2026-10-06`, exactly as before, so every existing file and command keeps
working. Later batches are `2026-10-06-2`, `2026-10-06-3` … The id is the key wherever the date used to be: the branch
`books/<id>`, data/processed/additions/<id>.json, data/pipeline/runs/<id>.json, `python -m src.pipeline.review <id>`, the
`date` column of agreement.csv (batch stays "daily") and the trial-sample seed. The additions doc's own `date` stays the
calendar day (the weekly sample groups by it).

Usage (the workflow's gate, stdlib only — no pip install needed):
  python3 -m src.pipeline.batch next --date 2026-10-06 [taken ...]
    taken = additions file stems on main and books/ branch names (with or without "books/", ".json"); prints the next free id
"""
import argparse
import re
import sys
from datetime import date

ID = re.compile(r"(\d{4}-\d{2}-\d{2})(?:-([1-9]\d*))?")


class BatchError(ValueError):
    """Not a batch id: a date, or a date + "-N" with N >= 2."""


def parse(batch: str) -> tuple[str, int]:
    """'2026-10-06' → ('2026-10-06', 1); '2026-10-06-3' → ('2026-10-06', 3). '-1', '-01', '-pilot' are not batch ids."""
    m = ID.fullmatch(batch or "")
    if not m:
        raise BatchError(f"not a batch id: {batch!r} (YYYY-MM-DD or YYYY-MM-DD-N, N >= 2)")
    day, n = m.group(1), int(m.group(2) or 1)
    try:
        date.fromisoformat(day)
    except ValueError as err:
        raise BatchError(f"not a batch id: {batch!r} ({err})") from err
    if m.group(2) and n < 2:
        raise BatchError(f"not a batch id: {batch!r} (the first batch is the plain date)")
    return day, n


def is_batch(name: str) -> bool:
    try:
        parse(name)
    except BatchError:
        return False
    return True


def make(day: str, n: int) -> str:
    if n < 1:
        raise BatchError(f"batch number must be >= 1, got {n}")
    return day if n == 1 else f"{day}-{n}"


def sort_key(batch: str) -> tuple[str, int]:
    """Day, then batch number ('-10' after '-9'). Anything else sorts by its text, as number 0."""
    return parse(batch) if is_batch(batch) else (batch, 0)


def _stem(name: str) -> str:
    name = name.strip().removeprefix("refs/heads/").removeprefix("books/")
    return name.removesuffix(".json")


def next_free(day: str, taken: list[str]) -> str:
    """The id after the highest batch of `day` already taken (an additions file on main or a books/ branch). Other
    days and other files of the day (`<day>-pilot.json`) are ignored. A day with nothing taken gets the plain date."""
    if parse(day) != (day, 1):
        raise BatchError(f"not a day: {day!r} (YYYY-MM-DD)")
    numbers = [n for d, n in (parse(s) for s in map(_stem, taken) if is_batch(s)) if d == day]
    return make(day, max(numbers, default=0) + 1)


def main(argv: list[str] | None = None) -> int:
    ap = argparse.ArgumentParser(description="batch ids of the daily pipeline")
    sub = ap.add_subparsers(dest="cmd", required=True)
    nxt = sub.add_parser("next", help="print the next free batch id of a day")
    nxt.add_argument("--date", required=True)
    nxt.add_argument("taken", nargs="*")
    args = ap.parse_args(argv)
    try:
        print(next_free(args.date, args.taken))
    except BatchError as err:
        print(f"ERROR: {err}", file=sys.stderr)
        return 1
    return 0


if __name__ == "__main__":
    sys.exit(main())
