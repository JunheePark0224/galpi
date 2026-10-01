"""Pipeline: config, slot rules and today's gaps (src/pipeline/config.py · slots.py · gaps.py)."""
import json
import re
import sys
from pathlib import Path

import pytest

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from apply_review import FIELD_OF_TOPIC  # noqa: E402
from collect_candidates import matches  # noqa: E402
from pipeline.config import ConfigError, load_config, parse_config  # noqa: E402
from pipeline.gaps import GENRE_TARGET, Want, gaps, plan_day, tally  # noqa: E402
from pipeline.slots import keyword_rule, slot_rule  # noqa: E402

GOOD = {"daily_count": 50, "auto_merge": False, "sample_rate": 0.1, "model": "claude-haiku-4-5",
        "second_model": "claude-sonnet-5-5"}


def test_config_reads_the_five_knobs_and_the_saved_file_is_valid():
    cfg = parse_config(GOOD)
    assert (cfg.daily_count, cfg.auto_merge, cfg.sample_rate, cfg.second_model) == (50, False, 0.1, "claude-sonnet-5-5")
    saved = load_config()
    assert saved.auto_merge is False and saved.sample_rate == 0.1  # decided 10-01: start with a person reviewing


@pytest.mark.parametrize("over, msg", [
    ({"daily_count": 0}, "daily_count"), ({"daily_count": True}, "daily_count"), ({"auto_merge": "no"}, "auto_merge"),
    ({"sample_rate": 0}, "sample_rate"), ({"model": "gpt-5"}, "model must be"), ({"extra": 1}, "unknown"),
])
def test_config_refuses_bad_values(over, msg):
    with pytest.raises(ConfigError, match=msg):
        parse_config(GOOD | over)


def test_config_count_override_is_checked(tmp_path):
    path = tmp_path / "config.json"
    path.write_text(json.dumps(GOOD), encoding="utf-8")
    assert load_config(path, count=5).daily_count == 5
    with pytest.raises(ConfigError):
        load_config(path, count=500)


def test_every_topic_and_genre_has_a_yes24_rule():
    for name in [*FIELD_OF_TOPIC, *GENRE_TARGET]:
        rule = slot_rule(name)
        assert rule["entry"] == ("target" if name in FIELD_OF_TOPIC else "leaf")
        assert rule["cats"] or rule["q"], name
        re.compile(rule["inc"]), re.compile(rule["exc"])
    with pytest.raises(KeyError):
        slot_rule("요리")


def test_rules_keep_the_measured_filters():
    item = {"title": "주식 투자 첫걸음", "goodsSortNm": "경제경영", "contentDetail": {"bookIntroduction": "배당"}}
    assert matches(slot_rule("돈 관리·투자"), item)
    assert not matches(slot_rule("돈 관리·투자"), {**item, "title": "주식 투자 기출문제집"})  # study books stay out
    word = keyword_rule("돈 관리·투자", "ETF·펀드", "ETF|펀드|인덱스")
    assert word["q"] == ["ETF 펀드"] and word["cats"] == []
    assert matches(word, {**item, "title": "처음 etf"}) and not matches(word, item)


BOOKS = ([{"entry": "target", "topic": "돈 관리·투자", "keywords": ["주식"]}] * 6
         + [{"entry": "target", "topic": "돈 관리·투자", "keywords": ["ETF·펀드"]}] * 2
         + [{"entry": "leaf", "genre": "SF·판타지"}] * 59)
KEPT = {"돈 관리·투자": ["주식", "ETF·펀드", "연금·노후"], "글쓰기": ["업무 글"]}


def test_tally_and_gap_order_keywords_then_topics_then_genres():
    t = tally(BOOKS)
    assert t["topic"]["돈 관리·투자"] == 8 and t["keyword"][("돈 관리·투자", "ETF·펀드")] == 2
    g = gaps(BOOKS, KEPT)
    assert g[:3] == [Want("target", "돈 관리·투자", 3, "ETF·펀드"), Want("target", "돈 관리·투자", 5, "연금·노후"),
                     Want("target", "글쓰기", 5, "업무 글")]
    assert g[3:5] == [Want("target", "돈 관리·투자", 17), Want("target", "글쓰기", 25)]
    assert Want("leaf", "SF·판타지", 1) in g and all(w.entry == "leaf" for w in g[5:])


def test_plan_day_caps_each_slot_and_counts_keyword_books_toward_their_topic():
    plan = plan_day(BOOKS, KEPT, daily_count=20, per_slot=5)
    assert plan == [Want("target", "돈 관리·투자", 3, "ETF·펀드"), Want("target", "돈 관리·투자", 5, "연금·노후"),
                    Want("target", "글쓰기", 5, "업무 글"), Want("target", "돈 관리·투자", 5), Want("target", "글쓰기", 2)]
    assert sum(w.n for w in plan) == 20
    full = [{"entry": "target", "topic": "글쓰기", "keywords": ["업무 글"]}] * 25
    later = plan_day(full, {"글쓰기": ["업무 글"]}, 10)
    assert sum(w.n for w in later) == 10 and all(w.entry == "leaf" for w in later)  # 🎯 full → 🍃 genres next
    assert plan_day([], {}, 0) == []
