"""simulate_draws.py: the 🍃 score must match web/src/lib/recommend/score.ts (CLAUDE.md: same distribution)."""
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from simulate_draws import leaf_score  # noqa: E402


def test_an_empty_axis_scores_zero_like_the_app():
    """v3.1 rule 9 (10-07): an axis left empty (None, 비움) adds 0 — never filtered out, never an error."""
    user = {"temp": 2, "pull": -1, "gain": 1, "world": 0, "len": 1}
    book = {"temp": 1, "pull": -1, "gain": 1, "world": -1, "len": 1}
    assert leaf_score(book, user) == 2 + 1 + 1 + 0 + 1
    assert leaf_score({**book, "temp": None, "gain": None}, user) == 1 + 0 + 1
