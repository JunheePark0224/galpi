"""Launch-week analysis helpers (src/launch_analysis.py) — tiny hand-made event tables, no real data."""
import sys
from pathlib import Path

import pandas as pd

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from launch_analysis import EXCLUDED, clean, curious_by_pick, stop_points, user_bootstrap_diff  # noqa: E402


def ev(anon, name, t, **props):
    return {"anon": anon, "session": f"s-{anon}", "name": name, "at": pd.Timestamp("2026-10-10") + pd.Timedelta(minutes=t),
            "props": props}


def reacted(anon, t, pick, curious):
    return ev(anon, "bookmark_reacted", t, pick_type=pick, reaction="curious" if curious else "pass")


def frame(rows):
    return pd.DataFrame(rows)


def five(anon, t0, curious_count):
    """Five reactions: the first `curious_count` curious, one of the five the 운명 1장."""
    return [reacted(anon, t0 + i, "random" if i == 4 else "recommended", i < curious_count) for i in range(5)]


def test_clean_keeps_the_launch_window_and_drops_the_developer_devices():
    rows = [ev("a", "site_visited", 0), ev(EXCLUDED[0], "site_visited", 1),
            {**ev("b", "site_visited", 0), "at": pd.Timestamp("2026-10-09 14:00")}]
    out = clean(frame(rows))
    assert list(out.anon) == ["a"]


def test_stop_points_sort_each_person_who_saw_bookmarks_by_how_far_they_went():
    rows = [ev("short", "bookmark_shown", 0), *five("short", 1, 1)[:3],
            ev("none", "bookmark_shown", 0), *five("none", 1, 0), ev("none", "back_cover_shown", 7),
            ev("left", "bookmark_shown", 0), *five("left", 1, 2), ev("left", "back_cover_shown", 7),
            ev("looked", "bookmark_shown", 0), *five("looked", 1, 1), ev("looked", "back_cover_shown", 7),
            ev("looked", "result_viewed", 8),
            ev("kept", "bookmark_shown", 0), *five("kept", 1, 3), ev("kept", "back_cover_shown", 7),
            ev("kept", "result_viewed", 8), ev("kept", "book_saved", 9),
            ev("never", "site_visited", 0)]
    out = stop_points(frame(rows)).set_index("anon")["stop"]
    assert out.to_dict() == {"short": "1 5장을 다 못 넘김", "none": "3 뒤표지 — 궁금해요 0권",
                             "left": "4 뒤표지 — 궁금해요 있는데 결과 안 봄", "looked": "5 결과 — 저장·공유 안 함",
                             "kept": "6 저장 또는 공유"}


def test_curious_by_pick_counts_reactions_and_rates():
    rows = [*five("a", 0, 2), *five("b", 10, 5)]
    t = curious_by_pick(frame(rows)).set_index("pick")
    assert t.loc["recommended", "reacted"] == 8 and t.loc["recommended", "curious"] == 6
    assert t.loc["random", "reacted"] == 2 and t.loc["random", "curious"] == 1
    assert abs(t.loc["random", "rate"] - 0.5) < 1e-9


def test_user_bootstrap_resamples_whole_people_and_is_reproducible():
    rows = [*five("a", 0, 2), *five("b", 10, 5), *five("c", 20, 0), *five("d", 30, 4)]
    one = user_bootstrap_diff(frame(rows), n=300, seed=1)
    two = user_bootstrap_diff(frame(rows), n=300, seed=1)
    assert one == two
    est, lo, hi = one
    assert lo <= est <= hi
