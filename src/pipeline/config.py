"""data/pipeline/config.json — the knobs of the daily run (design 2-1) plus the blind second tagger's model (10-01).

daily_count  books to add per day (D-C 50, then 30)          auto_merge  false: a person reviews the PR / true: merge
sample_rate  share of a week's additions sampled after graduation   model / second_model  tagger (pass A) / checker (pass B)
"""
import json
from dataclasses import dataclass, replace
from pathlib import Path

from . import CONFIG

MODELS = ("claude-haiku-4-5", "claude-sonnet-5-5")
MAX_DAILY = 100
KEYS = ("daily_count", "auto_merge", "sample_rate", "model", "second_model")


class ConfigError(ValueError):
    """config.json is missing a key, has an unknown one, or a value out of range."""


@dataclass(frozen=True)
class Config:
    daily_count: int
    auto_merge: bool
    sample_rate: float
    model: str
    second_model: str


def _count(value: object) -> int:
    if isinstance(value, bool) or not isinstance(value, int) or not 1 <= value <= MAX_DAILY:
        raise ConfigError(f"daily_count must be an integer from 1 to {MAX_DAILY}")
    return value


def parse_config(raw: object) -> Config:
    if not isinstance(raw, dict):
        raise ConfigError("config must be a JSON object")
    missing, unknown = [k for k in KEYS if k not in raw], sorted(set(raw) - set(KEYS))
    if missing or unknown:
        raise ConfigError(f"config keys: missing {missing}, unknown {unknown}")
    if not isinstance(raw["auto_merge"], bool):
        raise ConfigError("auto_merge must be true or false")
    rate = raw["sample_rate"]
    if isinstance(rate, bool) or not isinstance(rate, (int, float)) or not 0 < rate <= 1:
        raise ConfigError("sample_rate must be a number in (0, 1]")
    for key in ("model", "second_model"):
        if raw[key] not in MODELS:
            raise ConfigError(f"{key} must be one of {MODELS}")
    return Config(_count(raw["daily_count"]), raw["auto_merge"], float(rate), raw["model"], raw["second_model"])


def load_config(path: Path = CONFIG, count: int | None = None) -> Config:
    """The saved config; `count` (workflow_dispatch input) replaces daily_count for this run only."""
    cfg = parse_config(json.loads(path.read_text(encoding="utf-8")))
    return cfg if count is None else replace(cfg, daily_count=_count(count))
