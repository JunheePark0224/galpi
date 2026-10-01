"""Rule checks and the two-pass decision (design 2-1 "checks", 10-01 two blind passes).

rule_issues (+ scrub): the one-liner rules of check_one_liners.check_line (length, hype, title repeat, grounded in intro/TOC), the
style (🍃 question ends with "?", 🎯 summary does not), evidence at most EVIDENCE_MAX chars, and no copying — a run of
COPY_RUN characters (spaces ignored) shared with the YES24 intro/TOC means our words were not our own.
disagreements: why a person should look — the two passes differ on fit / keywords / way / an axis, or pass A is unsure.
decide: rule issues → reserve (대기, never merged as is); both passes say it does not fit → dropped; a disagreement →
"review" (auto_merge false: waits in the file, NOT in books.json, until a person's --apply sets picked / dropped / reserve —
merging the PR without reviewing cannot put an unreviewed flagged book into the app) or reserve (auto_merge true: nobody
looks before merge, so it waits too); otherwise picked and auto-accepted (`auto: "ai-agree"`) — counted apart from
human-reviewed books (agreement.py). Only "picked" books reach books.json (web/src/lib/books/additions.ts).
"""
from difflib import SequenceMatcher

from build_pilot_review import LOW_CONFIDENCE
from check_one_liners import check_line

from .prompt import AXES, EVIDENCE_MAX

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
    if entry == "leaf" and not line.endswith("?"):
        issues.append("질문형인데 ?로 끝나지 않음")
    if entry == "target" and line.endswith("?"):
        issues.append("요약형인데 물음표로 끝남")
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
    return issues


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
    return ({k: ("" if k in blank else v) for k, v in tag.items()},
            {k: ("" if k in blank else v) for k, v in second.items()})


def disagreements(entry: str, a: dict, b: dict) -> list[str]:
    out = []
    if not (a["fits"] and b["fits"]):
        out.append("fits")
    if entry == "target":
        if set(a["keywords"]) != set(b["keywords"]):
            out.append("keywords")
        if a["way"] != b["way"]:
            out.append("way")
    else:
        out += [axis for axis in AXES if a["axes"][axis] != b["axes"][axis]]
    if a["confidence"] < LOW_CONFIDENCE:
        out.append("confidence")
    return out


def decide(a: dict, b: dict, flags: list[str], issues: list[str], auto_merge: bool) -> tuple[str, str | None]:
    """(status, auto mark)."""
    if not a["fits"] and not b["fits"]:
        return "dropped", None
    if issues:
        return "reserve", None
    if flags:
        return ("reserve" if auto_merge else "review"), None
    return "picked", AUTO
