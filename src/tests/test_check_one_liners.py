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


# 🍃 질문형 (10-08, user: "…쉽게 알게 돼요?" reads oddly): a question asks the reader; a statement with "?" stuck on is not one
from check_one_liners import form_issue  # noqa: E402


def test_a_real_question_passes():
    for line in ["고조선부터 현대까지, 한국사의 뼈대를 시대별로 잡아 볼까요?", "어떤 책이 나에게 맞을지 궁금하지 않나요?",
                 "귀여운 SD 캐릭터, 얼굴부터 채색까지 차근차근 그려 볼래요?", "혼자 있는 시간이 필요하세요?", "다 내려놓고 쉬고 싶다면요?",
                 "이런 고민, 한 번쯤 해 본 적 있어요?", "정답이 없는 질문 앞에서 기댈 곳이 없어요?"]:
        assert form_issue("leaf", line) is None, line


def test_a_statement_with_a_question_mark_is_not_a_question():
    for line in ["유명 애니 속 장면을 실험으로 풀며 과학 개념을 쉽게 알게 돼요?", "고조선부터 현대까지 한국사의 뼈대를 잡아 봐요?",
                 "왜 어떤 민족은 정복했는지 지리와 생물로 풀어줘요?", "60년 작품 세계를 키워드로 훑어보는 회고전이에요?",
                 "만화로 세포의 구조와 신호전달 같은 개념을 익혀요?", "돈이 도덕을 밀어내는 사례로 시장의 한계를 짚어 보게 해요?",
                 "사라진 문명들의 몰락 원인을 비교하며 교훈을 짚어요?", "영웅의 모험을 편하게 읽어요?"]:   # 10-08: 어요?/아요? too
        assert form_issue("leaf", line) == "질문형인데 평서문에 ?만 붙음", line


def test_the_form_of_each_entry():
    assert form_issue("leaf", "한국사의 뼈대를 시대별로 잡아 봐요") == "질문형인데 ?로 끝나지 않음"
    assert form_issue("target", "엑셀로 공공데이터를 불러와 통계 분석까지 해 봐요") is None
    assert form_issue("target", "엑셀로 통계 분석까지 해 볼까요?") == "요약형인데 물음표로 끝남"
