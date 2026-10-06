"""Which rules a book was tagged under (plans/2026-10-06-calibration.md 5: `rules_version` on every book).

One reader for every tagger path (run_daily.tag_one, retag, gold calibrate): the version written in docs/label-dictionary.md
— the first heading or "버전 / version" line near the top that names one (`v3`, `v3.1`). Without the dictionary (or without
a version in it) the instructions are still the 10-06 signal rules of balance-game.md, called FALLBACK.
"""
import re
from pathlib import Path

from . import ROOT

DICTIONARY = ROOT / "docs" / "label-dictionary.md"
FALLBACK = "v2"  # the 10-06 signal rules (balance-game.md 태그 기준), before the label dictionary
HEAD_LINES = 15
VERSION = re.compile(r"(?<![\w.])v(\d+(?:\.\d+)?)(?![\w.])", re.I)


def rules_version(path: Path = DICTIONARY) -> str:
    try:
        lines = path.read_text(encoding="utf-8").splitlines()[:HEAD_LINES]
    except FileNotFoundError:
        return FALLBACK
    for line in lines:
        if line.startswith("# ") or re.search(r"버전|version", line, re.I):
            found = VERSION.search(line)
            if found:
                return f"v{found.group(1)}"
    return FALLBACK
