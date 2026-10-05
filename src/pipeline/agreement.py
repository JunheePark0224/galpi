"""Applying a human review to additions files (design 2-3) — the counting side of the agreement log (agreement_log.py).

Agreement = per field, the share of human-reviewed books whose pass-A tag the person did not change: 🎯 topic · keywords
(same set) · way, 🍃 genre · temp · pull · gain · world, both one_liner (same text). Only books a person confirmed count —
books accepted because the two passes agreed (`auto: "ai-agree"`) are counted apart (`auto_agreed`) and say nothing
about accuracy. Dropped books are counted apart (`dropped`); a book the person keeps as a reserve is not counted.

The trial sample: a person also looks at a share of the agreed books. Such a book loses its auto mark, keeps `sampled: true`
and is counted like any reviewed book; the tally `sample_n` / `sample_changed` reports them apart (changed = any field, the
status, or the line differs from pass A) — that, not the mixed shares, says how often an agreed book was still wrong.
The day's tally is computed from EVERY reviewed book of the file (`tally_of`), not from the latest download, so applying in
two sittings or applying a download again gives the same row. 🎯 answers are checked by apply_review.checked_answer (the
pilot's rules); `screened` refuses to pick a book whose one-liner breaks the rules instead of aborting the whole apply.
"""
from collections import Counter

from apply_review import FIELD_OF_TOPIC, ReviewError, draft_of
from apply_review import checked_answer as checked_target
from check_one_liners import check_line

from .agreement_log import LEAF_FIELDS, TARGET_FIELDS
from .checks import AUTO
from .gaps import GENRES
from .keyword_candidates import clean as clean_candidate
from .prompt import AXES

STATUSES = ("picked", "reserve", "dropped")
NO_LINE = "(한 줄 없음)"  # a book that is dropped / held needs no line, but the stored record keeps one


def checked_leaf(isbn: str, ans: dict) -> dict:
    if ans.get("genre") not in GENRES:
        raise ReviewError(f"{isbn}: unknown genre {ans.get('genre')}")
    axes = ans.get("axes") if isinstance(ans.get("axes"), dict) else {}
    if any(axes.get(a) not in (-1, 0, 1) or isinstance(axes.get(a), bool) for a in AXES):
        raise ReviewError(f"{isbn}: axes must be -1, 0 or 1 for {', '.join(AXES)}")
    line = str(ans.get("one_liner") or "").strip()
    if not line:
        raise ReviewError(f"{isbn}: one_liner is empty")
    if ans.get("status", "picked") not in STATUSES:
        raise ReviewError(f"{isbn}: unknown status {ans.get('status')}")
    return {"genre": ans["genre"], "axes": {a: axes[a] for a in AXES}, "one_liner": line,
            "status": ans.get("status", "picked")}


def same_fields(entry: str, a: dict, d: dict) -> dict[str, bool]:
    if entry == "target":
        return {"topic": a["topic"] == d["topic"], "keywords": set(a["keywords"]) == set(d["keywords"]),
                "way": a["way"] == d["way"], "one_liner": a["one_liner"] == d["one_liner"].strip()}
    return {"genre": a["genre"] == d["genre"], **{x: a["axes"][x] == d["axes"][x] for x in AXES},
            "one_liner": a["one_liner"] == d["one_liner"].strip()}


def tally_of(doc: dict, only: set[str] | None = None) -> Counter:
    """The agreement tally of every human-reviewed book of `doc` (or just those in `only`): n_target, n_leaf, dropped,
    same:<field> over the books that stay picked, sample_n / sample_changed over the agreed books a person looked at, and
    auto_agreed (books still accepted without a human look)."""
    tally = Counter()
    for b in doc["books"]:
        if not b.get("reviewed") or (only is not None and b["isbn"] not in only):
            continue
        draft = draft_of(b)
        same = same_fields(b["entry"], b, draft)
        if b.get("sampled"):
            tally["sample_n"] += 1
            tally["sample_changed"] += not all(same.values()) or b["status"] != draft["status"]
        if b["status"] != "picked":
            tally["dropped"] += b["status"] == "dropped"
            continue
        tally[f"n_{b['entry']}"] += 1
        tally.update(f"same:{f}" for f, ok in same.items() if ok)
    tally["auto_agreed"] = sum(b.get("auto") == AUTO and b["status"] == "picked" for b in doc["books"])
    return tally


def candidate_of(book: dict, ans: dict, topic: str, kept: dict[str, dict], excluded: dict[str, list[str]]) -> str | None:
    """The person's keyword candidate (the page's field), or the stored one when the answer has none — cleaned like the
    tagger's against the topic the person chose (keyword_candidates.clean)."""
    value = ans["keyword_candidate"] if "keyword_candidate" in ans else book.get("keyword_candidate")
    return clean_candidate(value, topic, kept.get(topic, {}), excluded.get(topic, []))


def apply_answers(doc: dict, answers: dict[str, dict], kept: dict[str, dict], only: set[str] | None = None,
                  excluded: dict[str, list[str]] | None = None) -> tuple[dict, Counter]:
    """New doc with the human answers applied (the input is not changed) + the tally of the whole file (`tally_of`;
    `only` limits it to some books, for a weekly sample row that must count just what was looked at). `excluded`: per
    topic, the names the keyword list left out on purpose (keyword_candidates.excluded_names) — never a candidate."""
    books = []
    for book in doc["books"]:
        ans = answers.get(book["isbn"])
        if ans is None:
            books.append(dict(book))
            continue
        if ans.get("auto"):
            raise ReviewError(f"{book['isbn']}: this page sends human answers only")
        if book["entry"] == "target":
            a = checked_target(book["isbn"], ans, kept)
            a = {**a, "field": FIELD_OF_TOPIC[a["topic"]], "keyword_candidate": candidate_of(book, ans, a["topic"], kept, excluded or {})}
        else:
            a = checked_leaf(book["isbn"], ans)
        sampled = book.get("auto") == AUTO or bool(book.get("sampled"))
        books.append({**{k: v for k, v in book.items() if k != "auto"}, **a, "draft": draft_of(book), "reviewed": True,
                      **({"sampled": True} if sampled else {})})
    live = [b for b in books if b["status"] in ("picked", "review")]  # a book still waiting for a person is not "reviewed"
    new_doc = {**doc, "books": books, "reviewed": bool(live) and all(b.get("reviewed") for b in live)}
    return new_doc, tally_of(new_doc, only)


def line_problems(book: dict, line: str) -> list[str]:
    """Why a one-liner cannot go into the app: empty, or breaks the line rules (length, hype, title repeat — grounding needs
    the YES24 text, which is not here) or the style of its entry (🍃 a question, 🎯 a summary)."""
    if not line:
        return ["한 줄이 비어 있어요"]
    out = [i for i in check_line(line, book.get("title", ""), line)["issues"] if not i.startswith("근거")]
    if book["entry"] == "leaf" and not line.endswith("?"):
        out.append("질문형인데 ?로 끝나지 않음")
    if book["entry"] == "target" and line.endswith("?"):
        out.append("요약형인데 물음표로 끝남")
    return out


def screened(books: dict[str, dict], answers: dict[str, dict]) -> tuple[dict[str, dict], dict[str, list[str]]]:
    """(answers that can be applied, {isbn: problems} for the picks refused). A book is only picked with a line that passes
    the rules — it stays as it was otherwise; dropping or holding a book never needs a line."""
    ok, refused = {}, {}
    for isbn, ans in answers.items():
        book, line = books.get(isbn), str(ans.get("one_liner") or "").strip()
        if book is not None and ans.get("status", "picked") == "picked" and (problems := line_problems(book, line)):
            refused[isbn] = problems
        else:
            ok[isbn] = ans if line or ans.get("status", "picked") == "picked" else {**ans, "one_liner": NO_LINE}
    return ok, refused


def stats_row(date: str, batch: str, tally: Counter) -> dict:
    nt, nl = tally["n_target"], tally["n_leaf"]
    share = lambda f, n: "" if not n else str(round(100 * tally[f"same:{f}"] / n, 1))  # noqa: E731
    return {"date": date, "batch": batch, "n": str(nt + nl), **{f: share(f, nt) for f in TARGET_FIELDS},
            "one_liner": share("one_liner", nt + nl), "dropped": str(tally["dropped"]),
            "auto_agreed": str(tally["auto_agreed"]), "n_target": str(nt), "n_leaf": str(nl),
            **{f: share(f, nl) for f in LEAF_FIELDS},
            "sample_n": str(tally["sample_n"]), "sample_changed": str(tally["sample_changed"])}
