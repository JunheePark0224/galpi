"""Which slots to fill today, and how many books each (design 2-1 "gaps").

Targets come in two phases (book-pool.md 1-2, plans/2026-10-05-new-genres.md), picked by `target_phase` in
data/pipeline/config.json: **launch** (before the 1,000-book launch) — every 🍃 genre 45, every 🎯 topic 26, every 🎯
keyword at least 5; **grow** (after it) — 100 · 60 · 15. A target is a floor the pipeline fills up to; once every slot is
there the daily run adds nothing (no calls, no cost) until a person moves the phase. Axes are not picked for directly (a
book's axes are only known after tagging); report.py measures them.

Units: every 🍃 genre, 🎯 topic and 🎯 keyword under its phase target. Order (10-05): **most short first** — by relative
shortfall (missing ÷ target), so an empty new slot comes before a half-full old one whatever its size. Ties: more books
missing first, then the fixed order genres → topics → keywords, then list order (GENRES, the topic list, each topic's
keyword list) — the plan is the same for the same books every time. Keywords are ranked on the same scale as genres and
topics (a keyword at 0 of 5 is as short as an empty genre), so their minimum is served between the other slots, not before
or after all of them. The day walks the ranked units and gives each up to PER_SLOT books; a keyword's books count toward
its topic, and a topic (its keywords included) or a genre takes at most PER_SLOT books a day, so a batch of 100 spreads
over about 10 slots. The old order (keywords → topics → genres, 5 per slot) let 🎯 take the whole quota every day.
"""
from collections import Counter
from dataclasses import dataclass
from fractions import Fraction

KEYWORD_MIN = 5          # target-chips 2절: a keyword shows in the app from 5 books (the launch floor below)
PER_SLOT = 10


@dataclass(frozen=True)
class Targets:
    genre: int    # each 🍃 genre
    topic: int    # each 🎯 topic
    keyword: int  # each 🎯 keyword, at least


PHASES = {"launch": Targets(45, 26, KEYWORD_MIN), "grow": Targets(100, 60, 15)}
DEFAULT_PHASE = "launch"
GENRES = ("한국 소설", "외국 소설", "SF·판타지", "추리·스릴러", "에세이", "시", "인문", "과학 교양", "예술·여행",
          "역사", "사회·시사", "호러·괴담", "로맨스")  # 로맨스: 10-05
KIND = {"leaf": 0, "target": 1, "keyword": 2}  # tie order


@dataclass(frozen=True)
class Want:
    entry: str                  # "target" | "leaf"
    slot: str                   # 🎯 topic or 🍃 genre
    n: int                      # books wanted
    keyword: str | None = None  # a 🎯 keyword under its target


def tally(books: list[dict]) -> dict[str, Counter]:
    topic, keyword, genre = Counter(), Counter(), Counter()
    for b in books:
        if b["entry"] == "target":
            topic[b["topic"]] += 1
            keyword.update((b["topic"], k) for k in b.get("keywords") or [])
        else:
            genre[b["genre"]] += 1
    return {"topic": topic, "keyword": keyword, "genre": genre}


def targets_of(phase: str) -> Targets:
    if phase not in PHASES:
        raise KeyError(f"unknown target phase {phase!r} (one of {', '.join(PHASES)})")
    return PHASES[phase]


def _target(w: Want, t: Targets) -> int:
    return t.keyword if w.keyword is not None else t.topic if w.entry == "target" else t.genre


def _kind(w: Want) -> int:
    return KIND["keyword" if w.keyword is not None else w.entry]


def gaps(books: list[dict], kept: dict[str, list[str]], phase: str = DEFAULT_PHASE) -> list[Want]:
    """Every need, uncapped, most short first (module docstring). `kept`: topic → its closed keyword list, every 🎯 topic
    of the run in a fixed order (run_daily.topic_lists: the app vocab's topics, then new ones it does not have yet)."""
    t, tg = tally(books), targets_of(phase)
    units = [Want("leaf", g, tg.genre - t["genre"][g]) for g in GENRES if t["genre"][g] < tg.genre]
    units += [Want("target", topic, tg.topic - t["topic"][topic]) for topic in kept if t["topic"][topic] < tg.topic]
    units += [Want("target", topic, tg.keyword - t["keyword"][(topic, k)], k)
              for topic, names in kept.items() for k in names if t["keyword"][(topic, k)] < tg.keyword]
    order = {w: i for i, w in enumerate(units)}
    return sorted(units, key=lambda w: (-Fraction(w.n, _target(w, tg)), -w.n, _kind(w), order[w]))


def plan_day(books: list[dict], kept: dict[str, list[str]], daily_count: int, per_slot: int = PER_SLOT,
             phase: str = DEFAULT_PHASE) -> list[Want]:
    """Today's wants: walk the ranked gaps, at most `per_slot` books per topic (its keywords included) or genre, until
    `daily_count` books are planned. Books planned for a topic's keywords count toward that topic's own gap."""
    left, out, planned = daily_count, [], Counter()
    for w in gaps(books, kept, phase):
        if left <= 0:
            break
        key = (w.entry, w.slot)
        need = w.n - (planned[key] if w.entry == "target" and w.keyword is None else 0)
        take = min(need, per_slot - planned[key], left)
        if take <= 0:
            continue
        out.append(Want(w.entry, w.slot, take, w.keyword))
        planned[key] += take
        left -= take
    return out
