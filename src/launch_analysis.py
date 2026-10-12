"""Launch-week analysis of Galpi's event log (report/README.md): the numbers behind the 10/15 report, the Tistory post
and next week's fixes. Input = the Supabase export (report/sql/events_export.sql) in data/raw/events/ — kept out of git;
every function returns counts and rates only, never a row per person beyond the anonymous id.

Scope: from the launch (2026-10-09 14:10 KST, test records deleted) and without the developer's own devices.
"""
import json
from pathlib import Path

import numpy as np
import pandas as pd

ROOT = Path(__file__).resolve().parents[1]
START = pd.Timestamp("2026-10-09 14:10")
# found 10-12 from the developer's own logins (report/README.md)
EXCLUDED = ("963f449d-d96b-45cc-b03a-6d5f150477fa", "abc42f53-3c38-4a94-a4fe-b4c16e2b2c56")
KEPT = ("book_saved", "share_clicked")   # 10-12: "picked a book" inside Galpi = saved or shared (YES24 is one way out of many)


def load(path: Path) -> pd.DataFrame:
    """The export as a frame: `at` (KST), `props` as dicts, launch window and excluded devices applied."""
    df = pd.read_csv(path)
    df["props"] = df["props"].map(json.loads)
    df["at"] = pd.to_datetime(df["at_kst"])
    return clean(df)


def clean(df: pd.DataFrame) -> pd.DataFrame:
    return df[(df["at"] >= START) & ~df["anon"].isin(EXCLUDED)].sort_values("at").reset_index(drop=True)


def people(df: pd.DataFrame, name: str | tuple[str, ...]) -> set[str]:
    names = (name,) if isinstance(name, str) else name
    return set(df.loc[df["name"].isin(names), "anon"])


def reactions(df: pd.DataFrame) -> pd.DataFrame:
    """One row per bookmark reaction: anon, session, at, pick (recommended / random), curious (0/1), position."""
    r = df[df["name"] == "bookmark_reacted"].copy()
    r["pick"] = r["props"].map(lambda p: p.get("pick_type"))
    r["curious"] = r["props"].map(lambda p: p.get("reaction") == "curious").astype(int)
    r["position"] = r["props"].map(lambda p: p.get("position"))
    return r


def funnel(df: pd.DataFrame) -> pd.DataFrame:
    """People reaching each step (anonymous id), with the share of the step before and of the first step."""
    steps = [("방문", "site_visited"), ("시작", "entry_selected"), ("질문 끝", "path_completed"),
             ("책갈피", "bookmark_shown"), ("뒤표지", "back_cover_shown"), ("결과(책 정보)", "result_viewed"),
             ("저장 또는 공유", KEPT)]
    n = [len(people(df, name)) for _, name in steps]
    out = pd.DataFrame({"step": [s for s, _ in steps], "people": n})
    out["of_previous"] = out["people"] / out["people"].shift(1)
    out["of_first"] = out["people"] / out["people"].iloc[0]
    return out


def stop_points(df: pd.DataFrame) -> pd.DataFrame:
    """Each person who saw bookmarks, sorted by how far they went (the deepest point reached)."""
    r = reactions(df)
    seen = sorted(people(df, "bookmark_shown"))
    count = r.groupby("anon").size()
    cur = r.groupby("anon")["curious"].sum()
    back, result, kept = people(df, "back_cover_shown"), people(df, "result_viewed"), people(df, KEPT)

    def stop(a: str) -> str:
        if count.get(a, 0) < 5:
            return "1 5장을 다 못 넘김"
        if a not in back:
            return "2 5장 넘겼는데 뒤표지 없음"
        if cur.get(a, 0) == 0:
            return "3 뒤표지 — 궁금해요 0권"
        if a not in result:
            return "4 뒤표지 — 궁금해요 있는데 결과 안 봄"
        if a not in kept:
            return "5 결과 — 저장·공유 안 함"
        return "6 저장 또는 공유"

    return pd.DataFrame({"anon": seen, "stop": [stop(a) for a in seen], "curious": [int(cur.get(a, 0)) for a in seen]})


def curious_by_pick(df: pd.DataFrame) -> pd.DataFrame:
    """Hypothesis 1, per reaction: how many reactions and 궁금해요 for the four recommended vs the 운명 1장."""
    t = reactions(df).groupby("pick")["curious"].agg(reacted="size", curious="sum").reset_index()
    t["rate"] = t["curious"] / t["reacted"]
    return t


def _gap(r: pd.DataFrame) -> float:
    g = r.groupby("pick")["curious"].mean()
    return float(g["recommended"] - g["random"])


def user_bootstrap_diff(df: pd.DataFrame, n: int = 4000, seed: int = 7) -> tuple[float, float, float]:
    """(recommended − random 궁금해요 rate, 2.5%, 97.5%): people are resampled whole, so one person's many reactions
    move together (the reactions are not independent)."""
    r = reactions(df)
    by = {a: g for a, g in r.groupby("anon")}
    ids = np.array(sorted(by))
    rng = np.random.default_rng(seed)
    gaps = []
    for _ in range(n):
        sample = pd.concat([by[a] for a in rng.choice(ids, len(ids))])
        if sample["pick"].nunique() == 2:
            gaps.append(_gap(sample))
    lo, hi = np.percentile(gaps, [2.5, 97.5])
    return round(_gap(r), 6), round(float(lo), 6), round(float(hi), 6)
