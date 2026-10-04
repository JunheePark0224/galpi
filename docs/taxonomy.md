# 이벤트 택소노미 — 갈피 (Galpi)

| 버전 | 작성 | 근거 | 상태 |
|---|---|---|---|
| taxonomy v0.2 | 2026-09-30 | 사용자 결정 5건(9절) · `PRD.md` v0.2 4절 · `proposal.md` 4-4 · `PHASES.md` P8·P9 · `balance-game.md` 4절 · `target-chips.md` 5·6절 · `plans/2026-09-30-amplitude.md` · 현재 코드(`web/src/lib/track/*`, `track()` 호출 14곳) | 사용자 결정 반영 |
| taxonomy v0.3 | 2026-10-01 | 개발 라운드 `plans/2026-10-01-taxonomy-dev.md` | **구현 완료 — 코드가 이 문서를 따른다** (8절) |
| taxonomy v0.3.1 | 2026-10-01 | v0.3 최종 검토 | 입력 칸 가림·허용 목록·검사 #11·표현 정리 (8절) |
| taxonomy v0.4 | 2026-10-01 | P4 결과·서버 `plans/2026-10-01-p4-results-server.md` | S-06·S-08 이벤트 live (8절) |
| taxonomy v0.5 | 2026-10-01 | D-D 입력 B안 (PRD F-02, context 10-01) | E-03 `chip_type` "example", E-26 `is_free_text` = 예시 칩 글 그대로면 FALSE (8절) |
| taxonomy v0.5.1 | 2026-10-01 | 최종 검토 (integrate/pilot) | home-nav `round` 변경 기록·3-1a 함수 이름 (8절) |
| taxonomy v0.6 | 2026-10-01 | PRD F-24 "이렇게 이해했어요" (시안 C′) | E-22 `understood`, E-21 `has_missing`·`missing_text`(Supabase only), E-18 `source` "first_page"(book_id null), E-02 `source`, ③ [🍃 그냥 한 권] round +1 (8절) |
| taxonomy v0.7 | 2026-10-01 | DESIGN C-16 책 속 책갈피 (PRD F-12 보이는 부분) | E-27 `bookmark_pulled`·E-28 `bookmark_flipped` live, 동사 `pulled`·`flipped` (8절) |
| taxonomy v0.9 | 2026-10-02 | 밸런스 게임 순서 무작위 (PRD F-03, balance-game 2절) | E-24·E-25 `position` 추가 (8절) |
| taxonomy v0.8 | 2026-10-01 | P5 로그인·내 책갈피 `plans/2026-10-01-p5-login-library.md` | 3-2 결정(Q5), E-29 `shelf_created`·E-30 `bookmark_moved` 추가, 막대 이름은 이벤트에 넣지 않음, E-11~17 설명을 [내 책갈피에 꽂기]로 (8절) |
| taxonomy v0.11 | 2026-10-02 | S-06 ‹ › 앞뒤 넘기기 (PRD F-09, 친구 시험) | E-10 판마다 책당 한 번, 앞뒤 이동 이벤트 없음 (8절) |
| taxonomy v0.12 | 2026-10-02 | S-06 [🔖 꽂기] 제목 옆·늘 보임 (PRD F-12, DESIGN C-16b, 친구 시험) | E-11은 꺼내지 않아도 남음, E-27은 꽂기와 무관한 뒷면 보기 신호. 이벤트·속성·`schema.ts` 변경 없음 (8절) |
| taxonomy v0.10 | 2026-10-02 | 갈피 우체통 (PRD F-26) `plans/2026-10-02-feedback-mailbox.md` | E-31 `feedback_sent` live, 동사 `sent`, 분류 `홈`, `feedback_text` Supabase only, Supabase 사본은 `/api/feedback`이 저장 (8절) |
| taxonomy v1.0 | 2026-10-04 | v2 설계 `plans/2026-10-04-galpi-v2-paths-design.md` 6절 · 계획 2 | 갈림길 이벤트 E-32·E-33·E-34, E-25 속성 교체, 공통 `mode`·`entry`=갈래·`screen_version` v2, 🎯 입력·밸런스 이벤트 6개 `removed` (8절) |
| taxonomy v1.1 | 2026-10-04 | 내 책갈피 끌어서 옮기기 `plans/2026-10-04-library-front-drag.md` | E-30 `method` "drag" 추가("hold"는 보내지 않음), `is_same_shelf` 추가, 같은 막대 안 순서 바꾸기도 남김 (8절) |
| taxonomy v1.2 | 2026-10-04 | 내 책갈피 [모두 제거] (PRD F-13, 시안 `mockups/2026-10-04-v2/library-buttons-options.png` A) | E-35 `library_cleared`(`removed_count`) live, 동사 `cleared`, 모두 빼기는 E-16을 책마다 보내지 않음 (8절) |
| taxonomy v1.3 | 2026-10-05 | 도감 v1 (PRD F-21, `plans/2026-10-05-collection-dex.md`) | E-36 `collection_item_found`·E-37 `collection_viewed` live, 동사 `found`, 분류 `도감`, E-07 `art.rare`의 뜻, 처리방침 6-3g (8절) |

> **이 문서가 이벤트의 원본(SSOT)이다.** 이벤트 이름·속성·값·보내는 곳은 여기서 정하고, 코드는 이 문서를 따른다.
> - `docs/taxonomy.csv` — 이 문서의 **기계가 읽는 사본**. 이벤트 × 속성 한 줄씩. **두 파일은 항상 같은 커밋에서 함께 고친다** (7절).
> - `PRD.md` 4절 — 이벤트 ID(`E-xx`)와 이름·한 줄 설명만 둔다. 속성·값·발생 시점의 상세는 이 문서가 최신이다.
> - 이름·속성은 v0.3(2026-10-01)부터 **코드와 같다**. 4절의 "현재 → 제안" 열은 그 개발 라운드(4-4)의 마이그레이션 기록으로 남긴다.

---

## 1. 목적과 원칙

### 1-1. 이 택소노미가 답해야 할 질문

택소노미는 분석의 도구이지 목적이 아니다. 아래 질문에 답하는 데 필요한 이벤트·속성만 둔다. 질문에 쓰이지 않는 이벤트는 만들지 않는다.

| ID | 질문 | 출처 |
|---|---|---|
| Q-01 | **퍼널** — 처음 화면 → 입구 → 입력 완료 → 책 펼치기 → 책갈피 1장 → 5장 → 궁금해요 책 보기 → 예스24. 어디서 가장 많이 빠지나 | proposal 4-4 |
| Q-02 | **책갈피 위치별 이탈** — 몇 번째 책갈피에서 그만두나, 5개가 적당한가 | proposal 4-4 |
| Q-03 | **다시 뽑기** — 5장을 보고 더 보는 사람은 얼마나 되나, 궁금해요 0개일 때 무엇을 누르나 | proposal 4-4, PRD F-10 |
| Q-04 | **궁금해요** — 한 판에 몇 개, 0개인 판의 비율, 어떤 책·어떤 한 줄에 몰리나 | proposal 4-4 |
| Q-05 | **입구** — 🎯/🍃 비율, 입구별 완주율·궁금해요 | proposal 4-4 |
| Q-06 | **첫 장 고치기** — 고치는 비율, 무엇을 고치나 (입력이 상황을 잘 담는가) | proposal 4-4 |
| Q-07 | **한 줄 말투** — 요약형 vs 질문형 궁금해요율 (말투가 입구에 묶여 있어 입구 차이와 섞인다) | proposal 4-4 |
| Q-08 | **추천 4 vs 무작위 1** — 궁금해요율 차이 (테스트가 추천을 좋게 했나) | balance-game 4절 ①, target-chips 6절 ①, PHASES P8 |
| Q-09 | **밸런스 게임 검증** — 질문별 "갈피를 못 잡겠어요" 비율, 망설임(뗀 횟수), 같은 축 두 질문 일치율, 질문별 효과(답 = 책 태그일 때 궁금해요가 더 많은가), 몇 번째 질문에서 그만두나, 답하는 시간 | balance-game 4절 ⓪~③ |
| Q-10 | **🎯 입력 검증** — 보기 vs 직접 쓰기 비율과 각각의 궁금해요, 찾은 책 0 / 1~3 / 4+ 별 궁금해요·이탈, 못 찾은 요청 목록, 요청 적중률(키워드에 연결된 비율) | target-chips 2·6절, PHASES P8 |
| Q-11 | **결과 화면** — 궁금해요 → 예스24 클릭 비율, [더 보기] 비율(추천/무작위), 책 속 책갈피를 꺼내 보는 비율과 뒷면(나온 이유)까지 보는 비율(추천/무작위, v0.7) | proposal 4-4, PRD F-09·F-12, PHASES P8 |
| Q-12 | **보관 → 로그인** — 보관 → 로그인 창 → 로그인 완료 → 자동 보관 비율, 카카오·구글 비율 | PRD 4절 "새로 볼 수 있는 것", PHASES P8 |
| Q-13 | **재방문·내 책갈피** — 재방문 후 내 책갈피를 여는 비율. 막대를 만들고 책갈피를 옮기는(꾸미는) 사람이 내 책갈피를 더 자주 여나, 옮기기를 꾹 누르기와 뒷면 메뉴 중 어느 쪽으로 하나 (v0.8) | PRD 4절, F-13 |
| Q-14 | **기기** — 휴대폰/데스크톱, 앱 안 브라우저 비율, 앱 안 브라우저에서 구글 로그인 실패 | context 09-29(모바일 우선), PRD F-20 |
| Q-15 | **2단계 전후 비교** — 고친 것 하나의 전후 차이(효과 크기 + 신뢰구간), 유입 경로별로 나눠 보기 | proposal 4-4, PHASES P9 |

### 1-2. 설계 원칙 — 참고한 글과 갈피에 적용한 것

마티니(martinee) 블로그 다섯 편을 읽고 갈피에 맞게 옮겼다. 문장은 옮기지 않고 요지만 적는다.

| 원칙 (요지) | 출처 | 갈피에 적용 |
|---|---|---|
| 택소노미는 분석 도구다. 설계 전에 목적·방향을 분명히 하고, 분석 관점(쓰는 사람)과 구현 관점(심는 사람)을 함께 본다 | [네이버 시리즈 1편](https://blog.martinee.io/post/designing-perfect-event-taxonomy-naver-series) | 1-1 질문표가 먼저, 이벤트는 그 뒤. 이벤트마다 "분석 질문" 칸을 둔다 |
| 이벤트 카테고리 = 최종 전환까지 이어지는 퍼널 한 묶음. 이벤트 = 행동, 속성 = 그 순간의 추가 정보 | 네이버 시리즈 1편 | 분류(2-5)를 이용 흐름의 단계로 둔다. 전환은 두 개 — 궁금해요(관심)와 예스24 클릭·보관(행동) |
| 네이밍 컨벤션은 선택이 아니라 필수. 누가 봐도 유추할 수 있게, 소문자 + 밑줄(snake_case) | [네이버 시리즈 2편](https://blog.martinee.io/post/designing-perfect-event-taxonomy-naver-series-2) | 2절 규칙. 이 문서의 테스트(7절)가 규칙을 기계로 검사한다 |
| 전환까지 꼭 필요한 경로(critical path)만 이벤트로. 경로의 갈래는 이벤트를 늘리지 말고 속성으로 | 네이버 시리즈 2편 | 같은 버튼이 여러 화면에 있으면 이벤트 하나 + `source` 속성 (예스24·로그인 창·처음으로) |
| view와 click은 둘 다 필요할 때만 함께 둔다. view는 여러 경로로 같은 화면에 오거나 화면 정보가 전환에 영향을 줄 때 쓸모 있고, 새로고침 중복·의도 불명확이라는 위험이 있다 | 네이버 시리즈 2편, [꿀팁 2편](https://blog.martinee.io/post/designing-taxonomy-honeytip-2) | view는 5개뿐(방문·책갈피 노출·결과·로그인 창·내 책갈피). `bookmark_shown`은 새로고침 복원 때 다시 보내지 않는다 |
| 모든 행동을 잡지 않는다. 분석에 쓸 곳이 없는 이벤트는 비용(Amplitude는 이벤트 수 과금)과 혼란만 늘린다. `1 − 전환율`로 계산되는 것은 따로 잡지 않는다 | 꿀팁 2편 | 4-3절 "이벤트로 만들지 않는 것". 패스율은 `bookmark_reacted` 한 이벤트의 `reaction` 값으로 |
| 이벤트로 나눌지 속성으로 나눌지는 분석 편의로 정한다. 늘 따로 봐야 하는 두 퍼널이면 이벤트를 나누는 게 낫고, 합쳐 보기는 나중에 쉽다 | 꿀팁 2편 | 🍃·🎯는 입력 화면만 다르고(→ `balance_answered` vs `chip_selected`) 그 뒤 화면은 같다 → 공통 이벤트 + 공통 속성 `entry`. Amplitude에서 `entry`로 나눠 본다 |
| 이벤트 흐름도(패스)와 택소노미 시트는 따로 끝내지 말고 함께 고친다 | [꿀팁 1편](https://blog.martinee.io/post/designing-taxonomy-honeytip-1) | 흐름·퍼널은 이 문서(4·5절), 시트는 `taxonomy.csv` — 같은 커밋에서 함께 고친다 |
| 유저 속성 = 행동과 상관없이 오래 유지되는 값, 이벤트 속성 = 이벤트마다 바뀔 수 있는 값 | [꿀팁 3편](https://blog.martinee.io/post/designing-taxonomy-honeytip-3) | 3절. 기기·입구·회차는 한 사람 안에서도 바뀌므로 이벤트 속성 |
| 속성 상속(앞 이벤트 속성을 뒤 이벤트에 계속 싣기)은 전환율 계산을 쉽게 하지만 퍼널 순서를 굳힌다. 퍼널을 가르는 속성(예: 유입 루트)을 따로 둔다 | 꿀팁 3편 | 상속하지 않는다. 한 판은 `(session_id, round)`로, 책은 `book_id`로 잇는다. Amplitude 퍼널에 꼭 필요한 `pick_type`·`position`만 여러 이벤트에 싣는다 |
| 속성 이름은 한 뜻·한 구조로. 비슷한 이름이 다른 뜻으로 섞이면 분석이 어려워진다 | 꿀팁 3편 | "한 이름 = 한 뜻 = 한 타입" (2-3). 지금 `question`이 문항 번호(Number)와 칸 이름(String) 두 뜻으로 쓰여 나눈다 |
| QA 단계에서 설계대로 쌓이는지 로그로 확인한다 | 네이버 시리즈 1·2편 | 7절 자동 검사 + PHASES P6 전수 점검 |

---

## 2. 명명 규칙

### 2-1. 이벤트 이름

- **snake_case, 영어 소문자, `대상_동작(과거형)`** — 예: `bookmark_reacted`, `login_prompt_shown`
- 대상은 화면에 보이는 사물(책갈피·책·로그인 창·내 책갈피)이나 입력(칩·목표)으로 쓴다. 화면 ID(S-05)나 컴포넌트 이름은 쓰지 않는다
- 동작은 2-2 목록의 동사만. 새 동사가 필요하면 목록부터 고친다
- 🍃/🎯 접두어를 붙이지 않는다 — 입구는 공통 속성 `entry`로 나눈다 (1-2)
- 한 이벤트 = 한 순간. 같은 순간에 두 이벤트가 나는 것은 서로 다른 질문에 답할 때만 허용 (`goal_submitted` + `free_goal_written`)

### 2-2. 허용 동사

| 동사 | 뜻 | 트리거 |
|---|---|---|
| `visited` | 사이트(페이지)가 열렸다 | view |
| `viewed` | **화면** 하나가 보였다 | view |
| `shown` | 화면 안의 **요소**(책갈피·창)가 나타났다 | view |
| `selected` | 여러 보기 중 하나를 골랐다 | click |
| `answered` | 질문에 답했다 | click |
| `reacted` | 반응 버튼(패스/궁금해요)을 눌렀다 | click |
| `clicked` | 버튼·링크를 눌렀다 (결과가 따로 이벤트로 남지 않는 누름) | click |
| `opened` | 닫힌 것을 열었다 | click |
| `expanded` | 접힌 내용을 펼쳤다 | click |
| `pulled` | 꽂혀 있던 것을 꺼냈다 (S-06 책 속 책갈피, v0.7) | click |
| `flipped` | 뒤집어 뒷면을 보았다 (책갈피 뒷면, v0.7) | click |
| `cancelled` | 하던 동작을 끝내지 않고 멈췄다 | click |
| `started` | 여러 단계 과정을 시작했다 | click |
| `submitted` | 입력 묶음을 제출했다 | submit |
| `written` | 자유 글을 적어 제출했다 | submit |
| `edited` | 이미 낸 입력을 고쳐 다시 냈다 | submit |
| `checked` | 시스템이 결과를 확인했다 | system |
| `completed` | 과정이 성공으로 끝났다 | system |
| `saved` / `unsaved` | 보관했다 / 보관에서 뺐다 | system / click |
| `created` | 이용자가 새것을 만들었다 (내 책갈피 막대, v0.8) | click |
| `moved` | 이용자가 자리를 옮겼다 (책갈피를 다른 막대로, v0.8 · 같은 막대 안 다른 자리로, v1.1) | click |
| `sent` | 이용자가 쓴 글을 보냈고 서버가 저장했다 (갈피 우체통, v0.10) | click |
| `cleared` | 이용자가 모두 비웠다 (내 책갈피 [모두 제거] → 확인, 서버가 지운 뒤, v1.2) | click |
| `found` | 처음 만났다 — 서버가 새 항목으로 기록한 뒤 (도감, v1.3) | system |

### 2-3. 속성 이름

- snake_case, 영어 소문자. **한 이름 = 한 뜻 = 한 타입** — 다른 이벤트에서도 같은 이름이면 같은 뜻·같은 타입
- 참/거짓(Boolean)은 `is_` / `has_`로 시작 — `is_edit`, `is_logged_in`
- 개수는 `_count` (`curious_count`), 시간(ms)은 `_ms` (`elapsed_ms`, `held_ms`)
- 순서: 목록 안의 자리는 `position`(1부터), 고정된 대상의 번호는 `_no` (`question_no` — 5번 문항은 늘 같은 문항)
- ID는 `_id` (`book_id` = ISBN-13 문자열)
- 같은 버튼이 여러 화면에 있으면 `source`로 어느 화면인지
- **공통 속성(3절) 이름을 이벤트 속성으로 다시 쓰지 않는다** (지금 `entry_selected`·`first_page_edited`가 `entry`를 다시 보냄 → 삭제)
- 중첩 객체는 쓰지 않는다. 예외 하나: `art`(책갈피 그림 조합) — PRD D-05 보관 데이터와 같은 모양이라 그대로

### 2-4. 값

- 열거형 값은 영어 소문자 snake_case — `"curious"`, `"first_page"`
- **예외 1 — 시스템 키**: 책 표(`books`)·태그에서 쓰는 한국어 키는 그대로 보낸다(주제 `"데이터 분석"`, 읽는 방식 `"실습"`, 키워드 `"SQL"`). SQL에서 책 표와 바로 이어 붙이기 위해서다
- **예외 2 — 문서 표기**: 밸런스 답 `"A"`/`"B"`는 `balance-game.md` 표의 열 이름, 구간 `"0"`/`"1-3"`/`"4+"`는 PRD E-22 표기 그대로
- 값이 없음 / "상관없음"은 `null`. 빈 문자열을 쓰지 않는다 (예외: `referrer`는 브라우저가 주는 빈 문자열 그대로)
- 배열은 같은 타입만 (`keywords`, `changed_items`)
- 화면 문구(한국어 라벨)는 값으로 보내지 않는다 — 문구가 바뀌어도 값은 그대로여야 한다

### 2-5. 분류 (Event Category)

이용 흐름의 단계 순서. 퍼널의 한 묶음이다.

| 분류 | 화면 | 이벤트 |
|---|---|---|
| 진입 | S-01 | E-01, E-02 |
| 갈림길 | S-02 | E-32, E-25, E-33, E-34 (v1.0) |
| ~~밸런스게임~~ · ~~목표입력~~ | ~~S-02 🍃 · 🎯~~ | v1.0 없앰 — E-24, E-03·E-26·E-21·E-22 (`removed`) |
| 책펼치기 | S-03, S-04 | E-05, E-06 |
| 책갈피 | S-05 | E-07, E-08 |
| 결과 | S-06 | E-09, E-10, E-23, E-27, E-28, E-18 |
| 보관 | S-06, S-09 | E-11, E-15, E-16 |
| 로그인 | S-07 | E-12, E-13, E-14 |
| 내 책갈피 | S-09 | E-17, E-29, E-30, E-35 (v1.2) |
| 도감 | S-05(처음 만남)·S-09(도감 보기) | E-36, E-37 (v1.3) |
| 마무리 | S-08 (E-20은 S-04의 막다른 길에서도) | E-19, E-20 |
| 홈 | S-01 (퍼널 밖 — 갈피 우체통, v0.10) | E-31 |
| 공통 | — | 공통 속성 (csv의 `*` 줄) |

### 2-6. 트리거 (Trigger)

| 값 | 뜻 |
|---|---|
| `view` | 화면·요소가 보일 때 |
| `click` | 누를 때 (탭, 꾹 누르기 완료, 누르다 떼기 포함) |
| `submit` | 입력 묶음을 제출할 때 (검사를 통과했을 때만) |
| `system` | 사람의 누름이 아니라 서버 응답·저장 성공 같은 결과가 확인될 때 |
| `-` | 공통 속성 줄 (csv) |

### 2-7. 보내는 곳 (Integration)

| 값 | 경로 | 비고 |
|---|---|---|
| `SDK` | 화면 코드에서 `track(name, props)` 하나 → ① `/api/track` → Supabase `events`(원본) ② 같은 이름·속성을 Amplitude 브라우저 SDK로 | 지금 모든 이벤트. Amplitude가 꺼져 있거나(키는 Production에만) 실패해도 ①은 영향 없음. **예외 하나 — E-31 `feedback_sent`(v0.10)**: 저장을 확인해야 "잘 받았어요"를 보이므로 ①은 `/api/feedback`이 직접 한다(같은 `saveEvent`·같은 서버 확인 `user_id`, 공통 속성은 브라우저가 보낸 것). 2xx를 받은 뒤 화면이 `trackStored(name, props, common)`으로 ②만 보낸다 — 같은 공통 속성, `Supabase only` 속성은 빠짐 |
| `Server` | 서버 라우트가 `saveEvent()`로 `events`에 직접 쓰기 (Amplitude는 HTTP API, device_id = anon_id) | **예약만**. 지금 없음. 쓰게 되면 공통 속성을 요청에서 받아 같은 모양으로 채운다 |
| `Autocapture` | Amplitude가 스스로 모으는 이벤트 (`[Amplitude] …` 이름) | Supabase에 없음. 이 택소노미의 지표 정의에는 쓰지 않는다 (3-3) |

**속성 단위 예외 — `Supabase only` / `Amplitude only`** (v0.2). Integration은 이벤트 단위(`SDK`)지만, 같은 이벤트의 **속성 하나만 한쪽에만 보낼 수 있다.** csv에서는 그 속성 줄의 Note에 `Supabase only` 또는 `Amplitude only`로 적는다(Integration 열은 `SDK` 그대로).

| 속성 | 표시 | 뜻 |
|---|---|---|
| E-21 `missing_text` (v0.6) | **`Supabase only`** | 분류가 적은 글에서 뽑은 "우리 키워드에 없는 구체적인 것"(≤20자, F-24). 적은 글에서 나온 말이라 `goal_text`와 같이 Amplitude 사본에서 뺀다 — Amplitude에는 `has_missing`(예/아니오)만 간다. 처리방침 6-3c |
| E-31 `feedback_text` (v0.10) | **`Supabase only`** | 갈피 우체통에 적은 글(≤500자). Amplitude 사본에는 `text_length`(글자 수)만 간다. 처리방침 6-3e |
| E-21 `goal_text` | **`Supabase only`** | 직접 쓴 글(≤30자)은 Supabase `events.props`에만 저장한다. **같은 이벤트의 Amplitude 사본에는 이 속성이 없다** — `topic`·`keywords`·`is_matched`·`method`는 그대로 간다. 이유·처리방침 변경은 6-2·6-3 |
| E-01 `prompt_version` | `Amplitude only` | 강사 안내문 6단계 설치 확인값 (기존) |

구현 규칙: `track()`이 Amplitude로 넘기기 전에 `Supabase only` 속성을 뺀다. 어떤 속성이 `Supabase only`인지는 코드에서도 한 곳(`schema.ts`의 명세)에 두어 문서와 어긋나지 않게 한다. v0.3부터 `EVENT_SPEC`의 `only: "supabase"`가 그 목록이고(`props.ts`의 `forAmplitude`가 뺀다), taxonomy 테스트 #7이 csv Note의 `Supabase only`·`Amplitude only`와 대조한다.

**Amplitude 경로 — 개발 라운드 항목** (Amplitude 검토, 2026-09-30 — **v0.3에서 구현**: `amplitude.ts`의 대기열·`time`)

| # | 항목 | v0.3 전 코드 | v0.3에서 바꾼 것 |
|---|---|---|---|
| a | **Amplitude가 시작되기 전 이벤트도 큐에 받는다** | `sendToAmplitude`가 `started`가 아니면 바로 버린다(`if (!started \|\| failed) return`). 시작(`startAmplitude`)은 루트 레이아웃의 `AmplitudeInit`이 마운트될 때라, 그보다 먼저 나는 이벤트(예: 홈 `site_visited`)가 사라질 수 있다 | 시작 여부와 관계없이 큐(상한 있음)에 쌓고, SDK가 올라오면 순서대로 넘긴다. 키가 없으면 큐도 쌓지 않는다(꺼진 환경에서 메모리만 쓰지 않게). 테스트: "init 컴포넌트가 늦게 마운트돼도 그 전 이벤트가 전달된다" |
| b | **큐에 있던 이벤트는 원래 시각(`time`)을 유지한다** | 큐를 넘길 때 `track(name, props)`만 호출해 Amplitude가 **넘긴 시각**을 이벤트 시각으로 잡는다 — 퍼널 순서·소요 시간이 틀어진다 | 이벤트를 큐에 넣는 순간 `time`(ms)을 기록하고, `amplitude.track(name, props, { time })`으로 넘긴다. 테스트: "큐에서 나온 이벤트의 time이 넣은 시각과 같다" |

Supabase 경로는 두 항목과 무관하다(이미 즉시 전송, `created_at`은 서버 시각). 두 항목은 P7 전에 끝내야 P6 두 곳 수 대조가 맞는다.

### 2-8. 상태 (Status, csv의 줄 단위)

| 값 | 뜻 |
|---|---|
| `live` | 지금 코드가 보냄 (이름이 바뀐 것은 Note에 "이전 이름") |
| `planned-P4` / `planned-P5` | PRD에 있고 해당 Phase에서 심음 |
| `planned-taxonomy` | PRD에 있고(또는 PRD에 반영되는 승인 완료 변경) **택소노미 개발 라운드**(4-4, P7 전)에서 심음 — 새 이벤트, 기존 이벤트의 속성 추가. **v0.3에서 모두 처리 — 지금 이 상태의 줄은 없다** |
| `proposed` | 이 문서가 새로 제안 — PRD·사용자 승인 전. 승인되면 `planned-*`로. **v0.2에서 남은 `proposed`는 없다** (전부 승인됨, 9절) |
| `removed` | 없앰 (줄은 남기고 변경 기록에 이유) |

---

## 3. 공통 속성

`lib/track/common.ts`의 `commonProps()`가 모든 이벤트에 붙인다. Supabase에서는 `events.common`(jsonb), 이벤트 속성은 `events.props`, 시각은 `events.created_at`(서버 시각)이다.

### 3-1. 속성별 보내는 곳과 종류

| 속성 | 현재 → 제안 | 타입 | 뜻 | Supabase | Amplitude |
|---|---|---|---|---|---|
| `anon_id` | 같음 | String | 브라우저 익명 번호 (localStorage UUID) | common | **device_id** (식별자, 속성 아님) |
| `user_id` | 같음 | String \| null | 로그인 후 Supabase Auth UUID (P5) | common | **user_id** — `/api/track`이 로그인 세션으로 채움, 브라우저 값은 버림 (3-2, v0.8) |
| `session_id` | 같음 | String | 탭 단위 세션 (sessionStorage) | common | 보내지 않음 — Amplitude는 자체 세션(30분 규칙)을 쓴다. 두 세션 수는 다를 수 있다 |
| `round` | 같음 | Number | 회차 = 판 번호 (1부터, 탭마다). **+1 규칙은 3-1a** | common | 이벤트 속성 |
| `entry` | v1.0: 뜻만 바뀜 | String \| null | **갈래** — 두 번째 질문의 답. `leaf`=이야기에 빠지기, `target`=뭔가 배우기. 고르기 전·갈피를 못 잡겠어요(섞어서)·처음으로 뒤는 null. 도전이어도 고른 갈래 그대로. 값이 v1 입구(🍃=leaf, 🎯=target)와 같아 v1 기록과 이어 볼 수 있다 | common | 이벤트 속성 (null이면 생략) |
| `mode` | 추가 (v1.0) | String \| null | **길의 모드** — 첫 질문의 답. `normal`=평소 끌리는 쪽(갈피를 못 잡겠어요도), `challenge`=오늘은 낯선 쪽으로 도전. 첫 답 전·처음으로 뒤는 null | common | 이벤트 속성 (null이면 생략) |
| `screen_version` | 같음 | String | 화면 버전 `v1` → 2단계 `v2` (F-18) — v1.0부터 `v2` | common | 이벤트 속성 |
| `referrer` | 같음 | String | 들어온 곳, 500자 | common | 보내지 않음 — Amplitude는 자동 수집(최초 유입)으로 따로 가진다 |
| `is_returning` | `returning` → `is_returning` | Boolean | 세션 시작 때 이전 기록이 있었나 | common | 이벤트 속성 |
| `device` | 같음 | String | `phone` / `desktop` | common | 이벤트 속성 |
| `is_in_app_browser` | `in_app_browser` → `is_in_app_browser` | Boolean | 카톡 등 앱 안 브라우저 | common | 이벤트 속성 |

#### 3-1a. `round` 규칙 (v0.2 확정)

`round`는 한 탭(`session_id`) 안에서 **뽑기 묶음(판)** 을 세는 번호다. 탭이 새로 열리면 1에서 시작한다(`sessionStorage`라 새로고침해도 유지).

| 언제 | round |
|---|---|
| 탭에서 처음 시작 | 1 |
| **[다시 뽑기]**(E-19)를 누를 때 | **+1** |
| 같은 탭에서 **[처음으로]**(E-20)를 눌러 다시 시작할 때 (새 판) | **+1** |
| S-04 [← 질문으로 돌아가기] → 다시 답해 재뽑기(같은 답이면 같은 다섯 장), 새로고침·뒤로 가기·버려진 탭 복원으로 같은 장 복원 | 그대로 (같은 판) |
| ~~**F-24 ③**(맞는 주제 없음 — 뽑기 없음)에서 **[🍃 그냥 한 권]** (v0.6)~~ | **+1** — E-02(`source`=first_page)를 보내기 **직전**. 끝 이벤트는 없다(그 🎯 판은 E-22 `understood`=none으로 끝난 것이 보인다). 한 판 = 한 입구로 두어 🎯 판과 🍃 판이 섞이지 않게. 구현: `Flow.tsx`의 `switchToLeaf`가 `nextRound()` → `setEntry("leaf")` → E-02 (`settleOpen`처럼 이벤트 없는 +1) — v1.0 없앰 |
| S-02 **첫 질문**의 [← 이전 질문] — 처음 화면으로 (v1.0) | **+1** — E-20(`source`=question)을 보낸 직후. 그 판은 답이 하나도 없이 끝난다 |
| 주소 다시 입력·링크·헤더 로고·/privacy [처음으로]로 **새로 열어** S-01에서 시작할 때, 저장돼 있던 흐름이 판 도중(step이 home이 아님)이었다 | **+1** (이벤트는 보내지 않는다 — 끝 이벤트 없이 끊긴 판이 곧 이탈 신호). 이미 처음 화면이었다면 그대로 |

- **+1은 E-19·E-20을 보낸 직후**에 한다. 그 이벤트 자체는 **끝나는 판의 round**를 싣고(그 판의 `curious_count`와 같은 판), 그다음 이벤트(`entry_selected` 등)부터 새 값을 싣는다.
- [처음으로]는 S-04(뽑기 실패·책 없음)에서 눌러도 똑같이 +1 한다(`source=first_page`) — 끝난 판과 새 판을 섞지 않는다. 이용자가 [처음으로] 뒤 아무것도 하지 않고 나가도 부작용이 없다(다음 이벤트가 없다).
- 이 규칙이 없으면 [처음으로] 뒤 재시작이 앞 판과 `(session_id, round)`가 같아져 두 판이 한 판으로 섞인다(5-1).
- **새로 열기 (10-01)**: 흐름 복원은 문서를 불러온 방식으로 가른다 — `reload`·`back_forward`·`document.wasDiscarded`면 이어가고, 그 밖의 `navigate`(주소 입력·링크·로고)면 S-01에서 시작한다. 이때 이 탭에서 이미 본 책(`seen`)은 그대로 제외한다. 판 도중이었다면 round +1과 `entry` null은 이 문서의 `site_visited`를 보내기 **전에** 정해진다(그 방문이 새 판의 첫 이벤트). 구현은 `web/src/lib/flow/storage.ts`의 `shouldResume`(이어갈지 판정)·`settleOpen`(문서마다 한 번 정해 `TrackVisit`이 `site_visited` 전에 부름).
- **구현 (v0.3)**: `track()`이 `ROUND_ENDING_EVENTS`(`schema.ts` — E-19·E-20)를 두 곳에 보낸 **직후** `nextRound()`를 부른다. 화면 코드는 round를 만지지 않는다 — P4의 [다시 뽑기]는 E-19를 보내기만 하면 된다.

**유저 속성으로 올리지 않는 이유**: 꿀팁 3편의 기준(오래 유지되는가)으로 보면 입구·회차·화면 버전·기기·재방문 여부는 한 사람 안에서도 바뀐다 → 모두 이벤트 속성. 지금 코드(`amplitude.ts`)도 그렇게 보낸다.

### 3-2. Amplitude 식별자와 유저 속성 (**P5 결정, 2026-10-01**)

> 9절 Q5: 후보안 그대로 채택. 더해서 `user_id`는 **서버가 로그인 세션에서 채운다**.

- 로그인 전: device_id = `anon_id` 하나로 이어진다 (Supabase `common.anon_id`와 같은 값)
- 로그인(E-14) 순간: 브라우저가 `amplitude.setUserId(user_id)` — 로그인 전·후 기록이 한 사람으로 이어진다 (PRD F-17). Supabase는 같은 `anon_id`로 잇는다. 로그아웃하면 `setUserId(undefined)`(같은 기기의 다음 기록이 앞 사람에게 붙지 않게), `anon_id`는 그대로
- **`common.user_id`는 `/api/track`이 로그인 세션 쿠키로 확인한 Supabase 사용자 UUID로 덮어쓴다** — 브라우저가 보낸 값은 쓰지 않는다(남의 UUID를 적어 보내도 기록되지 않게). 세션이 없으면 null
- 유저 속성은 **`login_provider`(`kakao`/`google`) 하나만** — 처음 로그인한 방법으로 계속 들어오도록 안내하므로(PRD 3-3) 오래 유지되는 값이다. 가입 시각은 Supabase `profiles`(D-04)에 있다
- 이름·이메일·카카오/구글 고유번호는 유저 속성에도 넣지 않는다 (6절)

### 3-3. Autocapture (Amplitude만)

`initAll`의 `autocapture: true`로 Amplitude가 페이지 보기·세션 시작/끝·요소 누름·폼 같은 이벤트를 `[Amplitude] …` 이름으로 스스로 모은다(정확한 목록은 설치된 `@amplitude/unified` 버전의 기본값 — Amplitude Data 화면에서 확인). Session Replay는 방문자 20%, 입력칸은 가림(`defaultMaskLevel: "medium"`).

- 이 이벤트들은 **Supabase에 없다** → 두 곳 수 대조(P6)와 5절 지표 정의에 쓰지 않는다
- 보조로만 쓴다: 막힌 곳 찾기(연타·반응 없는 누름), 리플레이로 이탈 직전 화면 보기
- 갈피 이벤트와 이름이 겹치지 않는다(`[Amplitude]` 접두어). 같은 순간을 두 번 세지 않도록, 지표는 갈피 이벤트로만 정의한다

---

## 4. 이벤트 목록

### 4-1. 한눈에 보기

상태 (v1.3): live 30 · removed 6 · planned 0. v1.2: live 28. v1.0: live 27. v0.10: live 30 · planned-P4 0 · planned-P5 0 · planned-taxonomy 0. P4(결과·서버)는 S-06·S-08의 이벤트를 화면과 함께 심는다 — 남는 planned 없음(v0.8 — P5 이벤트 모두 live). v0.7: S-06 책 속 책갈피(C-16)의 E-27·E-28을 화면과 함께 심음. v0.8: P5 막대(E-29·E-30) 추가 — 화면과 함께 live로. v0.10: 갈피 우체통(E-31) 추가 — 화면과 함께 live로. v1.2: 내 책갈피 [모두 제거](E-35) 추가 — 화면과 함께 live로

| ID | 제안 이름 | 이전 이름 | 분류 | 트리거 | 상태 |
|---|---|---|---|---|---|
| E-01 | `site_visited` | `visit` | 진입 | view | live |
| E-02 | `entry_selected` | 같음 | 진입 | click | live |
| E-24 | `balance_answered` | 같음 | 밸런스게임 | click | removed |
| E-25 | `unsure_hold_cancelled` | 같음 | 갈림길 | click | live |
| E-32 | `question_answered` | (없음, v1.0 — E-24 대신) | 갈림길 | click | live |
| E-33 | `question_back_clicked` | (없음, v1.0) | 갈림길 | click | live |
| E-34 | `path_completed` | (없음, v1.0) | 갈림길 | system | live |
| E-03 | `chip_selected` | 같음 | 목표입력 | click | removed |
| E-26 | `goal_submitted` | (없음) | 목표입력 | submit | removed |
| E-21 | `free_goal_written` | `goal_free_written` | 목표입력 | submit | removed |
| E-22 | `goal_coverage_checked` | `goal_coverage` | 목표입력 | system | removed |
| E-05 | `book_opened` | 같음 | 책펼치기 | click | live |
| E-06 | `first_page_edited` | 같음 | 책펼치기 | submit | removed |
| E-07 | `bookmark_shown` | 같음 | 책갈피 | view | live |
| E-08 | `bookmark_reacted` | 같음 | 책갈피 | click | live |
| E-09 | `result_viewed` | 같음 | 결과 | view | live |
| E-10 | `result_book_viewed` | 같음 | 결과 | view | live |
| E-23 | `description_expanded` | 같음 | 결과 | click | live |
| E-27 | `bookmark_pulled` | (없음, v0.7) | 결과 | click | live |
| E-28 | `bookmark_flipped` | (없음, v0.7) | 결과 | click | live |
| E-18 | `yes24_link_clicked` | `yes24_clicked` (PRD) | 결과 | click | live |
| E-11 | `save_clicked` | 같음 | 보관 | click | live |
| E-15 | `book_saved` | 같음 | 보관 | system | live |
| E-16 | `book_unsaved` | 같음 | 보관 | click | live |
| E-12 | `login_prompt_shown` | 같음 | 로그인 | view | live |
| E-13 | `login_started` | 같음 | 로그인 | click | live |
| E-14 | `login_completed` | 같음 | 로그인 | system | live |
| E-17 | `library_viewed` | 같음 | 내 책갈피 | view | live |
| E-29 | `shelf_created` | (없음, v0.8) | 내 책갈피 | click | live |
| E-30 | `bookmark_moved` | (없음, v0.8) | 내 책갈피 | click | live |
| E-35 | `library_cleared` | (없음, v1.2) | 내 책갈피 | click | live |
| E-36 | `collection_item_found` | (없음, v1.3) | 도감 | system | live |
| E-37 | `collection_viewed` | (없음, v1.3) | 도감 | view | live |
| E-19 | `redraw_clicked` | 같음 | 마무리 | click | live |
| E-20 | `home_clicked` | 같음 | 마무리 | click | live |
| E-31 | `feedback_sent` | (없음, v0.10) | 홈 | click | live |

E-04 `situation_written`은 PRD에서 삭제(09-29)되어 목록에 없다. 모든 이벤트가 `schema.ts`의 `EVENT_SPEC`에 속성까지 들어 있다(30개 — `EVENT_NAMES`는 그 키, v1.2 E-35 추가, v1.3 E-36·E-37 추가. `removed` 6개는 csv·이 문서에 기록으로만). v0.8부터 planned 없음.

### 4-2. 이벤트별 상세

모든 이벤트에 3절 공통 속성이 붙는다. 아래 표는 이벤트 고유 속성만. 타입의 `[]`는 배열(csv의 Array = TRUE).

#### E-01 `site_visited`

| 분류 | 트리거 | 상태 | 현재 → 제안 |
|---|---|---|---|
| 진입 | view | live | `visit` → `site_visited` |

**언제**: 홈 주소(/) 페이지가 열릴 때 1번 (app/page.tsx TrackVisit 마운트). 새로고침·앱 안 브라우저 재로딩 때도 남음 — 새로고침·뒤로 가기·버려졌다 복원된 탭은 흐름을 sessionStorage로 이어가고, 주소를 다시 입력하거나 링크·헤더 로고·처리방침의 [처음으로]로 새로 열면 S-01에서 시작하며 진행 중이던 판이 있었다면 round +1(끝 이벤트 없이 둔 판 = 이탈). 이벤트 이름·속성은 그대로. /privacy에서는 남지 않음  
**분석 질문**: Q-01, Q-14, Q-15

| 속성 | 현재 → 제안 | 타입 | 값 | 설명 |
|---|---|---|---|---|
| `prompt_version` | 같음 | String | "BA400.4" | Amplitude 설치 확인값 (강사 안내문 6단계) — Amplitude로만 보냄 (Supabase props에는 없음) |

#### E-02 `entry_selected`

| 분류 | 트리거 | 상태 | 현재 → 제안 |
|---|---|---|---|
| 진입 | click | live | 같음 |

**언제**: S-01 [갈피 잡으러 가기]를 누를 때(source=home). v1.0부터 first_page 값은 나오지 않는다(F-24 ③ 없앰). 누르기 직전에 공통 entry·mode가 null로 정해지고, 갈래·모드는 질문에 답하며 정해진다  
**분석 질문**: Q-01, Q-05, Q-10

| 속성 | 현재 → 제안 | 타입 | 값 | 설명 |
|---|---|---|---|---|
| `source` | 추가 (v0.6, F-24) | String | "home", "first_page" | 누른 화면 — home=S-01 입구 버튼, first_page=S-04 ③(맞는 주제 없음)의 [🍃 그냥 한 권]. 퍼널 FN-1·FN-2는 source=home으로 센다 |

#### E-24 `balance_answered`

| 분류 | 트리거 | 상태 | 현재 → 제안 |
|---|---|---|---|
| 밸런스게임 | click | removed | 같음 |

**v1.0 (2026-10-04) 없앰** — 9문항 밸런스 게임이 질문 지도로 바뀜. v1 기록(`screen_version`=v1)을 읽을 때만 쓴다. 새 답은 E-32.  
**언제**: S-02 🍃에서 선택지 카드를 누를 때(질문이 뜬 뒤 250ms 안의 누름은 무시) 또는 [갈피를 못 잡겠어요]를 0.8초 꾹 눌러 넘어갈 때. 문항마다 1번. v0.9부터 **문항 순서가 판마다 무작위** — 문항은 `question_no`, 몇 번째에 나왔는지는 `position`  
**분석 질문**: Q-01, Q-09

| 속성 | 현재 → 제안 | 타입 | 값 | 설명 |
|---|---|---|---|---|
| `question_no` | `question` → `question_no` | Number | 1, 5, 9 | 문항 번호 (balance-game.md 2절 표) — 1~4·5~8이 같은 축, 9는 분량. 나온 순서와는 무관 (v0.9) |
| `position` | 추가 (v0.9) | Number | 1, 9 | 이 판에서 몇 번째로 나온 질문인지 (1~9) — 순서가 무작위라 Q-09 ③ "몇 번째에서 그만두나"는 이것으로 |
| `choice` | 같음 | String | "A", "B", "unsure" | 고른 답. A/B는 balance-game.md 표의 열 이름 — 대문자 A·B는 명명 규칙의 예외 (문서 표기와 맞춤) |
| `side` | 같음 | String | null, "left", "right" | 누른 카드가 왼쪽인지 오른쪽인지. unsure면 null — 5~8번은 A가 오른쪽 |
| `elapsed_ms` | `ms` → `elapsed_ms` | Number | 2400 | 질문이 보인 뒤 답할 때까지 걸린 시간 (ms) |
| `is_edit` | `edit` → `is_edit` | Boolean | TRUE, FALSE | 첫 장 [한 번 고치기]로 다시 답하는 중인지 |

#### E-25 `unsure_hold_cancelled`

| 분류 | 트리거 | 상태 | 현재 → 제안 |
|---|---|---|---|
| 갈림길 | click | live | v1.0: 속성 교체 (question_no·position·is_edit → node_id·depth) |

**언제**: S-02 [갈피를 못 잡겠어요]를 누르다 0.8초가 되기 전에 뗄 때 (망설임)  
**분석 질문**: 설계 6절 ① 헷갈리는 질문

| 속성 | 현재 → 제안 | 타입 | 값 | 설명 |
|---|---|---|---|---|
| `node_id` | 추가 (v1.0) | String | "learn-area" | 그 질문의 id (docs/question-map.md) |
| `depth` | 추가 (v1.0) | Number | 1, 4 | 지금 길에서 몇 번째 질문인지 (1부터) |
| `held_ms` | 같음 | Number | 350 | 누르고 있던 시간 (ms, 800 미만) |

#### E-32 `question_answered`

| 분류 | 트리거 | 상태 | 현재 → 제안 |
|---|---|---|---|
| 갈림길 | click | live | 추가 (v1.0 — E-24 `balance_answered` 대신. 이름을 바꿔 v1 9문항과 섞이지 않게) |

**언제**: S-02에서 선택지 카드를 누를 때(질문이 뜬 뒤 250ms 안의 누름은 무시) 또는 [갈피를 못 잡겠어요]를 0.8초 꾹 눌러 넘어갈 때. 질문마다 1번 — 되돌아가 다시 답하면 또 남는다. 보낼 때의 공통 entry·mode는 이 답 **전** 값(갈래·모드 질문의 답은 `choice`로 읽는다)  
**분석 질문**: 설계 6절 ① 어디까지 좁히나·헷갈리는 질문(질문별 unsure 비율) ② 좁힐수록 궁금해요가 느나

| 속성 | 현재 → 제안 | 타입 | 값 | 설명 |
|---|---|---|---|---|
| `node_id` | 추가 (v1.0) | String | "start", "learn-data-tool" | 질문 지도의 질문 id (docs/question-map.md). 질문 문장이 바뀌어도 id는 그대로 |
| `kind` | 추가 (v1.0) | String | "narrow", "mood" | 질문 종류 — narrow=좁히기(범위를 줄임), mood=기분(점수만) |
| `choice` | 추가 (v1.0) | String | "A", "B", "unsure" | 고른 답. A·B는 question-map.md의 A·B 줄. unsure=갈피를 못 잡겠어요 |
| `depth` | 추가 (v1.0) | Number | 1, 11 | 지금 길에서 몇 번째 질문인지 (1부터). 되돌아가 다시 답하면 같은 depth |
| `position` | 추가 (v1.0) | Number | 1, 14 | 이 판에서 몇 번째로 낸 답인지 (1부터, 되돌아가 다시 낸 답도 셈) |
| `elapsed_ms` | 추가 (v1.0) | Number | 2400 | 질문이 보인 뒤 답할 때까지 걸린 시간 (ms) |

#### E-33 `question_back_clicked`

| 분류 | 트리거 | 상태 | 현재 → 제안 |
|---|---|---|---|
| 갈림길 | click | live | 추가 (v1.0) |

**언제**: S-02 [← 이전 질문](두 번째 질문부터 — 첫 질문에서는 E-20 source=question) 또는 S-04 [← 질문으로 돌아가기]를 누를 때. 마지막 답 하나를 지운다  
**분석 질문**: 설계 6절 ① 헷갈리는 질문(질문별 되돌리기 비율)

| 속성 | 현재 → 제안 | 타입 | 값 | 설명 |
|---|---|---|---|---|
| `node_id` | 추가 (v1.0) | String | "branch" | 다시 답하게 되는 질문 = 지운 답의 질문 id |
| `depth` | 추가 (v1.0) | Number | 2, 11 | 그 질문의 depth (= 지우기 전 답 수) |
| `source` | 추가 (v1.0) | String | "question", "first_page" | 누른 화면 — question=S-02 [← 이전 질문], first_page=S-04 [← 질문으로 돌아가기] |

#### E-34 `path_completed`

| 분류 | 트리거 | 상태 | 현재 → 제안 |
|---|---|---|---|
| 갈림길 | system | live | 추가 (v1.0) |

**언제**: 마지막 질문에 답해 길이 끝났을 때(뽑기를 부르기 직전, E-32 바로 뒤). S-04에서 돌아가 다시 끝내도 그때마다 남는다. 모드·갈래는 공통 `mode`·`entry`가 싣는다(2-3: 공통 이름을 이벤트 속성으로 다시 쓰지 않음)  
**분석 질문**: 설계 6절 ④ 도전 vs 일반 ⑤ 책이 모자란 길 — `scope_id`로 `npm run map:coverage` 표와 이어 본다

| 속성 | 현재 → 제안 | 타입 | 값 | 설명 |
|---|---|---|---|---|
| `scope_id` | 추가 (v1.0) | String | "entry=target;topics=데이터 분석;keywords=SQL", "all" | 뽑는 범위 id — 도전이면 먼 곳으로 바꾼 뒤. `npm run map:coverage`의 scope 열과 같은 값(`scopeKey`) |
| `depth` | 추가 (v1.0) | Number | 3, 11 | 길의 질문 수 (= 답 수) |
| `unsure_count` | 추가 (v1.0) | Number | 0, 2 | 그 길에서 갈피를 못 잡겠어요를 고른 수 |

#### E-03 `chip_selected`

| 분류 | 트리거 | 상태 | 현재 → 제안 |
|---|---|---|---|
| 목표입력 | click | removed | 같음 |

**v1.0 (2026-10-04) 없앰** — 🎯 입력·직접 쓰기·F-24·한 번 고치기를 없앰(PRD v2).  
**언제**: S-02 🎯에서 칩을 누를 때 — 예시 칩(입력 B안 10-01: 누르면 무엇을 칸에 그 말이 채워짐)·분량·읽는 방식. 켜진 분량·읽는 방식 칩을 다시 눌러 끌 때도 남음(값 null). 🍃 답은 E-24  
**분석 질문**: Q-10

| 속성 | 현재 → 제안 | 타입 | 값 | 설명 |
|---|---|---|---|---|
| `chip_type` | `question` → `chip_type` | String | "example", "len", "way" | 어느 칸의 칩인지 — v0.5 (10-01 입력 B안): "topic"(주제 보기·[직접 쓰기]) → "example"(예시 칩) |
| `chip_value` | `value` → `chip_value` | String | null, "불안할 때", "thin", "실습" | 고른 값. example=예시 칩 글 그대로(칸에 채워진 말), len=thin/normal/thick, way=개념/실습/사례, 끄면 null — 방식 값은 books 표의 키 그대로(한국어). v0.5: 주제 키·"free" 값 없어짐 → 예시 칩 글 |
| `is_edit` | `edit` → `is_edit` | Boolean | TRUE, FALSE | 고치기 중인지 |

#### E-26 `goal_submitted`

| 분류 | 트리거 | 상태 | 현재 → 제안 |
|---|---|---|---|
| 목표입력 | submit | removed | (없음) → 신규 (accepted 2026-09-30, v0.3 구현) |

**v1.0 (2026-10-04) 없앰** — 🎯 입력·직접 쓰기·F-24·한 번 고치기를 없앰(PRD v2).  
**언제**: 🎯 입력 완료 — S-02 🎯 폼이 [책 펼치기]로 제출되어 입력이 통과될 때 (무엇을 칸이 비어 멈추면 남지 않음). 고치기 뒤 다시 제출할 때도 남음. 🍃의 "입력 완료"는 9번 문항 `balance_answered`. 무엇을 칸의 글은 분류가 끝난 뒤(보통 1초, 최대 5초)에 남음 — 예시 칩 글 그대로면 분류 없이 바로  
**분석 질문**: Q-01, Q-10

| 속성 | 현재 → 제안 | 타입 | 값 | 설명 |
|---|---|---|---|---|
| `topic` | 같음 | String | "데이터 분석", "습관·집중" | 주제 키 (예시 칩 글 그대로면 그 칩에 정해 둔 주제, 자기 말이면 연결된 주제. 10-01 전에는 고른 주제 보기) |
| `is_free_text` | 같음 | Boolean | TRUE, FALSE | 자기 말로 제출했는지. FALSE = 보기를 그대로 (10-01 입력 B안부터: 예시 칩 글을 고치지 않고 제출, 그 전: 주제 보기) — v0.5: 뜻은 그대로(보기 vs 직접 쓰기), 보기가 주제 칩에서 예시 칩으로 |
| `len` | 같음 | String | null, "thin", "normal", "thick" | 분량. 비우면 null(상관없음) |
| `way` | 같음 | String | null, "개념", "실습", "사례" | 읽는 방식. 비우면 null |
| `is_edit` | 같음 | Boolean | TRUE, FALSE | 고치기 뒤 다시 제출인지 |

#### E-21 `free_goal_written`

| 분류 | 트리거 | 상태 | 현재 → 제안 |
|---|---|---|---|
| 목표입력 | submit | removed | `goal_free_written` → `free_goal_written` |

**v1.0 (2026-10-04) 없앰** — 🎯 입력·직접 쓰기·F-24·한 번 고치기를 없앰(PRD v2).  
**언제**: S-02 🎯에서 무엇을 칸에 자기 말을 써서 제출할 때 (E-26과 같은 순간, is_free_text=TRUE일 때만 — 예시 칩 글 그대로면 남지 않음). 분류가 끝난 뒤(보통 1초, 최대 5초)에 남음. **Amplitude 사본**은 `goal_text`·`missing_text` 없이 `topic`·`keywords`·`is_matched`·`method`·`has_missing`만 간다  
**분석 질문**: Q-10

| 속성 | 현재 → 제안 | 타입 | 값 | 설명 |
|---|---|---|---|---|
| `goal_text` | `text` → `goal_text` | String | "SQL 처음 배우기" | 적은 글 (앞뒤 공백 제거, 최대 30자) — 6절: 처리방침에 공개된 유일한 자유 글. **`Supabase only`** — Amplitude 사본에는 이 속성이 없다 (2-7·6-2) |
| `topic` | 같음 | String | "데이터 분석" | 연결된 주제 키. is_matched=false면 가장 가까운 추정 |
| `keywords` | 같음 | String[] | ["SQL"], [] | 연결된 세부 키워드 (닫힌 목록 이름만, 0~5개) |
| `is_matched` | `matched` → `is_matched` | Boolean | TRUE, FALSE | 우리 목록에서 하나라도 찾았는지 |
| `method` | 같음 | String | "word", "llm" | 연결 방법. llm은 P4(Claude Haiku), 실패·3초 초과면 word |
| `has_missing` | 추가 (v0.6, F-24) | Boolean | TRUE, FALSE | 분류가 "우리 키워드에 없는 구체적인 것"을 찾았는지 (F-24 ②·③ — llm만, word는 늘 FALSE) |
| `missing_text` | 추가 (v0.6, F-24) | String | null, "단타 매매" | 그 구체적인 것을 가리키는 짧은 말 (분류가 적은 글에서 뽑음, 최대 20자). 없으면 null. **`Supabase only`** (2-7·6-2). 화면에서는 예스24 검색어로만 쓰인다(6-3c) |

#### E-22 `goal_coverage_checked`

| 분류 | 트리거 | 상태 | 현재 → 제안 |
|---|---|---|---|
| 목표입력 | system | removed | `goal_coverage` → `goal_coverage_checked` |

**v1.0 (2026-10-04) 없앰** — 🎯 입력·직접 쓰기·F-24·한 번 고치기를 없앰(PRD v2).  
**언제**: 🎯 자기 말로 제출한 뒤(is_free_text=TRUE — 예시 칩 글 그대로면 남지 않음) /api/books/draw 응답을 받았을 때 (고치기 재뽑기 포함). F-24 ③(맞는 주제 없음)은 뽑지 않으므로 분류가 끝나 제출하는 순간 found_count 0으로. 첫 장 안내 문구를 정하는 순간  
**분석 질문**: Q-10

| 속성 | 현재 → 제안 | 타입 | 값 | 설명 |
|---|---|---|---|---|
| `coverage_bucket` | `bucket` → `coverage_bucket` | String | "0", "1-3", "4+" | 찾은 책 수 구간 (target-chips.md 3절) — 구간 표기는 PRD 그대로 |
| `found_count` | `found` → `found_count` | Number | 0, 2, 7 | 키워드에 맞는 책 수. is_matched=false면 0 |
| `understood` | 추가 (v0.6, F-24) | String | "keyword", "topic", "missing", "none", "nearest" | 첫 장 "이렇게 이해했어요"가 보인 판단 — keyword=① 주제·키워드, topic=①b 주제만, missing=② 주제는 맞고 구체적인 것이 키워드에 없음, none=③ Claude가 맞는 주제 없다고 함(뽑지 않음), nearest=단어 매칭(키 없음·오류·시간 초과·한도·오프라인 등 모든 대체)이 아무것도 못 찾음 — 판단할 수 없어서 가장 가까운 주제 책을 펼침 |

#### E-05 `book_opened`

| 분류 | 트리거 | 상태 | 현재 → 제안 |
|---|---|---|---|
| 책펼치기 | click | live | 같음 |

**언제**: S-03 닫힌 책을 눌러 펼칠 때 → S-04 첫 장  
**분석 질문**: Q-01

속성 없음 (공통 속성만).

#### E-06 `first_page_edited`

| 분류 | 트리거 | 상태 | 현재 → 제안 |
|---|---|---|---|
| 책펼치기 | submit | removed | 같음 |

**v1.0 (2026-10-04) 없앰** — 🎯 입력·직접 쓰기·F-24·한 번 고치기를 없앰(PRD v2).  
**언제**: S-04 [한 번 고치기] 뒤 다시 답을 마쳐 새 뽑기가 시작될 때 — 🍃는 9문항을 다시 끝냈을 때, 🎯는 입력을 다시 제출했을 때  
**분석 질문**: Q-06

| 속성 | 현재 → 제안 | 타입 | 값 | 설명 |
|---|---|---|---|---|
| `changed_items` | `items` → `changed_items` | String[] | ["q2", "q6"], ["topic", "len"], [] | 바뀐 항목. 🍃 q1~q9(답이 바뀐 문항), 🎯 topic·len·way. 바뀐 것이 없으면 빈 배열 — 현재 🎯 "what" → "topic"(무엇을 칸. v0.3에서 E-03 chip_type과 통일했으나 v0.5부터 E-03은 "example" — 이 값은 그대로). 현재 보내는 props.entry는 삭제(공통 entry와 중복) |

#### E-07 `bookmark_shown`

| 분류 | 트리거 | 상태 | 현재 → 제안 |
|---|---|---|---|
| 책갈피 | view | live | 같음 |

**언제**: S-05 책갈피 장이 보일 때 — 첫 장 [다음 장] 뒤 1장, 반응 뒤 다음 장. 새로고침으로 같은 장이 복원될 때는 남지 않음  
**분석 질문**: Q-01, Q-02, Q-04, Q-07, Q-08

| 속성 | 현재 → 제안 | 타입 | 값 | 설명 |
|---|---|---|---|---|
| `book_id` | 같음 | String | "9788998441012" | 책 ISBN-13 (books.isbn) |
| `position` | `index` → `position` | Number | 1, 3, 5 | 몇 번째 책갈피인지 (1부터) |
| `one_liner_style` | 같음 | String | "summary", "question" | 첫인상 한 줄 말투 — 🎯 요약형, 🍃 질문형(좋은 질문이 없으면 요약형) |
| `pick_type` | `kind` → `pick_type` | String | "recommended", "random" | 추천 4권 중 하나인지, 검증용 무작위 1권인지 (화면에는 구분 없음) |
| `art` | 같음 | Object | {"animal": "fox", "bg": "peach", "sky": "moon", "ground": "grass", "rare": false} | 책갈피 그림 조합 {animal, bg, sky, ground, rare} — 중첩 객체 예외 — D-05 보관 그림과 같은 모양. Amplitude에서는 art.animal처럼 펼쳐짐. v1.3: 값에 한정판·초판본(예: "otter", "galaxy", "goldmoon")이 더해짐, `rare` = 넷 중 하나라도 한정판 이상(그 전 기록은 모두 false). 부분별 등급은 값에서 찾는다(`tierOf`) |

#### E-08 `bookmark_reacted`

| 분류 | 트리거 | 상태 | 현재 → 제안 |
|---|---|---|---|
| 책갈피 | click | live | 같음 |

**언제**: S-05 [패스] 또는 [궁금해요]를 누를 때 (둘 중 하나를 눌러야 다음 장)  
**분석 질문**: Q-02, Q-04, Q-07, Q-08, Q-09

| 속성 | 현재 → 제안 | 타입 | 값 | 설명 |
|---|---|---|---|---|
| `book_id` | 같음 | String | "9788998441012" | 책 ISBN-13 (books.isbn) |
| `position` | `index` → `position` | Number | 1, 3, 5 | 몇 번째 책갈피인지 (1부터) |
| `reaction` | 같음 | String | "pass", "curious" | 반응 |
| `pick_type` | `kind` → `pick_type` | String | "recommended", "random" | 추천 4권 중 하나인지, 검증용 무작위 1권인지 (화면에는 구분 없음) |
| `one_liner_style` | 추가 — v0.3 구현 | String | "summary", "question" | 첫인상 한 줄 말투 (E-07과 같은 값) |

#### E-09 `result_viewed`

| 분류 | 트리거 | 상태 | 현재 → 제안 |
|---|---|---|---|
| 결과 | view | live | 같음 |

**언제**: S-06 궁금해요 책 보기 화면에 들어올 때 (궁금해요가 1개 이상일 때만 — 0개면 S-08로 바로 가서 남지 않음)  
**분석 질문**: Q-01, Q-11

| 속성 | 현재 → 제안 | 타입 | 값 | 설명 |
|---|---|---|---|---|
| `curious_count` | 같음 | Number | 1, 2, 5 | 이번 회차 궁금해요 수 |

#### E-10 `result_book_viewed`

| 분류 | 트리거 | 상태 | 현재 → 제안 |
|---|---|---|---|
| 결과 | view | live | 같음 |

**언제**: S-06에서 궁금해요 책 한 권이 보일 때 (첫 권 포함, 한 권씩). **v0.11**: 판마다 책당 한 번 — ‹ ›로 돌아가 다시 봐도 또 남지 않는다(앞뒤 이동 자체는 이벤트 없음 — 답할 질문이 없음, 1-1)  
**분석 질문**: Q-11

| 속성 | 현재 → 제안 | 타입 | 값 | 설명 |
|---|---|---|---|---|
| `book_id` | 같음 | String | "9788998441012" | 책 ISBN-13 (books.isbn) |
| `position` | 같음 | Number | 1, 2 | 궁금해요 책 중 몇 번째인지 (1부터) |
| `pick_type` | 추가 — v0.3 명세 반영, 심는 것은 P4 | String | "recommended", "random" | 추천 4권 중 하나인지, 검증용 무작위 1권인지 (화면에는 구분 없음) |

#### E-23 `description_expanded`

| 분류 | 트리거 | 상태 | 현재 → 제안 |
|---|---|---|---|
| 결과 | click | live | 같음 |

**언제**: S-06 책 설명 [더 보기]를 누를 때  
**분석 질문**: Q-11

| 속성 | 현재 → 제안 | 타입 | 값 | 설명 |
|---|---|---|---|---|
| `book_id` | 같음 | String | "9788998441012" | 책 ISBN-13 (books.isbn) |
| `pick_type` | 같음 | String | "recommended", "random" | 추천 4권 중 하나인지, 검증용 무작위 1권인지 (화면에는 구분 없음) |

#### E-27 `bookmark_pulled`

| 분류 | 트리거 | 상태 | 현재 → 제안 |
|---|---|---|---|
| 결과 | click | live | 추가 (v0.7) |

**언제**: S-06에서 표지 위로 빼꼼 꽂힌 책갈피(C-16)를 꺼낼 때 — 누르기·끌어올리기 모두. 다시 넣을 때는 남지 않는다. 같은 책에서 다시 꺼내면 또 남는다(비율은 책 단위로 중복 제거). 마우스를 올리기만 하면(들림 + "눌러서 꺼내기") 남지 않는다. **v0.12부터 꽂기(E-11)의 앞 단계가 아니다** — 꽂기는 제목 옆 [🔖 꽂기]로 바로 하므로 E-27은 "뒷면(나온 이유)을 보러 꺼냈는가" 신호로만 읽는다  
**분석 질문**: Q-11

| 속성 | 현재 → 제안 | 타입 | 값 | 설명 |
|---|---|---|---|---|
| `book_id` | 추가 (v0.7) | String | "9788998441012" | 책 ISBN-13 (books.isbn) |
| `position` | 추가 (v0.7) | Number | 1, 2 | 궁금해요 책 중 몇 번째인지 (1부터) |
| `pick_type` | 추가 (v0.7) | String | "recommended", "random" | 추천 4권 중 하나인지, 검증용 무작위 1권인지 (화면에는 구분 없음) |

#### E-28 `bookmark_flipped`

| 분류 | 트리거 | 상태 | 현재 → 제안 |
|---|---|---|---|
| 결과 | click | live | 추가 (v0.7) |

**언제**: S-06에서 꺼낸 책갈피를 [뒷면 보기]로 뒤집어 뒷면(나온 이유·만난 날)을 볼 때. 앞면으로 돌아갈 때는 남지 않는다. 다시 뒷면으로 뒤집거나 넣었다 꺼내 또 뒤집으면 **그때마다 또 남는다**(뒷면율은 책 단위로 중복 제거)  
**분석 질문**: Q-11 (나온 이유를 찾아 보는가 — CLAUDE.md 원칙 2의 기준 공개가 읽히는지)

| 속성 | 현재 → 제안 | 타입 | 값 | 설명 |
|---|---|---|---|---|
| `book_id` | 추가 (v0.7) | String | "9788998441012" | 책 ISBN-13 (books.isbn) |
| `pick_type` | 추가 (v0.7) | String | "recommended", "random" | 추천 4권 중 하나인지, 검증용 무작위 1권인지 (화면에는 구분 없음) |

#### E-18 `yes24_link_clicked`

| 분류 | 트리거 | 상태 | 현재 → 제안 |
|---|---|---|---|
| 결과 | click | live | `yes24_clicked` → `yes24_link_clicked` |

**언제**: S-06 또는 S-09에서 [예스24에서 보기]를 누를 때, 또는 S-04 F-24 ②·③에서 [예스24에서 … 찾기]를 누를 때 (새 탭)  
**분석 질문**: Q-01, Q-10, Q-11

| 속성 | 현재 → 제안 | 타입 | 값 | 설명 |
|---|---|---|---|---|
| `book_id` | 같음 (v0.6: null 허용) | String | null, "9788998441012" | 책 ISBN-13 (books.isbn). source=first_page면 null (책 없이 검색) |
| `source` | 같음 (v0.6: "first_page" 추가) | String | "result", "library", "first_page" | 누른 화면 — result=S-06, library=S-09, first_page=S-04 F-24 ②·③ (v1.0부터 보내지 않음 — v1 기록용. 어느 쪽인지는 같은 판의 E-22 `understood`) |
| `pick_type` | 추가 — v0.3 명세 반영, 심는 것은 P4 | String | null, "recommended", "random" | 추천 4권 중 하나인지, 검증용 무작위 1권인지 (화면에는 구분 없음). source=library·first_page면 null |

#### E-11 `save_clicked`

| 분류 | 트리거 | 상태 | 현재 → 제안 |
|---|---|---|---|
| 보관 | click | live | 같음 |

**언제**: S-06 제목 옆 [🔖 꽂기](접근 이름 "내 책갈피에 꽂기")를 누를 때 — v0.12부터 책갈피를 꺼내지 않아도 된다(그 전에는 꺼낸 책갈피 아래 버튼). 로그인 전이면 이어서 E-12. 이름의 "save"는 그대로  
**분석 질문**: Q-12

| 속성 | 현재 → 제안 | 타입 | 값 | 설명 |
|---|---|---|---|---|
| `book_id` | 같음 | String | "9788998441012" | 책 ISBN-13 (books.isbn) |
| `is_logged_in` | 같음 | Boolean | TRUE, FALSE | 누를 때 로그인 상태였는지 |

#### E-15 `book_saved`

| 분류 | 트리거 | 상태 | 현재 → 제안 |
|---|---|---|---|
| 보관 | system | live | 같음 |

**언제**: 꽂기가 저장에 성공했을 때 — 로그인 상태에서 바로, 또는 로그인 직후 누르던 책 자동 꽂기(같은 책 화면으로 돌아온 뒤). 새 책갈피는 첫 막대 맨 앞  
**분석 질문**: Q-12

| 속성 | 현재 → 제안 | 타입 | 값 | 설명 |
|---|---|---|---|---|
| `book_id` | 같음 | String | "9788998441012" | 책 ISBN-13 (books.isbn) |
| `is_auto_save` | 같음 | Boolean | TRUE, FALSE | 로그인 직후 자동 보관인지 |

#### E-16 `book_unsaved`

| 분류 | 트리거 | 상태 | 현재 → 제안 |
|---|---|---|---|
| 보관 | click | live | 같음 |

**언제**: S-09 내 책갈피에서 책갈피 뒷면의 [빼기]를 확인까지 누를 때. [모두 제거]로 한꺼번에 뺄 때는 보내지 않는다 — 그때는 E-35 하나만(v1.2)  
**분석 질문**: Q-13

| 속성 | 현재 → 제안 | 타입 | 값 | 설명 |
|---|---|---|---|---|
| `book_id` | 같음 | String | "9788998441012" | 책 ISBN-13 (books.isbn) |

#### E-12 `login_prompt_shown`

| 분류 | 트리거 | 상태 | 현재 → 제안 |
|---|---|---|---|
| 로그인 | view | live | 같음 |

**언제**: S-07 로그인 창이 뜰 때  
**분석 질문**: Q-12

| 속성 | 현재 → 제안 | 타입 | 값 | 설명 |
|---|---|---|---|---|
| `source` | 같음 | String | "save", "header" | 어디서 열렸는지 — save=[내 책갈피에 꽂기], header=우측 위 [로그인] (로그인 안 된 채 연 S-09의 [로그인]도 header) |

#### E-13 `login_started`

| 분류 | 트리거 | 상태 | 현재 → 제안 |
|---|---|---|---|
| 로그인 | click | live | 같음 |

**언제**: S-07 카카오/구글 버튼을 누를 때 (외부 로그인으로 떠나기 직전)  
**분석 질문**: Q-12, Q-14

| 속성 | 현재 → 제안 | 타입 | 값 | 설명 |
|---|---|---|---|---|
| `provider` | 같음 | String | "kakao", "google" | 로그인 방식 |

#### E-14 `login_completed`

| 분류 | 트리거 | 상태 | 현재 → 제안 |
|---|---|---|---|
| 로그인 | system | live | 같음 |

**언제**: 로그인에서 돌아와 세션이 확인된 뒤 1번 — Amplitude `user_id`가 붙는 첫 이벤트(Supabase `common.user_id`는 서버가 세션 쿠키로 채우므로 돌아온 화면의 `site_visited`부터 채워짐). `/auth/callback`이 남긴 짧은 HttpOnly 쿠키를 `/api/me`가 한 번 넘겨줄 때만 보낸다 — 주소의 `?login=`만으로는 보내지 않는다(조작한 링크 방지, 보안 리뷰)  
**분석 질문**: Q-12, Q-14

| 속성 | 현재 → 제안 | 타입 | 값 | 설명 |
|---|---|---|---|---|
| `provider` | 같음 | String | "kakao", "google" | 로그인 방식 |
| `is_first_login` | 같음 | Boolean | TRUE, FALSE | 처음 로그인(이용자가 새로 생김)인지 |

#### E-17 `library_viewed`

| 분류 | 트리거 | 상태 | 현재 → 제안 |
|---|---|---|---|
| 내 책갈피 | view | live | 같음 |

**언제**: S-09 내 책갈피를 열 때 (목록을 불러온 뒤)  
**분석 질문**: Q-13

| 속성 | 현재 → 제안 | 타입 | 값 | 설명 |
|---|---|---|---|---|
| `saved_count` | 같음 | Number | 0, 3, 12 | 보관한 책 수 |

#### E-29 `shelf_created`

| 분류 | 트리거 | 상태 | 현재 → 제안 |
|---|---|---|---|
| 내 책갈피 | click | live | 신규 (v0.8) |

**언제**: S-09 [＋ 막대 추가]로 막대가 생겼을 때 (저장 성공 뒤). 첫 꽂기 때 서버가 저절로 만드는 첫 막대는 남지 않음. 막대 이름은 **넣지 않는다**(이용자가 쓴 글, 6-1)  
**분석 질문**: Q-13

| 속성 | 현재 → 제안 | 타입 | 값 | 설명 |
|---|---|---|---|---|
| `shelf_count` | 추가 | Number | 2, 5 | 만든 뒤 이 사람의 막대 수 (최대 5) |

#### E-30 `bookmark_moved`

| 분류 | 트리거 | 상태 | 현재 → 제안 |
|---|---|---|---|
| 내 책갈피 | click | live | 신규 (v0.8) · v1.1: "drag", `is_same_shelf` |

**언제**: S-09에서 책갈피를 다른 막대로, 또는 같은 막대 안 다른 자리로(v1.1) 옮겼을 때 (저장 성공 뒤). 제자리에 놓거나 막대 밖에서 놓으면 남지 않음. 막대 이름·번호·자리 번호는 넣지 않는다  
**분석 질문**: Q-13

| 속성 | 현재 → 제안 | 타입 | 값 | 설명 |
|---|---|---|---|---|
| `book_id` | 추가 | String | "9788998441012" | 책 ISBN-13 (books.isbn) |
| `method` | v1.1: "drag" 추가 | String | "drag", "menu", "hold" | 옮긴 방법 — drag=끌어서 놓기(v1.1 — 10-04부터 [책갈피 옮기기] 모드에서, 꾹 누르기 없음), menu=시트 [다른 막대로 옮기기](맨 앞에 붙음), hold=꾹 눌러 집고 막대 누르기(v1.0까지 — v1.1부터 보내지 않음, 옛 탭·옛 기록용으로 스펙에 남김) |
| `is_same_shelf` | 추가 (v1.1) | Boolean | TRUE, FALSE | 같은 막대 안에서 자리만 바꿨는지 (끌기로만 TRUE — 메뉴는 다른 막대만) |

#### E-35 `library_cleared`

| 분류 | 트리거 | 상태 | 현재 → 제안 |
|---|---|---|---|
| 내 책갈피 | click | live | 신규 (v1.2) |

**언제**: S-09 [모두 제거] → 확인 시트 [모두 빼기]를 눌러 **서버가 지운 뒤**(2xx). [그대로 두기]·시트 닫기·실패는 남지 않음. 빠진 책마다 E-16 `book_unsaved`를 따로 보내지 않는다(한 번의 누름 = 한 이벤트, 2-1). 막대는 그대로 남고, 막대 이름·번호는 넣지 않는다  
**분석 질문**: Q-13

| 속성 | 현재 → 제안 | 타입 | 값 | 설명 |
|---|---|---|---|---|
| `removed_count` | 추가 (v1.2) | Number | 3, 12 | 서버가 뺀 책갈피 수 (목록에서 빠져 화면에 안 보이던 책도 포함) |

#### E-36 `collection_item_found`

| 분류 | 트리거 | 상태 | 현재 → 제안 |
|---|---|---|---|
| 도감 | system | live | 신규 (v1.3) |

**언제**: 로그인한 사람에게 S-05 책갈피가 보이고(E-07과 같은 순간), 서버가 그 그림의 부분을 도감에 **처음** 기록했을 때 — 새 부분마다 한 번(한 책갈피에서 동물과 배경이 처음이면 둘). 서버가 서명된 뽑기 seed로 그림을 다시 계산해 기록하므로 브라우저가 꾸민 그림은 남지 않는다. 로그인 전·이미 만난 부분·기록 실패는 남지 않음. 책 ID는 넣지 않는다(그림은 책과 무관하게 뽑힌다, 원칙 2)  
**분석 질문**: 도감 — 희귀(한정판·초판본)를 만난 사람이 더 자주 돌아오는지(재방문·다시 뽑기와 이어 봄). 꽂기(E-15)와는 떨어져 있다(launch-plan 3절)

| 속성 | 현재 → 제안 | 타입 | 값 | 설명 |
|---|---|---|---|---|
| `part_kind` | 추가 (v1.3) | String | "animal", "bg", "sky", "ground" | 그림의 어느 부분인지 — 동물·배경·하늘 소품·땅 소품 (`kind`는 E-32에서 다른 뜻이라 쓰지 않음, 2-3) |
| `part_value` | 추가 (v1.3) | String | "otter", "galaxy", "goldmoon" | 그 부분의 값 — `art`의 값과 같은 시스템 키(lib/art/combine.ts 목록) |
| `tier` | 추가 (v1.3) | String | "common", "limited", "first_edition" | 등급 — 일반판·한정판·초판본 |

#### E-37 `collection_viewed`

| 분류 | 트리거 | 상태 | 현재 → 제안 |
|---|---|---|---|
| 도감 | view | live | 신규 (v1.3) |

**언제**: S-09에서 [도감]을 열 때 — 로그인했다면 도감을 불러온 뒤, 로그인 전이면 실루엣 도감이 보일 때(로그인 전 /library). [막대]↔[도감]을 오갈 때마다 [도감]이 열리면 한 번. 불러오기 실패는 남지 않음  
**분석 질문**: 도감 — 도감을 보는 사람이 얼마나 되는지, 로그인 전 도감이 로그인(E-12 header)으로 이어지는지

| 속성 | 현재 → 제안 | 타입 | 값 | 설명 |
|---|---|---|---|---|
| `collected_count` | 추가 (v1.3) | Number | 0, 9, 30 | 도감에 모은 항목 수(동물·배경·소품 합, 최대 43). 로그인 전은 0 |
| `is_logged_in` | 추가 (v1.3) | Boolean | TRUE, FALSE | 열 때 로그인 상태였는지 |

#### E-19 `redraw_clicked`

| 분류 | 트리거 | 상태 | 현재 → 제안 |
|---|---|---|---|
| 마무리 | click | live | 같음 |

**언제**: S-08 [다시 뽑기]를 누를 때. 이 이벤트는 끝나는 판의 round를 싣고, **보낸 직후 round +1** (3-1a)  
**분석 질문**: Q-03

| 속성 | 현재 → 제안 | 타입 | 값 | 설명 |
|---|---|---|---|---|
| `curious_count` | 같음 | Number | 0, 2 | 이번 회차 궁금해요 수 |

#### E-20 `home_clicked`

| 분류 | 트리거 | 상태 | 현재 → 제안 |
|---|---|---|---|
| 마무리 | click | live | 같음 |

**언제**: [처음으로]를 누를 때 — S-04(뽑기 실패·책 없음)와 S-08 마무리. 이벤트는 끝나는 판의 round를 싣고, **보낸 직후 round +1 — 같은 탭에서 다시 시작하면 새 판** (3-1a) v1.0: S-02 첫 질문의 [← 이전 질문]도(source=question — 처음 화면으로, 새 판)  
**분석 질문**: Q-01, Q-03

| 속성 | 현재 → 제안 | 타입 | 값 | 설명 |
|---|---|---|---|---|
| `curious_count` | `curious` → `curious_count` | Number | 0, 2 | 이번 회차 궁금해요 수 |
| `source` | 추가 — v0.3 구현 | String | "first_page", "end", "question" | 누른 화면 — first_page=S-04(막다른 길), end=마무리, question=S-02 첫 질문의 이전 질문(v1.0) |

#### E-31 `feedback_sent`

| 분류 | 트리거 | 상태 | 현재 → 제안 |
|---|---|---|---|
| 홈 | click | live | 신규 (v0.10) |

**언제**: S-01 갈피 우체통(PRD F-26) 시트에서 [넣기]를 눌러 **서버가 저장했을 때만**. Supabase 사본은 `/api/feedback`이 저장하고(2-7 예외), 2xx를 받은 뒤 브라우저가 Amplitude 사본을 보낸다 — Amplitude 사본에는 `feedback_text` 없이 `text_length`만. 빈 글·실패·중복 누름은 남지 않음. 저장이 꺼진 환경은 `TRACK_STORE=off`일 때만 202(로컬·E2E), 설정이 빠졌으면 503 — 저장되지 않은 글에 고마움을 보이지 않는다. 저장되면 운영자에게 도착 알림 메일(시각만, 글 없음)  
**분석 질문**: 없음 — 운영용(첫 이용자 의견을 읽는 곳). 퍼널·지표(5절)에 넣지 않는다

| 속성 | 현재 → 제안 | 타입 | 값 | 설명 |
|---|---|---|---|---|
| `feedback_text` | 추가 (v0.10) | String | "책갈피가 귀여워요" | 우체통에 적은 글 (앞뒤 공백 제거, 1~500자). **`Supabase only`** (2-7·6-2) — 로그·DOM 속성에 넣지 않는다 |
| `text_length` | 추가 (v0.10) | Number | 12, 480 | 앞뒤 공백을 뺀 글자 수 (UTF-16 단위, 1~500) |

### 4-3. 이벤트로 만들지 않는 것

| 행동 | 이유 |
|---|---|
| 첫 장 [다음 장] 누름 | `bookmark_shown`(position 1)이 같은 순간 |
| 닫힌 책(S-03)이 보임 | 입력 완료 이벤트(🍃 9번 답, 🎯 `goal_submitted`) 바로 뒤라 같은 순간 |
| 뽑기 실패 [다시 시도] | 분석 질문이 없다. 오류는 서버 로그와 Autocapture로 본다 |
| 🎯 "무엇을" 비우고 [책 펼치기] (안내만 뜸) | 1-1 질문에 쓰이지 않는다. 필요해지면 `goal_submitted`의 실패 값이 아니라 새 질문과 함께 검토 |
| 패스율 | `1 − 궁금해요율` — `bookmark_reacted`의 `reaction`으로 계산 |
| 스크롤·표지 보기 시간 | 분석 질문 없음, 이벤트 수만 늘어난다 |
| 갈피 우체통 열기·닫기, 보내기 실패 (v0.10) | 분석 질문 없음. 보낸 것만 E-31로 남는다 |

### 4-4. 마이그레이션 — 현재 → 제안

**상태: 아래 이름 변경·속성 변경·추가는 모두 `accepted — dev round` (2026-09-30 사용자 승인) → v0.3(2026-10-01)에서 모두 구현 (`plans/2026-10-01-taxonomy-dev.md`).** Supabase `events`에 이미 쌓인 테스트 기록은 옛 이름 그대로 두고 옮기지 않는다 — P7에서 지운다. 이 표가 개발 라운드의 **마이그레이션 명세**다 — 표의 "제안" 열이 곧 코드가 따를 이름이다. (표 머리글의 "제안"은 v0.1 용어를 그대로 둔 것)

**언제**: 한 개발 라운드에서 한 번에, **P7(실데이터 시작) 전 — Vercel에 Amplitude 키를 넣기 전**. 지금 Supabase 기록은 테스트 데이터이고 P7에서 지운다. Amplitude 키는 Production에만 있어 아직 쌓인 것이 없다 → 옛 이름을 이어 붙이는 작업(백필·별칭)이 필요 없다. P7 뒤에 바꾸면 Amplitude에 옛 이름이 따로 남고 SQL도 두 이름을 모두 봐야 한다.

**이벤트 이름**

| ID | 현재 | 제안 | 이유 |
|---|---|---|---|
| E-01 | `visit` | `site_visited` | 동사 원형 → `대상_동작(과거형)` |
| E-21 | `goal_free_written` | `free_goal_written` | "목표 없이 썼다"로 읽힐 수 있음 → 대상이 "직접 쓴 목표" |
| E-22 | `goal_coverage` | `goal_coverage_checked` | 동작이 없음 → 시스템 확인(`checked`) |
| E-18 | `yes24_clicked` (PRD만, 코드는 이름만) | `yes24_link_clicked` | 대상이 사이트가 아니라 링크 |

**속성 이름·값**

| 이벤트 | 현재 | 제안 | 이유 |
|---|---|---|---|
| 공통 | `returning` | `is_returning` | Boolean은 `is_` |
| 공통 | `in_app_browser` | `is_in_app_browser` | Boolean은 `is_` |
| E-02 | `entry` | (삭제) | 공통 `entry`와 중복 |
| E-03 | `question` | `chip_type` | `question`이 E-24에서는 문항 번호(Number) — 한 이름 두 뜻 |
| E-03 | `value` | `chip_value` | 너무 일반적인 이름 |
| E-03 | 값 `"direct"` | 값 `"free"` | `free_goal_written`·`is_free_text`와 같은 말 |
| E-03 · E-24 · E-25 | `edit` | `is_edit` | Boolean은 `is_` |
| E-24 · E-25 | `question` | `question_no` | 고정된 문항 번호는 `_no` |
| E-24 | `ms` | `elapsed_ms` | 무엇의 시간인지 |
| E-21 | `text` | `goal_text` | 무엇의 글인지 |
| E-21 | `matched` | `is_matched` | Boolean은 `is_` |
| E-22 | `bucket` | `coverage_bucket` | 무엇의 구간인지 |
| E-22 | `found` | `found_count` | 개수는 `_count` |
| E-06 | `entry` | (삭제) | 공통 `entry`와 중복 |
| E-06 | `items` | `changed_items` | 무엇의 항목인지 |
| E-06 | 🎯 값 `"what"` | 값 `"topic"` | E-03 `chip_type`과 같은 말 (v0.3 당시. v0.5부터 E-03은 "example", E-06 값은 "topic" 그대로) |
| E-07 · E-08 | `index` | `position` | 1부터 세는 자리 (`index`는 0부터로 읽힌다) |
| E-07 · E-08 | `kind` | `pick_type` | 무엇의 종류인지 |
| E-20 | `curious` | `curious_count` | 개수는 `_count` |

**추가 (accepted — dev round, PRD 반영 완료)**

| 이벤트 | 추가 | 답하는 질문 |
|---|---|---|
| E-26 `goal_submitted` (새 이벤트, 🎯 입력 완료 — [책 펼치기]로 제출될 때) | `topic`, `is_free_text`, `len`, `way`, `is_edit` | Q-01 🎯 입력 완료 단계가 지금은 없다(칩 누름·직접 쓰기만 있음). Q-10 보기 vs 직접 쓰기 비율 |
| E-08 `bookmark_reacted` | `one_liner_style` | Q-07 — Amplitude에서 조인 없이 말투별 궁금해요율 |
| E-10 `result_book_viewed` | `pick_type` | Q-08·Q-11 — 무작위 책이 결과 화면 이후에도 살아남나 |
| E-18 `yes24_link_clicked` | `pick_type` (내 책갈피에서는 null) | Q-08·Q-11 — 무작위 책도 예스24까지 가나 |
| E-20 `home_clicked` | `source` (`first_page` / `end`) | Q-01·Q-03 — 막다른 길(S-04)에서 나간 것과 다 보고 나간 것을 구분 |

**이 라운드에서 함께 하는 동작 변경** (이름 변경이 아니라 동작 — 모두 승인됨)

| # | 변경 | 근거 |
|---|---|---|
| 1 | `round` +1 — [다시 뽑기]와 같은 탭 [처음으로] (지금은 `nextRound()`를 부르는 곳이 없어 늘 1) | 3-1a, 5-1 |
| 2 | E-21 `goal_text`는 Supabase에만 저장, Amplitude 사본에서 뺌 | 2-7, 6-2 |
| 3 | `/privacy` 문장 고침 (모으는 정보가 바뀜) | 6-3 |
| 4 | Amplitude 큐: 시작 전 이벤트 받기 + 원래 `time` 유지 | 2-7 a·b |

**코드에서 함께 바꿀 곳** (v0.3 개발 라운드에서 바꾼 곳 — 기록): `lib/track/schema.ts`(`EVENT_NAMES`, `CommonProps`, `parseCommon`), `lib/track/common.ts`, `lib/track/amplitude.ts`(공통 속성 전달·`visit` 조건·**`goal_text` 제외**·**큐·`time`**, 2-7), `lib/track/client.ts`, `lib/track/common.ts`의 `nextRound()` 호출을 [다시 뽑기]·[처음으로]에 연결(3-1a — v0.3에서는 `Flow.tsx`가 아니라 `track()`이 부른다), `components/TrackVisit.tsx`, `components/flow/Flow.tsx`·`TargetInput.tsx`·`BalanceGame.tsx`, `lib/flow/summary.ts`(`"what"` → `"topic"`), 각 테스트와 `e2e/*`, `PRD.md` 4절 이름, `README.md` 추적표(ID라 변경 없음). 처리방침(`app/privacy/page.tsx`)은 **이름 변경만으로는 고칠 것 없다.** 그러나 `goal_text`를 Amplitude로 보내지 않게 되므로 **문장 하나를 고쳐야 한다** (6-3).

---

## 5. 퍼널·분석 정의

대시보드(Amplitude)와 노트북(SQL)이 같은 숫자를 내도록 여기서 정의한다. 이름은 제안 이름 — 마이그레이션 전 데이터에는 4-4 표 "현재" 열의 옛 이름을 쓴다.

### 5-1. 단위

| 단위 | 정의 |
|---|---|
| 사람 | `anon_id` (로그인 뒤에도 같은 브라우저면 같은 값. 다른 기기는 `user_id`로만 이어짐) |
| 세션 | `session_id` (탭 단위). Amplitude 차트는 Amplitude 세션 — 세션 수 비교는 SQL로 |
| **판** | `(session_id, round)` — 뽑기 한 묶음(책갈피 5장). 대부분의 비율은 판 단위 |
| 버전 | `screen_version` — 1단계 `v1`, 2단계 `v2`. 전후 비교는 이 값으로 가른다 |
| 테스트 제외 | P7 전 데이터는 지운다. 그 뒤에는 제작자 `anon_id` 목록을 노트북 한 곳에서 뺀다 |

**`round` 규칙(3-1a, 확정)** — [다시 뽑기]와 **같은 탭에서 [처음으로] 뒤 다시 시작**하는 경우 모두 +1 한다. 그래서 `(session_id, round)`가 판 하나를 가리킨다. v0.3부터 `track()`이 E-20(지금)·E-19(P4)를 보낸 직후 +1 한다. **그 전 데이터(round가 늘 1)는 판을 세는 데 쓰지 않는다** (어차피 P7에서 지움).

### 5-2. 퍼널

| ID | 퍼널 | 단계 (이벤트 + 조건) | 단위 | 질문 |
|---|---|---|---|---|
| FN-1 (v1 — screen_version=v1만) | 메인 🍃 | `site_visited` → `entry_selected`(entry=leaf) → `balance_answered`(question_no=9, is_edit=false) → `book_opened` → `bookmark_shown`(position=1) → `bookmark_reacted`(position=5) → `result_viewed` → `yes24_link_clicked`(source=result) | 세션 | Q-01, Q-05 |
| FN-2 (v1 — screen_version=v1만) | 메인 🎯 | `site_visited` → `entry_selected`(entry=target) → `goal_submitted`(is_edit=false) → `book_opened` → `bookmark_shown`(1) → `bookmark_reacted`(5) → `result_viewed` → `yes24_link_clicked`(result) | 세션 | Q-01, Q-05 |
| FN-7 | 메인 v2 (v1.0) | `site_visited` → `entry_selected` → `question_answered`(depth=1) → `path_completed` → `book_opened` → `bookmark_shown`(1) → `bookmark_reacted`(5) → `result_viewed` → `yes24_link_clicked`(result) | 세션 | 설계 6절 |
| FN-3 | 책갈피 잔존 | `bookmark_shown` position 1 → 2 → 3 → 4 → 5 → `bookmark_reacted`(5) | 판 | Q-02 |
| FN-4 | 결과 → 예스24 | `result_viewed` → `result_book_viewed` → `description_expanded` → `yes24_link_clicked`(result) | 판 | Q-11 |
| FN-5 | 보관 → 로그인 | `save_clicked`(is_logged_in=false) → `login_prompt_shown`(source=save) → `login_started` → `login_completed` → `book_saved`(is_auto_save=true) | 사람 | Q-12 |
| FN-6 | 재방문 → 내 책갈피 | `site_visited`(is_returning=true, 로그인한 사람) → `library_viewed` | 세션 | Q-13 |

FN-2의 셋째 단계(`goal_submitted`)는 v0.3(2026-10-01)부터 쌓인다. 그 전 데이터에는 🎯 입력 완료를 잴 수 없다(칩 누름 `chip_selected`는 완료가 아니다).

### 5-3. 지표

| 지표 | 정의 | 나눠 보기 | 질문 |
|---|---|---|---|
| 궁금해요율 | `bookmark_reacted` 중 reaction=curious 비율 | entry, pick_type, one_liner_style, position, screen_version | Q-04, Q-07, Q-08 |
| 판당 궁금해요 수 / 0개 판 비율 | 판마다 curious 수 (5장까지 반응한 판만) | entry | Q-04 |
| 5장 완주율 | position=5 반응이 있는 판 / position=1이 보인 판 | entry, device | Q-01, Q-02 |
| 다시 뽑기율 | `redraw_clicked` 수 / 5장 완주 판 | curious_count 구간 | Q-03 |
| 고치기율 | `first_page_edited`가 있는 판 / `book_opened` 판. 🍃 문항별로는 changed_items 빈도 | entry | Q-06 |
| 못 잡겠어요율 | question_no별 choice=unsure 비율 (is_edit=false) | question_no | Q-09 ⓪-1 |
| 망설임 | question_no별 `unsure_hold_cancelled` 수 / 답한 수 | question_no | Q-09 ⓪-2 |
| 같은 축 일치율 | 한 판에서 (1,5)(2,6)(3,7)(4,8) 두 답이 모두 A/B일 때 같은 답인 비율 (is_edit=false) | 축 | Q-09 ⓪ |
| 질문별 효과 | 🍃 판에서 그 축 답 방향 = 책 축 태그 방향일 때 vs 아닐 때 궁금해요율 (`book_id`로 `books.axes` 조인) | 축 | Q-09 ② |
| 보기 vs 직접 쓰기 | `goal_submitted`의 is_free_text 비율, 각 판의 궁금해요율. v0.5(입력 B안)부터 FALSE = 예시 칩 글을 그대로 낸 것. **"예시 칩에서 시작해 고친" 판** = 같은 `session_id`·`round` 안에 `chip_selected`(chip_type=example)가 있고 `goal_submitted`가 is_free_text=TRUE인 판 (손으로 예시 칩 글과 똑같이 쓰면 칩 이벤트 없이 FALSE) | — | Q-10 ② |
| 찾은 책 구간별 반응 | 판의 마지막 `goal_coverage_checked.coverage_bucket`별 궁금해요율·5장 완주율 | coverage_bucket | Q-10 ③ |
| 못 찾은 요청 | `free_goal_written`에서 is_matched=false 또는 found_count<4의 goal_text 목록. v0.6부터 `missing_text`(has_missing=TRUE)를 모아 세면 "새 키워드 후보" 목록 (PRD F-24 — 많이 쌓이면 새 주제·키워드) | method | Q-10 ④ |
| 이해 판단별 반응 (v0.6) | 판의 마지막 `goal_coverage_checked.understood`별 비율, 각각의 5장 완주율·궁금해요율, ②·③에서 `yes24_link_clicked`(first_page) 비율, ③에서 E-02(source=first_page)·E-06 비율 | understood | Q-10 |
| 요청 적중률 | `free_goal_written` 중 keywords가 1개 이상인 비율 | method | Q-10 |
| 더 보기율 | `description_expanded` / `result_book_viewed` (책 단위, 중복 제거) | pick_type | Q-11 |
| 예스24 클릭률 | `yes24_link_clicked`(result) / `result_book_viewed` | pick_type | Q-11 |
| 책갈피 꺼냄율 | `bookmark_pulled` / `result_book_viewed` (책 단위, 중복 제거, v0.7부터) | pick_type, position | Q-11 |
| 뒷면율 | `bookmark_flipped` / `bookmark_pulled` (책 단위, 중복 제거) | pick_type | Q-11 |
| 보관 → 로그인율 | FN-5 단계별 전환 | provider, is_in_app_browser | Q-12, Q-14 |
| 꾸미기율 (v0.8) | 내 책갈피를 연 사람 중 `shelf_created` 또는 `bookmark_moved`가 있는 사람 비율, 그 사람들과 아닌 사람들의 재방문 `library_viewed` 수 | method | Q-13 |
| 질문별 못 잡겠어요·되돌리기 (v1.0) | node_id별 `question_answered` choice=unsure 비율, `question_back_clicked` 수 / 그 질문의 답 수, `unsure_hold_cancelled` 수 / 답 수 | node_id, kind | 설계 6절 ① |
| 좁힌 깊이별 반응 (v1.0) | 판의 `path_completed.depth`·scope_id별 궁금해요율·5장 완주율 | mode | 설계 6절 ②·④·⑤ |

**보고 방식**: 비율은 차이의 크기 + 95% 신뢰구간(판 단위 비율은 Wilson 구간, 같은 사람의 여러 판은 사람 단위 부트스트랩)으로. "유의하다/아니다"로 단정하지 않는다 (CLAUDE.md 원칙 5).

### 5-4. SQL 예시 (Supabase `events`)

```sql
-- FN-3 책갈피 잔존: 판마다 본 마지막 책갈피 자리 → 자리별 도달률
with plays as (
  select common->>'session_id' as sid, (common->>'round')::int as rnd, common->>'entry' as entry,
         max((props->>'position')::int) as last_pos
  from events
  where name = 'bookmark_shown' and common->>'screen_version' = 'v1'
  group by 1, 2, 3
)
select entry, k as position,
       count(*) filter (where last_pos >= k)::numeric / count(*) as reach
from plays cross join generate_series(1, 5) as k
group by entry, k order by entry, k;

-- Q-08 추천 vs 무작위 궁금해요율
select common->>'entry' as entry, props->>'pick_type' as pick_type,
       count(*) as n,
       avg((props->>'reaction' = 'curious')::int) as curious_rate
from events
where name = 'bookmark_reacted'
group by 1, 2;
```

Amplitude에서는 같은 이벤트로 퍼널 차트를 만들고 `entry`로 나눈다. 두 결과가 다르면 SQL을 기준으로 한다(원본은 Supabase).

---

## 6. 개인정보

`/privacy`(S-10, PRD F-16)와 PRD D-04에 맞춘다. **처리방침에 없는 정보는 이벤트에 싣지 않는다.** 모으는 것이 바뀌면 처리방침을 먼저 고친다(7절 순서).

### 6-1. 절대 보내지 않는 것

- 이름, 이메일, 전화번호, 주소, 생년월일
- 카카오·구글 계정 고유번호, 로그인 토큰 — 이벤트의 `user_id`는 Supabase 내부 UUID뿐
- 갈피 우체통(E-31 `feedback_text`, 500자, v0.10 — Supabase에만. v1.0부터 직접 쓰기 글은 받지 않는다; 옛 E-21 기록은 1년 자동 삭제) 말고는 **이용자가 쓴 자유 글** — **내 책갈피 막대 이름(v0.8, 12자)도 이벤트에 넣지 않는다**: Supabase `shelves`에만, 화면 글자로만 보이고 DOM 속성(`aria-label`·`title`·`value` 밖의 속성)에 넣지 않으며 막대 이름 칸과 S-09 막대 머리글에 `data-amp-mask`(리플레이 가림) — 새 입력칸이 생기면 이 문서와 처리방침부터. `goal_text`도 **Supabase에만** 둔다(Amplitude로 보내지 않음, 6-2)
- 책소개·가격·표지 등 YES24 원문 (이벤트에는 `book_id`=ISBN만)
- 키·비밀값, 서버 오류 원문

### 6-2. 조심해서 보내는 것

| 항목 | 규칙 |
|---|---|
| `goal_text` (v1.0 없앰 — 남은 기록은 1년 뒤 삭제) | 최대 30자, 앞뒤 공백 제거. 입력칸 아래 "이름·연락처는 적지 마세요". **Supabase에만 저장한다 — Amplitude 사본에는 이 속성을 넣지 않는다**(결정 2026-09-30, 9절 Q3). 못 찾은 요청 분석(5-3)은 SQL로 하므로 잃는 것이 없다. Amplitude에는 `topic`·`keywords`·`is_matched`·`method`가 간다. 처리방침에 저장 명시, **Amplitude로는 안 간다는 문장은 v0.3에서 추가(6-3)**. **P4**: 주제를 찾으려고 이 글만 Anthropic(Claude Haiku)에 보낸다 — 익명 번호·공통 속성·다른 기록은 보내지 않고, 서버 로그에도 글을 남기지 않는다. 처리방침에 먼저 적었다(6-3b). 첫 장(S-04)이 이 글을 화면에 보이면 Session Replay(20%)가 화면 글자를 담을 수 있다 — v0.3: 직접 쓴 글이 있는 첫 장(`FirstPage.tsx`)과 글을 쓰는 입력 칸(`TargetInput.tsx`)에 `data-amp-mask`를 달아 리플레이에서 가린다 (v0.3.1: 입력 칸도 — 대시보드의 가림 수준이 `light`로 바뀌어도 가려진다) |
| `missing_text` (v0.6) (v1.0 없앰 — 남은 기록은 1년 뒤 삭제) | 분류(Claude Haiku)가 `goal_text`에서 뽑은 짧은 말, 최대 20자(서버 `max`), `<` `>` 제거. `goal_text`와 같이 **Supabase에만** — Amplitude에는 `has_missing`만. 화면에서는 F-24 ②·③의 [예스24에서 찾기] 검색어로 쓰여, 누르면 **그 짧은 말만** 예스24 검색 주소에 실려 간다(익명 번호는 가지 않음. 짧은 글이면 그 말이 글과 같을 수 있다). **DOM 속성에는 절대 넣지 않는다** — Amplitude 자동 수집은 링크 `href`를 가리지 않고 보내고 Session Replay는 속성을 기록하므로, ②·③은 `<a href>`가 아니라 버튼이고 누를 때만 주소를 만들어 `window.open`으로 연다. 그 말이 보이는 글자는 `data-amp-mask`가 달린 첫 장 안에만 있어 리플레이·자동 수집 글자에서 가려진다 (단위·E2E 테스트가 속성·가림을 확인) |
| `feedback_text` (v0.10) | 갈피 우체통 글, 앞뒤 공백 제거 1~500자(넘으면 서버가 받지 않음). **Supabase에만** — Amplitude에는 `text_length`만. 서버 로그·알림 메일·DOM 속성에 넣지 않는다(글칸의 값은 화면 글자로만). 글칸을 `data-amp-mask`로 감싸 리플레이에서 가린다. 시트에 "이름·연락처는 적지 마세요". 다른 이벤트와 같은 공통 속성(익명 번호, 로그인했으면 서버가 확인한 사용자 번호 등)과 함께 저장 — 처리방침 6-3e |
| `referrer` | 500자에서 자름. Supabase에만. 검색 주소 등 쿼리 문자열에 개인 정보가 섞일 수 있어, 필요하면 호스트만 남기는 것을 검토 |
| `anon_id` | 처리방침 "지우고 싶다면"에서 이 번호로 삭제 요청을 받는다 — 값의 형식·위치를 바꾸면 처리방침 화면도 함께 |
| Autocapture·Session Replay | IP·대략적 지역·누른 요소가 Amplitude로 간다(처리방침에 명시). 리플레이는 입력칸을 가린다 — 새 입력칸도 가림 대상인지 확인 |

### 6-3. 처리방침(`/privacy`) 변경 — v0.3에서 반영 (갱신일 2026-10-01)

`web/src/app/privacy/page.tsx`(v0, 갱신일 2026-09-30)는 **직접 쓴 글을 포함한 모든 기록이 Amplitude로도 간다고** 읽혔다. v0.3에서 아래 두 문장을 그대로 넣었다. `goal_text`가 Supabase에만 남으면 아래를 고친다 (모으는 정보의 전달처가 바뀌므로 7-1 순서상 기능 배포 전에).

| # | 위치 | 지금 문장 | 바꿀 문장(안) |
|---|---|---|---|
| 1 (필수) | "기록을 전달하는 곳" 문단 | "위 기록은 분석 서비스 Amplitude(서버는 미국에 있어요)에도 보내요." | "위 기록은 분석 서비스 Amplitude(서버는 미국에 있어요)에도 보내요. **다만 🎯 \"직접 쓰기\"에 적은 글은 Amplitude에 보내지 않고, 갈피의 데이터베이스(Supabase)에만 저장해요.**" |
| 2 (권장) | 표의 🎯 직접 쓰기 행, 첫 칸 | "🎯 \"직접 쓰기\"에 적은 글 (최대 30자) — 그 글에서 찾은 주제·키워드도 함께" | "🎯 \"직접 쓰기\"에 적은 글 (최대 30자, **갈피의 데이터베이스에만 저장**) — 그 글에서 찾은 주제·키워드는 Amplitude에도 함께 보내요" |

- 함께 고칠 것: `web/src/app/privacy/page.test.tsx`(문장 단정이 있으면), `lib/privacy.ts`의 `UPDATED`(갱신일), `PRD.md` F-16 v0 서술 한 줄, 이 문서 6-2·7-1의 확인 체크.
- 그대로 두는 것: "Amplitude가 자동으로 모으는 것" 행, 화면 녹화 행, "지우고 싶다면"(삭제 요청 시 Amplitude 기록도 함께 지움) — 이번 결정과 무관.

### 6-3b. 처리방침 변경 — P4 (Anthropic)

P4의 `/api/goal/classify`가 직접 쓴 글(≤30자)을 Anthropic API로 보낸다(target-chips 3절). 7-1의 7단계대로 **기능보다 먼저** `/privacy`를 고쳤다 — 표의 직접 쓰기 행에 "주제를 찾을 때 Anthropic에 보내요", "기록을 전달하는 곳"에 받는 곳(Anthropic, 미국)·보내는 것(그 글뿐)·Anthropic이 밝힌 처리(API 입력을 학습에 쓰지 않음 — Commercial Terms B, 30일 안에 삭제 — Privacy Center, 예외 있음). 이벤트 속성은 그대로(`method`가 `llm`이 될 뿐).

### 6-3c. 처리방침 변경 — F-24 (예스24 검색어)

7-1의 7단계대로 **기능보다 먼저** `/privacy`를 고쳤다(갱신일 그대로 2026-10-01). ① 표의 직접 쓰기 행 끝에 "갈피에 아직 없는 걸 찾았다면 그걸 가리키는 짧은 말도 데이터베이스에만 저장해요" ② "기록을 전달하는 곳"에 새 문단 — "첫 장에서 [예스24에서 찾기]를 누르면, 그 글에서 찾은 짧은 말(예: '캠핑 장비')만 검색어로 예스24에 보내요. 글이 짧으면 그 말이 글과 같을 수 있어요. 익명 번호는 보내지 않아요." 그 뒤에 "이 밖의 곳에는 주지 않아요"를 옮겼다. (처음 안의 "적은 글 전체는 보내지 않아요"는 짧은 글에서 보장되지 않아 리뷰 뒤 고침)

### 6-3d. 처리방침 변경 — P5 (로그인·내 책갈피, v0.8)

7-1의 7단계대로 **기능보다 먼저** `/privacy`를 고친다(갱신일 바꿈). 표에 ① 로그인: Supabase 사용자 번호·로그인 방법(카카오/구글)·처음 로그인한 때 — 이름·이메일은 갈피 표에 두지 않음, **구글 로그인은 이메일을 로그인 서비스(Supabase Auth) 저장소에만 남김**(로그인 확인용, 기록·분석에 쓰지 않음), 카카오는 이메일을 받지 않음 ② 내 책갈피: 꽂은 책·그때 책갈피 그림·만난 날·막대와 막대 이름(직접 쓴 글 — 갈피 데이터베이스에만). "기록을 전달하는 곳"에 카카오·구글(로그인할 때 그 회사 화면으로 이동 — 그쪽이 받는 것은 그 회사 방침), 로그인한 뒤의 기록에 사용자 번호가 붙어 Amplitude에도 간다는 문장. "지우고 싶다면"에 로그아웃(이 기기에서 연결만 끊음)과 탈퇴 = 문의 메일 → 계정·내 책갈피·기록을 함께 지움.

### 6-3e. 처리방침 변경 — 갈피 우체통 (PRD F-26, v0.10)

7-1의 7단계대로 **기능보다 먼저** `/privacy`를 고쳤다(갱신일 2026-10-02). 표에 새 행 — 갈피 우체통에 적은 글(최대 500자)을 익명 번호 등 다른 기록과 같은 정보(로그인했다면 사용자 번호)와 함께 갈피의 데이터베이스에만 저장, Amplitude에는 글자 수만. "기록을 전달하는 곳"에 — 우체통 글은 Amplitude에 보내지 않음, 운영자에게 가는 도착 알림 메일(Resend)에는 도착 시각만 들어가고 글·익명 번호는 들어가지 않음. 보관은 다른 기록과 같이 1년.

### 6-3f. 처리방침 변경 — v2 (직접 쓴 글·Anthropic 없음, v1.0)

7-1의 7단계대로 **화면보다 먼저** `/privacy`를 고쳤다(갱신일 2026-10-04). ① 표의 행동 기록 행을 "질문마다 고른 답(둘 중 하나 또는 갈피를 못 잡겠어요)과 답하는 데 걸린 시간, 이전 질문으로 되돌린 것, 고른 길(평소/도전, 이야기/배우기)"로 ② 🎯 직접 쓴 글 행을 지움 ③ Anthropic 문단·예스24 검색어 문단을 지우고 "이제 직접 쓴 목표 글을 받지 않고 어떤 글도 Anthropic에 보내지 않는다, 예전 글은 1년 자동 삭제로 지워진다"는 문단을 넣음. 이미 쌓인 `goal_text`·`missing_text`는 `0002_retention.sql`이 1년 뒤 지운다.

### 6-3g. 처리방침 변경 — 도감 v1 (PRD F-21, v1.3)

7-1의 7단계대로 **기능보다 먼저** `/privacy`를 고쳤다(갱신일 2026-10-05). 표에 새 행 — "도감: 로그인했다면, 책장에서 만난 책갈피 그림의 동물·배경·소품과 각각 처음 만난 때와 그때의 그림을 갈피의 데이터베이스에 저장해요 (어떤 책이었는지는 넣지 않아요)" / 왜 "만난 책갈피를 도감에 모아 보여 주기 위해". 저장은 Supabase `collection`(0004, 사용자 번호·부분·값·처음 만난 때·그때 그림·NEW 여부)뿐, 이벤트 E-36·E-37에는 부분·값·등급·개수만(개인 정보 없음). 보관은 내 책갈피와 같이 탈퇴 요청 때까지(계정을 지우면 함께 지워짐 — `on delete cascade`).

### 6-4. 보관

Supabase 기록은 1년 뒤 자동 삭제(`0002_retention.sql`). Amplitude에 전달된 기록은 Amplitude가 따로 보관하고 삭제 요청 때 함께 지운다(처리방침 그대로).

---

## 7. 변경 관리 (동기화 규칙)

### 7-1. 바꾸는 순서

이벤트·속성·값을 **추가·변경·삭제**할 때 이 순서를 지킨다. 한 단계라도 빠지면 테스트(7-3)가 실패해야 한다.

1. (기능이 바뀌면) `PRD.md` — 기능과 이벤트 ID·이름 한 줄 (CLAUDE.md "PRD 먼저")
2. **`docs/taxonomy.md`** — 이 문서. 4절 상세 + 필요하면 5절 지표 + 8절 변경 기록 한 줄
3. **`docs/taxonomy.csv`** — 같은 내용을 줄 단위로 (UTF-8 BOM 유지, 13열)
4. `web/src/lib/track/schema.ts` — `EVENT_NAMES`, 이벤트별 속성 명세(7-3의 `EVENT_SPEC`), 공통 속성
5. 테스트 — taxonomy 테스트, 해당 화면 단위 테스트, E2E의 이벤트 확인
6. `track()` 호출 — 화면 코드 (타입 검사가 명세와 다른 속성을 막는다)
7. `/privacy` — **모으는 정보가 바뀔 때만** (새 자유 글, 새 전달처, 새 종류의 값). 이름만 바뀌면 고치지 않는다
8. Amplitude Data(데이터 카탈로그) — 이벤트·속성 설명을 csv의 Description으로, 분류를 Event Category로. 계획에 없는 이벤트가 보이면 원인을 찾는다 (Production 배포 뒤)
9. `docs/context.md` — 날짜와 이유 한 줄

1~6은 **같은 커밋**. 7은 기능이 배포되기 전, 8은 배포 뒤.

### 7-2. 누가·언제

| 언제 | 누가 | 무엇을 |
|---|---|---|
| Phase 계획 파일을 쓸 때 (`plans/…-pX-*.md`) | Claude | 그 Phase 화면의 이벤트를 이 문서에서 `planned-*` → 구현 명세로 확인. 빠진 속성이 있으면 이 문서부터 고치고 사용자 승인 |
| 이벤트를 심을 때 | 구현 에이전트 | 7-1의 1~6을 한 커밋에. 상태를 `live`로 |
| 코드 리뷰 | 리뷰 에이전트 | 아래 체크리스트 한 줄 확인 |
| P6 전수 점검 | Claude + 사용자 | E2E 한 바퀴로 모든 `live` 이벤트가 속성까지 맞는지, Supabase·Amplitude 수 대조 |
| P7 실데이터 시작 뒤 | 사용자 승인 | 이름 변경은 원칙적으로 하지 않는다(속성 추가만). 꼭 바꿔야 하면 변경 기록에 날짜를 남기고 분석에서 두 이름을 합친다 |
| 새 `proposed` | 사용자 | 승인 → PRD 반영 → `planned-*` |

**커밋 체크리스트 한 줄** (코드 리뷰·커밋 메시지 본문):
`- [ ] events: taxonomy.md · taxonomy.csv · schema.ts changed together (or no event change)`

**CLAUDE.md에 넣을 규칙 (제안 문구)** — "원칙" 3번 아래:
> 3-1. **이벤트의 원본은 `docs/taxonomy.md`** — 이벤트를 추가·변경·삭제할 때는 taxonomy.md → taxonomy.csv → `schema.ts` → 테스트 → `track()` 호출 순으로 같은 커밋에서 고친다. 모으는 정보가 바뀌면 `/privacy`를 먼저. taxonomy 테스트가 실패하면 문서와 코드 중 어느 쪽이 틀렸는지 확인하고, 테스트를 고쳐 통과시키지 않는다.

### 7-3. 자동 검사 (v0.3 구현 — `web/src/lib/track/taxonomy.test.ts`, `web/e2e/helpers.ts`의 `specMismatches`)

목표: **문서 ↔ csv ↔ 코드 명세 ↔ 호출**이 어긋나면 `npm run test`나 `npm run typecheck`가 실패한다.

**① 코드에 속성 명세 두기** — `lib/track/schema.ts`

```ts
// 실제 모양 (v0.3 — 일부만 옮김)
export const EVENT_SPEC = {
  site_visited: { prompt_version: { type: "string", only: "amplitude" } },
  entry_selected: {},
  balance_answered: {
    question_no: { type: "number" }, choice: { type: ["A", "B", "unsure"] }, side: { type: [null, "left", "right"] },
    elapsed_ms: { type: "number" }, is_edit: { type: "boolean" },
  },
  free_goal_written: {
    goal_text: { type: "string", only: "supabase", max: 30 }, topic: { type: "string" },
    keywords: { type: "string", array: true }, is_matched: { type: "boolean" }, method: { type: ["word", "llm"] },
  },
  // … 27개 전부
} as const satisfies Record<string, Readonly<Record<string, PropSpec>>>;
export type EventName = keyof typeof EVENT_SPEC;         // EVENT_NAMES는 여기서 만든다
export type PropsOf<N extends EventName> = /* EVENT_SPEC[N]에서 보내는 속성의 타입을 뽑는 매핑 타입 (only: "amplitude" 제외) */;
export function track<N extends EventName>(name: N, props: PropsOf<N>): void;
export const COMMON_KEYS = ["anon_id", "user_id", "session_id", "round", "entry", "screen_version",
                            "referrer", "is_returning", "device", "is_in_app_browser"] as const;
```

- `track()`이 이 타입(`PropsOf`)을 받으면 **호출하는 곳의 속성 이름·타입·값은 `tsc`가 검사**한다 (호출을 grep할 필요가 없다)
- 명세 값 (`PropSpec`): `type`은 `"string" | "number" | "boolean" | "object"` 또는 열거형 값 목록(null 허용이면 `null` 포함). 배열은 `array: true`, null 허용 문자열은 `nullable: true`, 한쪽에만 보내는 속성은 `only: "supabase" | "amplitude"`, 글 길이 상한은 `max`
- v0.3: `/api/track`이 같은 명세로 `props`를 검사한다(`props.ts`의 `parseProps`) — 모르는 속성·Amplitude 전용 속성·타입이 틀린 값은 버리고 이벤트는 저장, 버린 키 이름만 서버 로그에 남긴다(값은 남기지 않음)

**② taxonomy 테스트** — `web/src/lib/track/taxonomy.test.ts` (Vitest)

- `docs/taxonomy.csv`를 읽는다: `new URL("../../../../docs/taxonomy.csv", import.meta.url)`. CSV 해석은 `csv-parse`(`csv-parse/sync`, `bom: true`)를 devDependency로 — 따옴표 안 쉼표·줄바꿈이 있어 직접 split하지 않는다
- 검사 목록:

| # | 검사 | 실패하면 |
|---|---|---|
| 1 | 머리글이 정확히 13열: Trigger … Note, Event ID, Status | csv 형식이 깨짐 |
| 2 | 이벤트 이름 `^[a-z][a-z0-9]*(_[a-z0-9]+)+$`, 마지막 단어가 2-2 동사 목록 안 (`*` 줄 제외) | 명명 규칙 위반 |
| 3 | 속성 이름 snake_case, Data Type이 Boolean이면 `is_`/`has_`로 시작, Data Type ∈ {String, Number, Boolean, Object}, Array ∈ {TRUE, FALSE}, Trigger ∈ {view, click, submit, system, -}, Status ∈ 2-8 | 규칙 위반 |
| 4 | Event ID ↔ Event Name이 1:1, 같은 이벤트 줄끼리 Trigger·Category·Description이 같음 | csv 안에서 어긋남 |
| 5 | 한 속성 이름은 모든 이벤트에서 같은 Data Type·Array | "한 이름 = 한 타입" 위반 |
| 6 | Status가 `live`·`planned-*`인 이벤트 이름 집합 = `Object.keys(EVENT_SPEC)` | 문서와 코드의 이벤트 목록이 다름 |
| 7 | 그 이벤트마다 `proposed`·`removed`가 아닌 속성 줄 집합 = `EVENT_SPEC[name]`의 키, 타입·배열 여부 일치. 열거형 명세면 Value Example의 따옴표 값 집합과 같음 | 속성이 어긋남 |
| 8 | `*` 줄의 속성 = `COMMON_KEYS` (그리고 `parseCommon`이 돌려주는 키) | 공통 속성이 어긋남 |
| 9 | `docs/taxonomy.md`의 `#### E-xx \`name\`` 제목에서 뽑은 (ID, 이름) 쌍 = csv의 쌍 (`*` 제외) | md와 csv가 어긋남 |
| 10 | Status가 `live`인 이벤트 이름 집합 = 앱 소스(`web/src`, 테스트 제외)의 `track("…"`·`trackStored("…"`(v0.10 — 서버가 먼저 저장한 E-31의 Amplitude 사본) 호출 이름 집합. 한 이벤트의 줄은 모두 같은 Status(#4) | 심었는데 문서가 planned, 또는 문서는 live인데 호출이 없음 |
| 11 | `docs/taxonomy.md`의 이벤트별 속성 표(4-2, `#### E-xx` 아래)의 속성 이름·타입(`String[]` = 배열)·값 = csv의 그 이벤트 줄의 Event Properties·Data Type·Array·Value Example | 속성 표를 md에서만 또는 csv에서만 고침 (#9는 이벤트 이름만 본다) |

- 규칙: 열거형 속성은 csv Value Example에 **가능한 값을 모두** 적는다(지금 csv가 그렇게 되어 있다. `chip_value`·`topic`처럼 키 목록이 긴 값은 명세를 `"string"`으로 둔다)

**③ E2E 한 줄** — `e2e/helpers.ts`가 가로채는 `/api/track` 본문마다 `props`의 키가 `EVENT_SPEC[name]`의 키(Amplitude 전용 제외)와 **같은지**, `common`의 키가 `COMMON_KEYS`와 같은지 확인 (P6 전수 점검을 매번 자동으로 — 🍃·🎯 흐름 E2E가 `specMismatches(events)`를 부름)

**④ 실패했을 때** — 문서가 맞으면 코드를, 코드가 맞으면(이미 승인된 변경) 문서·csv를 고친다. 테스트 기대값만 바꿔 통과시키지 않는다.

---

## 8. 변경 기록

| 버전 | 날짜 | 누가 | 바뀐 것 |
|---|---|---|---|
| v0.1 | 2026-09-30 | Claude (검토 전) | 첫 작성. PRD E-01~E-25(E-04 삭제) 24개 + 제안 E-26 `goal_submitted`. 명명 규칙·공통 속성·퍼널·개인정보·동기화 규칙. 현재 코드 대비 이벤트 이름 변경 3건(+PRD만 있는 E-18 1건)·속성·값 변경 19건·기존 이벤트 속성 추가 제안 4건(4-4) |
| v0.2 | 2026-09-30 | Claude (사용자 결정 반영) | 사용자 결정 5건(9절). ① E-26 `goal_submitted` 추가 확정 → Status `planned-taxonomy`(새 상태), PRD 4절에도 추가. ② `round` +1 = [다시 뽑기] + 같은 탭 [처음으로](3-1a·5-1). ③ `goal_text`는 **Supabase only** — Amplitude 사본에서 뺌(2-7 속성 단위 예외·6-2), `/privacy` 고칠 문장 2개 기록(6-3). ④ 이름 변경 4건·속성·값 변경 19건·속성 추가 4건 모두 `accepted — dev round` — **한 번의 개발 라운드로, P7 전·Vercel Amplitude 키 설정 전**(4-4 표는 마이그레이션 명세로 유지). ⑤ Amplitude `setUserId`·`login_provider`는 **P5에서 결정**(3-2). Amplitude 검토의 개발 라운드 항목 2건 추가: 시작 전 이벤트도 큐에 받기, 큐 이벤트는 원래 `time` 유지(2-7). 상태 집계 `proposed` 1 → 0, `planned-taxonomy` 1 |
| v0.3 | 2026-10-01 | Claude (개발 라운드) | **구현 완료** (`plans/2026-10-01-taxonomy-dev.md`). 4-4 마이그레이션 전부 코드에 반영 — 이벤트 이름 4건(E-18은 명세만), 속성·값 19건, 중복 `entry` 삭제 2건, 속성 추가 4건(E-08 `one_liner_style`·E-20 `source` 구현, E-10·E-18 `pick_type`은 명세만 — P4), E-26 `goal_submitted` 구현. `round` +1은 `track()`이 E-20·E-19를 보낸 직후(3-1a). `goal_text`는 Amplitude 사본과 Session Replay에서 빠지고 `/privacy`에 6-3 문장 2개(갱신일 10-01). `schema.ts`의 `EVENT_SPEC`·`PropsOf`로 `track()` 호출을 tsc가 검사, `/api/track`도 같은 명세로 props 검사. 자동 검사: `taxonomy.test.ts`(7-3 #1~#10), E2E `specMismatches`. Amplitude 대기열: 시작 전 이벤트도 받기(키 있을 때만)·원래 `time`. csv: 구현된 줄 `live`, E-10·E-18 `pick_type`은 `planned-P4`, E-01 Note에 `Amplitude only`, Note의 "현재 이름" → "이전 이름". Supabase의 테스트 기록은 옛 이름 그대로(P7에서 지움 — 옮기지 않음) |
| v0.3.1 | 2026-10-01 | Claude (최종 검토 반영) | 직접 쓰기 입력 칸에 `data-amp-mask`(Session Replay 가림이 대시보드 수준과 무관하게 코드로 보장 — 6-2). `forAmplitude`는 허용 목록 방식(명세에 있고 `Supabase only`가 아닌 속성만). 자동 검사 #11 추가 — 이벤트별 속성 표 ↔ csv (7-3). 옛 표현을 구현된 상태로 고침(2-7 a·b, 2-8, 4-1, 4-4, 7-3 ①). 배포 체크리스트(`deploy.md`)에 Production 키 설정 뒤 개인정보 확인 추가. 이벤트·속성 변경 없음 |
| v0.4 | 2026-10-01 | Claude (P4 구현) | S-06에서 E-09 `result_viewed`·E-10 `result_book_viewed`(`pick_type` 포함)·E-23 `description_expanded`·E-18 `yes24_link_clicked`(`source`=result, `pick_type`), S-08에서 E-19 `redraw_clicked`를 심어 `live`로(E-19 뒤 round +1은 v0.3의 `track()` 그대로). E-20 설명에서 P3 임시 화면 문구를 뺌. 이벤트 이름·속성 변경 없음 |
| v0.5 | 2026-10-01 | Claude (D-D 입력 B안) | S-02 🎯가 큰 무엇을 칸 + 예시 칩 6개로(PRD F-02, context 10-01). E-03 `chip_type` 값 "topic" → "example"(예시 칩을 누를 때, `chip_value` = 칩 글). E-26 `is_free_text`는 이름·뜻 그대로 "보기 vs 직접 쓰기"(Q-10 ②) — FALSE = 예시 칩 글을 고치지 않고 제출. 그 글은 칩마다 정해 둔 주제·키워드로 바로 연결(Claude 호출 없음)되고 E-21·E-22는 남지 않는다(주제 칩 때와 같음). 고친 글은 직접 쓴 말 — 분류, E-21·E-22. 새 이벤트·속성 없음 |
| v0.5.1 | 2026-10-01 | Claude (최종 검토 반영) | 로고·주소로 새로 열기 규칙(home-nav)의 `round` 변경을 기록: 판 도중이던 흐름을 `navigate`로 새로 열면 round +1(이벤트 없음)·`entry` null이 `site_visited`보다 먼저 정해진다(3-1a·E-01, `storage.ts`의 `settleOpen`). 3-1a의 구현 함수 이름을 고침. 저장 흐름 `VERSION` 2 → 3(마음·회복이 키워드에서 빠졌으므로 배포 전 저장 흐름은 처음부터). 이벤트·속성 이름·값 변경 없음 |
| v0.6 | 2026-10-01 | Claude (F-24 구현) | PRD F-24 "이렇게 이해했어요"(시안 C′). E-22 `understood`("keyword"/"topic"/"missing"/"none"/"nearest") 추가 — ③(Claude가 맞는 주제 없다고 함)은 뽑지 않으므로 제출 때 found_count 0으로 보낸다. 단어 매칭이 못 찾은 판(nearest)은 ③이 아니다 — 예전처럼 가장 가까운 주제 책 + "아직 이 주제 책이 없어요…" 한 줄. ②·③의 예스24 검색은 버튼(누를 때만 주소를 만듦) — 그 말이 `href` 같은 속성으로 Amplitude 자동 수집·리플레이에 가지 않게(6-2). E-21 `has_missing`(Boolean, Amplitude에도)·`missing_text`(String 또는 null, ≤20자, **Supabase only**) 추가. E-18 `source`에 "first_page"(②의 링크·③의 버튼, `book_id`·`pick_type` null — `book_id`가 null 허용으로). E-02 `source`("home"/"first_page") 추가 — ③ [🍃 그냥 한 권]은 E-02 직전에 round +1(3-1a, 이벤트 없는 +1). ③ [다른 말로 쓰기]는 기존 E-06 그대로. `/privacy` 6-3c 먼저. 저장 흐름 `VERSION` 3 → 4. `screen_version`은 그대로 `v1`(F-18 2단계 전후 비교용 — 실이용자 전이라 올리지 않음). 이벤트 이름 변경 없음 |
| v0.7 | 2026-10-01 | Claude (C-16 구현) | S-06 책 속 책갈피(DESIGN C-16, PRD F-12의 보이는 부분)와 함께 E-27 `bookmark_pulled`(`book_id`·`position`·`pick_type`)·E-28 `bookmark_flipped`(`book_id`·`pick_type`)를 추가해 바로 `live`. 2-2 동사 `pulled`·`flipped` 추가, Q-11·5-3 지표(꺼냄율·뒷면율). 모으는 정보는 그대로(책 ID·위치·추천/무작위뿐) — `/privacy` 변경 없음. v0.6은 F-24 브랜치의 변경 |

| v0.8 | 2026-10-01 | Claude (P5 계획, 사용자 결정 반영) | 3-2 결정(Q5 — 후보안 채택 + `user_id`는 `/api/track`이 세션으로 채움, 로그아웃 때 `setUserId(undefined)`). E-29 `shelf_created`(`shelf_count`)·E-30 `bookmark_moved`(`book_id`·`method`) 추가 `planned-P5`, 동사 `created`·`moved`, Q-13·꾸미기율. 막대 이름은 이벤트·Amplitude·DOM 속성 금지(6-1). 로그아웃·막대 이름 바꾸기·막대 지우기는 이벤트 없음(답할 질문이 없음, 1-1). E-11·E-12·E-14·E-15·E-16·E-17 설명을 [내 책갈피에 꽂기]·뒷면 [빼기]로. 처리방침 변경 6-3d. 기존 이벤트의 이름·속성 변경 없음. 구현 뒤 리뷰: E-14는 서버 쿠키로 확인된 로그인에만, E-12 header에 S-09 [로그인] 포함 |

| v0.9 | 2026-10-02 | Claude (사용자 요청) | 밸런스 게임 문항 순서를 판마다 무작위로(PRD F-03, balance-game 2절 — 같은 축 두 질문은 붙지 않게, 좌우는 문항마다 고정). E-24 `balance_answered`·E-25 `unsure_hold_cancelled`에 `position`(Number, 1~9 — 이 판에서 몇 번째로 나왔는지) 추가. `question_no`는 이제 순서가 아니라 문항 번호. 같은 축 일치율(5-3)은 문항 번호 쌍 그대로. 저장 흐름 `VERSION` 4 → 5. 모으는 정보 변화 없음(처리방침 그대로) |
| v0.10 | 2026-10-02 | Claude (사용자 요청) | 갈피 우체통(PRD F-26, S-01만)과 함께 E-31 `feedback_sent`(`feedback_text` String ≤500 **Supabase only**·`text_length` Number)를 추가해 바로 `live`. 동사 `sent`, 분류 `홈`(퍼널 밖 — 분석 질문 없음, 운영용). 저장을 확인한 뒤에만 "잘 받았어요"를 보이므로 Supabase 사본은 `/api/feedback`이 `/api/track`과 같은 저장·`user_id` 확인 경로(`lib/track/record.ts`)로 쓰고, 화면은 2xx 뒤 `trackStored()`로 Amplitude 사본만 보낸다(2-7 예외) — 검사 #10이 `trackStored("…"` 호출도 센다. 저장되면 운영자에게 Resend 도착 알림(시각만, 글 없음). 처리방침 6-3e 먼저(갱신일 2026-10-02). 기존 이벤트 변경 없음 |
| v0.11 | 2026-10-02 | Claude (사용자 요청) | 친구 5명 시험 의견("아까 본 책을 다시 못 본다")으로 S-06에 ‹ › 앞뒤 넘기기(PRD F-09, DESIGN C-11). E-10 `result_book_viewed`는 판마다 **책당 한 번**(돌아가 다시 봐도 또 남지 않음 — position 별 조회 수가 부풀지 않게). 앞뒤 이동 자체는 이벤트 없음(답할 질문이 없음, 1-1). 이벤트 이름·속성·`schema.ts` 변경 없음, 모으는 정보 변화 없음 |
| v0.12 | 2026-10-02 | Claude (사용자 결정) | 친구 5명 시험에서 꽂는 법을 아무도 못 찾음 → S-06 꽂기를 제목 옆 작은 잉크 알약 [🔖 꽂기]로, 늘 보이고 한 번에 꽂힘(PRD F-12, DESIGN C-16b). 책 아래 [내 책갈피에 꽂기]는 없앰, 주 버튼은 늘 [예스24에서 보기]. **E-11 `save_clicked`는 이제 E-27 `bookmark_pulled` 없이도 남는다** — 5-3 꺼냄율·뒷면율은 그대로지만 v0.12 전후의 "꺼냄 → 꽂기" 순서를 퍼널로 잇지 않는다(그 전에는 꽂으려면 꺼내야 했다). 마우스 hover(들림 + "눌러서 꺼내기")는 이벤트 없음. 처음 S-06 안내(C-21)도 이벤트 없음(C-20과 같음, 1-1). 이벤트 이름·속성·`schema.ts` 변경 없음, 모으는 정보 변화 없음 — `/privacy` 그대로(localStorage 열쇠 `galpi.hint.resultGuide` 하나 추가는 C-20과 같은 화면 설정) |
| v1.0 | 2026-10-04 | Claude (v2 계획 2) | 갈피 v2(입구 하나, 둘 중 하나 고르는 갈림길). **새로**: E-32 `question_answered`(node_id·kind·choice·depth·position·elapsed_ms — E-24 대신, 이름을 바꿔 v1과 섞이지 않게), E-33 `question_back_clicked`(node_id·depth·source), E-34 `path_completed`(scope_id·depth·unsure_count), 공통 `mode`. **바꿈**: E-25 `unsure_hold_cancelled` 속성 question_no·position·is_edit → node_id·depth, 분류 갈림길. E-20 `source`에 "question"(첫 질문의 이전 질문 → 새 판, 3-1a). 공통 `entry` 뜻 = 갈래(값 그대로), `screen_version` v2. **없앰(`removed`, 줄은 기록으로)**: E-03 `chip_selected`, E-26 `goal_submitted`, E-21 `free_goal_written`, E-22 `goal_coverage_checked`, E-06 `first_page_edited`, E-24 `balance_answered`. E-02 `source`=first_page와 E-18 `source`=first_page 값은 더 나오지 않지만 v1 기록을 읽으려고 스펙에 남김. 처리방침 6-3f를 먼저. v1 기준점과는 책갈피 이후 이벤트(공통)로만 비교(설계 9절) |
| v1.1 | 2026-10-04 | Claude (사용자 요청) | 내 책갈피(S-09)를 꾹 눌러 **끌어서** 다른 막대 어디든·같은 막대 안 다른 자리로 옮김(PRD F-13, `plans/2026-10-04-library-front-drag.md`). E-30 `bookmark_moved`: `method`에 "drag" 추가, "hold"(들고 → 막대 누르기)는 v1.1부터 보내지 않음 — 그 화면이 없어짐, 옛 탭과 v1.0까지의 기록을 읽으려고 스펙에 남김. 새 속성 `is_same_shelf`(Boolean — 2-3 규칙으로 `is_`, 계획서의 `same_shelf`). 같은 막대 안 순서 바꾸기도 남김, 제자리·막대 밖 놓기는 남지 않음. 놓인 자리 번호는 넣지 않음(답할 질문이 없음, 1-1). 모으는 정보 변화 없음 — `/privacy` 그대로 |
| v1.2 | 2026-10-04 | Claude (사용자 요청) | 내 책갈피(S-09)에 [모두 제거] → 확인 시트 [모두 빼기](PRD F-13, 시안 `library-buttons-options.png` A). 새 E-35 `library_cleared`(`removed_count` Number — 서버가 지운 수)를 화면과 함께 `live`로, 동사 `cleared` 추가. 서버가 지운 것을 확인한 뒤에만 보낸다. 빠진 책마다 E-16 `book_unsaved`를 보내지 않는다(한 누름 = 한 이벤트 — 어떤 책이었는지는 그 전 E-15로 안다). 막대 이름·번호는 넣지 않음(6-1). 모으는 정보 변화 없음(지운 수뿐) — `/privacy`는 기록을 "누른 버튼"으로만 적고 이벤트를 하나하나 나열하지 않아 그대로 |
| v1.3 | 2026-10-05 | Claude (도감 v1 구현) | 도감 v1(PRD F-21, `plans/2026-10-05-collection-dex.md`). 새 E-36 `collection_item_found`(`part_kind`·`part_value`·`tier` — 서버가 새로 기록한 부분마다, 로그인한 사람만)·E-37 `collection_viewed`(`collected_count`·`is_logged_in`)를 화면과 함께 `live`로. 동사 `found`, 분류 `도감`. 이름 규칙 2-3 때문에 계획서의 `kind`·`value`·`found_count` 대신 `part_kind`·`part_value`·`collected_count`(`kind`는 E-32의 질문 종류, `found_count`는 옛 E-22의 책 수와 뜻이 다름). E-07 `art`: 값에 한정판·초판본이 더해지고 `rare`의 뜻을 정함(넷 중 하나라도 한정판 이상). 처리방침 6-3g 먼저(갱신일 2026-10-05) |

---

## 9. 결정 기록 (v0.2, 2026-09-30)

v0.1 보고의 열린 질문 5개에 대한 사용자 결정. 모두 구속력이 있다.

| # | 질문 | 결정 | 반영 위치 |
|---|---|---|---|
| Q1 | E-26 `goal_submitted`를 만들까 | **만든다.** 🎯 입력 완료 — [책 펼치기]로 폼이 제출될 때. PRD 4절에 추가, 개발 라운드에서 심음(`planned-taxonomy`) | 2-8, 4-1, 4-2 E-26, 4-4, csv, PRD 4절 |
| Q2 | [처음으로] 뒤 같은 탭 재시작도 `round`를 올리나 | **올린다.** [다시 뽑기]와 [처음으로](새 판) 모두 +1, 이벤트를 보낸 직후에 | 3-1·3-1a, 4-2 E-19·E-20, 5-1, csv `round` |
| Q3 | 직접 쓴 글(`goal_text`)을 Amplitude로도 보낼까 | **아니다 — Supabase에만.** Amplitude 사본은 나머지 속성(topic·keywords·is_matched·method)을 유지. `/privacy` 문장은 개발 라운드에서 고친다 | 2-7, 4-2 E-21, 6-1·6-2·6-3, csv Note, PRD E-21·D-04 |
| Q4 | 제안한 이름 변경·속성 추가를 받아들이나 | **전부 받아들인다 — 한 번의 개발 라운드로, P7 실데이터 시작 전(Amplitude 키를 Vercel에 넣기 전)** | 4-4, csv Note(`accepted—dev round`), PRD 4절 속성 |
| Q5 | P5에서 Amplitude `setUserId` + 유저 속성 `login_provider`만 쓸까 | **쓴다 (2026-10-01 사용자 결정)** — 더해서 `user_id`는 서버가 세션에서 채운다 | 3-1, 3-2 |
