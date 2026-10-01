"""Which slots to fill today, and how many books each (design 2-1 "gaps").

Order (design 2-1): 🎯 keywords under KEYWORD_MIN → 🎯 topics under TOPIC_TARGET → 🍃 genres under their target.
The 🍃 targets (book-pool.md 1-2) were set from the axis estimate — SF·판타지 60 and 호러·괴담 40 are what lifts "딴 세상"
to 25% — so axes are not picked for directly (a book's axes are only known after tagging); report.py measures them.
Each slot gets at most PER_SLOT books a day, so one day spreads over several slots.
"""
from collections import Counter
from dataclasses import dataclass

KEYWORD_MIN = 5          # target-chips 2절: a keyword needs 5 books
TOPIC_TARGET = 25        # book-pool 1-2b
GENRE_TARGET = {"한국 소설": 25, "외국 소설": 25, "SF·판타지": 60, "추리·스릴러": 25, "에세이": 25, "시": 25,
                "인문": 25, "과학 교양": 25, "예술·여행": 25, "역사": 25, "사회·시사": 25, "호러·괴담": 40}  # book-pool 1-2
PER_SLOT = 5


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
    """Every need, in priority order and uncapped. `kept`: topic → its closed keyword list (keyword_vocab.json)."""
    t = tally(books)
    words = [Want("target", topic, KEYWORD_MIN - t["keyword"][(topic, k)], k)
             for topic, names in kept.items() for k in names if t["keyword"][(topic, k)] < KEYWORD_MIN]
    topics = [Want("target", topic, TOPIC_TARGET - t["topic"][topic]) for topic in kept
              if t["topic"][topic] < TOPIC_TARGET]
    genres = [Want("leaf", g, n - t["genre"][g]) for g, n in GENRE_TARGET.items() if t["genre"][g] < n]
    return [*words, *topics, *genres]


def plan_day(books: list[dict], kept: dict[str, list[str]], daily_count: int, per_slot: int = PER_SLOT) -> list[Want]:
    """Today's wants: walk the gaps in order, at most `per_slot` each, until `daily_count` books are planned.
    Books planned for a topic's keywords count toward that topic's own gap."""
    left, out, planned = daily_count, [], Counter()
    for w in gaps(books, kept):
        if left <= 0:
            break
        need = w.n - (planned[w.slot] if w.entry == "target" and w.keyword is None else 0)
        take = min(need, per_slot, left)
        if take <= 0:
            continue
        out.append(Want(w.entry, w.slot, take, w.keyword))
        planned[w.slot] += take
        left -= take
    return out
