"""Where a slot's books are found on YES24, in the one shape collect_candidates.matches()/candidates_for() read.

The rules stay where they were measured — nothing is copied: the 9 old 🍃 genres and 6 old 🎯 topics are D1's
collect_candidates.SLOTS, the newer topics and genres are the expansion research rules (research_expansion.TOPICS /
GENRES: 6 topics and 3 genres from 10-01, docs/expansion-candidates.md; 4 topics and 로맨스 from 10-05,
docs/plans/2026-10-05-new-genres.md). A 🎯 keyword slot narrows its topic to one keyword.
"""
import re

from collect_candidates import SLOTS
from research_expansion import EXAM, GENRES, TOPICS

NEW_TOPICS = ("돈 관리·투자", "경제 상식", "마음 돌보기", "대화·관계", "취업·커리어", "글쓰기",
              "마케팅·브랜딩", "리더십", "건강·운동", "요리·살림")  # last four: 10-05
NEW_GENRES = ("역사", "사회·시사", "호러·괴담", "로맨스")  # 로맨스: 10-05


def _old(name: str) -> dict:
    s = SLOTS[name]
    return {"entry": s["entry"], "cats": list(s["cats"]), "q": list(s["q"]), "sort": s.get("sort"), "inc": s["inc"],
            "exc": s["exc"], "exc_title": s.get("exc_title"), "title_only": bool(s.get("title_only"))}


def _new_topic(name: str) -> dict:
    t = TOPICS[name]
    return {"entry": "target", "cats": list(t["cats"]), "q": list(t["q"]), "sort": t.get("sort"), "inc": t["title"],
            "exc": f"{t['exc']}|{EXAM.pattern}", "exc_title": None, "title_only": True}


def _new_genre(name: str) -> dict:
    g = GENRES[name]
    return {"entry": "leaf", "cats": list(g["cats"]), "q": list(g.get("q", [])), "sort": g["sort"],
            "inc": g.get("inc", "."), "exc": g["exc"], "exc_title": g.get("exc_title"),
            "exc_publisher": g.get("exc_publisher"), "title_only": False}


def slot_rule(name: str) -> dict:
    """The YES24 rule of a 🎯 topic or 🍃 genre."""
    if name in SLOTS:
        return _old(name)
    if name in NEW_TOPICS:
        return _new_topic(name)
    if name in NEW_GENRES:
        return _new_genre(name)
    raise KeyError(f"no YES24 rule for slot {name}")


def keyword_rule(topic: str, keyword: str, pattern: str) -> dict:
    """A topic's rule narrowed to one keyword: the keyword's name searched first, then the topic's own categories and
    searches, keeping books whose title + intro opening match the keyword's vocab pattern (case-insensitive, like the
    app's word matching). The topic's exclusions still apply. 10-05: the name search alone found 0-5 new books for many
    keywords (a two-word name like "ETF 펀드" is a narrow search); the topic's lists hold most of them."""
    base = slot_rule(topic)
    name = re.sub(r"·", " ", keyword)
    return {**base, "q": [name, *(q for q in base["q"] if q != name)], "inc": f"(?i){pattern}", "title_only": False}
