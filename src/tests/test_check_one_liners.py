"""One-liner rules (src/check_one_liners.py): the 10-03 false alarms."""
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from check_one_liners import check_line  # noqa: E402

MATERIAL = "완벽주의 우울 감정 단계 방법 업무 생산성 야근 조직 시간"


def issues(text, title="어떤 책"):
    return check_line(text, title, MATERIAL)["issues"]


def test_a_plain_word_that_contains_a_hype_word_is_not_hype():
    assert not [i for i in issues("완벽주의 뒤에 숨은 우울을 알아보고 감정을 다루는 방법을 얻어요") if i.startswith("과장")]


def test_the_hype_word_itself_is_still_caught():
    assert "과장 표현: 완벽" in issues("우울을 완벽하게 이기는 감정 다루기 방법을 얻어요")
    assert any(i.startswith("과장") for i in issues("완벽주의도 완벽하게 고치는 우울 감정 방법이에요"))


def test_a_one_word_title_is_not_a_title_to_repeat():
    line = "야근 대신 업무의 질과 빈 시간으로 조직의 생산성을 높이는 길을 짚어 줘요"
    assert "제목 반복" not in issues(line, "생산성")


def test_a_real_title_repeat_is_still_caught():
    assert "제목 반복" in issues("우울 덮기 하나로 감정 다루는 방법을 익혀요", "우울 덮기")
