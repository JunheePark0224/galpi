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

from .keyword_candidates import clean as clean_candidate
from .gaps import GENRES
from .prompt import AXES, MAX_KEYWORDS, SIGNAL_MAX, TOPICS, WAYS, WHY_MAX

MAX_TOKENS = 2048
MODEL_OPTIONS = {"claude-haiku-4-5": {"extra_body": {"temperature": 0}},
                 "claude-sonnet-5-5": {"effort": "low", "max_tokens": 4096}}
STOP_LIMIT = 5                     # API failures in a row (any status, connection) that stop a run
FATAL_400 = re.compile(r"model|billing|credit|quota|limit", re.I)  # a 400 about the model or the account: every call will fail
PRICES = {"claude-haiku-4-5": (1.0, 5.0), "claude-sonnet-5-5": (2.0, 10.0)}  # $ per MTok in/out (claude-api skill, 09-25)
CACHE_READ, CACHE_WRITE = 0.1, 1.25


class TaggerStop(RuntimeError):
    """No point calling again today: the key is refused (401/403), the model is unknown (404) or the account/model is the
    problem (400), or one model's calls failed STOP_LIMIT times in a row. The message holds a class name / status only."""


class Breaker:
    """Counts API failures in a row (`http_*`, `connection`), ONE STREAK PER PASS ("A" tags, "B" checks): the two passes
    alternate, so a shared streak would be reset by a healthy pass and never stop a dead one. The streak is keyed by pass,
    not by model name, so model == second_model (the shipped config) still has two independent streaks. A success or a
    book-level failure (refusal, truncation, invalid JSON — the API worked) resets that pass's streak; the STOP_LIMIT-th
    failure in a row raises TaggerStop."""

    def __init__(self, limit: int = STOP_LIMIT):
        self.limit, self.streaks = limit, {}

    def note(self, pass_: str, model: str, reason: str) -> None:
        if not (reason.startswith("http_") or reason == "connection"):
            self.streaks[pass_] = 0
            return
        self.streaks[pass_] = self.streaks.get(pass_, 0) + 1
        if self.streaks[pass_] >= self.limit:
            raise TaggerStop(f"pass {pass_} ({model}): {self.streaks[pass_]} API failures in a row ({reason})")


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


def request(model: str, system: str, user: str, schema: dict, follow: tuple = ()) -> dict:
    """Keyword arguments for client.messages.create. `follow`: later turns after the book's user message (a one-liner
    retry sends the model's own answer back and asks for one field — pipeline/one_liner.py)."""
    opt = MODEL_OPTIONS[model]
    out = {"format": {"type": "json_schema", "schema": schema}}
    if "effort" in opt:
        out["effort"] = opt["effort"]
    kwargs = {"model": model, "max_tokens": opt.get("max_tokens", MAX_TOKENS), "output_config": out,
              "system": [{"type": "text", "text": system, "cache_control": {"type": "ephemeral"}}],
              "messages": [{"role": "user", "content": user}, *follow]}
    if "extra_body" in opt:
        kwargs["extra_body"] = dict(opt["extra_body"])  # a copy per call: the module-level options stay untouched
    return kwargs


def call(client, model: str, system: str, user: str, schema: dict, breaker: Breaker | None = None,
         pass_: str = "A", follow: tuple = ()) -> tuple[dict | None, Usage, str]:
    """(answer JSON or None, usage, reason). Raises TaggerStop on 401/403, on a 404 (unknown model), on a 400 about the
    model / billing / limits, and — when a `breaker` is given — after STOP_LIMIT API failures in a row in one `pass_` (A / B).
    Reasons: ok, http_<status>, connection, a stop_reason (refusal, max_tokens…), invalid_json."""
    failure = None
    try:
        msg = client.messages.create(**request(model, system, user, schema, follow))
    except (anthropic.AuthenticationError, anthropic.PermissionDeniedError) as err:
        raise TaggerStop(type(err).__name__) from None
    except anthropic.APIStatusError as err:
        if err.status_code == 404:
            raise TaggerStop(f"{model}: http_404 (unknown model)") from None
        if err.status_code == 400 and (found := FATAL_400.search(str(err.message))):
            raise TaggerStop(f"http_400 about {found.group(0).lower()}") from None
        failure = f"http_{err.status_code}"
    except anthropic.APIConnectionError:
        failure = "connection"
    if failure:  # outside the except block, so a TaggerStop from the breaker carries no chained SDK exception
        return _failed(breaker, pass_, model, failure)
    if breaker:
        breaker.note(pass_, model, "ok")
    usage = _usage(msg)
    if msg.stop_reason != "end_turn":
        return None, usage.plus(Usage(0, 1)), str(msg.stop_reason)
    text = next((b.text for b in msg.content if b.type == "text"), "")
    try:
        answer = json.loads(text)
    except json.JSONDecodeError:
        return None, usage.plus(Usage(0, 1)), "invalid_json"
    return (answer, usage, "ok") if isinstance(answer, dict) else (None, usage.plus(Usage(0, 1)), "invalid_json")


def _failed(breaker: Breaker | None, pass_: str, model: str, reason: str) -> tuple[None, Usage, str]:
    if breaker:
        breaker.note(pass_, model, reason)
    return None, Usage(1, 1), reason


# A model now and then runs the next answer field's name into a text value ("…한국 소설이 아님.way", 10-06 calibration:
# 1 of ~9,800 strings). Only a field name glued after the sentence's last mark is cut — never a word inside the text.
LEAKED_FIELD = re.compile(r"(?<=[.!?。])\s*(way|why|keywords|axes|fits|signals|missing|one_liner|evidence|confidence|temp|pull|gain|world|suggest|suggest_keywords)\s*$")


def _text(v: object) -> str:
    return LEAKED_FIELD.sub("", v.strip()) if isinstance(v, str) else ""


def signals_of(raw: dict) -> dict:
    """A 🍃 answer's per-axis signal lines (cut to SIGNAL_MAX, "" when absent) and the axes it marked as having no info
    (in AXES order, no repeats, unknown names dropped). Both passes give them (10-06); an answer without them still parses."""
    given = raw.get("signals") if isinstance(raw.get("signals"), dict) else {}
    marked = raw.get("missing") if isinstance(raw.get("missing"), list) else []
    return {"signals": {a: _text(given.get(a))[:SIGNAL_MAX] for a in AXES}, "missing": [a for a in AXES if a in marked]}


def axes_of(raw: dict) -> dict | None:
    """A 🍃 answer's axes, signal lines and no-info axes, or None when an axis is absent or not -1 / 0 / 1 / null (1.0 and
    True are not axis values). An empty (null) value always counts as no info: it is added to `missing` if the model left
    it out (10-06 calibration: no signal → '정보 없음' + an empty value, never a 0 filler)."""
    if any(a not in raw for a in AXES):
        return None
    axes = {a: raw[a] for a in AXES}
    if any(v is not None and (type(v) is not int or v not in (-1, 0, 1)) for v in axes.values()):
        return None
    sig = signals_of(raw)
    marked = set(sig["missing"]) | {a for a, v in axes.items() if v is None}
    return {"axes": axes, "signals": sig["signals"], "missing": [a for a in AXES if a in marked]}


def suggestion(raw: dict, entry: str, fits: bool, lists: dict[str, list[str]] | None) -> dict:
    """The slot a pass names for a book it says does not fit (10-06 calibration): a 🍃 genre or a 🎯 topic from our lists —
    either 갈래 since 10-08 (checks.crossed_to) — "" when none or when the pass says the book fits; on a 🎯 book a topic
    suggestion also carries that topic's keywords, cut to its closed list (`lists`: topic → keywords; at most MAX_KEYWORDS).
    A 🍃 book gets its 🎯 keywords when it is tagged again there (requeue)."""
    named = raw.get("suggest")
    slot = named if not fits and isinstance(named, str) and (named in GENRES or named in TOPICS) else ""
    if entry != "target":
        return {"suggest": slot}
    own = (lists or {}).get(slot, [])
    given = raw.get("suggest_keywords") if slot in TOPICS and isinstance(raw.get("suggest_keywords"), list) else []
    return {"suggest": slot, "suggest_keywords": list(dict.fromkeys(k for k in given if k in own))[:MAX_KEYWORDS]}


def parse(raw: dict, entry: str, kind: str, keywords: list[str], topic: str = "", excluded=(),
          lists: dict[str, list[str]] | None = None) -> dict | None:
    """The answer cut to our lists: keywords outside the topic are dropped (at most MAX_KEYWORDS); a bad way / axis /
    missing one-liner makes the whole answer unusable (None). Pass B's free-text `why` is cut to WHY_MAX characters.
    A 🍃 axis may be null (no info — axes_of). Both passes give `suggest` (and on a 🎯 book `suggest_keywords`) — see
    suggestion(); `lists` maps every topic to its keywords.
    Pass A on a 🎯 book also gives `keyword_candidate`: its `new_keyword` cleaned (keyword_candidates.clean — a short name,
    None when missing, too long, the topic `topic`, on the list or `excluded` by it); a bad candidate never spoils the answer."""
    if not isinstance(raw.get("fits"), bool):
        return None
    out: dict = {"fits": raw["fits"]}
    if entry == "target":
        if raw.get("way") not in WAYS or not isinstance(raw.get("keywords"), list):
            return None
        out |= {"keywords": list(dict.fromkeys(k for k in raw["keywords"] if k in keywords))[:MAX_KEYWORDS],
                "way": raw["way"]}
    else:
        axes = axes_of(raw)
        if axes is None:
            return None
        out |= axes
    out |= suggestion(raw, entry, out["fits"], lists)
    if kind == "check":
        return out | {"why": _text(raw.get("why"))[:WHY_MAX]}
    line, conf = _text(raw.get("one_liner")), raw.get("confidence")
    if not line or isinstance(conf, bool) or not isinstance(conf, (int, float)):
        return None
    conf = round(min(1.0, max(0.0, float(conf))), 2)
    out |= {"one_liner": line, "evidence": _text(raw.get("evidence")), "confidence": conf}
    if entry == "target":
        out |= {"keyword_candidate": clean_candidate(raw.get("new_keyword"), topic, keywords, excluded)}
    return out
