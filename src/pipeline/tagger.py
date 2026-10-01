"""One structured-output call per book and pass (design 2-1 "tagger"), with the official `anthropic` Python SDK (1.4.0).

`output_config.format` = JSON schema whose enums are our closed lists (prompt.schema); answers are still checked here and
anything outside the lists is dropped (design 6절). Model-specific settings (SDK 1.x has no `temperature` keyword):
  claude-haiku-4-5   temperature 0 through extra_body — Haiku 4.5 still accepts sampling; a tagger should be repeatable
  claude-sonnet-5-5  effort "low" — thinking cannot be switched off on this model and sampling values are rejected
The system prompt carries a cache breakpoint (it is the same for every call of a run; models whose minimum cacheable
prefix is longer than the prompt just do not cache). Errors are reported by class name / status only — never the request,
which holds YES24 text.
"""
import json
from dataclasses import dataclass

import anthropic

from .prompt import AXES, MAX_KEYWORDS, WAYS

MAX_TOKENS = 2048
MODEL_OPTIONS = {"claude-haiku-4-5": {"extra_body": {"temperature": 0}},
                 "claude-sonnet-5-5": {"effort": "low"}}
PRICES = {"claude-haiku-4-5": (1.0, 5.0), "claude-sonnet-5-5": (2.0, 10.0)}  # $ per MTok in/out (claude-api skill, 09-25)
CACHE_READ, CACHE_WRITE = 0.1, 1.25


class TaggerStop(RuntimeError):
    """The key is wrong or not allowed (or the workspace refuses): no point calling again today."""


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
    kwargs = {"model": model, "max_tokens": MAX_TOKENS, "output_config": out,
              "system": [{"type": "text", "text": system, "cache_control": {"type": "ephemeral"}}],
              "messages": [{"role": "user", "content": user}]}
    if "extra_body" in opt:
        kwargs["extra_body"] = opt["extra_body"]
    return kwargs


def call(client, model: str, system: str, user: str, schema: dict) -> tuple[dict | None, Usage, str]:
    """(answer JSON or None, usage, reason). Raises TaggerStop on 401/403."""
    try:
        msg = client.messages.create(**request(model, system, user, schema))
    except (anthropic.AuthenticationError, anthropic.PermissionDeniedError) as err:
        raise TaggerStop(type(err).__name__) from None
    except anthropic.APIStatusError as err:
        return None, Usage(1, 1), f"http_{err.status_code}"
    except anthropic.APIConnectionError:
        return None, Usage(1, 1), "connection"
    usage = _usage(msg)
    if msg.stop_reason != "end_turn":
        return None, usage.plus(Usage(0, 1)), str(msg.stop_reason)
    text = next((b.text for b in msg.content if b.type == "text"), "")
    try:
        answer = json.loads(text)
    except json.JSONDecodeError:
        return None, usage.plus(Usage(0, 1)), "invalid_json"
    return (answer, usage, "ok") if isinstance(answer, dict) else (None, usage.plus(Usage(0, 1)), "invalid_json")


def _text(v: object) -> str:
    return v.strip() if isinstance(v, str) else ""


def parse(raw: dict, entry: str, kind: str, keywords: list[str]) -> dict | None:
    """The answer cut to our lists: keywords outside the topic are dropped (at most MAX_KEYWORDS); a bad way / axis /
    missing one-liner makes the whole answer unusable (None)."""
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
        if any(v not in (-1, 0, 1) or isinstance(v, bool) for v in axes.values()):
            return None
        out |= {"axes": axes}
    if kind == "check":
        return out | {"why": _text(raw.get("why"))}
    line, conf = _text(raw.get("one_liner")), raw.get("confidence")
    if not line or isinstance(conf, bool) or not isinstance(conf, (int, float)):
        return None
    conf = round(min(1.0, max(0.0, float(conf))), 2)
    return out | {"one_liner": line, "evidence": _text(raw.get("evidence")), "confidence": conf}
