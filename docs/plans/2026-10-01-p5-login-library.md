# P5 로그인·내 책갈피 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 카카오·구글로 로그인해 S-06의 그 책갈피를 [내 책갈피에 꽂기]로 모으고, 로그인 전이면 로그인 뒤 **누르던 책 화면(책갈피를 꺼낸 상태)으로 돌아와 자동으로 꽂히게** 한다. S-09 내 책갈피는 **막대에 건 책갈피**: 새 책갈피는 첫 막대 맨 앞, 막대는 옆으로 밀어 넘기고, [＋ 막대 추가]·막대 이름, 꾹 눌러 집고 → 놓을 막대 누르기(또는 뒷면 [다른 막대로 옮기기])로 옮긴다. 로그인 전·후 기록을 한 사람으로 잇고, 처리방침을 기능보다 먼저 고친다.

**Spec:** `docs/PRD.md` F-11·F-12·F-13·F-16·F-17, S-06·S-07·S-09·S-10, D-04·D-05, E-11~E-18 · `docs/PHASES.md` P5 · `docs/taxonomy.md` 3-2(Q5)·4절 E-11~17·6절·7-1 · `docs/DESIGN.md` C-12·C-13·C-16 · 시안 `docs/mockups/2026-10-01-p5-login-library.png`(①②) · `docs/mockups/2026-10-01-p5-move-bookmark.png`(막대·옮기기 4단계)

## 1. 사용자 결정 (10-01)

| # | 결정 |
|---|---|
| 1 | 구글 로그인 이메일은 Supabase 로그인 저장소(`auth.users`)에만 남는다 — 우리 표·이벤트·Amplitude에는 넣지 않고 처리방침에 적는다. 카카오는 이메일 없이 받는다 |
| 2 | 로그아웃(S-09 맨 아래 작은 버튼) + 탈퇴·삭제는 처리방침의 문의 메일로(운영자가 지움). PRD에 한 줄 |
| 3 | 기록 잇기 = taxonomy 3-2 후보안 채택: E-14 때 `amplitude.setUserId`, 유저 속성 `login_provider` 하나. `user_id`는 **서버가 로그인 세션에서 채운다**(브라우저가 보낸 값은 버림) |
| 4 | 머리글 [로그인] → 로그인 뒤 [내 책갈피 N], S-06 꺼낸 뒤 [내 책갈피에 꽂기](주)·예스24(보조), 로그인 시트 = 시안 ①② 그대로 |
| 5 | 로그인 뒤 **처음 화면이 아니라 그 책갈피 화면으로** 복귀 + 자동 꽂기 (완료 기준에 E2E로) |
| 6 | S-09 = 막대(시안 B 변형). 옮기기 = 꾹 눌러 집기(0.5초) → 막대 한 번 누르기, 끌어서 놓기는 하지 않음. 뒷면 [다른 막대로 옮기기]로도 |
| 7 | 막대 이름 붙이기 — 직접 쓴 글이므로 Supabase에만, Amplitude·DOM 속성·이벤트 금지, 처리방침 한 줄. 막대 최대 5개, 빈 막대만 지우기, 첫 막대는 지우지 못함 |
| 8 | 🍃/🎯 필터 없음(막대가 나눠 두는 방법). 위에 모은 수·동물 종류 수만 |

## 2. 사용자가 할 일 (구현과 나란히 — 값은 대화에 쓰지 않는다)

1. **카카오 디벨로퍼스** 앱 만들기 → 카카오 로그인 켜기 → Redirect URI = `https://<프로젝트>.supabase.co/auth/v1/callback` → 동의 항목은 **닉네임·이메일 끔**(고유번호만). REST API 키·Client Secret을 Supabase 대시보드 Auth → Providers → Kakao에 입력, **"이메일 없는 사용자 허용"** 켜기
2. **Google Cloud** OAuth 클라이언트(웹) → 승인된 리디렉션 URI 같은 주소 → Client ID·Secret을 Supabase Auth → Providers → Google에. 동의 화면 앱 이름 "갈피"
3. Supabase Auth → URL Configuration: Site URL `https://galpi-omega.vercel.app`, Redirect URLs에 `https://galpi-omega.vercel.app/auth/callback`·`http://localhost:3000/auth/callback`
4. `web/.env.local`과 Vercel(Production·Preview)에 `NEXT_PUBLIC_SUPABASE_URL`·`NEXT_PUBLIC_SUPABASE_ANON_KEY`(공개 키 — 그래도 대화에 붙이지 않는다)
5. 마이그레이션 `0003_p5_auth.sql`을 Supabase SQL 편집기에서 실행(Claude가 파일과 순서를 준다)

1~4가 없어도 Task 1~8은 진행된다(테스트는 가짜 세션). 실제 로그인 확인은 1~5 뒤.

## 3. 구조

- **인증**: `@supabase/ssr` — 브라우저 클라이언트는 `signInWithOAuth({ provider, options: { redirectTo: /auth/callback?next=… } })`만. `/auth/callback` 라우트가 code를 세션 쿠키로 바꾸고 `profiles`에 첫 줄을 넣어(성공 = 첫 로그인) `?login=<provider>&first=<0|1>`을 붙여 `next`로 보낸다. 세션 갱신 = Next 16의 `proxy.ts`(예전 middleware — 구현 전 `node_modules/next/dist/docs`에서 이름·형식 확인). `next`는 같은 사이트 경로만 허용(열린 리디렉트 금지)
- **데이터 접근은 우리 서버 라우트만**: `/api/me`(로그인 여부·저장 수), `/api/saves`(GET 목록 / POST 꽂기 / DELETE 빼기 / PATCH 옮기기), `/api/shelves`(POST 추가 / PATCH 이름 / DELETE 빈 막대). 라우트는 **이용자 세션 + anon 키**로 Supabase를 불러 RLS가 막게 한다(service role 아님). 같은 출처·분당 한도(`guardJson`) 유지
- **DB** (`0003_p5_auth.sql`): `profiles(user_id pk → auth.users on delete cascade, provider, created_at)`, `shelves(id, user_id, name ≤ 12자, position, created_at)` 이용자당 5개, `saves`에 `shelf_id`·`position` 추가 + `user_id → auth.users on delete cascade`, `met_on date`(만난 날 저장). RLS: 세 표 모두 `auth.uid() = user_id`로만 select/insert/update/delete. 첫 막대는 첫 꽂기 때 서버가 만든다(이름 기본 "내 책갈피")
- **자동 꽂기**: [꽂기]를 로그인 전에 누르면 `sessionStorage galpi.pendingSave = {isbn, art, reason, met}` + 흐름 저장(이미 VERSION 있는 `galpi.flow`) → 로그인 → `/auth/callback` → `next` = 같은 페이지 → 복원(`shouldResume`에 "로그인에서 돌아옴" 추가: `?login=` 있으면 이어감) → S-06 같은 책, 책갈피 꺼낸 상태 → pending 있으면 POST `/api/saves` → E-15 `is_auto_save=true` → pending 지움 → 주소에서 `?login=` 지움
- **기록**: `/api/track`이 세션 쿠키에서 `user_id`를 읽어 `common.user_id`를 덮어쓴다(없으면 null). 브라우저 `setUserId`는 Amplitude용으로만. E-14는 복귀 페이지가 `?login=`을 보고 한 번 보낸다
- **S-09 화면**: 새 경로 `/library`(로그인 전이면 S-01로). 막대 = 가로 스크롤(`overflow-x: auto; scroll-snap`) — 손가락 밀기는 브라우저 기본 스크롤. 꾹 누르기 = pointerdown 500ms + 이동 10px 넘으면 취소(스크롤로 봄). 집은 동안 다른 막대가 "여기를 누르면 옮겨져요" 버튼이 됨(키보드: 책갈피 버튼 메뉴 → [다른 막대로 옮기기] 시트). 뒷면 = 기존 `BookmarkBack`(C-13) + [예스24] [다른 막대로 옮기기] [빼기]

## 4. 이벤트 (taxonomy 먼저 — v0.8)

| | 이벤트 | 변경 |
|---|---|---|
| E-11~E-17 | 기존 planned-P5 | live로. E-15에 `shelf_count` 없음 — 그대로 |
| E-29 (새) | `shelf_created` | 속성 `shelf_count`(만든 뒤 막대 수). 이름은 넣지 않음 |
| E-30 (새) | `bookmark_moved` | `book_id`, `method`(`hold`/`menu`). 막대 이름·번호 넣지 않음(`to_position`만 Number) |
| E-31 (새) | `logout_clicked` | 속성 없음 |
| E-18 | `yes24_link_clicked` | `source:"library"` 이미 있음 |

막대 이름 바꾸기·막대 지우기는 이벤트 없음(분석 질문이 없음 — taxonomy 원칙 "질문 없는 이벤트는 만들지 않는다"). 처리방침: 로그인 고유번호·로그인 방법·가입 시각·보관 목록(책·책갈피 그림·만난 날·막대와 이름)·구글 이메일은 로그인 저장소에만·카카오/구글이 받는 것·로그아웃·탈퇴 메일.

## 5. Tasks

- [ ] **Task 0 — 문서 먼저**: PRD(F-11 로그아웃, F-13 막대·옮기기·이름·필터 없음, D-04 이메일 문장, D-05 막대·met_on, E-29~31) → taxonomy.md·csv v0.8(3-2 결정, E-11~17 상세 확인, E-29~31, 6절 막대 이름) → `schema.ts` → taxonomy 테스트 → DESIGN(C-12·C-13·S-09 막대, 새 C-17 막대) → PHASES P5 표 → context. 커밋 1
- [ ] **Task 1 — 처리방침**(기능보다 먼저): `/privacy` 표·보관·전달처(카카오·구글·Supabase Auth)·지우는 법(로그아웃·탈퇴 메일)·막대 이름, `UPDATED`, 테스트·E2E. 커밋 2
- [ ] **Task 2 — DB**: `0003_p5_auth.sql`(표·RLS·5개 제한 트리거 또는 서버 검사) + **RLS 확인 SQL 스크립트**(두 가짜 이용자로 서로 안 보임 — 사용자가 Supabase에서 실행, PHASES 완료 기준). database-reviewer 검토
- [ ] **Task 3 — 인증 뼈대**: `@supabase/ssr` 설치, `lib/auth/{browser,server}.ts`, `proxy.ts` 세션 갱신, `/auth/callback`(next 검사·profiles·first), 키 없으면 로그인 숨김(지금 배포가 깨지지 않게). 단위 테스트: next 검사, first 판정
- [ ] **Task 4 — 서버 라우트**: `/api/me`·`/api/saves`·`/api/shelves` + 입력 검사(ISBN은 우리 목록, art는 `ArtCombo` 값 목록, 이름 1~12자·앞뒤 공백·제어 문자 제거) + `/api/track`의 `user_id` 서버 채움. 테스트는 Supabase 클라이언트 가짜로
- [ ] **Task 5 — 머리글·S-07**: `SiteHeader` 오른쪽 [로그인]/[내 책갈피 N](44px), `LoginSheet`(C-12, 처리방침 링크, 포커스 가둠·Esc·닫기), E-12·E-13. `Home.test`의 account-slot 검사 갱신
- [ ] **Task 6 — S-06 꽂기 + 자동 꽂기 + 복귀**: `BookmarkInBook` 꺼낸 상태에서 [내 책갈피에 꽂기](주)·안내 문구, 꽂은 뒤 "꽂았어요 ✓ · 내 책갈피 보기", pending 저장·복원·자동 꽂기, `shouldResume` 로그인 복귀, E-11·E-14·E-15, Amplitude `setUserId`·`login_provider`
- [ ] **Task 7 — S-09 막대**: `/library` 페이지, `Shelf`·`ShelfBookmark`(C-17), 가로 스크롤, 꾹 눌러 집기 → 막대 누르기, 뒷면 메뉴·막대 고르기 시트, 막대 추가·이름(인라인 입력, 12자)·빈 막대 지우기, 빼기(되돌리기 토스트 없음 — 확인 한 번), 로그아웃, E-16·E-17·E-18(library)·E-29·E-30·E-31. 낙관적 갱신 + 실패하면 되돌리고 안내
- [ ] **Task 8 — E2E**: OAuth는 가짜 — Supabase authorize 주소로 가는 이동을 `page.route`로 가로채 `/auth/callback` 대신 `?login=kakao&first=1`로 돌려보내고 `/api/me`·`/api/saves`·`/api/shelves`를 가짜 응답으로. 시나리오: ① 로그인 전 꽂기 → 시트 → 로그인 → **같은 책·꺼낸 책갈피·자동 꽂힘** ② 막대 추가·이름 → 꾹 눌러 옮기기 → 뒷면 메뉴로 옮기기 → 빼기 ③ 로그아웃. 이벤트 명세 검사(`specMismatches`) 통과. 휴대폰·데스크톱
- [ ] **Task 9 — 실제 연결 확인**(사용자 2절 끝난 뒤): Preview 배포에서 카카오·구글 실제 로그인 한 번씩, RLS 확인 SQL, `events`에 `user_id` 채워짐, Amplitude User Look-up — 그 뒤 main 병합·배포는 허락 후
- [ ] **Task 10 — 마무리**: code-reviewer·security-reviewer, HANDOFF·tasks·process 갱신

## 6. 완료 기준 (PHASES P5 + 이번 결정)

- 로그인 전 꽂기 → 로그인 → **그 책 화면·꺼낸 책갈피로 복귀 + 자동 꽂힘** E2E
- 다른 사람 책갈피·막대가 보이지 않는다 (RLS 확인 SQL)
- 로그인 시트에 처리방침 링크
- 막대 추가·이름·옮기기(두 길)·빼기·로그아웃이 휴대폰 E2E로 동작, 누르는 곳 44px
- 이메일·막대 이름이 `events`·Amplitude·DOM 속성 어디에도 없다 (테스트로)
- Supabase 키가 없으면 로그인 자리가 숨고 지금 사이트가 그대로 동작

## 7. 위험

- 카카오 "이메일 없는 사용자 허용"이 Supabase 대시보드에 없으면 → 카카오 비즈 앱 전환이 필요할 수 있음(사용자 확인). 그 경우 카카오 먼저 미루고 구글만 켜는 것도 가능
- 카카오톡 안 브라우저의 구글 로그인 차단(F-20) — P5 범위 밖, 시트에 안내 한 줄만 검토
- 일정: P5가 막대 때문에 약 1.5배
