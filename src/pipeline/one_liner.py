"""One retry for a pass-A one-liner that breaks a rule (10-05: batch 2026-10-05 had a 🍃 line without "?" and a 🎯 line
of 38 characters although the prompt states both rules).

problems: the one-liner rules a model can fix by rewriting the line — form (🍃 question ends with "?", 🎯 summary does
not), length (check_one_liners MIN_LEN..MAX_LEN without spaces), hype words, title repeat — each as a request in Korean.
"Grounded in the intro/TOC" and the YES24-copy check stay with checks.rule_issues only: a retry cannot be told which words
to use without quoting the YES24 text back.
retry: asks the SAME model once more, in the same conversation (its own answer as the assistant turn), for just a
corrected one_liner; every other tag stays as it was. The better line is kept — the retry's when it passes or has fewer
problems, else the first — and checks.rule_issues then flags whatever is still wrong, so the review page shows it as before.
"""
import json
from collections import Counter

from check_one_liners import MAX_LEN, MIN_LEN, check_line

from .tagger import Breaker, Usage, call

SCHEMA = {"type": "object", "properties": {"one_liner": {"type": "string"}}, "required": ["one_liner"],
          "additionalProperties": False}
ASK = "방금 답에서 one_liner만 고쳐 주세요. 다른 태그는 그대로 두고, 고친 한 줄만 답해요. 고칠 점:"


def problems(entry: str, line: str, title: str) -> list[str]:
    """What to fix in `line`, in Korean, [] when the line passes (material is not checked here — see the module doc)."""
    checked, out = check_line(line, title, ""), []
    n = checked["chars"]
    for issue in checked["issues"]:
        if issue.startswith("짧음"):
            out.append(f"공백 빼고 {MIN_LEN}자 이상으로 늘려 주세요(지금 {n}자)")
        elif issue.startswith("김"):
            out.append(f"공백 빼고 {MAX_LEN}자 이하로 줄여 주세요(지금 {n}자)")
        elif issue.startswith("과장 표현"):
            out.append(f"과장 표현을 빼 주세요({issue.split(': ', 1)[1]})")
        elif issue == "제목 반복":
            out.append("책 제목을 되풀이하지 말아 주세요")
    if entry == "leaf" and not line.endswith("?"):
        out.append("질문형이어야 해요(?로 끝나게)")
    if entry == "target" and line.endswith("?"):
        out.append("요약형이어야 해요(물음표 없이)")
    return out


def retry(client, model: str, system: str, user: str, entry: str, raw: dict, answer: dict, title: str,
          breaker: Breaker | None = None) -> tuple[dict, Usage, str]:
    """(answer with the better one-liner, usage of the retry call, outcome). Outcomes: "ok" (no retry needed, no call),
    "fixed", "still_failing" (the better of the two lines kept), or the failed call's reason (http_…, invalid_json…; the
    first line kept). `raw` is pass A's answer as the model gave it (sent back as its own turn). Raises TaggerStop."""
    first = problems(entry, answer["one_liner"], title)
    if not first:
        return answer, Usage(), "ok"
    follow = ({"role": "assistant", "content": json.dumps(raw, ensure_ascii=False)},
              {"role": "user", "content": "\n".join([ASK, *(f"- {p}" for p in first)])})
    got, used, why = call(client, model, system, user, SCHEMA, breaker, "A", follow)
    line = got.get("one_liner") if got else None
    if not isinstance(line, str) or not line.strip():
        return answer, used, why if got is None else "invalid_answer"
    line = line.strip()
    again = problems(entry, line, title)
    if not again:
        return answer | {"one_liner": line}, used, "fixed"
    return (answer | {"one_liner": line} if len(again) < len(first) else answer), used, "still_failing"


class RetryLog:
    """A run's one-liner retries for its summary: how each turned out and what the retry calls cost, per model (the same
    usage is also in the run's main ledger, so the run's cost_usd stays the whole cost)."""

    def __init__(self):
        self.outcomes, self.ledger = Counter(), {}

    def note(self, model: str, used: Usage, outcome: str) -> None:
        if outcome == "ok":  # nothing was wrong: no call
            return
        self.outcomes[outcome] += 1
        self.ledger[model] = self.ledger.get(model, Usage()).plus(used)

    def summary(self) -> dict:
        return {"tried": sum(self.outcomes.values()), "fixed": self.outcomes["fixed"],
                "still_failing": self.outcomes["still_failing"],
                "call_failed": sum(n for o, n in self.outcomes.items() if o not in ("fixed", "still_failing")),
                "usage": {m: u.__dict__ for m, u in self.ledger.items()},
                "cost_usd": round(sum(u.cost(m) for m, u in self.ledger.items()), 4)}
