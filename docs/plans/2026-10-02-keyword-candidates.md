# 키워드 후보 → 승인 (D-B 보강) Implementation Plan

**왜 (10-02, 사용자)**: 새 키워드는 목록(`data/processed/keyword_vocab.json`)에 있어야만 책에 붙는다. 그런데 "합친 키워드가
책이 늘면 다시 분리된다"(target-chips v1.1)를 해 주는 장치가 없어, 엑셀·파이썬·LLM 같은 책이 들어와도 "키워드 없음"으로만
쌓였다. 키워드는 사람이 정한다(CLAUDE.md 원칙 2)는 규칙은 지키면서, **모이는 것은 자동, 만드는 것은 사람 승인**으로 한다.

**흐름**
1. **AI가 후보를 적는다** — 태그 패스 A가 `new_keyword`(문자열, 없으면 "")를 함께 낸다: 책의 중심을 나타내는 키워드가 그 주제
   목록에 **없을 때만**, 우리 말로 2~12자 이름(예: "엑셀", "R"). 주제·목록에 있는 이름은 후보가 아니다. 책 기록에 `keyword_candidate`
   (문자열 또는 null)로 남는다. 짧은 이름뿐이라 예스24 글은 남지 않는다.
2. **사람도 적을 수 있다** — 검수 페이지의 🎯 책마다 "목록에 없는 키워드 후보" 칸(12자), `--apply`가 그대로 기록.
3. **매일 센다** — 모든 추가 파일의 🎯 picked 책에서 (주제, 후보) 별 권수. 같은 이름은 공백·대소문자를 무시해 하나로.
   PR 본문에 "### 키워드 후보" 절: **5권 이상**은 "추가할까요?"로 위에, 나머지는 권수 순 상위 10개.
4. **승인하면 생긴다** — 사용자가 대화에서 승인 → Claude가 `python src/backfill_keywords.py promote "주제:이름" --pattern "..."
   --definition "..."` 실행: 키워드 목록(`kept`, 단어 규칙)과 `docs/target-chips.md` "새 키워드 정의" 표에 한 줄,
   그 후보가 적혔던 책들에 키워드를 붙이고 후보 칸을 비운다 → `npm run books:import`·테스트 → 커밋. 정의 문장은 사용자 확인.

**지키는 것**: 이벤트·처리방침 변화 없음(파이프라인 데이터만). 키워드는 주제를 넘지 않는다. AI 키워드 수 상한(3)은 그대로.
태거 지시문이 바뀌므로 태거 평가 수치는 "지시문 바뀜" 메모와 함께. 기존 책은 이미 10-02 backfill로 단어 규칙 점검을 했다.

## Tasks
- [x] T1 prompt·tagger: `new_keyword` 지시 한 줄 + 스키마(패스 A, 🎯만) + `parse`가 정리(공백, 12자, `<>` 제거, 주제·목록 이름이면 버림, 없으면 None)
- [x] T2 merge.record: 🎯 `keyword_candidate` 저장 (테스트 fakes 갱신)
- [x] T3 검수 페이지 칸 + `--apply`가 `keyword_candidate`를 답에서 가져옴(12자·정리 같은 규칙)
- [x] T4 `pipeline/keyword_candidates.py` 세기 + report.py PR 절
- [x] T5 `backfill_keywords.py promote` (+ 테스트): vocab·정의 표·책 키워드·후보 비우기
- [x] T6 문서: target-chips 2절 한 줄, deploy.md 7절(매일 할 일), context.md (HANDOFF는 병합할 때 메인 세션이)
