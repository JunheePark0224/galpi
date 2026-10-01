# 개발 순서 — 갈피 (Galpi)

Last Updated: 2026-10-01

`../Reference.pdf`(몽글이 키우기 개발 기록)의 순서를 따르되 갈피에 맞게 바꾼 것.
단계를 끝낼 때마다 상태와 결과물을 여기에 적는다.
**날짜는 모두 잠정이다** — 언제든 바뀌고, 시간이 남으면 다음 날 할 일까지 바로 이어서 진행한다. 지키는 것은 날짜가 아니라 순서.

## 몽글이와 다른 점

| | 몽글이 | 갈피 |
|---|---|---|
| 저장 | 서버 없음, 브라우저 저장 | **서버 필요** — YES24 키는 서버에만, 이용자 행동 기록은 한곳에 모아야 함 |
| 트랙 | 🛠 개발 · 🎨 디자인 | 🛠 개발 · 🎨 디자인 · **📚 데이터**(책 선정·태그·첫인상 한 줄) |
| 결과물 | 게임 | 웹 + **분석**. 이벤트 기록이 기능 목록에 들어가고, Phase 완료 기준에 "이벤트가 제대로 쌓이는가"가 포함됨 |
| 문서 ID | PRD(F, S) → PHASES(P) → DESIGN(T, C, A) | PRD(F 기능, S 화면, **E 이벤트**) → PHASES(P) → DESIGN(T, C, A) · 데이터(D) |

## 순서

| # | 단계 | 결과물 | 상태 |
|---|---|---|---|
| 1 | PRD — `proposal.md` v3를 기능 F·화면 S·이벤트 E 번호로 정리, 남은 빈칸 확정 | `docs/PRD.md` | **완료 (v0.2)** |
| 2 | PHASES — 3트랙, Phase마다 완료 기준. 배포 10/16, 분석 10/31 | `docs/PHASES.md` | v0.1 (책 구성·뽑기 `book-pool.md` 포함) |
| 3 | DESIGN + 문서 관계 — 토큰·컴포넌트(책·책갈피·칩)·에셋, 추적표 | `docs/DESIGN.md`, `docs/README.md` | v0.1 작성, 검토 중 |
| 4 | 레퍼런스 이미지로 디자인 다듬기 — 오래된 책·책갈피 참고 (민음사 저작물은 쓰지 않음) | `docs/references/`, `assets/animals/`, DESIGN 갱신 | **완료** (동물 7종 초안·배치 규칙) |
| 5 | Stitch 화면 설계 — 프롬프트, 시안 수집 | `docs/stitch/` | **완료** — 시안 8개 + 로고 수집 (`exports/README.md`) |
| 6 | 프로젝트 CLAUDE.md | `Galpi/CLAUDE.md` | **완료** |
| 7 | 구현 계획 — 로드맵 + 첫 Phase 상세 | `docs/plans/` | **완료** — 로드맵 + P0 + P1 (계획 속 코드 검증) |
| 8 | git 저장소 + P0 셋업 (서버·이벤트 저장 포함) | 코드 | 예정 |
| 9 | Phase별 구현 → 스펙 리뷰 → 코드 리뷰 → 완료 기준 확인 | 코드 | 예정 |
| 10 | 배포 (외부 공개라 사용자 확인 후) | URL | 예정 |
| 11 | 1단계 이용자 모으기·분석 → 2단계 고치고 전후 비교 | `notebooks/`, 제안 한 장 | 예정 |
| 12 | 세션 기록 PDF | `docs/session-log.pdf` | 예정 |

## 기록

(단계를 끝낼 때마다: 요청 · 한 일 · 결과물)

### 1. PRD (09-29)
- 요청: Reference 순서대로 갈피에 맞게 진행. 결과·보관·로그인 흐름 지시
- 결정: 궁금해요 책은 한 권씩 큰 표지 + 설명, 책마다 [보관] [예스24]. 로그인은 처음엔 요구하지 않고 보관할 때만. **카카오 + 구글 로그인만, 자체 회원가입 없음.** 로그인하면 우측 위 [내 책갈피]. 다시 뽑기는 앞의 궁금해요를 이어가지 않음
- 결과물: `PRD.md` v0.1 — 기능 F-01~20, 화면 S-01~10, 이벤트 E-01~20, 데이터 D-01~06, 미정 5개
- 이어서 하나씩 결정 → **v0.2 확정**: 🍃 취향 밸런스 게임(연구 근거 + 무작위 1장 검증, `balance-game.md`), 책 200권·🎯 분야 3개, 기록 Supabase + Amplitude, 스택 Next.js + Motion + CSS 3D(움직임 시안 클릭 테스트 통과), 🎯 한 화면 입력 + 직접 쓰기 LLM 분류 + 태그 3층·검증 기준(`target-chips.md`), 책 설명 접기 + 나온 이유 한 줄
- 원칙 추가: **추천 기준은 사람이 정하고 설명할 수 있다** (AI는 초안·분류만)
- 추가 결정: 밸런스 게임 9문항(축마다 2번, 두 번째는 좌우 반전) + "갈피를 못 잡겠어요" 0.8초 꾹 누르기 — 시안 클릭 테스트로 확인(짧게 누르면 안 넘어감, 왼쪽만 누르면 "둘 다 좋아요"로 걸러짐)

### 2. PHASES (09-29)
- 결과물: `PHASES.md` v0.1 — 🛠 P0 셋업 → P1 추천 로직 → P3 흐름 화면 → P4 결과·서버 → P5 로그인·내 책갈피 → P6 기록 마무리 → P7 QA·배포 / 📚 D1~D4 + D-07 / 🎨 DESIGN·책갈피 그림·Stitch / 📊 P8·P9. 이벤트는 화면 Phase의 완료 기준에 포함
- 추가: 🍃 장르 9개로 다양화, 뽑기 규칙(상위권 가중 추첨·장르 상한) + 가상 이용자 시뮬레이션(`book-pool.md`, `src/simulate_draws.py`, 코드 검토 반영)

### 3. DESIGN + 문서 관계 (09-29)
- 시안 비교: 방향 A(천 표지)/B(파스텔)/C(대출 카드) → 사용자가 민음사 책갈피 사진 제시 → 반투명 필름 책갈피 → "민음사와 너무 똑같다" → **갈피만의 모양 ① 아치 창 + 제비꼬리 끝 + 끈**, 그림은 **무작위 동물 × 배경 × 소품**
- 결정: 내 책갈피 = **책갈피 컬렉션**(그때 책갈피를 그대로 저장), 책 한 권에 책갈피 하나, 희귀 책갈피는 나중(F-21)
- 결과물: `DESIGN.md` v0.1 — 토큰 T-01~06(장르 색 12개 대비 4.5:1 이상 계산), 컴포넌트 C-01~15, 책갈피 규격, 에셋 A-01~06(동물 캐릭터는 사용자) / `README.md` — 문서 관계·변경 규칙·추적표

### 4. 레퍼런스 · 동물 캐릭터 (09-29)
- 레퍼런스: 민음사 책갈피 사진(`docs/references/01_minumsa-bookmarks.png`, 참고 전용)
- 동물 7종 초안을 Claude가 SVG로(`assets/animals/*.svg`) — 사용자 피드백으로 **창의 55% 크기로 언덕 위에**, 소품 하늘 5 + 땅 5 → 조합 1,050가지. 사용자가 이 크기로 확정

### 5. Stitch 준비 (09-29)
- 공식 형식(`npx -p @google/design.md designmd spec`) 확인 → `docs/stitch/DESIGN.md` 작성, **공식 검사 오류 0 · 경고 0** (쓰이지 않던 토큰 3개 정리)
- `docs/stitch/STITCH-PROMPTS.md` — 사용 순서, P-00 책갈피 시트 + 화면 프롬프트 8개(P-01~08), 수정 프롬프트 4개, 체크리스트
- 다음: 사용자가 Stitch에서 생성 → 링크 또는 이미지(`docs/stitch/exports/`) → Claude 수집, PRD와 다른 부분은 "따르지 않을 부분"으로 기록

### 6. 프로젝트 CLAUDE.md (09-29)
- `Galpi/CLAUDE.md` — 세션 이어가기 순서, 문서·ID, 원칙 5개, 구조, 기술, 보안·약관, 디자인 금지 사항, 사용자와 일하는 방식
- 추가 결정: 데스크톱은 전용 레이아웃 없이 **가운데 기둥(최대 430px)**, 기기 종류를 공통 속성으로 기록, P3 완료 기준에 노트북 크기 확인

### D1-1. 책 200권 선정 (09-29, 데이터 트랙)
- `src/collect_candidates.py` — YES24 분야별 베스트·스테디(분야 코드는 `category/list`로 확인) + 검색 → 규칙(분야·제목·중복·저자 2권·시리즈 2권 이후 제외) → 상세 조회로 평점·쪽수·목차 확인
- Claude 제외 목록 24건(이유 포함) + 확인 필요 6건 → `data/processed/d1_curation.json`
- 코드 검토(python-reviewer) 반영: 🎯 제외 단어를 제목에만 적용(책소개의 우연한 단어로 좋은 책이 빠지던 문제), 작법서 단어도 제목에만, 제외를 중복 제거 전에, 빈 응답은 캐시하지 않고 실패를 출력, 예비 후보가 다른 칸에서 다시 쓰이지 않게
- 결과: 선정 200 · 예비 93 · 정보 부족 57 · 제외 21 · 저자 상한 13. API 실패 4건(일부 분야 목록 404)은 기록만
- 수집(09-29): 사용자가 Stitch에서 생성 → 사용자가 `.env`에 `STITCH_API_KEY` 직접 입력(채팅 노출 없음) → `src/stitch_client.py`(MCP 엔드포인트, 키 마스킹) + `src/fetch_stitch.py`(읽기 전용) → 화면 8개·로고·HTML을 `docs/stitch/exports/`에
- 검사: 체크리스트 대부분 통과. **따르지 않을 부분 11건** 기록 — 아래 메뉴 바, "취향 일치도 92%", 책소개를 "갈피 코멘터리"로 표기, "3권 더 읽으면 열림" 등. P-07 로그인은 사용자가 추가 생성 → 다시 수집해 반영(체크 통과). 수집 코드 검토 반영: 키는 401/403 + Google 호스트일 때만·리다이렉트 금지, 도구 오류 감지, 파일 형식 확인(JPEG 2건 자동 판별)

### D1-2·3. 키워드 목록 · 체크 화면 (09-29)
- 정보나루 키워드 수집(`src/collect_keywords.py`) → 🎯 후보 약 150권 중 **78권이 키워드 없음**(대출 기록 없는 새 책) → 재료를 **YES24 제목·책소개·목차**로 바꿈
- `src/build_vocab.py` — 정해진 키워드 + 동의어 규칙, 키워드당 5권 이상만 유지 → **27개**, 합친 것 11개. 책별 초안 `keyword_tags_draft.json`
- `src/build_check_page.py` → `data/processed/check/d2_check.html` — 🎯 10권(키워드·수준·방식) + 🍃 10권(축 4개), AI 답 숨김, 브라우저에 자동 저장, 끝나면 `d2_human_tags.json` 내려받기. YES24 글이 들어 있어 **로컬 전용(공개 금지)**
- 브라우저 클릭 테스트: 빈 채로 다음 → 안내 문구, 20권 완주, 답 20개 저장, 이전으로 돌아가면 답 유지
- 결정: 정보나루는 주 재료에서 **보조**로 (사용자 질문 계기) — 책 목록·키워드 모두 YES24로 충분
- 코드 검토 반영(09-29): 키워드 규칙을 복합어로 좁히고 **60% 상한** 추가 → 27개 → **20개**. 체크 화면: HTML 태그 제거, 책소개를 문장 단위로만, 이어 하기(처음 안 끝난 책부터), "해당 없음"과 다른 키워드 동시 선택 막기, 키보드 접근, 안전한 JSON 삽입. 브라우저 재검증 통과(태그 0, 문장 중간 끊김 0, 이어 하기·배타 선택 확인)

### 7. 구현 계획 (09-29, superpowers:writing-plans)
- `docs/plans/2026-09-29-roadmap.md` — Phase 진행 절차, 폴더 구조, **Phase 간 고정 인터페이스**(추천 타입·함수 10개, 이벤트 스키마·`track()`, DB 3테이블), P0~P7 개요, 리스크
- `docs/plans/2026-09-29-p0-setup.md` — 6 태스크: git(YES24 원문·비밀 제외), Next.js 16 생성, Vitest·Playwright(휴대폰+노트북), 토큰·글꼴·가운데 기둥·Button·/design, 이벤트 스키마·`track()`, `/api/track`·DB 스키마·`visit` + 사용자 Supabase 연결
- `docs/plans/2026-09-29-p1-recommend-logic.md` — 7 태스크: 타입·무작위·쪽수, 밸런스 답→축 점수, 🍃·🎯 점수, 5권 뽑기, 안내·책소개·나온 이유, 시뮬레이션 분포 비교, 커버리지 100%
- **계획 속 코드 검증**: 임시 폴더에서 실제로 실행 — P1 테스트 49개 통과·커버리지 100%(분기 포함, 도달 불가 분기 2개 제거·테스트 3개 추가)·타입 검사 통과·Python 분포 비교 통과 / P0 기록 코드 테스트 12개 통과
- 기준 버전(09-29 npm 확인): Node 24.19 · Next.js 16.3.6 · React 19.3 · Motion 13.4 · supabase-js 2.117 · Vitest 5.0.2 · Playwright 1.63

### D2. 태그 일치율 (09-29)
- 사용자 20권 체크(`d2_human_tags.json`) ↔ AI(사용자 답을 못 보는 별도 에이전트, `d2_ai_tags.json`) → `src/compare_tags.py`, `d2_agreement.json`
- 결과: 읽는 방식 90%·κ0.85 / 🍃 축 80%·κ0.69 (알게 됨↔마음 κ0.46, 정반대 1건) / 키워드 사람↔규칙 89.5%·κ0.79, 사람↔AI 76.3%·κ0.54 (AI가 더 많이 붙임) / **수준 70%·κ0.44** — 사용자 '조금 알아요' 0회, 엇갈림 3건 중 2건이 그 칸
- 결정: 수준 2단계(입문/기초 이상 — 책이 요구하는 사전 지식), 키워드 규칙 먼저, 세계 축 보강 → PRD·target-chips·balance-game·book-pool·PHASES·Stitch 프롬프트·로드맵·P1 계획 수정, P1 계획 코드 재검증(49 통과·100%)
- D2b: 수준만 10권 다시 체크 화면(`d2b_level_check.html`, 클릭 테스트 통과) + AI 새 기준 태그
- D2b 결과(09-29): 2단계 수준 일치 8/10·κ0.41, 책이 입문 쪽으로 몰림 → **수준 질문 삭제**(사용자 결정 A). PRD·target-chips·book-pool·PHASES·Stitch·로드맵·P0 SQL·P1 계획 수정, P1 계획 코드 재검증 48 통과·100%·타입 통과

### P3. 흐름 화면 (09-30, `docs/plans/2026-09-30-p3-flow-screens.md`)
- S-01 처음 → S-02 🍃 밸런스 9문항(0.8초 타이머 꾹 누르기) / 🎯 한 화면 입력(직접 쓰기 단어 매칭) → S-03 책 펼치기(CSS 3D) → S-04 첫 장(한 번 고치기, 솔직한 안내) → S-05 책갈피(동물 × 배경 × 소품, 반투명·아치 창·제비꼬리) → 궁금해요 목록
- 뽑기는 서버 `/api/books/draw` + 앱 안 JSON(D3 초안 200권), 새로고침해도 같은 장
- 검증: Vitest 전부 통과, E2E 🎯 2 · 🍃 2 × 휴대폰·노트북 통과, 휴대폰 4× 느리게 움직임 기록(스크린샷)
- 휴대폰 움직임(Pixel 7, CPU 4× 느리게, 🍃 한 바퀴 — 표지 열기 + 책갈피 5장): 프레임 426개 중 50ms 넘는 것 0개(p95 17ms, 최대 33ms), 긴 작업 1건(52ms). 책갈피가 오르는 동안 `data-moving`이 붙어 흐림이 꺼지고 멈추면 사라짐(0.1초 간격 표본으로 확인). 스크린샷은 `.superpowers/sdd/2026-09-30-p3-flow-screens/shots/`
- 최종 리뷰 반영: 키워드 6개 이상 멈춤, 뽑기 실패 시 [처음으로], 밸런스 두 번 누름 무시(250ms), 책갈피 한 줄 4줄 → 큰 글씨 대응으로 책갈피 344px(시안 B)

### 09-30 — P0·P1 병합, D3·D4, 배포 전 준비, 첫 배포
- P0: 사용자가 Supabase 키 입력 → 첫 화면 `visit` 저장 확인 → main 병합. P1: 7태스크 + 최종 리뷰(NaN 무한 반복 수정, 분포 허용치 ±3%p) → main 병합
- D3: 200권 AI 태그·한 줄(서브에이전트 4개 병렬) → 규칙 검사 200/200, 실제 태그 시뮬레이션 채움 96.5%. D4: 걸린 45권 사용자 검수 → **세계 축 규칙 변경**(현실 = 사람·삶·사회·경험을 다룬 책, 비소설 포함) → 나머지 🍃 재태그 → `books_v1.json`(채움 95.8%·장르 3.84)
- 배포 전: 처리방침 v0(`/privacy`, 모으는 항목 전부 공개, 1년 자동 삭제 pg_cron), 보안(같은 출처·분당 한도·크기 상한·문자열 정리·중첩 제한·보안 헤더, 보안 리뷰에서 Vercel이 x-forwarded-for를 덮어씀 확인), `/design` 404, `deploy.md`
- GitHub 공개 저장소: 기록 전체 검사 → 앱 리뷰(작성자 실명)·Reference.pdf·정보나루 원본을 기록에서 제거(사용자가 filter-branch 실행, 백업 `Portfolio/backups/`), 키 값 0건 확인
- Vercel: Aside로 프로젝트 설정(루트 `web`, 환경변수 이름) → 사용자가 값 입력·배포 → **https://galpi-omega.vercel.app**. 배포 후 점검: 200/404/보안 헤더/다른 출처 403/🍃 완주/Supabase 31건 저장. Preview에는 `TRACK_STORE=off`
- 사용자 판단: 동작은 되지만 Stitch 디자인이 빠짐 → **디자인 반영 단계**를 5명 반응 전에 추가 (저자 줄, 로고 SVG, 로고 머리글)
- 디자인 반영 완료 (9/30) — `docs/plans/2026-09-30-design-pass.md`. 다음: P7 휴대폰·카톡 브라우저 점검 → 5명 반응

### 09-30 저녁 — 디자인 반영·다크 모드 배포, Amplitude·택소노미 (중단 지점)
- 배포(main): 디자인 반영(`8886223`) + 다크 모드 강제 방지 `color-scheme: only light`(`fba8256`) → galpi-omega.vercel.app
- 브랜치 `feat/amplitude`(아직 main 아님): Amplitude 브라우저 SDK(`d2bb548`·`839f9a5`·`148cf4b`, 리뷰·재검토 통과 — 지연 로딩, engagement 끔, 녹화 20%·입력 가림, 처리방침 공개) + 택소노미 문서 v0.2(`0cef9d8`, `docs/taxonomy.md`·`taxonomy.csv`, 사용자 결정 반영)
- **다음에 이어서 할 일 (A 단계)**: ① 택소노미 개발 계획서 `docs/plans/2026-09-30-taxonomy-dev.md` 작성(중단됨 — 처음부터 다시) → ② SDD로 구현(이름 바꾸기, goal_submitted, 회차 규칙, goal_text는 Supabase만, EVENT_SPEC 타입 검사, CSV↔코드 자동 검사, Amplitude 대기열 보완, CLAUDE.md 규칙) → ③ main 병합·배포(사용자 허락) → ④ 사용자가 Vercel Production에 `NEXT_PUBLIC_AMPLITUDE_API_KEY` + Amplitude 대시보드 Session Replay 20%·입력 가림 → ⑤ Amplitude 커넥터로 카탈로그 등록·대시보드
- 그 뒤: P4 → P5 → P7(5명 반응) → P8·P9 (전체 목록은 대화 09-30 "남은 단계")

### 10-01 — 택소노미 개발 라운드 v0.3 (`docs/plans/2026-10-01-taxonomy-dev.md`, 브랜치 `feat/amplitude`)
- 이름 변경(이벤트 3 + 공통 속성 2 + 속성·값 19), E-26 `goal_submitted`, E-08 `one_liner_style`·E-20 `source` → `taxonomy.md`·`taxonomy.csv`와 코드가 같아짐(csv 상태 live 13)
- `EVENT_SPEC` 하나에서: `track()` 타입 검사(tsc가 호출 15곳 검사), `/api/track` props 검사(명세 밖은 버리고 키 이름만 로그), Amplitude 사본에서 `goal_text` 뺌
- 회차: [처음으로] 뒤 같은 탭 재시작 = round 2 (E2E로 확인). 직접 쓴 글은 Supabase에만 + 첫 장 리플레이 가림, `/privacy` 6-3 문장 2개(갱신일 10-01)
- Amplitude 대기열: init 전 이벤트도 받고(키 있을 때만, 50개) 원래 시각으로 넘김
- 자동 검사: `taxonomy.test.ts`(csv 13열·명명·csv ↔ `EVENT_SPEC` ↔ md 제목 ↔ `track()` 호출), E2E가 보낸 이벤트마다 props·common 키를 명세와 대조
- **다음에 이어서 할 일**: ③ main 병합·배포(사용자 허락) → ④ 사용자가 Vercel Production에 `NEXT_PUBLIC_AMPLITUDE_API_KEY` + Amplitude 대시보드 Session Replay 20%·입력 가림 → ⑤ Amplitude 커넥터로 카탈로그 등록(csv Description·Category)·대시보드 → P7 전 Supabase 테스트 기록 지우기

### 10-01 — 택소노미 개발·Amplitude 실가동 (A 단계 완료)
- 택소노미 개발(`docs/plans/2026-10-01-taxonomy-dev.md`): 이름 바꾸기, `goal_submitted`, 회차 규칙, `goal_text`는 Supabase만, EVENT_SPEC 타입 검사 + 서버 검사, CSV↔md↔코드 자동 검사 11개, Amplitude 대기열 보완 → main `7a0300e` 배포
- Amplitude 실가동: 사용자가 Vercel Production에 키 → Aside로 Redeploy. Session Replay(`galpi` 870203) 20%·마스킹 중간·동적 샘플링 끔. 점검: 새 이름으로 수집, device_id = anon_id, `free_goal_written`에 글 없음
- Amplitude 카탈로그: 이벤트 25·속성 38 등록(설명·타입·허용값). 대시보드 "갈피 핵심 지표 v1"(차트 17, 기간 10-02 00:00 UTC부터) https://app.amplitude.com/analytics/silent-surf-305627/dashboard/n5w9r3vr — 판 단위 지표·질문별 효과·못 찾은 요청은 SQL로(P8)
- 사용자 할 일: Amplitude 프로젝트 시간대 Asia/Seoul로 변경(현재 UTC)
- 다음: P4(계획서 작성 중) → P5 → P7

### 10-01 — P4 결과·서버 (`docs/plans/2026-10-01-p4-results-server.md`)
- `/api/books/[isbn]`(YES24 → 카카오 → 빈 정보, 짧은 캐시, 우리 책만), 뽑기 응답에 나온 이유, S-06 한 권씩·S-08 다시 뽑기/처음으로, `/api/goal/classify`(Claude Haiku, 3초 → 단어 매칭), `/privacy`에 Anthropic
- 이벤트: E-09·10·18·19·23 live (taxonomy v0.4) — planned-P4 0
- 배포(10-01): main 병합 `5bf2165`. 최종 리뷰 수정 — 분류 비용 상한(분당 10·인스턴스당 하루 300·Anthropic `galpi` 워크스페이스 월 $5), 표지 실패 시 천 표지, 키워드 하나뿐인 주제는 글에 그 말이 있을 때만, `temperature: 0`, S-08 안내에서 숫자 뺌. 처음 보는 글 25개 주제 25/25, 채점용 30개 29/30(지시문을 고칠 때 본 예시라 표본 안 수치)
- **다음**: 사용자 결정으로 **D 단계(책 자동 추가 D-07) 먼저** → P5
