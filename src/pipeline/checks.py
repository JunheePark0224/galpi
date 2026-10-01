"""Rule checks and the two-pass decision (design 2-1 "checks", 10-01 two blind passes).

rule_issues: the one-liner rules of check_one_liners.check_line (length, hype, title repeat, grounded in intro/TOC), the
style (🍃 question ends with "?", 🎯 summary does not), evidence at most EVIDENCE_MAX chars, and no copying — a run of
COPY_RUN characters (spaces ignored) shared with the YES24 intro/TOC means our words were not our own.
disagreements: why a person should look — the two passes differ on fit / keywords / way / an axis, or pass A is unsure.
decide: rule issues → reserve (대기, never merged as is); both passes say it does not fit → dropped; a disagreement →
picked for review (auto_merge false) or reserve (auto_merge true: nobody looks before merge, so it waits); otherwise
picked and auto-accepted (`auto: "ai-agree"`) — counted apart from human-reviewed books (agreement.py).
"""
from difflib import SequenceMatcher

from build_pilot_review import LOW_CONFIDENCE
from check_one_liners import check_line

from .prompt import AXES, EVIDENCE_MAX

COPY_RUN = 10
AUTO = "ai-agree"


def _squash(s: str) -> str:
    return "".join(s.split())


def copied_run(text: str, material: str) -> int:
    """Longest run of characters (spaces ignored) that `text` shares with `material`."""
    a, b = _squash(text), _squash(material)
    if not a or not b:
        return 0
    return SequenceMatcher(None, a, b, autojunk=False).find_longest_match(0, len(a), 0, len(b)).size


def rule_issues(entry: str, tag: dict, title: str, material: str) -> list[str]:
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
        issues.append("근거가 책소개를 베낌")
    if copied_run(line, material) >= COPY_RUN:
        issues.append("한 줄이 책소개를 베낌")
    return issues


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
        return ("reserve" if auto_merge else "picked"), None
    return "picked", AUTO
