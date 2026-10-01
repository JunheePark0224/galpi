# 인수인계 — 갈피 (Galpi)

Last Updated: 2026-10-01 밤 (main `b54264c` 기준, 배포됨)

새 세션은 이 문서 → `process.md` → `context.md` → `tasks.md` 순으로 읽는다.

## 1. 어디에 무엇이

| 위치 | 내용 |
|---|---|
| `C:\Users\jukun\Desktop\Portfolio\Galpi` | **작업 폴더 = GitHub `JunheePark0224/galpi`(공개)**. 로컬 브랜치는 `main` 하나 |
| https://galpi-omega.vercel.app | 사이트. Vercel Root Directory `web`, **main에 push하면 배포** |
| `../backups/galpi-history-before-public-20260930.bundle` | 공개 전 git 기록(공개하면 안 되는 파일 포함). **Galpi 안으로 옮기지 않는다** |
| `../ERI-Project` `../Olist-BPM-Agent` `../Kkeutjang` `../strategy` `../stitch_data_analyst_portfolio_deck` | 다른 포트폴리오 자료. 갈피와 무관 (`strategy/`의 경쟁 조사만 `context.md`가 참조) |

**동시 작업(git worktree)은 `Galpi/.worktrees/<이름>`에만 만든다** (git 무시). Portfolio에 `galpi-*` 형제 폴더를 만들지 않는다 — 10-01에 7개를 정리했다.

로컬에만 있고 git에 안 올라가는 것 (공개 금지 — 예스24 글·키·검토 기록):

| 경로 | 내용 |
|---|---|
| `.env`, `web/.env.local` | 키. **열거나 출력하지 않는다** |
| `data/raw/` | 예스24 응답 캐시 등 원본 |
| `data/processed/check/` | 검수 페이지(HTML, 예스24 글 포함) |
| `data/pipeline/runs/`, `data/pipeline/eval/` | 파이프라인 실행 요약·태거 평가 행 |
| `.superpowers/sdd/<계획>/` | SDD 진행 기록·리뷰 (`progress.md`가 각 계획의 원장) |

## 2. 지금 무엇이 돌고 있나

- **책 330권** (🍃 100 · 🎯 230), 🎯 주제 12개(분야 6) · 🍃 장르 12개. 주제는 책 10권 이상일 때만 켜진다(`web/src/lib/books/active.ts`)
- 🎯 입력 B안(큰 직접 쓰기 + 예시 칩 6) · 직접 쓴 말은 Claude Haiku 분류(3초 넘으면 단어 매칭)
- F-24 "이렇게 이해했어요" ①찾음 ②"아직 없어요" + 예스24 검색 ③우리 주제 아님 · C-16 표지 위 책갈피(당기기·뒤집기, [꽂기] 저장은 P5)
- 홈 이동: 로고·새로 연 주소 = 처음 화면, 새로고침·뒤로가기 = 하던 곳
- 기록: Supabase `events` + Amplitude(project 870203, 시간대 Asia/Seoul, 대시보드 `n5w9r3vr`). 택소노미 v0.7 (`docs/taxonomy.md`가 원본)
- **매일 책 파이프라인 (D-B)**: GitHub Actions `daily-books` 매일 06:00 KST → 후보 50권 → Sonnet 5.5 두 번 따로 태그 → PR `books/<날짜>`. Secrets·Actions 권한은 사용자가 설정 완료(10-01). 첫 자동 실행은 **10-02 06:00**
- 비용: Anthropic `galpi` 워크스페이스 **월 한도 $15**를 사이트 분류와 파이프라인이 같이 씀. 파이프라인 하루 약 $0.6, 사이트는 1,000명당 약 $1~4

## 3. 매일 할 일 (D-C — 검수하며 자동 병합 졸업까지)

1. 아침 PR `books/<날짜>` 확인 (실패하면 PR 없이 Actions 기록에 이유만)
2. PR 브랜치에서 `PYTHONIOENCODING=utf-8 python -m src.pipeline.review <날짜>` → `data/processed/check/`에 검수 페이지 → 사용자가 검수하고 내려받기
3. `python -m src.pipeline.review <날짜> --apply <내려받은 파일>` → `cd web && npm run books:import` → `npm test` → PR 브랜치에 커밋 → **병합·배포는 사용자 허락 후**
4. 졸업 기준 (`docs/deploy.md` 7절): ① 연속 3회 모든 항목 95%+ — **현재 1/3** ② 그 3회 일치 책 표본 10권 이상·바뀐 책 5% 이하 — **현재 표본 3권, 바뀜 0**. 둘 다 넘으면 사용자에게 물어본 뒤 `data/pipeline/config.json` `auto_merge: true`
5. 일치율 기록: `data/pipeline/agreement.csv`

## 4. 남은 작업 (순서)

1. **D-C 매일 검수 루프** (위 3절) — 10-02부터
2. **사용자 확인 2개**: 카카오톡 브라우저에서 앱 전환 후 돌아왔을 때 이어지는지 · iOS에서 책갈피 뒷면 뒤집을 때 깜빡임
3. **다음 개발 — 사용자가 고른다** (둘 다 PRD에 있음):
   - F-23 홈 "갈피의 서재 N권 · 오늘 +M권" — 시안 비교부터
   - P5 로그인·보관·내 책갈피(이름 "내 책갈피")·[꽂기] — 카카오·구글 OAuth 앱은 사용자가 만든다
4. P7 휴대폰·카톡 점검 → 5명 반응 → 테스트 기록 지우기 → Amplitude 대시보드 시작점을 그날 00:00 KST로
5. P8 이용자 모으기·1단계 분석 → P9 고치고 전후 비교·리포트
6. 사용자 몫(급하지 않음): `docs/goal-grading.md` 30행 채점 · D4 나머지 156권 검수 · 원격 브랜치 `origin/feat/p3-flow` 지울지

보류한 작은 것들 (필요할 때): 관리/활용 단어 매칭 동점 처리 · ②가 키워드로 찾았을 때도 "비슷한 '{주제}'"라고 말함 · `playwright.config` 포트를 환경변수로 · S-06 ↗를 스크린 리더가 읽음 · 워크플로 `npm ci --ignore-scripts` · 45분 시간 초과면 그날 전부 잃음 · E-27 중복 · 뒤집기는 버튼인데 C-13은 탭

## 5. 지켜야 할 것

- **키 값을 출력·전사하지 않는다.** 키 입력은 사용자가 직접(`.env`, `web/.env.local`, Vercel, GitHub Secrets). `.env.example`은 빈 칸
- **예스24 책소개·목차 등 남의 글은 커밋·PR·Actions 로그·평가 파일 어디에도 남기지 않는다** (저장소 공개)
- 직접 쓴 글(`goal_text`, `missing_text`)은 Supabase에만, Amplitude 금지. **DOM 속성에 이용자 글을 넣지 않는다** (자동 수집·리플레이가 기록함)
- 이벤트 변경은 taxonomy.md → csv → `schema.ts` → 테스트 → `track()`를 한 커밋에. 모으는 정보가 바뀌면 `/privacy` 먼저
- 테스트·E2E는 실제 `events`에 쓰지 않는다
- **병합·push·배포는 사용자 허락 후.** 기록 재작성은 사용자가. 로그인·OAuth·결제·약관 동의도 사용자가
- 사용자와는 한국어, 쉬운 말로. 디자인은 시안으로 비교해서 받는다. 날짜는 잠정 — 순서만 지킨다
