# 책갈피 구경 — 갈피를 만든 사람의 책갈피함 (F-29)

## Context
로그인하는 사람과 다시 오는 사람이 적다(주간 재방문 0~5명). 친구 기능을 바로 만들기엔 이용자가 적어서, 먼저 **갈피를 만든 사람(운영자)의 실제 책갈피함을 누구나 로그인 없이 구경**하게 한다. 목적은 "남의 책갈피함을 궁금해하나"를 싸게 확인하고, 꾸미기·모으기를 보여 줘서 내 책갈피함(로그인)으로 이끄는 것. 블로그 연결은 하지 않는다(블로그 → 갈피 링크만, 갈피 밖 작업).

사용자 결정 (11-05): 입구 = 시안 A-1(`docs/mockups/2026-11-05-shelf-peek.png`, 막대 그림 · "책갈피 구경 / 갈피를 만든 사람의 책갈피함"), **모든 막대 공개**, 누르면 큰 앞면 + 예스24 + [나도 책갈피 모으러 가기], **만난 날 표시**.

## 문서 먼저 (CLAUDE.md 변경 순서)
1. `docs/PRD.md` — F-29 책갈피 구경, S-13 구경 시트(번호는 PRD 마지막 번호 확인 후)
2. `docs/DESIGN.md` — C-34 입구 버튼(우체통·부엉이와 같은 조용한 결, 그림 60px 높이 맞춤) + 시트. 세 개가 되면 설명 줄 두 줄 허용(C-18·C-33 줄 고침)
3. `docs/taxonomy.md` → `taxonomy.csv` → `schema.ts` (v3.1, 같은 커밋)
   - E-48 `maker_shelf_opened` { bookmark_count: number } — 시트를 열고 불러온 뒤
   - E-49 `maker_bookmark_viewed` { book_id } — 책갈피를 눌러 앞면을 볼 때
   - E-07 `yes24_link_clicked.source`에 `"maker_shelf"` 추가
   - [나도 모으러 가기]는 기존 시작 흐름(onStart)을 그대로 → 기존 이벤트로 잡힘
4. `/privacy` 점검 — 이용자 정보 새로 모으지 않음, 운영자 본인 책갈피만 공개(막대 이름·그림·만난 날). 처리방침 문구 변경 필요 여부만 확인
5. `docs/context.md` 11-05 행, `web/src/data/news.json` 그 주 한 줄, 배포 때 `report/README.md` 배포 줄

## 서버
- **`web/src/app/api/maker-shelf/route.ts`** (GET)
  - `guardRequest(req, { route: "maker", limit: 60 })` (`lib/server/guard.ts:168`)
  - `MAKER_USER_ID` 서버 env(없으면 `{ shelves: [] }` 200 — e2e·로컬 대비). UUID 검사(`lib/library/http.ts` `UUID`)
  - `serviceClient()`(`lib/server/serviceClient.ts:10`, null이면 빈 결과) → `supabaseStore(svc, MAKER_ID, null)`의 읽기(`shelves()`·`saves()`)만 → `libraryView(store, cardOf)`(`lib/library/service.ts:143`, `catalog()`·`toCard` — `app/api/library/route.ts:10-14`와 같게)
  - **응답은 줄여서**: `{ shelves: [{ name, bookmarks: [{ art, metOn, card }] }], count }` — user_id·shelf id·reason·originalArt 빼기. 순수 함수 `toMakerView(view)` (`lib/library/makerView.ts`)
  - 서버 메모리 캐시 60초(`lib/server/bookDetail.ts` 패턴) + `Cache-Control: private, max-age=60`
- RLS·DB 변경 없음(서비스 키로 고정 id만 읽음). Vercel Production에 `MAKER_USER_ID` 추가는 **사용자가 직접**(값은 이미 아는 내 user_id)

## 화면
- **`web/src/components/maker/MakerShelf.tsx`** + `.module.css`
  - 버튼: `NewsOwl` 구조 그대로(`.post`/`.owl`/`.art`/`.name`/`.line`), 그림은 새 `RodPeek.tsx` SVG(시안 A-1 막대 + 책갈피 3장, aria-hidden). aria-label "책갈피 구경 — 갈피를 만든 사람의 책갈피함"
  - 누르면 `Sheet`(`components/Sheet.tsx`, title "갈피를 만든 사람의 책갈피함") → `fetch("/api/maker-shelf")`(`lib/library/client.ts` 방식, 실패는 조용히 "지금은 불러올 수 없어요")
  - 목록 단계: 막대마다 `Shelf`(`components/library/Shelf.tsx`)를 읽기 전용으로 — `GuestLibrary.tsx:297-300`과 같은 props(`moving={false} fixed`), 책갈피는 `ShelfBookmark`. 위에 한 줄 "갈피를 만든 사람이 직접 뽑아 모은 책갈피예요 · N권", 빈 경우 "아직 꽂힌 책갈피가 없어요"
  - 앞면 단계(같은 Sheet, `stepKey`로 전환 — 시트 겹치지 않음): 큰 `Bookmark`(card·art·`metLabel(metOn)`, `BookmarkSheet.tsx:171-185`의 `.frontFace` 부분을 작은 공용 `BookmarkFront`로 뽑아 둘이 같이 씀) + [예스24에서 보기 ↗](`yes24SearchUrl`, source "maker_shelf") + [나도 책갈피 모으러 가기](시트 닫고 `onStart`) + 작은 [← 책갈피함으로]
  - NewsOwl처럼 열 때 scrollTop 0
- `components/flow/Home.tsx` `.notes`에 `<MakerShelf onStart={onStart} />` 셋째로. `Home.module.css` `.notes` — 셋일 때 각 칸 `flex:1 1 0; min-width:0`, 설명 줄 `white-space: normal; word-break: keep-all; text-wrap: balance`(이름 줄은 한 줄 유지), 그림 높이 60px로 맞춤

## 테스트 (TDD — 먼저 실패하게)
- `lib/library/makerView.test.ts` — 필드 줄이기(user·shelf id·reason·originalArt 없음), 카탈로그 밖 책 빠짐
- `app/api/maker-shelf/route.test.ts` — env 없음 → 빈 목록, 잘못된 UUID → 빈 목록, 다른 출처 403, 정상 → 줄인 모양, 캐시
- `components/maker/MakerShelf.test.tsx` — NewsOwl.test 패턴: 열기·E-48, 책갈피 누르기·E-49, 예스24 source, [나도 모으러 가기]가 onStart 부르고 닫힘, 불러오기 실패 문구
- taxonomy 테스트(`lib/track/taxonomy.test.ts`) 통과
- e2e: `e2e/maker-shelf.spec.ts`(`page.route`로 `/api/maker-shelf` 가짜 응답 — e2e엔 Supabase 없음) 열기·앞면·예스24 링크; `e2e/news.spec.ts:49`·`mailbox.spec.ts:61`의 한 줄 규칙을 DESIGN 바뀐 대로(셋 다 페이지 안, 이름 한 줄, 44px) 고침; 320/375px

## 검증
- `npx vitest run`, `PYTHONIOENCODING=utf-8 python -m pytest -q`, `npx playwright test`(전체), `npm run build`
- 로컬 dev 서버에 `MAKER_USER_ID`를 넣고 Browser pane에서 첫 화면 → 책갈피 구경 → 오로라 토끼 『선량한 차별주의자』 앞면·만난 날 2026.10.17 확인, 휴대폰 375/320 스크린샷
- code-reviewer 에이전트 검토 → 커밋(이벤트 체크리스트 줄) → 사용자가 Vercel에 `MAKER_USER_ID` 넣은 뒤 "배포해줘"에 배포·실사이트 확인

## 작업 기록
`docs/plans/2026-11-05-maker-shelf.md`(이 계획) — Galpi는 dev docs를 docs/에 둔다.
