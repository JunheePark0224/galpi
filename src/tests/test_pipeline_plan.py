"""Pipeline: config, slot rules and today's gaps (src/pipeline/config.py · slots.py · gaps.py)."""
import json
import random
import re
import sys
from pathlib import Path

import pytest

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from apply_review import FIELD_OF_TOPIC  # noqa: E402
from collect_candidates import matches  # noqa: E402
from pipeline.config import ConfigError, load_config, parse_config  # noqa: E402
from pipeline.gaps import GENRES, PHASES, Want, gaps, plan_day, tally, targets_of  # noqa: E402
from pipeline.run_daily import topic_lists  # noqa: E402
from pipeline.slots import NEW_GENRES, NEW_TOPICS, keyword_rule, slot_rule  # noqa: E402

GOOD = {"daily_count": 50, "auto_merge": False, "sample_rate": 0.1, "model": "claude-haiku-4-5",
        "second_model": "claude-sonnet-5-5", "target_phase": "launch"}


def test_config_reads_the_six_knobs_and_the_saved_file_is_valid():
    cfg = parse_config(GOOD)
    assert (cfg.daily_count, cfg.auto_merge, cfg.sample_rate, cfg.second_model) == (50, False, 0.1, "claude-sonnet-5-5")
    assert cfg.target_phase == "launch" and parse_config(GOOD | {"target_phase": "grow"}).target_phase == "grow"
    saved = load_config()
    assert saved.auto_merge is False and saved.sample_rate == 0.1  # decided 10-01: start with a person reviewing
    assert saved.target_phase == "launch"                           # 10-05: before the 1,000-book launch


@pytest.mark.parametrize("over, msg", [
    ({"daily_count": 0}, "daily_count"), ({"daily_count": True}, "daily_count"), ({"auto_merge": "no"}, "auto_merge"),
    ({"sample_rate": 0}, "sample_rate"), ({"model": "gpt-5"}, "model must be"), ({"extra": 1}, "unknown"),
    ({"target_phase": "later"}, "target_phase"), ({"target_phase": None}, "target_phase"),
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


def test_config_without_target_phase_is_refused():
    with pytest.raises(ConfigError, match="missing"):
        parse_config({k: v for k, v in GOOD.items() if k != "target_phase"})


def test_every_topic_and_genre_has_a_yes24_rule():
    assert set(NEW_TOPICS) <= set(FIELD_OF_TOPIC) and set(NEW_GENRES) <= set(GENRES)
    assert len(GENRES) == 13 and len(FIELD_OF_TOPIC) == 16  # plans/2026-10-05-new-genres.md
    for name in [*FIELD_OF_TOPIC, *GENRES]:
        rule = slot_rule(name)
        assert rule["entry"] == ("target" if name in FIELD_OF_TOPIC else "leaf")
        assert rule["cats"] or rule["q"], name
        re.compile(rule["inc"]), re.compile(rule["exc"])
    with pytest.raises(KeyError):
        slot_rule("요리")
    for name in ("로맨스", "마케팅·브랜딩", "리더십", "건강·운동", "요리·살림"):
        rule = slot_rule(name)
        assert rule["q"] and all(re.fullmatch(r"\d{12}|\d{15}", c) for c in rule["cats"]), name  # verified ids


def test_rules_keep_the_measured_filters():
    item = {"title": "주식 투자 첫걸음", "goodsSortNm": "경제경영", "contentDetail": {"bookIntroduction": "배당"}}
    assert matches(slot_rule("돈 관리·투자"), item)
    assert not matches(slot_rule("돈 관리·투자"), {**item, "title": "주식 투자 기출문제집"})  # study books stay out
    word = keyword_rule("돈 관리·투자", "ETF·펀드", "ETF|펀드|인덱스")
    topic = slot_rule("돈 관리·투자")
    assert word["q"] == ["ETF 펀드", *topic["q"]] and word["cats"] == topic["cats"]  # name first, then the topic's lists
    assert matches(word, {**item, "title": "처음 etf"}) and not matches(word, item)


NOVEL = "국내도서-소설/시/희곡"


def book(title: str, sort: str, intro: str = "", publisher: str = "출판사") -> dict:
    return {"title": title, "goodsSortNm": sort, "publisher": publisher, "contentDetail": {"bookIntroduction": intro}}


@pytest.mark.parametrize("title, intro, publisher, ok", [
    ("사랑의 이해", "네 사람의 연애와 계급을 그린 장편", "민음사", True),
    ("노트북", "평생 한 사람만 사랑한 남자의 이야기", "모모", True),
    ("규장각 각신들의 나날 1", "조선 궁궐의 로맨스", "파란 (파란미디어)", False),         # genre romance paperback line
    ("악역의 엔딩은 죽음뿐 1", "사랑받지 못한 악역 영애", "디앤씨미디어(D&C)", False),  # web novel (로판)
    ("너를 다시 만나다", "카카오페이지 화제의 웹소설, 사랑 이야기", "모모", False),     # web novel by its intro
    ("말하고 싶은 비밀 Vol.2", "첫사랑의 비밀", "모모", False),                        # later volume
    ("첫사랑 2부", "그 후의 사랑", "모모", False),
    ("숲속의 연인 외전", "두 연인의 사랑", "모모", False),
    ("밤의 연인", "수위 높은 19금 로맨스", "모모", False),                             # 19금
    ("로맨스 소설 쓰기", "사랑 이야기를 쓰는 법", "모모", False),                       # a writing guide
    ("우주의 끝", "행성 탐사대의 모험", "모모", False),                                  # no love at the centre
])
def test_romance_rule_keeps_love_stories_and_leaves_genre_lines_out(title, intro, publisher, ok):
    assert matches(slot_rule("로맨스"), book(title, NOVEL, intro, publisher)) is ok


@pytest.mark.parametrize("slot, title, sort, ok", [
    ("마케팅·브랜딩", "마케팅 설계자", "국내도서-경제 경영", True),
    ("마케팅·브랜딩", "그렇게 브랜드가 된다", "국내도서-경제 경영", True),
    ("마케팅·브랜딩", "네이버 블로그 상위 노출 마케팅", "국내도서-경제 경영", False),   # platform tricks only
    ("마케팅·브랜딩", "퍼스널 브랜딩 수업", "국내도서-자기계발", False),               # 취업·커리어 keyword
    ("마케팅·브랜딩", "검색광고마케터 1급 기출", "국내도서-경제 경영", False),
    ("마케팅·브랜딩", "세일즈맨의 죽음", NOVEL, False),
    ("리더십", "실리콘밸리의 팀장들", "국내도서-경제 경영", True),
    ("리더십", "두려움 없는 조직", "국내도서-경제 경영", True),
    ("리더십", "세종의 리더십", "국내도서-경제 경영", False),                        # 위인 리더십
    ("리더십", "대통령의 리더십 자서전", "국내도서-정치 사회", False),
    ("건강·운동", "근력 운동의 과학", "국내도서-건강 취미", True),
    ("건강·운동", "우리는 왜 잠을 자야 할까", "국내도서-건강 취미", True),
    ("건강·운동", "핸즈온 머신러닝", "국내도서-IT 모바일", False),
    ("건강·운동", "한 달 10kg 다이어트 비법", "국내도서-건강 취미", False),
    ("건강·운동", "백년허리 치료편", "국내도서-건강 취미", False),                     # treatment book
    ("요리·살림", "진짜 기본 요리책", "국내도서-가정 살림", True),
    ("요리·살림", "미니멀 라이프 아이디어 55", "국내도서-가정 살림", True),
    ("요리·살림", "한식조리기능사 필기", "국내도서-가정 살림", False),
    ("요리·살림", "삐뽀삐뽀 119 이유식", "국내도서-가정 살림", False),
    ("요리·살림", "아름다운 정원 조경 레시피 85", "국내도서-가정 살림", False),
    ("요리·살림", "생각 정리의 기술", "국내도서-자기계발", False),
])
def test_new_topic_rules_follow_their_definitions(slot, title, sort, ok):
    assert matches(slot_rule(slot), book(title, sort)) is ok


def leaf(genre: str, n: int) -> list[dict]:
    return [{"entry": "leaf", "genre": genre}] * n


def target(topic: str, n: int, keywords=()) -> list[dict]:
    return [{"entry": "target", "topic": topic, "keywords": list(keywords)}] * n


FULL = [b for g in GENRES for b in leaf(g, 45)]  # every genre at its launch target
KEPT = {"돈 관리·투자": ["주식", "ETF·펀드"], "글쓰기": ["업무 글"]}
SHORT = ([b for b in FULL if b["genre"] not in ("로맨스", "에세이")] + leaf("에세이", 30)
         + target("돈 관리·투자", 20, ["주식"]))


def test_targets_have_two_phases():
    launch, grow = PHASES["launch"], PHASES["grow"]
    assert targets_of("launch") == launch and (launch.genre, launch.topic, launch.keyword) == (45, 26, 5)
    assert (grow.genre, grow.topic, grow.keyword) == (100, 60, 15)
    with pytest.raises(KeyError):
        targets_of("later")


def test_tally_counts_topics_keywords_and_genres():
    t = tally(SHORT)
    assert t["topic"]["돈 관리·투자"] == 20 and t["keyword"][("돈 관리·투자", "주식")] == 20 and t["genre"]["에세이"] == 30


def test_gaps_rank_by_relative_shortfall_with_keywords_in_between():
    assert gaps(SHORT, KEPT) == [
        Want("leaf", "로맨스", 45),                         # 45/45 short: the empty new genre first
        Want("target", "글쓰기", 26),                       # 26/26: ties broken by books missing
        Want("target", "돈 관리·투자", 5, "ETF·펀드"),      # 5/5: a keyword at 0 is as short as an empty slot
        Want("target", "글쓰기", 5, "업무 글"),
        Want("leaf", "에세이", 15),                         # 15/45
        Want("target", "돈 관리·투자", 6),                  # 6/26
    ]


def test_plan_day_takes_up_to_per_slot_in_rank_order_and_counts_keyword_books_toward_their_topic():
    plan = plan_day(SHORT, KEPT, daily_count=40, per_slot=10)
    assert plan == [Want("leaf", "로맨스", 10), Want("target", "글쓰기", 10), Want("target", "돈 관리·투자", 5, "ETF·펀드"),
                    Want("leaf", "에세이", 10), Want("target", "돈 관리·투자", 1)]  # 글쓰기 full for today: 업무 글 waits
    assert sum(w.n for w in plan) == 36                                            # nothing else is short
    assert plan_day(SHORT, KEPT, daily_count=15, per_slot=10) == [Want("leaf", "로맨스", 10), Want("target", "글쓰기", 5)]


def test_plan_is_deterministic_whatever_the_book_order():
    shuffled = SHORT[:]
    random.Random(7).shuffle(shuffled)
    assert plan_day(shuffled, KEPT, 100) == plan_day(SHORT, KEPT, 100)


def test_a_batch_of_100_spreads_over_about_ten_slots():
    plan = plan_day([], {t: [] for t in FIELD_OF_TOPIC}, 100)
    assert sum(w.n for w in plan) == 100 and len(plan) == 10 and all(w.n == 10 for w in plan)


def test_phase_moves_the_targets():
    done = (FULL + [b for t in KEPT for b in target(t, 21)] + target("돈 관리·투자", 5, ["주식", "ETF·펀드"])
            + target("글쓰기", 5, ["업무 글"]))
    assert plan_day(done, KEPT, 50) == []                                  # launch reached: nothing to do, no calls
    grow = plan_day(done, KEPT, 50, phase="grow")
    assert sum(w.n for w in grow) == 50
    ranked = gaps(done, KEPT, "grow")
    assert ranked[0] == Want("target", "돈 관리·투자", 10, "주식")             # keywords 10/15 beat topics 34/60
    assert ranked[3] == Want("target", "돈 관리·투자", 34) and ranked[5] == Want("leaf", "한국 소설", 55)  # then 55/100
    assert plan_day([], {}, 0) == []


def test_topic_lists_add_new_topics_the_app_vocab_does_not_have_yet():
    lists = topic_lists({"돈 관리·투자": {"kept": {"주식": {}, "ETF·펀드": {}}}})
    assert list(lists)[0] == "돈 관리·투자" and lists["돈 관리·투자"] == ["주식", "ETF·펀드"]
    assert lists["리더십"] == [] and set(lists) == set(FIELD_OF_TOPIC)
