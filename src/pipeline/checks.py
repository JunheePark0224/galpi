"""Rule checks and the two-pass decision (design 2-1 "checks", 10-01 two blind passes).

rule_issues (+ scrub): the one-liner rules of check_one_liners.check_line (length, hype, title repeat, grounded in intro/TOC), the
style (🍃 question ends with "?", 🎯 summary does not), evidence at most EVIDENCE_MAX chars, and no copying — a run of
COPY_RUN characters (spaces ignored) shared with the YES24 intro/TOC means our words were not our own — also checked on
each 🍃 axis's signal line of both passes (10-06; a copied line is blanked by scrub, its issue is a note nobody is asked).
disagreements: why a person should look — the two passes differ on fit / keywords / way / an axis, an axis one pass left
empty (null) included; both passes empty is decided as empty and a no-info mark on a value asks nothing (v3.1 rule 9,
10-07). Pass A being unsure is not a reason (10-06: confidence gates nothing).
decide: rule issues → reserve (대기, never merged as is); both passes say it does not fit → dropped; a disagreement →
"review" (auto_merge false: waits in the file, NOT in books.json, until a person's --apply sets picked / dropped / reserve —
merging the PR without reviewing cannot put an unreviewed flagged book into the app) or reserve (auto_merge true: nobody
looks before merge, so it waits too); otherwise picked and auto-accepted (`auto: "ai-agree"`) — counted apart from
human-reviewed books (agreement.py). Only "picked" books reach books.json (web/src/lib/books/additions.ts).
"""
from difflib import SequenceMatcher

from check_one_liners import check_line, form_issue

from .gaps import GENRES
from .prompt import AXES, EVIDENCE_MAX, TOPICS

COPY_RUN = 10
AUTO = "ai-agree"
# issue text per model-written field that can copy the YES24 text; a field with its issue is never stored (see scrub)
COPY_ISSUES = {"one_liner": "한 줄이 책소개를 베낌", "evidence": "근거가 책소개를 베낌", "why": "판단 이유가 책소개를 베낌"}


def _squash(s: str) -> str:
    return "".join(s.split())


def copied_run(text: str, material: str) -> int:
    """Longest run of characters (spaces ignored) that `text` shares with `material`."""
    a, b = _squash(text), _squash(material)
    if not a or not b:
        return 0
    return SequenceMatcher(None, a, b, autojunk=False).find_longest_match(0, len(a), 0, len(b)).size


def rule_issues(entry: str, tag: dict, title: str, material: str, second: dict) -> list[str]:
    """`second` (pass B's answer) is required: its `why` gets the same copy check as the evidence, so no caller can skip it."""
    line, evidence = tag["one_liner"], tag["evidence"]
    issues = list(check_line(line, title, material)["issues"])
    if issue := form_issue(entry, line):
        issues.append(issue)
    if not evidence:
        issues.append("근거 없음")
    elif len(evidence) > EVIDENCE_MAX:
        issues.append(f"근거 김({len(evidence)}자)")
    if copied_run(evidence, material) >= COPY_RUN:
        issues.append(COPY_ISSUES["evidence"])
    if copied_run(line, material) >= COPY_RUN:
        issues.append(COPY_ISSUES["one_liner"])
    if copied_run(second.get("why", ""), material) >= COPY_RUN:
        issues.append(COPY_ISSUES["why"])
    return issues + [signal_issue(who, axis) for who, ans in (("AI-1", tag), ("AI-2", second))
                     for axis, line in (ans.get("signals") or {}).items() if copied_run(line, material) >= COPY_RUN]


def signal_issue(who: str, axis: str) -> str:
    """The issue of a 🍃 signal line that copied the YES24 text; starts like the evidence issue, so it is a note
    (split_issues) and never a question for a person."""
    return f"{COPY_ISSUES['evidence']} ({who} {axis})"


EVIDENCE_ISSUE_STARTS = ("근거 없음", "근거 김", "근거가 ", "판단 이유")  # evidence / pass B reason: missing, long, copied ("근거 약함" is a one-liner rule)


def split_issues(issues: list[str]) -> tuple[list[str], list[str]]:
    """(one-liner issues, evidence/why issues). The one-liner rules and the evidence rules answer different questions:
    is the line usable, and did the model explain itself in its own words and within the length."""
    evidence = [i for i in issues if i.startswith(EVIDENCE_ISSUE_STARTS)]
    return [i for i in issues if i not in evidence], evidence


def scrub(tag: dict, second: dict, issues: list[str]) -> tuple[dict, dict]:
    """Copies of both answers where a field that failed the YES24-copy check is blanked: the issue flag stays in `issues`,
    the copied words are never written to a file, a PR or an eval row."""
    blank = {f for f, text in COPY_ISSUES.items() if text in issues}

    def clean(ans: dict, who: str) -> dict:
        out = {k: ("" if k in blank else v) for k, v in ans.items()}
        if isinstance(ans.get("signals"), dict):
            out["signals"] = {a: ("" if signal_issue(who, a) in issues else line) for a, line in ans["signals"].items()}
        return out
    return clean(tag, "AI-1"), clean(second, "AI-2")


def disagreements(entry: str, a: dict, b: dict) -> list[str]:
    """The fields the two passes answered differently. For a book both passes move to the same other slot (moved_to,
    10-08) the slot is agreed, and a 🎯 book's keywords are the ones they gave for that new topic."""
    out = []
    moved = moved_to(a, b, entry)
    if not (a["fits"] and b["fits"]) and not moved:
        out.append("fits")
    if entry == "target":
        kw = (lambda s: s.get("suggest_keywords") or []) if moved else (lambda s: s["keywords"])  # noqa: E731
        if set(kw(a)) != set(kw(b)):
            out.append("keywords")
        if a["way"] != b["way"]:
            out.append("way")
    else:
        out += [axis for axis in AXES if a["axes"][axis] != b["axes"][axis]]  # one empty (None) differs; both empty agree
    return out


UNSURE = "confidence"  # flag of files tagged before 10-06 (pass A unsure); never asked, never written any more


def needs_person(flags: list[str], issues: list[str]) -> tuple[list[str], list[str]]:
    """(flags, issues) a person must decide (10-05): a field the two passes answered differently, and a one-liner rule the
    shown line breaks. Kept in the record but never sent to a person: the evidence / pass B reason checks (notes the app
    never shows; a copied note is already blanked by scrub) and "AI-1 unsure" when both passes agree on every field (the
    trial sample measures how often agreed books are still wrong)."""
    return [f for f in flags if f != UNSURE], split_issues(issues)[0]


def _named(a: dict, b: dict) -> str | None:
    if a["fits"] or b["fits"]:
        return None
    slot = a.get("suggest") or ""
    return slot if slot and slot == (b.get("suggest") or "") else None


def _other(entry: str) -> tuple[str, tuple[str, ...]]:
    return ("target", TOPICS) if entry == "leaf" else ("leaf", GENRES)


def moved_to(a: dict, b: dict, entry: str | None = None) -> str | None:
    """The slot both passes place the book in when neither keeps it where it was found and both name the same one
    (10-08, plans/2026-10-08-route-pipeline.md — the library re-tag's "agreed" move, library_review.slot_decision); else
    None. A pass that says "not here" already fills every other answer for the book (prompt COMMON), so a 🍃 book's tags
    hold in the new genre; a 🎯 book takes the keywords both passes gave for the new topic (merge.record). Given the
    book's `entry`, a slot of the other 갈래 is no move (crossed_to: the book is tagged again there)."""
    slot = _named(a, b)
    return None if slot and entry and slot in _other(entry)[1] else slot


def crossed_to(entry: str, a: dict, b: dict) -> dict | None:
    """{entry, slot} when both passes place the book in the same slot of the other 갈래 (10-08, 『과몰입 사회』: found as
    🍃 사회·시사, really 🎯 마음 돌보기) — its tags are the other entry's (🎯 keywords·way·summary line), so it is not moved
    but requeued (requeue.json) and tagged again there; else None."""
    slot, (other, slots) = _named(a, b), _other(entry)
    return {"entry": other, "slot": slot} if slot in slots else None


def decide(a: dict, b: dict, flags: list[str], issues: list[str], auto_merge: bool,
           entry: str | None = None) -> tuple[str, str | None]:
    """(status, auto mark). A book both passes place in the same other slot is moved there (its "fits" flag was about the
    slot it was found in); it is dropped only when both say it belongs nowhere among our slots (10-08). Passes that name
    different slots, or one keeping it, leave it to a person. A slot of the other 갈래 (with `entry`) is no move here —
    run_daily requeues such a book (crossed_to); one already requeued once waits for a person."""
    if not a["fits"] and not b["fits"] and not (a.get("suggest") or b.get("suggest")):
        return "dropped", None
    if moved_to(a, b, entry):
        flags = [f for f in flags if f != "fits"]
    return status_of(flags, issues, auto_merge)


def status_of(flags: list[str], issues: list[str], auto_merge: bool) -> tuple[str, str | None]:
    """(status, auto mark) of a book that stays: a one-liner rule → reserve; a field left to a person → review (reserve
    with auto_merge); else picked and auto-accepted."""
    flags, issues = needs_person(flags, issues)
    if issues:
        return "reserve", None
    if flags:
        return ("reserve" if auto_merge else "review"), None
    return "picked", AUTO


def redecide(book: dict, auto_merge: bool) -> tuple[str, str | None]:
    """decide() for a stored additions record (pass A's fits on the book, pass B's under `second`) — to re-sort a batch
    tagged before a rule changed."""
    second = book.get("second") or {}
    return decide({"fits": book["fits"], "suggest": book.get("suggest", "")},
                  {"fits": second.get("fits", book["fits"]), "suggest": second.get("suggest", "")},
                  book.get("flags") or [], book.get("issues") or [], auto_merge, book.get("entry"))
