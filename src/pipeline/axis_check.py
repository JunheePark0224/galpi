"""One automatic re-ask for a 🍃 pass whose axis values are not backed by its own signal lines (calibration decisions 10-06:
AI-2 gave 넥서스 four 0s with no signal at all; AI-1 wrote "약하게 −" / "몰입 쪽" and still answered 0).

problems: per axis with a value — the signal line is empty, or the line states a direction (stated()) that the value
contradicts. An axis left empty (null) is in `missing` by construction (tagger.axes_of) and needs no line — but all four
empty at once is a problem (a pass that gave up). Four 0s with four empty lines are four problems, so a pass that failed
that way is always asked again.
stated: the directions a line names — signs (+, −, a lone "-" or "–", "+1"/"−1"), a lone 0 or the zero words (반반,
해당 없음, 둘 다), and each axis's own words (온도 따뜻/서늘·여운, 끌림 문장/몰입, 얻는 것 알게 됨/마음, 세계 현실/딴 세상).
A value contradicts its line when the line names directions and the value is none of them; 0 under a line that names both
+ and − is the "반반 0" and stands.
retry: asks the SAME model once more, in the same conversation (its own answer as the assistant turn — the one-liner
retry's pattern, one_liner.py), for just the four axes with their signal lines and no-info marks. The retry's axes replace
the first ones when they have fewer problems; the outcome is "fixed", "still_failing", or the failed call's reason.
Counted with one_liner.RetryLog, as the run's `axis_retries`.
"""
import json
import re

from .prompt import AXES, AXIS_VALUE
from .tagger import Breaker, Usage, axes_of, call

NAMES = {"temp": "온도", "pull": "끌림", "gain": "얻는 것", "world": "세계"}
WORDS = {"temp": ((1, ("따뜻",)), (-1, ("서늘", "여운"))),
         "pull": ((1, ("문장", "문체", "글맛")), (-1, ("몰입",))),
         "gain": ((1, ("알게 됨", "알게됨")), (-1, ("마음",))),
         "world": ((1, ("현실",)), (-1, ("딴 세상", "딴세상")))}
PLUS = re.compile(r"\+")
MINUS = re.compile(r"[−–]|(?<![A-Za-z0-9가-힣])-")
ZERO = re.compile(r"(?<![\d.+\-−])0(?![\d.])|반반|해당 없음|둘 다")
SCHEMA = {"type": "object",
          "properties": {**{a: AXIS_VALUE for a in AXES},
                         "signals": {"type": "object", "properties": {a: {"type": "string"} for a in AXES},
                                     "required": list(AXES), "additionalProperties": False},
                         "missing": {"type": "array", "items": {"type": "string", "enum": list(AXES)}}},
          "required": [*AXES, "signals", "missing"], "additionalProperties": False}
ASK = ("방금 답에서 temp·pull·gain·world와 signals·missing만 다시 답해 주세요. 기준표 0절 5·6·7대로 — 값을 낸 축은 근거 한 줄이 "
       "있고 그 줄의 방향이 값과 같아야 해요. 소설·시에서 신호가 없거나 똑같이 흐릿하면 missing에 넣고 값은 null, "
       "비소설은 0(해당 없음). 고칠 점:")


ALL_EMPTY = "네 축을 모두 비웠어요 — 약하게라도 한쪽을 가리키는 신호가 있는 축은 값을 내 주세요(기준표 0절 6)"


def stated(axis: str, line: str) -> set[int]:
    """The directions (+1 / 0 / −1) a signal line names; empty when it names none."""
    out = set()
    if PLUS.search(line):
        out.add(1)
    if MINUS.search(line):
        out.add(-1)
    if ZERO.search(line):
        out.add(0)
    for value, words in WORDS[axis]:
        if any(w in line for w in words):
            out.add(value)
    return out


def _sign(v: int) -> str:
    return {1: "+1", 0: "0", -1: "−1"}[v]


def problems(ans: dict) -> list[str]:
    """What to fix in a parsed 🍃 answer, in Korean, [] when every value is backed by its signal line. All four axes left
    empty is one problem too (a pass that gave up on the book, calibration 2 of 10-06)."""
    if all(ans["axes"][a] is None for a in AXES):
        return [ALL_EMPTY]
    out = []
    for axis in AXES:
        value, line = ans["axes"][axis], (ans.get("signals") or {}).get(axis, "")
        if value is None:
            continue
        name = f"{axis}({NAMES[axis]})"
        if not line.strip():
            out.append(f"{name}: 값({_sign(value)})을 냈는데 근거 신호가 비었어요")
            continue
        named = stated(axis, line)
        if named and value not in named and not (value == 0 and {1, -1} <= named):
            out.append(f"{name}: 근거에 쓴 방향({'/'.join(_sign(v) for v in sorted(named, reverse=True))})과 "
                       f"값({_sign(value)})이 달라요")
    return out


def retry(client, model: str, system: str, user: str, raw: dict, ans: dict, pass_: str,
          breaker: Breaker | None = None) -> tuple[dict, Usage, str]:
    """(answer with the better axes, usage of the retry call, outcome). Outcomes: "ok" (nothing to fix, no call), "fixed",
    "still_failing" (the axes with fewer problems kept), "invalid_answer" or the failed call's reason (the first axes
    kept). `raw` is the pass's answer as the model gave it. Raises TaggerStop."""
    first = problems(ans)
    if not first:
        return ans, Usage(), "ok"
    follow = ({"role": "assistant", "content": json.dumps(raw, ensure_ascii=False)},
              {"role": "user", "content": "\n".join([ASK, *(f"- {p}" for p in first)])})
    got, used, why = call(client, model, system, user, SCHEMA, breaker, pass_, follow)
    if got is None:
        return ans, used, why
    axes = axes_of(got)
    if axes is None:
        return ans, used, "invalid_answer"
    again = problems(axes)
    if not again:
        return ans | axes, used, "fixed"
    return (ans | axes if len(again) < len(first) else ans), used, "still_failing"
