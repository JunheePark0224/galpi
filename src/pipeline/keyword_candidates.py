"""Keyword candidates (plans/2026-10-02-keyword-candidates.md): names a topic's list is missing, gathered, never made.

Pass A (or a person on the review page) may name a 🎯 book's center when it is not on its topic's keyword list. Only that
short name is kept (`keyword_candidate`, at most NAME_MAX characters — never YES24 text). Every day the picked 🎯 books of
all additions files are counted per (topic, name), spaces and case ignored, and the PR body lists them (report.py):
candidates with PROMOTE_AT books or more first, asking whether to add them. A keyword is only made when the user approves
(`python src/backfill_keywords.py promote`), so people still decide the list (CLAUDE.md 원칙 2).
"""
import json
from collections import Counter, defaultdict
from pathlib import Path

NAME_MAX = 12
PROMOTE_AT = 5
OTHERS_MAX = 10


def normalize(name: str) -> str:
    """The key two spellings share: case folded, every space removed."""
    return "".join(name.split()).casefold()


def clean(value: object, topic: str, keywords, excluded=()) -> str | None:
    """A candidate name fit to store, or None: `<` `>` removed, spaces collapsed. Longer than NAME_MAX characters gives
    None — never cut, a cut phrase could be a YES24 fragment. Empty, the topic itself, a keyword already on the topic's
    list or a name the list left out on purpose (`excluded`: folded / too_common, spaces and case ignored) gives None."""
    if not isinstance(value, str):
        return None
    name = " ".join(value.replace("<", " ").replace(">", " ").split())
    taken = {normalize(topic), *(normalize(k) for k in [*keywords, *excluded])}
    return name if name and len(name) <= NAME_MAX and normalize(name) not in taken else None


def excluded_names(topic_vocab: dict) -> list[str]:
    """Names keyword_vocab.json left out of a topic on purpose: merged into another (`folded`) or on too many books
    (`too_common`)."""
    return [*topic_vocab.get("folded", {}), *topic_vocab.get("too_common", {})]


MD_SPECIAL = "\\*_`[]|"


def md(text: str) -> str:
    """`text` with markdown's special characters escaped (a name in the PR body)."""
    return "".join("\\" + c if c in MD_SPECIAL else c for c in text)


def load_docs(folder: Path) -> list[dict]:
    """Every additions file of `folder` (not the pilot's second-tagger copy, *-ai2.json)."""
    docs = [json.loads(p.read_text(encoding="utf-8")) for p in sorted(folder.glob("*.json")) if not p.name.endswith("-ai2.json")]
    return [d for d in docs if isinstance(d, dict) and isinstance(d.get("books"), list)]


def count(docs: list[dict]) -> list[dict]:
    """[{topic, name, n}] over the picked 🎯 books with a candidate, most books first. One row per (topic, normalized
    name); `name` is its most common spelling, `n` the number of different books."""
    groups: dict[tuple[str, str], dict[str, str]] = defaultdict(dict)  # (topic, key) → {isbn: spelling}: a book counts once
    for doc in docs:
        for b in doc["books"]:
            name = b.get("keyword_candidate")
            if b.get("entry") != "target" or b.get("status") != "picked" or not isinstance(name, str) or not name.strip():
                continue
            groups[(b.get("topic") or "", normalize(name))][str(b.get("isbn"))] = name.strip()
    rows = [{"topic": t, "name": Counter(by_book.values()).most_common(1)[0][0], "n": len(by_book)}
            for (t, _), by_book in groups.items()]
    return sorted(rows, key=lambda r: (-r["n"], r["topic"], r["name"]))


def section(rows: list[dict]) -> list[str]:
    """The PR body's "### 키워드 후보" lines (none when there is no candidate)."""
    if not rows:
        return []
    ready = [r for r in rows if r["n"] >= PROMOTE_AT]
    others = [r for r in rows if r["n"] < PROMOTE_AT][:OTHERS_MAX]
    line = lambda r: f"- {md(r['topic'])} › **{md(r['name'])}** {r['n']}권"  # noqa: E731
    return ["### 키워드 후보",
            f"목록에 없는 키워드로 AI·사람이 적은 이름이에요(넣은 🎯 책 기준, 공백·대소문자 무시). {PROMOTE_AT}권 이상이면 키워드로 만들지 "
            "사용자가 정해요 — 승인하면 `python src/backfill_keywords.py promote \"주제:이름\" --pattern … --definition …`.",
            *[f"{line(r)} — **추가할까요?**" for r in ready], *map(line, others), ""]
