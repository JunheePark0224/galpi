"""Which slots to fill today, and how many books each (design 2-1 "gaps").

Targets (book-pool.md 1-2 · 1-2b, 10-05): 🍃 genres sum to 560, 🎯 topics TOPIC_TARGET each, every 🎯 keyword at least
KEYWORD_MIN. The 🍃 targets were set from the axis estimate — SF·판타지 is the biggest because it lifts "딴 세상" — so
axes are not picked for directly (a book's axes are only known after tagging); report.py measures them.

Order (10-05): **the most short first**. Every slot under its target is a unit — a 🍃 genre, a 🎯 topic, or a 🎯 keyword
under KEYWORD_MIN (its own small want, target KEYWORD_MIN). The day is planned one book at a time: the next book goes to
the unit with the largest relative shortfall (missing − planned) / target; ties go to the larger absolute shortfall, then
to the fixed order genres → topics → keywords (so the plan is deterministic). A book planned for a keyword also counts
toward its topic's shortfall. Each 🎯 topic (its keywords included) or 🍃 genre takes at most PER_SLOT books a day, so a
batch of 100 spreads over about 100 / PER_SLOT slots. The old fixed order (keywords → topics → genres) let 🎯 use the
whole quota every day and empty 🍃 genres never got a turn.
"""
from collections import Counter
from dataclasses import dataclass
from fractions import Fraction

KEYWORD_MIN = 5          # target-chips 2절: a keyword needs 5 books
TOPIC_TARGET = 40        # book-pool 1-2b (10-05)
GENRE_TARGET = {"한국 소설": 50, "외국 소설": 50, "SF·판타지": 60, "추리·스릴러": 50, "에세이": 50, "시": 35,
                "인문": 50, "과학 교양": 50, "예술·여행": 45, "역사": 45, "사회·시사": 40, "호러·괴담": 35}  # book-pool 1-2
PER_SLOT = 10


@dataclass(frozen=True)
class Want:
    entry: str                  # "target" | "leaf"
    slot: str                   # 🎯 topic or 🍃 genre
    n: int                      # books wanted
    keyword: str | None = None  # a 🎯 keyword under its minimum


def tally(books: list[dict]) -> dict[str, Counter]:
    topic, keyword, genre = Counter(), Counter(), Counter()
    for b in books:
        if b["entry"] == "target":
            topic[b["topic"]] += 1
            keyword.update((b["topic"], k) for k in b.get("keywords") or [])
        else:
            genre[b["genre"]] += 1
    return {"topic": topic, "keyword": keyword, "genre": genre}


def gaps(books: list[dict], kept: dict[str, list[str]]) -> list[Want]:
    """Every need, uncapped, in the fixed tie order genres → topics → keywords.
    `kept`: topic → its closed keyword list (keyword_vocab.json)."""
    t = tally(books)
    genres = [Want("leaf", g, n - t["genre"][g]) for g, n in GENRE_TARGET.items() if t["genre"][g] < n]
    topics = [Want("target", topic, TOPIC_TARGET - t["topic"][topic]) for topic in kept
              if t["topic"][topic] < TOPIC_TARGET]
    words = [Want("target", topic, KEYWORD_MIN - t["keyword"][(topic, k)], k)
             for topic, names in kept.items() for k in names if t["keyword"][(topic, k)] < KEYWORD_MIN]
    return [*genres, *topics, *words]


def _target(w: Want) -> int:
    if w.keyword is not None:
        return KEYWORD_MIN
    return TOPIC_TARGET if w.entry == "target" else GENRE_TARGET[w.slot]


def plan_day(books: list[dict], kept: dict[str, list[str]], daily_count: int, per_slot: int = PER_SLOT) -> list[Want]:
    """Today's wants, most short first (module docstring): one book at a time to the unit with the largest relative
    shortfall, at most `per_slot` per topic/genre, until `daily_count` books are planned or nothing is short.
    Returned in the order each want got its first book."""
    units = gaps(books, kept)
    planned = Counter()                    # unit index → books planned
    per_name: Counter = Counter()          # (entry, slot) → books planned (a topic's keyword books included)
    first: dict[int, int] = {}

    def missing(i: int) -> int:
        w = units[i]
        if w.entry == "target" and w.keyword is None:  # keyword books count toward the topic
            return w.n - per_name[(w.entry, w.slot)]
        return w.n - planned[i]

    for step in range(max(daily_count, 0)):
        open_ = [i for i in range(len(units))
                 if missing(i) > 0 and per_name[(units[i].entry, units[i].slot)] < per_slot]
        if not open_:
            break
        best = max(open_, key=lambda i: (Fraction(missing(i), _target(units[i])), missing(i), -i))
        planned[best] += 1
        per_name[(units[best].entry, units[best].slot)] += 1
        first.setdefault(best, step)
    return [Want(units[i].entry, units[i].slot, planned[i], units[i].keyword) for i in sorted(first, key=first.get)]
