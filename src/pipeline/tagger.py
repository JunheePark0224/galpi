"""One structured-output call per book and pass (design 2-1 "tagger"), with the official `anthropic` Python SDK (1.4.0).

`output_config.format` = JSON schema whose enums are our closed lists (prompt.schema); answers are still checked here and
anything outside the lists is dropped (design 6절). Model-specific settings (SDK 1.x has no `temperature` keyword):
  claude-haiku-4-5   temperature 0 through extra_body — Haiku 4.5 still accepts sampling; a tagger should be repeatable
  claude-sonnet-5-5  effort "low" and max_tokens 4096 — sampling values are rejected, and adaptive thinking tokens count
                     against max_tokens (a 2048 cap truncated 1 book in the first real eval). `thinking: between_tools`
                     would turn thinking off, but SDK 1.4.0 has no type for it and it is unverified without a paid call
The system prompt carries a cache breakpoint (it is the same for every call of a run; models whose minimum cacheable
prefix is longer than the prompt just do not cache). Errors are reported by class name / status only — never the request,
which holds YES24 text. A Breaker stops a run whose API calls keep failing (spent cap, bad model, outage) instead of
failing book by book.
"""
import json
import re
from dataclasses import dataclass

import anthropic

from .prompt import AXES, EVIDENCE_MAX, MAX_KEYWORDS, WAYS

MAX_TOKENS = 2048
MODEL_OPTIONS = {"claude-haiku-4-5": {"extra_body": {"temperature": 0}},
                 "claude-sonnet-5-5": {"effort": "low", "max_tokens": 4096}}
STOP_LIMIT = 5                     # API failures in a row (any status, connection) that stop a run
FATAL_400 = re.compile(r"model|billing|credit|quota|limit", re.I)  # a 400 about the model or the account: every call will fail
PRICES = {"claude-haiku-4-5": (1.0, 5.0), "claude-sonnet-5-5": (2.0, 10.0)}  # $ per MTok in/out (claude-api skill, 09-25)
CACHE_READ, CACHE_WRITE = 0.1, 1.25


class TaggerStop(RuntimeError):
    """No point calling again today: the key is refused (401/403), the model or account is the problem (400), or the API
    failed STOP_LIMIT times in a row. The message holds a class name / status only."""


class Breaker:
    """Counts API failures in a row (`http_*`, `connection`). A success or a book-level failure (refusal, truncation,
    invalid JSON — the API worked) resets it; the STOP_LIMIT-th in a row raises TaggerStop."""

    def __init__(self, limit: int = STOP_LIMIT):
        self.limit, self.streak = limit, 0

    def note(self, reason: str) -> None:
        if not (reason.startswith("http_") or reason == "connection"):
            self.streak = 0
            return
        self.streak += 1
        if self.streak >= self.limit:
            raise TaggerStop(f"{self.streak} API failures in a row ({reason})")


@dataclass(frozen=True)
class Usage:
    calls: int = 0
    failed: int = 0
    input_tokens: int = 0
    output_tokens: int = 0
    cache_read: int = 0
    cache_write: int = 0

    def plus(self, o: "Usage") -> "Usage":
        return Usage(*(a + b for a, b in zip(self.__dict__.values(), o.__dict__.values(), strict=True)))

    def cost(self, model: str) -> float:
        i, o = PRICES[model]
        return (self.input_tokens * i + self.cache_read * i * CACHE_READ + self.cache_write * i * CACHE_WRITE
                + self.output_tokens * o) / 1_000_000


def _usage(msg) -> Usage:
    u = msg.usage
    return Usage(1, 0, u.input_tokens or 0, u.output_tokens or 0, getattr(u, "cache_read_input_tokens", 0) or 0,
                 getattr(u, "cache_creation_input_tokens", 0) or 0)


def request(model: str, system: str, user: str, schema: dict) -> dict:
    """Keyword arguments for client.messages.create."""
    opt = MODEL_OPTIONS[model]
    out = {"format": {"type": "json_schema", "schema": schema}}
    if "effort" in opt:
        out["effort"] = opt["effort"]
    kwargs = {"model": model, "max_tokens": opt.get("max_tokens", MAX_TOKENS), "output_config": out,
              "system": [{"type": "text", "text": system, "cache_control": {"type": "ephemeral"}}],
              "messages": [{"role": "user", "content": user}]}
    if "extra_body" in opt:
        kwargs["extra_body"] = dict(opt["extra_body"])  # a copy per call: the module-level options stay untouched
    return kwargs


def call(client, model: str, system: str, user: str, schema: dict,
         breaker: Breaker | None = None) -> tuple[dict | None, Usage, str]:
    """(answer JSON or None, usage, reason). Raises TaggerStop on 401/403, on a 400 about the model / billing / limits,
    and — when a `breaker` is given — after STOP_LIMIT API failures in a row."""
    try:
        msg = client.messages.create(**request(model, system, user, schema))
    except (anthropic.AuthenticationError, anthropic.PermissionDeniedError) as err:
        raise TaggerStop(type(err).__name__) from None
    except anthropic.APIStatusError as err:
        if err.status_code == 400 and (found := FATAL_400.search(str(err.message))):
            raise TaggerStop(f"http_400 about {found.group(0).lower()}") from None
        return _failed(breaker, f"http_{err.status_code}")
    except anthropic.APIConnectionError:
        return _failed(breaker, "connection")
    if breaker:
        breaker.note("ok")
    usage = _usage(msg)
    if msg.stop_reason != "end_turn":
        return None, usage.plus(Usage(0, 1)), str(msg.stop_reason)
    text = next((b.text for b in msg.content if b.type == "text"), "")
    try:
        answer = json.loads(text)
    except json.JSONDecodeError:
        return None, usage.plus(Usage(0, 1)), "invalid_json"
    return (answer, usage, "ok") if isinstance(answer, dict) else (None, usage.plus(Usage(0, 1)), "invalid_json")


def _failed(breaker: Breaker | None, reason: str) -> tuple[None, Usage, str]:
    if breaker:
        breaker.note(reason)
    return None, Usage(1, 1), reason


def _text(v: object) -> str:
    return v.strip() if isinstance(v, str) else ""


def parse(raw: dict, entry: str, kind: str, keywords: list[str]) -> dict | None:
    """The answer cut to our lists: keywords outside the topic are dropped (at most MAX_KEYWORDS); a bad way / axis /
    missing one-liner makes the whole answer unusable (None). Pass B's free-text `why` is cut to EVIDENCE_MAX characters."""
    if not isinstance(raw.get("fits"), bool):
        return None
    out: dict = {"fits": raw["fits"]}
    if entry == "target":
        if raw.get("way") not in WAYS or not isinstance(raw.get("keywords"), list):
            return None
        out |= {"keywords": list(dict.fromkeys(k for k in raw["keywords"] if k in keywords))[:MAX_KEYWORDS],
                "way": raw["way"]}
    else:
        axes = {a: raw.get(a) for a in AXES}
        if any(type(v) is not int or v not in (-1, 0, 1) for v in axes.values()):  # 1.0 and True are not axis values
            return None
        out |= {"axes": axes}
    if kind == "check":
        return out | {"why": _text(raw.get("why"))[:EVIDENCE_MAX]}
    line, conf = _text(raw.get("one_liner")), raw.get("confidence")
    if not line or isinstance(conf, bool) or not isinstance(conf, (int, float)):
        return None
    conf = round(min(1.0, max(0.0, float(conf))), 2)
    return out | {"one_liner": line, "evidence": _text(raw.get("evidence")), "confidence": conf}
