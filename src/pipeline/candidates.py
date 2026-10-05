"""Today's candidates for one wanted slot (design 2-1 "candidates").

D1 rules, reused from collect_candidates: general books only, intro >= 100 chars, the slot's title/intro rule, rank order
alternating steady / best / search (deeper list pages only when a slot runs dry, 10-05), other editions within
the slot out, detail with rating · pages · TOC · intro. On top:
what is already ours — ISBNs in books.json or in any additions file (reserve and dropped too: never offered twice),
titles in books.json (other editions), at most MAX_PER_AUTHOR books per author (book-pool 1절).

YES24 text (intro, TOC) stays in memory on the Candidate, for the tagger only. It is never written to the repo, a PR or a
log (YES24 terms, design 2-1). A book without author or page count is never a candidate (books:import would fail on it).
The raw responses are cached by collect_candidates under data/raw/yes24/ (git-ignored).
"""
import os
import re
from collections import Counter
from dataclasses import dataclass, field

from collect_candidates import (MAX_DEPTH, MAX_PER_AUTHOR, candidates_for, detail, first_author, has_more, interleave,
                                norm_title, usable)
from compare_apis import load_env
from pick_pilot import clean

from .gaps import Want

INTRO_MAX, TOC_MAX = 1500, 1200
DETAIL_TRIES = 3  # detail calls per wanted book at most (some fail `usable`)


@dataclass(frozen=True)
class Candidate:
    entry: str
    slot: str
    isbn: str
    title: str
    author: str
    pages: int
    link: str
    intro: str = field(repr=False)
    toc: str = field(repr=False)


@dataclass(frozen=True)
class Known:
    isbns: frozenset[str]
    titles: frozenset[str]
    authors: dict[str, int]

    def plus(self, cands: list[Candidate]) -> "Known":
        authors = Counter(self.authors)
        authors.update(k for c in cands if (k := author_key(c.author)))  # no author → nothing to count
        return Known(self.isbns | {c.isbn for c in cands}, self.titles | {norm_title(c.title) for c in cands},
                     dict(authors))


def author_key(name: str) -> str:
    """First author as one key for YES24 ("김승호 저") and books.json ("천선란, 임솔아", "피터 브루스 외") spellings."""
    return re.sub(r"\s+외$", "", first_author(name or "")).strip()


def known_from(books: list[dict], additions: list[dict]) -> Known:
    added = [b["isbn"] for doc in additions for b in doc.get("books", [])]
    return Known(frozenset([b["isbn"] for b in books] + added), frozenset(norm_title(b["title"]) for b in books),
                 dict(Counter(k for b in books if (k := author_key(b["author"])))))


def yes24_env() -> dict:
    """{"YES24_API_KEY": …}: the Actions secret, or the local .env. The value is never printed."""
    key = os.environ.get("YES24_API_KEY")
    if key:
        return {"YES24_API_KEY": key}
    try:
        return {k: v for k, v in load_env().items() if k == "YES24_API_KEY"}
    except FileNotFoundError:
        return {}


def pages_of(d: dict) -> int:
    digits = re.sub(r"\D", "", str(d.get("pages") or ""))
    return int(digits) if digits else 0


def find(env: dict, want: Want, rule: dict, known: Known) -> list[Candidate]:
    """Up to want.n usable candidates for one slot, in D1 rank order. The lists are read one depth at a time
    (collect_candidates.CAT_PAGES / SEARCH_PAGES, at most category pages 1-5 and search pages 1-3): a deeper depth is read
    only when the shallower ones did not give want.n usable books and some list still has pages left (has_more), and
    never past a list's end. Within a depth the order is D1's (interleave), books already seen at a shallower depth are
    skipped. Detail calls stay at most DETAIL_TRIES × want.n over all depths."""
    out: list[Candidate] = []
    authors = Counter(known.authors)
    seen: set[str] = set()
    titles = set(known.titles)  # a deeper depth can keep another edition of a title already offered
    tries = 0
    for depth in range(1, MAX_DEPTH + 1):
        kept, _ = candidates_for(env, want.slot, rule, {}, depth)
        for c in interleave(kept):
            if len(out) >= want.n or tries >= DETAIL_TRIES * want.n:
                return out
            if c["isbn"] in seen:
                continue
            seen.add(c["isbn"])
            if c["isbn"] in known.isbns or norm_title(c["title"]) in titles:
                continue
            if not (c.get("author") or "").strip():  # an added book needs an author: books:import fails on it, every day
                continue
            who = author_key(c["author"])
            if who and authors[who] >= MAX_PER_AUTHOR:
                continue
            tries += 1
            d = detail(env, c["isbn"])
            if not usable(d) or pages_of(d) <= 0:  # no page count: normalizeBook rejects the book, every day
                continue
            cd = d.get("contentDetail") or {}
            out.append(Candidate(want.entry, want.slot, c["isbn"], c["title"], c.get("author") or "", pages_of(d),
                                 d.get("link") or "", clean(cd.get("bookIntroduction") or "", INTRO_MAX),
                                 clean(cd.get("tableOfContents") or "", TOC_MAX)))
            titles.add(norm_title(c["title"]))
            if who:
                authors[who] += 1
        if len(out) >= want.n or tries >= DETAIL_TRIES * want.n or not has_more(rule, depth):
            break
    return out
