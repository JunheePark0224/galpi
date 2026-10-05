# 인수인계 — 갈피 (Galpi)

Last Updated: 2026-10-05 (책갈피 꾸미기 `feat/decorate` 병합 전 — 아래 "책갈피 꾸미기". 그 밖의 줄은 10-04 기준)

새 세션은 이 문서 → `process.md` → `context.md` → `tasks.md` 순으로 읽는다.

## 지금 상태

- **책갈피 꾸미기 (`feat/decorate`, `.worktrees/decorate`, 병합 전, 10-05)**: S-09 시트 버튼 시안 C([예스24] → [🎨 꾸미기][↔ 옮기기] → [빼기]), [꾸미기] 편집기(내 도감에 있는 부분으로만 그림 바꾸기, [처음 그림으로]·[이대로 꽂기]), 서버 `PATCH /api/library/saves/art`(도감 확인, 아니면 403), taxonomy v1.6(E-38). 계획 `plans/2026-10-05-decorate.md`, 스크린샷 `mockups/2026-10-05-decorate/impl-*.png`.
  **사용자가 할 일 (병합·배포 전, 0004 다음, 순서대로)**:
  1. Supabase 대시보드 → SQL Editor → New query에 `web/supabase/migrations/0005_original_art.sql` 전체를 붙여 **Run** (한 번만). "Success. No rows returned"가 나오면 됨. 기존 책갈피는 모두 지금 그림이 "처음 그림"이 된다.
  2. 새 query에 `web/supabase/checks/decorate_rls.sql` 전체를 붙여 Run → 빨간 오류 상자 "RLS CHECK RESULT" 안 8줄이 모두 `ok`인지 확인(이 오류는 정상 — 시험 데이터를 되돌리는 장치). `FAILED`나 다른 오류면 그 글을 Claude에게.
  3. 병합·배포 → 로그인해 /library에서 책갈피를 눌러 [꾸미기] → 도감에 있는 동물로 바꿔 [이대로 꽂기] → 막대 위 책갈피가 바뀌는지, `select isbn, art->>'animal', original_art->>'animal' from saves order by created_at desc limit 3;`에서 처음 그림이 그대로인지.
  - 0005를 적용하기 전에 배포해도 사이트는 그대로 돈다: 시트에 [꾸미기]가 나오지 않을 뿐(서버도 503).

- **도감 표시 수정 (`fix/dex-display`, `.worktrees/dex-fix`, 병합 전, 10-05)**: 배지가 부분마다 이름·등급, 도감 칸은 그 부분만, 땅 "없음"은 모으지 않음(소품 15, 운영의 옛 "none" 줄은 읽을 때 무시 — 마이그레이션 없음). 설계 8절, taxonomy v1.4.1.
- **도감 v1 (`feat/collection-dex`, `.worktrees/dex`, 병합 전, 10-05)**: 한정판·초판본 그림(동물 16·배경 11·소품 16 → 모으는 소품은 15, 부분마다 90/9/1), 초판본 효과, S-09 [막대 | 도감], S-05 "처음 만난 …!" 배지, 서버 서명 seed로 기록, taxonomy v1.3(E-36·E-37), 처리방침 갱신일 10-05. 설계는 `plans/2026-10-05-collection-dex.md` "설계 (구현)". 스크린샷 `mockups/2026-10-05-dex/impl-*.png`.
  **사용자가 할 일 (병합·배포 전, 순서대로)**:
  1. Supabase 대시보드 → SQL Editor → New query에 `web/supabase/migrations/0004_collection.sql` 전체를 붙여 **Run** (0001~0003 다음, 한 번만). "Success. No rows returned"가 나오면 됨.
  2. 새 query에 `web/supabase/checks/collection_rls.sql` 전체를 붙여 Run → 빨간 오류 상자 "RLS CHECK RESULT" 안 9줄이 모두 `ok`인지 확인(이 오류는 정상 — 시험 데이터를 되돌리는 장치). `FAILED`나 다른 오류면 그 글을 Claude에게.
  3. Vercel → Settings → Environment Variables → `COLLECTION_SIGNING_SECRET`을 **Production에만**, Sensitive로 추가(32자 이상 무작위 — 만드는 법 `deploy.md` 3절). 값은 대화에 붙이지 않는다. Preview에는 넣지 않는다(넣지 않으면 Preview는 도감 기록만 꺼짐).
  4. `SUPABASE_SERVICE_ROLE_KEY`가 Production에 이미 있는지 확인(도감 쓰기에 씀 — 없으면 도감 기록이 꺼짐).
  5. 병합·배포 → 로그인해 책갈피 몇 장을 넘긴 뒤 `select kind, value, first_met_at from collection order by first_met_at desc limit 5;`에 줄이 생기는지, [도감]에 그 그림이 보이는지.
  - 0004를 적용하기 전에 배포해도 사이트는 그대로 돈다: [도감]은 "도감을 불러오지 못했어요."만 보이고 배지는 나오지 않는다.

- **v2 계획 2 완료 (`feat/v2-screens`, 병합 전)**: S-01 입구 하나 · S-02 갈림길(이전 질문, 진행 표시 없음) · S-04 당신이 고른 길 · 서버 뽑기 = 질문 지도 길 · taxonomy v1.0(E-32 `question_answered`, E-33 `question_back_clicked`, E-34 `path_completed`, 공통 `mode`, 🎯·밸런스 이벤트 6개 removed) · 처리방침 v2 · 사이트 Anthropic 0. 길 끝 157개 중 4권 미만 7개(`npm run map:coverage`). 스크린샷 `docs/mockups/2026-10-04-v2/`. **남은 일**: 사용자 확인 → 병합·배포(사용자) → 배포 뒤 Supabase `events`에 `screen_version`=v2와 `question_answered` 확인, Amplitude 대시보드에 FN-7 퍼널 → 계획 3(모자란 길 채우기).
- **확인한 것 (10-04)**: 단위 870개 통과(`src/lib/recommend/**`·`src/lib/paths/**` 커버리지 임계 통과) · typecheck·lint·build 오류 0 (`/api/goal/classify` 라우트 없음) · 전체 E2E(`TRACK_STORE=off`) 134 passed · 18 skipped(휴대폰/노트북 한쪽 전용 테스트).
- **계획 3 입력**: 길 끝 157개 중 4권 미만 **7개**. 책이 0권인 장르·주제도 지도에서 빼지 않는다.

### 배포 체크리스트 (병합·배포는 사용자)

1. 옛 번들 탭은 새로고침 전까지 `/api/track` 이벤트를 잃고(`mode` 없음) 뽑기가 400을 받는다. 배포 직후 이 탭의 이탈은 퍼널 이탈로 세지 않는다.
2. 저장된 v5 흐름은 S-01부터 다시 시작한다.
3. Vercel의 `ANTHROPIC_API_KEY`는 지워도 된다(사이트가 더 이상 읽지 않음). **GitHub Actions Secret(매일 책 파이프라인)은 그대로 둔다.**
4. 배포 뒤 Supabase `events`에서 `screen_version`='v2', `question_answered`, `path_completed`, 공통 `mode`가 들어오는지 확인한다.
5. Amplitude FN-7 퍼널을 E-32 → E-34 → E-05로 다시 만든다.
6. v1과 v2 비교는 책갈피 단계 이후 이벤트만, `screen_version`으로 나눠서 한다.

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
2. PR 브랜치에서 `PYTHONIOENCODING=utf-8 python -m src.pipeline.review <날짜>` → 검수 페이지는 **늘 본 폴더(main 체크아웃) `Galpi/data/processed/check/pipeline/<날짜>.html`** — worktree(`.worktrees/<이름>`) 안에서 돌려도 같은 곳(10-05, 찍히는 절대 경로 확인) → 사용자가 검수하고 내려받기 (`--apply`는 내려받은 파일이 어디 있든 경로만 주면 된다)
   - 검수 페이지 결정에 **"다른 갈래로 (다시 태그)"**(10-05): 🎯로 왔지만 🍃 장르 책이면(예: 『뇌』 모기 겐이치로 → 과학 교양) 이걸 고르고 🍃 장르를 고른다. 🍃 책이면 🎯 주제를 고르거나 "AI가 정해요"(파이프라인이 우리 규칙으로 가장 맞는 주제를 고름). `--apply`가 그 책을 books.json에 넣지 않고(`dropped` + `requeued_to`) `data/pipeline/requeue.json`에 적는다 → 다음 묶음이 그 책을 맨 먼저 새 갈래로 태그하고(그날 권수에 포함) 줄을 지운다. 빼기와 달리 책을 잃지 않는다
3. `python -m src.pipeline.review <날짜> --apply <내려받은 파일>` → `cd web && npm run books:import` → `npm test` → PR 브랜치에 커밋 → **병합·배포는 사용자 허락 후**
4. 졸업 기준 (`docs/deploy.md` 7절): ① 연속 3회 모든 항목 95%+ — **현재 1/3** ② 그 3회 일치 책 표본 10권 이상·바뀐 책 5% 이하 — **현재 표본 3권, 바뀜 0**. 둘 다 넘으면 사용자에게 물어본 뒤 `data/pipeline/config.json` `auto_merge: true`
5. 일치율 기록: `data/pipeline/agreement.csv`

### 여러 번 돌리기 (10-06 공개 준비)

하루에 묶음(batch)을 여러 번 돌려 책을 376권 → 1,000권으로 늘린다(묶음당 100권, 7~9번). 묶음 100권은 **가장 모자란 칸부터 칸당 10권 → 약 10칸**(장르 · 주제 · 키워드, `book-pool.md` 1-2c). 목표는 `data/pipeline/config.json` **`target_phase`**: 지금 `"launch"`(장르 45 · 주제 26 · 키워드 5), 공개 뒤 사용자 승인으로 `"grow"`(100 · 60 · 15). 모든 칸이 목표에 닿으면 그 뒤 실행은 아무것도 넣지 않는다. 첫 묶음은 그대로 `<날짜>`, 같은 날 다음 묶음은 `<날짜>-2`, `-3` … — 브랜치 `books/<묶음>`, 파일 `data/processed/additions/<묶음>.json`, 검수 명령, `agreement.csv`의 `date` 칸(`batch`는 그대로 `daily`)이 모두 이 이름을 쓴다. 책의 날짜(`date`)는 달력 날짜 그대로.

1. 실행 (열린 `books/` PR이 없을 때만 돈다 — 있으면 API 호출 없이 쉰다):
   `gh workflow run daily-books.yml -f next_batch=true -f count=100 -f dry_run=false`
   → 실행 화면 Summary 첫 줄 `Batch: 2026-10-06-2`가 이번 묶음 이름. 오늘 main에 아무것도 없으면 `<날짜>` 그대로
2. PR `books/<묶음>` 브랜치에서 검수: `PYTHONIOENCODING=utf-8 python -m src.pipeline.review <묶음>` (예: `… review 2026-10-06-2`) → 내려받기 → `python -m src.pipeline.review <묶음> --apply <내려받은 파일>` → `cd web && npm run books:import` → `npm test` → PR 브랜치에 커밋
3. **병합한 뒤에** 1로 돌아가 다음 묶음. 병합 전에 돌리면 쉰다(한 번에 PR 하나 — books.json 충돌 방지). 앞 묶음 책은 main의 파일로 빠지므로 같은 책이 두 번 오지 않는다
- 매일 06:00 자동 실행은 그대로 — 그날 이미 묶음이 main에 있으면 쉰다. `next_batch` 없이 손으로 돌려도 마찬가지
- 묶음마다 약 $1.2(100권, 권당 약 $0.0115). 월 한도 $15를 사이트와 같이 쓰니 9번이면 약 $10.4 — 시작 전에 Console 사용량 확인

## 3b. 키워드 후보 → 승인 (10-02)

- 매일 PR 본문 "### 키워드 후보"에 같은 후보가 **5권 이상**이면 "추가할까요?" — 사용자에게 물어 정의 문장 확인 → `PYTHONIOENCODING=utf-8 python src/backfill_keywords.py promote "주제:이름" --pattern "<단어 규칙>" --definition "<정의>"` → `cd web && npm run books:import && npx vitest run` → 커밋 (`plans/2026-10-02-keyword-candidates.md`)
- 새 키워드를 기존 책에 붙일 때: `python src/backfill_keywords.py build "주제:이름,…"`(단어 규칙 후보) → Claude가 정의대로 판단해 `apply` (10-02: 사용자는 예스24 글을 볼 수 없는 페이지로 판단하지 않는다)
- 10-02에 다시 넣은 키워드: 데이터 분석 엑셀·파이썬·데이터 리터러시, AI 활용 LLM 원리. 사람 검수는 키워드 5개까지(AI는 3개)

## 3c. 친구 5명 시험 (10-02 시작)

- **시작점: 2026-10-02 14:22 KST (05:22:41 UTC)** — 사용자가 URL을 보내기 시작한 시각. 5명 분석은 이 시각 이후 기록만 쓴다. 그 전 기록(테스트·우체통 시험 글)은 지우지 않고 시작점으로 뺀다
- 뺄 기기: 사용자 본인 기기의 익명 번호(처리방침 맨 아래) — 받는 대로 여기 적는다: `4af2b2d9-4308-408f-a321-4350408e1aa9`(10-02 받음, 어느 브라우저인지 미기재) · `abc42f53…`(휴대폰 카톡 안 브라우저 — 위 번호와 같은 로그인 계정이라 사용자 본인으로 봄, 10-02) · `47c43f9a…`(PC, 15:52 — 같은 계정, 10-02)
- 볼 것: 사람별 흐름(입구 → 책 펼치기 → 책갈피 반응 → 결과 → 예스24·꽂기·로그인), 그만둔 곳, 걸린 시간 + 우체통 글(`feedback_sent`)·카톡 의견을 나란히. 5명이라 비율 대신 "5명 중 몇 명"과 사람별 흐름으로(원칙 5)

## 4. 남은 작업 (순서)

1. **D-C 매일 검수 루프** (위 3절) — 10-02부터
2. **사용자 확인 2개**: 카카오톡 브라우저에서 앱 전환 후 돌아왔을 때 이어지는지 · iOS에서 책갈피 뒷면 뒤집을 때 깜빡임
3. ~~F-23 홈 "갈피의 서재 N권 · 오늘 +M권"~~ — 시안 B 구현(10-01, `feat/f23-library-count`). 600권 넘는 배포에서 저절로 보인다. 검수 뒤 `books:import`하면 **`web/src/data/` 세 파일(books·vocab·library.json)을 같이 커밋**
   - ~~P5 로그인·내 책갈피~~ — `feat/p5-login`(`.worktrees/p5`) 완료(10-02): 카카오(개인 비즈 앱, 닉네임·사진·이메일 선택 동의)·구글(테스트 중, 테스트 사용자 2명) 실제 로그인, 꽂기 → 로그인 → 같은 책 복귀 + 자동 꽂기, S-09 막대(꾹 눌러 옮기기·뒷면 메뉴·막대 추가/이름/치우기·로그아웃), 처리방침, taxonomy v0.8(E-11~17·29·30 live). Supabase 0003 마이그레이션·RLS 확인 25/25, Redirect URL `http://localhost:3000/**`·`https://galpi-omega.vercel.app/**`, Vercel에 `NEXT_PUBLIC_SUPABASE_URL`·`_ANON_KEY`(Config). **병합·배포는 사용자 허락 후** → 배포 뒤 확인: 실제 `events.common.user_id`, Amplitude User Look-up, 사이트 코드에 Supabase 주소
   - P5 뒤 정할 것: 구글 앱 '게시'(지금은 테스트 사용자만 로그인) — P7 공개 전 · Supabase JWT 비대칭 서명 키(지금은 `/api/track`이 로그인한 이벤트마다 Auth 확인 — 보안 리뷰 L2) · 카카오·구글 같은 이메일 계정 자동 연결 설정 확인(L4) · Google Cloud `galpi-510315`(만들다 만 중복 프로젝트) 지우기 · `Galpi/kakao-app-icon-512.png`(카카오 앱 아이콘 원본, 커밋 안 함)
   - **갈피 우체통 (F-26)** — `feat/feedback-mailbox`(`.worktrees/feedback`), 병합·배포는 사용자 허락 후. 배포 전 사용자 몫: Resend 가입·API 키 → Vercel Production에 `RESEND_API_KEY`·`FEEDBACK_NOTIFY_TO`. 발신 `onboarding@resend.dev`는 **Resend 계정 주인 주소로만** 배달되니 `FEEDBACK_NOTIFY_TO`는 그 주소(아니면 알림 403, 글 저장은 됨). 알림 상한 50통/일은 **인스턴스마다**. 글은 Supabase `events`의 `feedback_sent` 줄 `props.feedback_text`
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
