# 디자인 반영(Design pass) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 배포된 P3 흐름(S-01 처음 → S-02 🍃/🎯 → S-03 책 → S-04 첫 장 → S-05 책갈피 5장 → 궁금해요 목록)에 Stitch 시안(P-00~P-05)의 모양을 입힌다 — 모든 화면 위 작은 로고 머리글(Stitch 로고를 SVG로 다시 그림, 파비콘 겸용), 종이·가죽 질감, **S-03부터 화면을 채우는 책**(책갈피는 두 쪽 사이 가운데에서 크게, 데스크톱에서는 430px 기둥을 벗어나 화면 크기로), 책갈피 **저자 줄**. 동작·이벤트·문구·테스트는 그대로 둔다.

**Architecture:** 다시 쓰지 않고 기존 스택(CSS modules + `tokens.css` + Motion) 위에서 CSS와 작은 컴포넌트만 바꾼다. 새 파일은 `Logo.tsx`·`SiteHeader.tsx`·`app/icon.svg`·`e2e/scene.spec.ts`뿐. 질감은 `tokens.css`의 CSS 그라디언트 + 인라인 SVG 노이즈(data URI) — 그림 파일 없음, 움직이는 요소에 `filter` 없음, 그림자는 움직이지 않음. 책 장면 크기는 `BookScene.module.css`의 `--book-h`(책 높이)·`--bm-scale`(책갈피 배율)을 화면 높이 구간과 데스크톱 구간으로 정하고, 책갈피는 **transform scale로 통째로** 키워 160 × 344 글자 맞춤 검사(`e2e/design.spec.ts`)가 어느 크기에서나 그대로 유효하다. 데스크톱(폭 768px 이상)에서는 `.column:has([data-wide-scene])`로 책 장면일 때만 기둥을 푼다. 저자는 `data/processed/d1_selected.csv`의 `author`를 정리(`cleanAuthor`)해 `books.json`에 넣는다.

**Tech Stack:** Next.js 16.3.6 (App Router) · React 19.2.8 · TypeScript · CSS modules · Motion 13.4 (`motion/react`) · tsx 4.23 · Vitest 5 + Testing Library · Playwright 1.63 (phone = Pixel 7 412 × 839, laptop = 1440 × 900, 포트 3217)

**Spec:** `docs/DESIGN.md` v0.1 (T-01~T-06, T-04b, C-01·C-02·C-04·C-07~C-10·C-14·C-15, 4절 책갈피 규격, A-05 "Stitch 로고를 SVG로 다시 그린다", A-06, 7절) · `docs/PRD.md` F-08(저자 줄) · `docs/context.md` 09-30 행(디자인 반영 결정, 세계 축, 책갈피 B안 344px) · `docs/stitch/exports/README.md`(가져갈 것 / **따르지 않을 부분 11건**) · `docs/stitch/exports/P-00~P-05.png`·`.html`, `갈피_로고_d6d51e.jpg` · 사용자 추가 지시(09-30, 아래 Global Constraints에 옮김)

**계획 속 코드 검증 (09-30):** 임시 폴더에 현재 `web/`을 두 벌 복사(`before/` = 지금 코드, `after/` = 이 계획 적용; `node_modules` 복사, `.env.local`은 지움 → 실제 Supabase에 쓰지 않음)하고 이 계획의 코드를 태스크 순서(데이터 → 로고·머리글 → S-01 → 책갈피 → 책 장면 → S-02·끝)로 넣으며 확인했다. 최종 상태:
- `npm run books:import` 200권·키워드 20개 — `books.json` 차이는 `"author"` 줄 200개뿐, `vocab.json` 변화 없음
- Vitest **47파일 353개 통과** (시작 45/331 → Task 1 347 → Task 2 351 → Task 3 351 → Task 4 352 → Task 5 353 → Task 6 353), `src/lib/recommend` 커버리지 100% 유지(`test:cov` 종료 코드 0)
- `tsc`·`eslint` 오류·경고 0, `next build` 통과(`/icon.svg` 라우트 생성)
- Playwright **56개**(시작 48 + 새 4개 × 2프로젝트, 휴대폰에서 데스크톱 전용 1개 skip) `--repeat-each=2` → 110 통과·2 skip
- 휴대폰 375 × 667·430 × 932, 노트북 1440 × 900 스크린샷 before/after 7화면씩: **S-03·S-04·S-05는 세 크기 모두 세로 스크롤 없음**, 데스크톱 책 장면은 기둥 밖으로(펼친 책 약 800 × 560). S-02 🎯 입력은 원래도 스크롤하는 화면(375 × 667에서 788 → 824px)
- 검증 중 고친 것: ① 저자 줄을 넣자 글자 ×1.15에서 61권이 넘침 → 글자 크기는 그대로, 간격만 줄임(gap 4→3, 위 여백 18→16, 제목 줄높이 1.4→1.3, 한 줄 1.35→1.3, 이름표 위아래 4→2, "갈피" 줄높이 1.2→1) ② 두 사람 이름이 긴 2권이 ×1.0에서 잘림 → 두 이름 합이 10자를 넘으면 "첫 이름 외" ③ 한 사람의 긴 이름에 "외"가 붙던 버그(세네카) → 두 이름일 때만 ④ 0.7px 차이로 "갈피" 표시가 카드 밖 → ①의 줄높이 1 ⑤ 모듈 CSS의 rgba 리터럴을 새 토큰으로(`--card-bg` 등) ⑥ 스크린샷은 뽑기 응답(같은 5권)과 `Math.random` 씨앗을 고정해 before/after가 같은 책을 보여 주게 함
- 스크린샷: `C:/Users/jukun/AppData/Local/Temp/claude/C--Users-jukun-Desktop-Portfolio/80e21b37-563b-4270-bfad-a792df827472/scratchpad/design-pass/shots/` (`before-*.png`·`after-*.png`, 나란히 비교는 `pairs/`)

## Global Constraints

- 구현 전에 `web/AGENTS.md`를 읽는다 (Next 16 — 파일 규칙 `app/icon.svg`는 `node_modules/next/dist/docs/01-app/`에서 확인)
- PRD에 없는 기능은 만들지 않는다. `docs/stitch/exports/README.md`의 **따르지 않을 부분 11건은 만들지 않는다**: 아래 메뉴 바, 로고 옆 영어 "Recommendations", 프로필 그림, "평범은 책들은 서재 보관함에 바로 담깁니다", 모두 빈 세기 점(점은 답을 따른다), "갈피를 터치하여 자세히 펼쳐보세요", "취향 일치도 92%", "갈피 코멘터리", 공유 버튼, 읽기 조건 희귀 책갈피, 수채화 동물 그림
- **로그인 글자·자리 없음 (P5까지).** 머리글 로고는 누를 수 없는 그림(링크 아님 — 새 동작을 만들지 않는다)
- 동작·이벤트·흐름·저장은 그대로. `Flow.tsx`·`lib/flow/*`·`lib/recommend/*`·`lib/track/*`는 건드리지 않는다
- **문구는 한 글자도 바꾸지 않는다. 새 문구 없음.** 책 표지 라벨은 S-01 태그라인("읽을 책, 갈피가 안 잡힐 때"), 책등은 "갈피"를 다시 쓴다. 저자는 데이터(서지 정보)
- 색·간격·모서리는 `tokens.css` 변수만(새 값은 Task 2에서 토큰으로 추가). 12px 미만 글씨 금지. 반투명(책갈피) 위 글자는 `ink`만(DESIGN 7절)
- 누르는 곳 44px 이상. 한 화면에 주 버튼 하나. 반응·다음 버튼은 책 아래. 다크 모드 없음
- **민음사 모양 금지** — 네모 카드·왼쪽 세로 띠·두 줄 색 띠. 궁금해요 목록 항목에도 왼쪽 색 띠를 쓰지 않는다
- 움직임은 T-06 그대로(`lib/motion.ts`). 닫힌 책 확대(S-03)도 `OPEN_COVER`와 같은 1000ms로 1배로 돌아온다. 움직이는 것은 transform·opacity만 — `filter`·그림자 애니메이션 없음. 책갈피가 움직이는 동안 반투명 흐림을 끈다(기존 `data-moving`)
- 질감은 CSS/SVG만. 그림 파일을 추가하지 않는다(파비콘 `icon.svg` 4.7KB는 SVG)
- 책 데이터는 우리 것만: isbn · 우리 태그 · 우리 한 줄 + 제목·**저자**(`d1_selected.csv`, 이미 git에 있는 서지 정보). YES24 책소개·가격·표지·평점은 없다
- **사용자 추가 지시 (09-30, 구속)**: ① S-03부터 책이 화면을 채운다 — 휴대폰 375 × 667~430 × 932에서 책은 기둥 폭 가득·화면 높이만큼, **375 × 667에서 페이지 스크롤 없음**, 버튼은 책 아래·바닥 표시는 맨 아래 ② 책갈피는 **두 쪽 사이 가운데(책 사이)**에 꽂혀 올라오고, 책과 함께 커진다(1 : 2.15, 아치 창·제비꼬리·끈 유지, 200권 맞춤 검사 ×1.0·×1.15 통과) ③ 닫힌 표지가 크고 P-01/P-04처럼(가죽 질감·책등 글씨·제목) ④ 첫 장(S-04)도 큰 책에서 읽기 쉽게 ⑤ **데스크톱(폭 768px 이상)에서 S-03~S-05는 430px 기둥을 벗어나** 펼친 책 폭 ≈ min(92vw, 1000px)·높이 ≈ 남은 높이 중 작은 쪽에 맞춤, 책갈피도 같이, 버튼 줄은 가운데 최대 480px. S-01·S-02·궁금해요 목록은 430px 기둥 그대로
- 이벤트는 `track()` 하나. `next dev`·Vitest·E2E는 `TRACK_STORE=off`
- 파일 하나 300줄 이하. 커밋 메시지는 영어 conventional commits, 저장소 기록처럼 끝에 `Co-Authored-By` 줄

### 시안에서 가져오는 것 / 바꾼 것

| 시안 | 가져옴 | 이 계획에서 |
|---|---|---|
| 로고(jpg) | 명조 글자 "갈피" + 작은 책·책갈피 아이콘 | 고운바탕 Bold 글자 윤곽(SIL OFL 1.1)을 SVG 경로로 + 아이콘을 선으로 다시 그림. 머리글·파비콘 |
| P-01 | 로고·태그라인, 책 한 권 + 꽂힌 책갈피 둘, 입구 카드(→ 원) | 책 그림은 글자 없이(영어 "Volume I"·"Galpi Archive"·"갈피의 서재"는 새 문구라 뺌). "조용히 머무는 책의 공간" 뺌 |
| P-02 | 9칸 진행 막대, 흰 카드 둘 + vs, 꾹 누르기 알약 | 카드 아이콘·작은 부제("새벽의 쓸쓸함")는 새 문구라 뺌 |
| P-03 | 필수/선택 알약, 흰 입력 칸, 책 아이콘 주 버튼 | 뒤로 가기 화살표는 새 동작이라 뺌 |
| P-04 | 가죽 표지·책등 세로 글씨, 종이 쪽지 안내(테이프) | 책등 글씨는 "갈피 기록부" 대신 "갈피". 첫 장은 왼쪽 = 제목 쪽, 오른쪽 = 요약 |
| P-05 | 반투명 책갈피·저자 줄, 책 아래 버튼, 쪽 번호 알약 "2 / 5" | 책갈피는 오른쪽 쪽이 아니라 **두 쪽 사이 가운데**(사용자 지시). "n / 5"는 버튼 줄에서 쪽 아래 오른쪽 알약으로 |

---

## File Structure

| 파일 | 책임 | 태스크 |
|---|---|---|
| `web/src/lib/books/types.ts` | `CatalogBook.author`, `BookCard.author` | 1 |
| `web/src/lib/books/normalize.ts` (+test) | `Bib`, `cleanAuthor()`, `bibFromCsv()` (← `titlesFromCsv` 대체) | 1 |
| `web/src/lib/books/catalog.ts` | `toCard`에 `author` | 1 |
| `web/scripts/import-books.ts` | CSV 제목 + 저자 → `books.json` | 1 |
| `web/src/data/books.json`, `books.sample.json` | 저자 추가 (스크립트 결과 / 가짜 30권) | 1 |
| `web/src/styles/tokens.css` | 질감·깊이 토큰(T-07 후보), `--header-h` | 2 |
| `web/src/app/globals.css` | 종이 결, 머리글 아래 여백, 데스크톱 책 장면 기둥 풀기 | 2·5 |
| `web/src/components/Logo.tsx` (+test) | A-05 SVG 로고(`Logo`)와 아이콘만(`LogoMark`) | 2 |
| `web/src/components/SiteHeader.tsx` (+css, +test) | 모든 화면 위 작은 로고 머리글 | 2 |
| `web/src/app/layout.tsx` | 머리글 넣기 | 2 |
| `web/src/app/icon.svg` (새) · `web/src/app/favicon.ico` (삭제) | 파비콘 = 로고 | 2 |
| `web/src/components/flow/Home.tsx` (+css, +test) | S-01: 제목·태그라인·책 그림·입구 카드, 로그인 자리 없앰 | 3 |
| `web/src/components/Bookmark.tsx` (+css, +test), `GenreTag.module.css` | 저자 줄, 가운데 정렬, 간격 | 4 |
| `web/src/components/flow/Book.tsx` (+css) | 가죽 표지·책등·라벨, 천 테두리, 닫힌 책 확대 | 5 |
| `web/src/components/flow/BookScene.tsx` (+css, +test) | 화면 가득, 가운데 책갈피, 쪽 번호, 데스크톱 넓게 | 5 |
| `web/src/components/flow/FirstPage.tsx` (+css) | 왼쪽 제목 쪽 + 오른쪽 요약 | 5 |
| `web/src/components/flow/BalanceGame.module.css`, `HoldButton.module.css` | S-02 🍃 모양 | 6 |
| `web/src/components/flow/TargetInput.tsx` (+css) | S-02 🎯 모양, 주 버튼 책 아이콘 | 6 |
| `web/src/components/flow/EndList.tsx` (+css, +test) | 궁금해요 목록 모양, 저자 | 6 |
| `web/e2e/design.spec.ts` | 머리글·아이콘, 저자 포함 200권 맞춤 | 2·4 |
| `web/e2e/scene.spec.ts` (새), `web/e2e/flow-target.spec.ts` | 화면 가득·가운데 책갈피·데스크톱 넓게 | 5 |
| `docs/DESIGN.md`, `docs/context.md`, `docs/tasks.md`, `docs/process.md` | 결정 기록 | 7 |

---

### Task 1: 책 데이터에 저자 — `cleanAuthor`, `bibFromCsv`, 200권 다시 가져오기

**Files:**
- Modify: `web/src/lib/books/types.ts`, `web/src/lib/books/normalize.ts`, `web/src/lib/books/normalize.test.ts`, `web/src/lib/books/data.test.ts`, `web/src/lib/books/catalog.ts`, `web/scripts/import-books.ts`, `web/src/data/books.json`(스크립트), `web/src/data/books.sample.json`
- Modify (BookCard 리터럴에 `author`만): `web/src/app/api/books/draw/route.test.ts`, `web/src/lib/books/draw.test.ts`, `web/src/lib/flow/api.test.ts`, `web/src/lib/flow/state.test.ts`, `web/src/lib/flow/summary.test.ts`, `web/src/components/Bookmark.test.tsx`, `web/src/components/flow/BookScene.test.tsx`, `web/src/components/flow/EndList.test.tsx`, `web/src/app/design/page.tsx`

**Interfaces:**
- Consumes: `normalizeBook(raw, titles)`·`normalizeCatalog(rows, titles)`·`titlesFromCsv(text)` (P3)
- Produces: `interface Bib { title: string; author: string }` · `cleanAuthor(raw: string): string` · `bibFromCsv(text: string): Map<string, Bib>` · `normalizeBook(raw, bib: ReadonlyMap<string, Bib>)` · `normalizeCatalog(rows, bib: ReadonlyMap<string, Bib>)` · `CatalogBook.author: string` · `BookCard.author: string` (`toCard`가 채움, `/api/books/draw` 응답에 포함). `titlesFromCsv`는 없어진다

- [ ] **Step 0: 작업 브랜치**

`feat/design-pass`는 이미 있다(문서 커밋 `3cad687`까지). 이 계획 파일만 새로 있어야 한다 — 먼저 커밋한다.
```bash
cd Galpi
git switch feat/design-pass
git status --short   # ?? docs/plans/2026-09-30-design-pass.md 한 줄뿐이어야 한다
git add docs/plans/2026-09-30-design-pass.md
git commit -m "docs: add the design-pass implementation plan"
```

- [ ] **Step 1: 실패하는 테스트 — 저자 정리와 CSV 읽기**

`web/src/lib/books/normalize.test.ts` 전체를 아래로 바꾼다.
```ts
import { describe, expect, it } from "vitest";
import { bibFromCsv, cleanAuthor, normalizeBook, normalizeCatalog, normalizeVocab, parseCsv } from "./normalize";

const BIB = new Map([
  ["9791111111111", { title: "모순", author: "양귀자" }],
  ["9792222222222", { title: "처음 만나는 SQL", author: "김하늘, 이바다" }],
]);
const leafRow = {
  isbn: "9791111111111", entry: "leaf", slot: "한국 소설", field: null, topic: null, genre: "한국 소설", pages: 308, way: null,
  axes: { temp: 1, pull: -1, gain: 0, world: 1 }, keywords: [], one_liner: "사랑과 현실 사이에서 무엇을 고를까요?", one_liner_style: "question",
};
const targetRow = {
  isbn: "9792222222222", entry: "target", slot: "데이터 분석", field: "데이터·통계", topic: "데이터 분석", genre: "데이터 분석", pages: 240,
  way: "실습", axes: null, keywords: ["SQL", "시각화"], one_liner: "표에서 원하는 줄만 꺼내는 쿼리를 익혀요", one_liner_style: "summary",
};

describe("normalizeBook", () => {
  it("keeps a 🍃 row with its title and axes", () => {
    expect(normalizeBook(leafRow, BIB)).toEqual({
      isbn: "9791111111111", entry: "leaf", title: "모순", author: "양귀자", genre: "한국 소설", field: null, topic: null, pages: 308, way: null,
      axes: { temp: 1, pull: -1, gain: 0, world: 1 }, keywords: [], one_liner: "사랑과 현실 사이에서 무엇을 고를까요?", one_liner_style: "question",
    });
  });

  it("derives field and genre of a 🎯 row from its topic", () => {
    const b = normalizeBook({ ...targetRow, field: undefined, genre: undefined }, BIB);
    expect(b).toMatchObject({
      entry: "target", title: "처음 만나는 SQL", author: "김하늘, 이바다", topic: "데이터 분석", genre: "데이터 분석", field: "데이터·통계",
      way: "실습", axes: null, keywords: ["SQL", "시각화"],
    });
  });

  it("accepts Korean one-liner style names", () => {
    expect(normalizeBook({ ...targetRow, one_liner_style: "요약형" }, BIB).one_liner_style).toBe("summary");
  });

  it.each([
    ["an unknown genre", { ...leafRow, slot: "요리" }, /unknown leaf genre/],
    ["an axis outside -1..1", { ...leafRow, axes: { temp: 2, pull: 0, gain: 0, world: 0 } }, /axis temp/],
    ["a missing title", { ...leafRow, isbn: "9793333333333" }, /no title/],
    ["a bad isbn", { ...leafRow, isbn: "12" }, /13 digits/],
    ["an unknown way", { ...targetRow, way: "독학" }, /way must be/],
    ["an empty one-liner", { ...targetRow, one_liner: "  " }, /one_liner is empty/],
    ["an unknown entry", { ...targetRow, entry: "shelf" }, /unknown entry/],
    ["zero pages", { ...targetRow, pages: 0 }, /pages/],
  ])("rejects %s", (_, row, message) => {
    expect(() => normalizeBook(row, BIB)).toThrow(message);
  });

  it("rejects a book whose author is empty after cleaning", () => {
    const bib = new Map([["9791111111111", { title: "모순", author: "" }]]);
    expect(() => normalizeBook(leafRow, bib)).toThrow(/no author/);
  });
});

describe("normalizeCatalog", () => {
  it("accepts a list or an isbn-keyed object", () => {
    expect(normalizeCatalog([leafRow, targetRow], BIB)).toHaveLength(2);
    const { isbn, ...rest } = leafRow;
    expect(normalizeCatalog({ [isbn]: rest }, BIB)[0].isbn).toBe(isbn);
  });

  it("rejects duplicates and empty sources", () => {
    expect(() => normalizeCatalog([leafRow, leafRow], BIB)).toThrow(/duplicate isbn/);
    expect(() => normalizeCatalog([], BIB)).toThrow(/no books/);
  });
});

describe("CSV titles and authors", () => {
  it("reads quoted titles with commas and a BOM", () => {
    const csv = "\uFEFFentry,slot,title,author,isbn\r\nleaf,시,\"꽃, 그리고 \"\"나\"\"\",\"천선란,임솔아 저\",9791111111111\nleaf,시,모순,양귀자 저,9792222222222\n";
    expect(parseCsv(csv)[1]).toEqual(["leaf", "시", "꽃, 그리고 \"나\"", "천선란,임솔아 저", "9791111111111"]);
    expect(bibFromCsv(csv).get("9791111111111")).toEqual({ title: "꽃, 그리고 \"나\"", author: "천선란, 임솔아" });
    expect(bibFromCsv(csv).get("9792222222222")).toEqual({ title: "모순", author: "양귀자" });
  });

  it("needs isbn, title and author columns", () => {
    expect(() => bibFromCsv("isbn,title\n1,2\n")).toThrow(/isbn, title and author/);
  });
});

describe("cleanAuthor", () => {
  it.each([
    ["양귀자 저", "양귀자"],
    ["김수현 저 ", "김수현"],
    ["조지 오웰 저/정회성 역", "조지 오웰"],
    ["라이먼 프랭크 바움 저/윌리엄 월리스 덴슬로우 그림/손인혜 역", "라이먼 프랭크 바움"],
    ["권정민 글/주형 만화", "권정민"],
    ["지현이(디지털거북이) 저", "지현이"],
    ["아디티 네루카(Aditi Nerurkar, MD) 저/박미경 역", "아디티 네루카"],
    ["천선란,임솔아 저", "천선란, 임솔아"],
    ["마경근,서주란 공저", "마경근, 서주란"],
    ["기시미 이치로,고가 후미타케 저/전경아 역/김정운 감수", "기시미 이치로 외"],
    ["피터 브루스, 앤드루 브루스, 피터 게데크 저/이준용 역", "피터 브루스 외"],
    ["배명은 등저", "배명은 외"],
    ["Dave Lee 저", "Dave Lee"],
    ["루키우스 안나이우스 세네카 저/하와이 대저택 편역", "루키우스 안나이우스 세네카"],
    ["", ""],
  ])("%s → %s", (raw, clean) => {
    expect(cleanAuthor(raw)).toBe(clean);
  });
});

describe("normalizeVocab", () => {
  const topic = (kept: Record<string, { pattern: string }>) => ({ kept, folded: { 파이썬: 4 }, too_common: { 시각화: 11 } });
  const raw: Record<string, ReturnType<typeof topic>> = {
    "데이터 분석": topic({ SQL: { pattern: "SQL|쿼리" } }), 통계: topic({}), "AI 활용": topic({}),
    "업무 자동화": topic({}), "습관·집중": topic({}), "시간·생산성": topic({}),
  };

  it("keeps kept patterns as keywords and folded / too-common names as topic words", () => {
    expect(normalizeVocab(raw)["데이터 분석"]).toEqual({ keywords: { SQL: "SQL|쿼리" }, terms: ["파이썬", "시각화"] });
  });

  it("rejects a missing topic and a broken pattern", () => {
    const missing = Object.fromEntries(Object.entries(raw).filter(([name]) => name !== "통계"));
    expect(() => normalizeVocab(missing)).toThrow(/no topic 통계/);
    expect(() => normalizeVocab({ ...raw, 통계: topic({ 확률: { pattern: "(" } }) })).toThrow(/통계\/확률/);
  });
});
```

`web/src/lib/books/data.test.ts`에서 두 줄을 바꾼다.
```ts
// before
    const titles = new Map(books.map((b) => [b.isbn, b.title]));
    expect(normalizeCatalog(asRows(books), titles)).toEqual(books);
// after
    const bib = new Map(books.map((b) => [b.isbn, { title: b.title, author: b.author }]));
    expect(normalizeCatalog(asRows(books), bib)).toEqual(books);
```

`web/src/app/api/books/draw/route.test.ts` — 책갈피가 받는 필드에 `author`:
```ts
    expect(Object.keys(body.picks[0].card).sort()).toEqual(["author", "entry", "field", "genre", "id", "oneLiner", "oneLinerStyle", "title"]);
```

- [ ] **Step 2: 실패 확인**

Run: `cd web && npx vitest run src/lib/books src/app/api`
Expected: FAIL — `bibFromCsv`·`cleanAuthor`가 export되지 않음, route 테스트는 `author` 없음

- [ ] **Step 3: 타입·정리 함수·가져오기 스크립트**

`web/src/lib/books/types.ts` 전체:
```ts
import type { AxisKey, DrawPick, Entry, Tag, Way } from "../recommend/types";

export type OneLinerStyle = "summary" | "question";

interface CatalogBase {
  isbn: string;
  title: string;
  author: string;
  genre: string;
  pages: number;
  keywords: string[];
  one_liner: string;
  one_liner_style: OneLinerStyle;
}

/** Roadmap 3-3 books columns (minus slot) + title and author. Our own tags only — no YES24 text. */
export type CatalogBook =
  | (CatalogBase & { entry: "leaf"; field: null; topic: null; way: null; axes: Record<AxisKey, Tag> })
  | (CatalogBase & { entry: "target"; field: string; topic: string; way: Way; axes: null });

/** What the browser gets for one bookmark: no scores, no tags beyond the name tag. */
export interface BookCard {
  id: string;
  entry: Entry;
  title: string;
  author: string;
  genre: string;
  field: string | null;
  oneLiner: string;
  oneLinerStyle: OneLinerStyle;
}

export interface CardPick { card: BookCard; kind: DrawPick["kind"] }

/**
 * POST /api/books/draw response.
 * keywords: the requested 🎯 keywords that some book in the topic really has (the rest were dropped before scoring).
 * found: 🎯 books behind the coverage notice (keyword matches, or the whole topic when no keyword was asked); null for 🍃.
 */
export interface DrawResponse {
  picks: CardPick[];
  exhausted: boolean;
  widened: boolean;
  found: number | null;
  keywords: string[];
}

export interface VocabTopic { keywords: Record<string, string>; terms: string[] }
export type Vocab = Record<string, VocabTopic>;
```

`web/src/lib/books/normalize.ts` 전체 (바뀐 곳: `Bib`, `base()`의 저자 검사, 두 함수의 인자 이름·타입, 파일 끝의 `ROLE`·`TWO_NAMES_MAX`·`cleanAuthor`·`bibFromCsv` — `titlesFromCsv`는 지운다):
```ts
import { AXES, type AxisKey, type Tag, type Way } from "../recommend/types";
import { FIELD_OF_TOPIC, LEAF_GENRES, TOPICS, WAYS, type Topic } from "./taxonomy";
import type { CatalogBook, OneLinerStyle, Vocab } from "./types";

type Row = Record<string, unknown>;

const STYLE: Record<string, OneLinerStyle> = { summary: "summary", question: "question", 요약형: "summary", 질문형: "question" };
const bad = (isbn: string, why: string) => new Error(`${isbn || "(no isbn)"}: ${why}`);

/** Title and author of one book, from d1_selected.csv (bibliographic data already in git — not YES24 text). */
export interface Bib { title: string; author: string }

function base(raw: Row, bib: ReadonlyMap<string, Bib>) {
  const isbn = typeof raw.isbn === "string" ? raw.isbn : String(raw.isbn ?? "");
  if (!/^\d{13}$/.test(isbn)) throw bad(isbn, "isbn must be 13 digits");
  const title = bib.get(isbn)?.title;
  if (!title) throw bad(isbn, "no title in d1_selected.csv");
  const author = bib.get(isbn)?.author;
  if (!author) throw bad(isbn, "no author in d1_selected.csv");
  const pages = Number(raw.pages);
  if (!Number.isInteger(pages) || pages <= 0) throw bad(isbn, "pages must be a positive integer");
  const oneLiner = typeof raw.one_liner === "string" ? raw.one_liner.trim() : "";
  if (!oneLiner) throw bad(isbn, "one_liner is empty");
  const style = STYLE[String(raw.one_liner_style)];
  if (!style) throw bad(isbn, `unknown one_liner_style ${String(raw.one_liner_style)}`);
  return { isbn, title, author, pages, one_liner: oneLiner, one_liner_style: style };
}

/** One row of books_v1(_draft).json → CatalogBook. Genre / field / topic are derived from entry + slot. */
export function normalizeBook(raw: Row, bib: ReadonlyMap<string, Bib>): CatalogBook {
  const b = base(raw, bib);
  const slot = String(raw.slot ?? "");
  if (raw.entry === "leaf") {
    if (!(LEAF_GENRES as readonly string[]).includes(slot)) throw bad(b.isbn, `unknown leaf genre ${slot}`);
    const axes = raw.axes;
    if (typeof axes !== "object" || axes === null) throw bad(b.isbn, "leaf book needs axes");
    const tags = {} as Record<AxisKey, Tag>;
    for (const axis of AXES) {
      const v = (axes as Row)[axis];
      if (v !== -1 && v !== 0 && v !== 1) throw bad(b.isbn, `axis ${axis} must be -1, 0 or 1`);
      tags[axis] = v;
    }
    return { ...b, entry: "leaf", genre: slot, field: null, topic: null, way: null, axes: tags, keywords: [] };
  }
  if (raw.entry === "target") {
    if (!(TOPICS as readonly string[]).includes(slot)) throw bad(b.isbn, `unknown topic ${slot}`);
    const topic = slot as Topic;
    if (!WAYS.includes(raw.way as Way)) throw bad(b.isbn, `way must be one of ${WAYS.join(", ")}`);
    const keywords = Array.isArray(raw.keywords) ? raw.keywords.filter((k): k is string => typeof k === "string") : [];
    return { ...b, entry: "target", genre: topic, field: FIELD_OF_TOPIC[topic], topic, way: raw.way as Way, axes: null, keywords };
  }
  throw bad(b.isbn, `unknown entry ${String(raw.entry)}`);
}

export function normalizeCatalog(rows: unknown, bib: ReadonlyMap<string, Bib>): CatalogBook[] {
  const list: Row[] = Array.isArray(rows)
    ? (rows as Row[])
    : typeof rows === "object" && rows !== null
      ? Object.entries(rows as Record<string, Row>).map(([isbn, r]) => ({ isbn, ...r }))
      : [];
  if (!list.length) throw new Error("no books in source");
  const books = list.map((r) => normalizeBook(r, bib));
  const seen = new Set<string>();
  for (const book of books) {
    if (seen.has(book.isbn)) throw bad(book.isbn, "duplicate isbn");
    seen.add(book.isbn);
  }
  return books;
}

/** Minimal RFC 4180 reader: quoted fields, doubled quotes, CRLF, BOM. */
export function parseCsv(text: string): string[][] {
  const src = text.replace(/^\uFEFF/, "");
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let quoted = false;
  for (let i = 0; i < src.length; i++) {
    const ch = src[i];
    if (quoted) {
      if (ch === '"' && src[i + 1] === '"') { cell += '"'; i++; }
      else if (ch === '"') quoted = false;
      else cell += ch;
    } else if (ch === '"') quoted = true;
    else if (ch === ",") { row.push(cell); cell = ""; }
    else if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && src[i + 1] === "\n") i++;
      row.push(cell); rows.push(row); row = []; cell = "";
    } else cell += ch;
  }
  if (cell || row.length) { row.push(cell); rows.push(row); }
  return rows.filter((r) => r.some((c) => c !== ""));
}

// Role words after the names: 저 · 공저 · 등저("and others") · 글 · 지음 · 편 · 편저 · 엮음.
const ROLE = /\s+(공저|등저|저|글|지음|편저|편|엮음)$/;
// Two names longer than this (with ", ") do not fit the bookmark's one author line at 12px — they become "첫 이름 외".
const TWO_NAMES_MAX = 10;

/**
 * "양귀자 저" → "양귀자", "조지 오웰 저/정회성 역" → "조지 오웰" (translators, illustrators, editors after "/" are dropped),
 * "지현이(디지털거북이) 저" → "지현이", two short names → "천선란, 임솔아", two long names, three or more (or 등저) → "피터 브루스 외".
 */
export function cleanAuthor(raw: string): string {
  const main = raw.split("/")[0].replace(/\([^)]*\)/g, "").trim();
  const names = main.replace(ROLE, "").split(",").map((n) => n.trim()).filter(Boolean);
  if (!names.length) return "";
  const both = names.join(", ");
  if (names.length > 2 || /\s등저$/.test(main) || (names.length === 2 && both.length > TWO_NAMES_MAX)) return `${names[0]} 외`;
  return both;
}

export function bibFromCsv(text: string): Map<string, Bib> {
  const [head = [], ...rows] = parseCsv(text);
  const [iIsbn, iTitle, iAuthor] = ["isbn", "title", "author"].map((c) => head.indexOf(c));
  if (iIsbn < 0 || iTitle < 0 || iAuthor < 0) throw new Error("d1_selected.csv needs isbn, title and author columns");
  return new Map(rows.map((r) => [r[iIsbn], { title: r[iTitle], author: cleanAuthor(r[iAuthor] ?? "") }]));
}

type RawTopic = { kept?: Record<string, { pattern?: unknown }>; folded?: Record<string, unknown>; too_common?: Record<string, unknown> };

/** keyword_vocab.json (v1.1) → the closed keyword list (kept) + topic words (folded / too-common names). */
export function normalizeVocab(raw: unknown): Vocab {
  if (typeof raw !== "object" || raw === null) throw new Error("vocab must be an object");
  const src = raw as Record<string, RawTopic | undefined>;
  const out: Vocab = {};
  for (const topic of TOPICS) {
    const t = src[topic];
    if (!t) throw new Error(`vocab has no topic ${topic}`);
    const keywords: Record<string, string> = {};
    for (const [name, k] of Object.entries(t.kept ?? {})) {
      if (typeof k.pattern !== "string") throw new Error(`${topic}/${name}: pattern must be a string`);
      try {
        new RegExp(k.pattern, "i");
      } catch {
        throw new Error(`${topic}/${name}: pattern does not compile`);
      }
      keywords[name] = k.pattern;
    }
    out[topic] = { keywords, terms: [...Object.keys(t.folded ?? {}), ...Object.keys(t.too_common ?? {})] };
  }
  return out;
}
```

`web/src/lib/books/catalog.ts`의 `toCard`:
```ts
export function toCard(b: CatalogBook): BookCard {
  return { id: b.isbn, entry: b.entry, title: b.title, author: b.author, genre: b.genre, field: b.field, oneLiner: b.one_liner, oneLinerStyle: b.one_liner_style };
}
```

`web/scripts/import-books.ts` 전체:
```ts
// Run from web/:  npm run books:import
// ../data/processed/books_v1.json (reviewed, D4) — or books_v1_draft.json (D3) until it exists —
// + d1_selected.csv titles and authors + keyword_vocab.json  →  src/data/books.json, src/data/vocab.json.
// Only our own tags, one-liners, titles and authors: no YES24 text.
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { bibFromCsv, normalizeCatalog, normalizeVocab } from "../src/lib/books/normalize";

const processed = path.resolve(process.cwd(), "..", "data", "processed");
const outDir = path.resolve(process.cwd(), "src", "data");
const readJson = (file: string): unknown => JSON.parse(readFileSync(file, "utf8"));
const write = (name: string, data: unknown) => writeFileSync(path.join(outDir, name), `${JSON.stringify(data, null, 1)}\n`);

const vocab = normalizeVocab(readJson(path.join(processed, "keyword_vocab.json")));
write("vocab.json", vocab);
console.log(`vocab.json: ${Object.values(vocab).reduce((n, t) => n + Object.keys(t.keywords).length, 0)} keywords`);

const source = ["books_v1.json", "books_v1_draft.json"].map((f) => path.join(processed, f)).find((f) => existsSync(f));
if (!source) {
  console.error("no books_v1.json or books_v1_draft.json yet — src/data/books.json is left as it is");
  process.exit(2);
}
const bib = bibFromCsv(readFileSync(path.join(processed, "d1_selected.csv"), "utf8"));
const books = normalizeCatalog(readJson(source), bib);
write("books.json", books);
const leaf = books.filter((b) => b.entry === "leaf").length;
console.log(`books.json: ${books.length} books (leaf ${leaf}, target ${books.length - leaf}) from ${path.basename(source)}`);
```

- [ ] **Step 4: 데이터 다시 만들기**

실제 200권은 스크립트로:
```bash
cd web && npm run books:import
```
Expected: `vocab.json: 20 keywords` / `books.json: 200 books (leaf 100, target 100) from books_v1.json`. 그리고
```bash
cd .. && git diff --stat web/src/data/vocab.json          # 변화 없음
git diff web/src/data/books.json | grep '^[-+] ' | grep -v '^+  "author"' | wc -l   # 0 — 저자 줄만 늘었다
grep -c '"author"' web/src/data/books.json                # 200
grep '"author": ".* 외"' web/src/data/books.json | wc -l  # 11
```

가짜 30권(`books.sample.json`)에는 지어낸 저자를 넣는다 — 한 번만 쓰는 스크립트를 만들어 실행하고 지운다. `web/scripts/tmp-sample-authors.mjs`:
```js
// one-off: add a made-up author to each fixture book, right after its title (one book per line is kept)
import { readFileSync, writeFileSync } from "node:fs";
const AUTHORS = {
  "9790000000001": "한여름", "9790000000002": "윤골목", "9790000000003": "마리 오션", "9790000000004": "서달님",
  "9790000000005": "하루서", "9790000000006": "기차린", "9790000000007": "알리 방", "9790000000008": "천아침",
  "9790000000009": "혼저녁", "9790000000010": "창단어", "9790000000011": "문질문, 답해봄", "9790000000012": "별시간",
  "9790000000101": "김쿼리", "9790000000102": "이질문", "9790000000103": "박보고", "9790000000104": "최분석",
  "9790000000105": "정표현", "9790000000106": "강평균", "9790000000107": "조회귀", "9790000000108": "윤검정",
  "9790000000109": "장대화", "9790000000110": "임동료", "9790000000111": "한생성", "9790000000112": "오반복",
  "9790000000113": "서문서", "9790000000114": "신한시", "9790000000115": "권이분", "9790000000116": "황주의",
  "9790000000117": "안하루", "9790000000118": "송계획 외",
};
const file = "src/data/books.sample.json";
const out = readFileSync(file, "utf8").replace(/("isbn":"(\d{13})".*?"title":"[^"]*")/g, (m, head, isbn) => {
  if (!AUTHORS[isbn]) throw new Error(`no author for ${isbn}`);
  return `${head},"author":"${AUTHORS[isbn]}"`;
});
writeFileSync(file, out);
```
```bash
cd web && node scripts/tmp-sample-authors.mjs && rm scripts/tmp-sample-authors.mjs
head -2 src/data/books.sample.json   # {"isbn":"9790000000001","entry":"leaf","title":"여름의 우편함","author":"한여름",...
```

- [ ] **Step 5: 다른 테스트의 BookCard·CatalogBook 리터럴에 `author`**

타입이 `author`를 요구하므로 아래 줄들만 `title` 바로 뒤에 `author`를 넣은 모습으로 고친다(검사 내용은 그대로).
```ts
// web/src/lib/books/draw.test.ts — habit()
      isbn: `97911111111${String(i).padStart(2, "0")}`, entry: "target", title: `습관 ${i}`, author: "저자", genre: "습관·집중",
// web/src/lib/flow/api.test.ts — card()
const card = (id: string) => ({ id, entry: "leaf" as const, title: id, author: "시인", genre: "시", field: null, oneLiner: "?", oneLinerStyle: "question" as const });
// web/src/lib/flow/state.test.ts
    card: { id: `b${i}`, entry: "leaf" as const, title: `책 ${i}`, author: `저자 ${i}`, genre: "에세이", field: null, oneLiner: "한 줄일까요?", oneLinerStyle: "question" as const },
// web/src/lib/flow/summary.test.ts
  card: { id: "1", entry: "target", title: "t", author: "a", genre: "데이터 분석", field: "데이터·통계", oneLiner: "o", oneLinerStyle: "summary" },
// web/src/components/flow/BookScene.test.tsx — view()
    card: { id: `b${i}`, entry: "target" as const, title: `책 ${i}`, author: `저자 ${i}`, genre: "통계", field: "데이터·통계", oneLiner: `한 줄 ${i}`, oneLinerStyle: "summary" as const },
// web/src/components/flow/EndList.test.tsx — pick()
  card: { id, entry: "leaf", title: `책 ${id}`, author: `저자 ${id}`, genre: "에세이", field: null, oneLiner: `한 줄 ${id}`, oneLinerStyle: "question" },
// web/src/components/Bookmark.test.tsx — leaf, target
  id: "9790000000008", entry: "leaf", title: "천천히 걷는 아침", author: "천아침", genre: "에세이", field: null,
  id: "9790000000101", entry: "target", title: "처음 만나는 쿼리", author: "김쿼리", genre: "데이터 분석", field: "데이터·통계",
// web/src/app/design/page.tsx — DEMO
  { id: "demo-leaf", entry: "leaf", title: "천천히 걷는 아침", author: "천아침", genre: "에세이", field: null, oneLiner: "오늘 아침은 몇 걸음이었을까요?", oneLinerStyle: "question" },
  { id: "demo-target", entry: "target", title: "처음 만나는 쿼리", author: "김쿼리", genre: "데이터 분석", field: "데이터·통계", oneLiner: "표에서 원하는 줄만 꺼내는 쿼리를 익혀요", oneLinerStyle: "summary" },
```

- [ ] **Step 6: 통과 확인**

Run: `cd web && npm run typecheck && npm run lint && npx vitest run`
Expected: 오류 0 / Vitest **45파일 347개 PASS** (331 + 저자 없음 1 + `cleanAuthor` 15)

- [ ] **Step 7: Commit**

```bash
git add web/src/lib/books web/scripts/import-books.ts web/src/data/books.json web/src/data/books.sample.json web/src/app/api/books/draw/route.test.ts web/src/lib/flow/api.test.ts web/src/lib/flow/state.test.ts web/src/lib/flow/summary.test.ts web/src/components/Bookmark.test.tsx web/src/components/flow/BookScene.test.tsx web/src/components/flow/EndList.test.tsx web/src/app/design/page.tsx
git commit -m "feat(books): add a cleaned author line to every book from d1_selected.csv"
```

---

### Task 2: 토큰·종이 결·로고(A-05)·머리글·파비콘

**Files:**
- Modify: `web/src/styles/tokens.css`, `web/src/app/globals.css`, `web/src/app/layout.tsx`, `web/e2e/design.spec.ts`
- Create: `web/src/components/Logo.tsx`, `web/src/components/Logo.test.tsx`, `web/src/components/SiteHeader.tsx`, `web/src/components/SiteHeader.module.css`, `web/src/components/SiteHeader.test.tsx`, `web/src/app/icon.svg`
- Delete: `web/src/app/favicon.ico` (create-next-app 기본 아이콘, 25,931바이트)

**Interfaces:**
- Consumes: 없음
- Produces: `Logo({ className?, height = 34 })` — `role="img"`, `aria-label="갈피"`, 90 : 55 · `LogoMark({ className?, width = 26 })` — 책+리본만, `aria-hidden` · 상수 `GLYPH_GAL`, `GLYPH_PI`, `BOOK_ICON`, `RIBBON` · `SiteHeader()` · CSS 변수 `--header-h`, `--foil`, `--paper-rule`, `--paper-grain`, `--leather-grain`, `--leather-sheen`, `--card-bg`, `--card-edge`, `--field-bg`, `--foil-line`, `--spine-shade`, `--tape`, `--shadow-plate`, `--shadow-soft`, `--shadow-book`

로고 만드는 법(기록용, 다시 할 필요 없음): Stitch 로고 jpg는 배경 격자가 그림에 박혀 있어 쓸 수 없다. 앱이 이미 쓰는 고운바탕 Bold(SIL OFL 1.1 — 글자 윤곽을 로고 그림으로 쓰는 것은 허용)의 "갈"·"피" 윤곽을 fontTools로 SVG 경로로 뽑아(1000upm × 0.04, 기준선 y = 35.2) 붙이고, 책·리본은 시안을 보고 선으로 그렸다. 경로 문자열은 아래 코드에 그대로 있다.

- [ ] **Step 1: 실패하는 테스트**

`web/src/components/Logo.test.tsx`:
```tsx
import { readFileSync } from "node:fs";
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { BOOK_ICON, GLYPH_GAL, GLYPH_PI, Logo, LogoMark, RIBBON } from "./Logo";

describe("Logo (A-05)", () => {
  it("reads as 갈피 and keeps the 90 : 55 shape at any height", () => {
    render(<Logo height={55} />);
    const svg = screen.getByRole("img", { name: "갈피" });
    expect(svg).toHaveAttribute("width", "90");
    expect(svg.querySelectorAll("path")).toHaveLength(4);
  });

  it("the ornament is decorative", () => {
    const { container } = render(<LogoMark />);
    expect(container.querySelector("svg")).toHaveAttribute("aria-hidden", "true");
  });

  it("app/icon.svg draws the same word mark and book", () => {
    const icon = readFileSync("src/app/icon.svg", "utf8");
    for (const d of [GLYPH_GAL, GLYPH_PI, BOOK_ICON, RIBBON]) expect(icon).toContain(d);
  });
});
```

`web/src/components/SiteHeader.test.tsx`:
```tsx
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { SiteHeader } from "./SiteHeader";

describe("SiteHeader", () => {
  it("shows only the logo — no login text, link or button before P5", () => {
    render(<SiteHeader />);
    expect(screen.getByRole("img", { name: "갈피" })).toBeInTheDocument();
    expect(screen.queryByRole("link")).toBeNull();
    expect(screen.queryByRole("button")).toBeNull();
    expect(screen.queryByText("로그인")).toBeNull();
  });
});
```

`web/e2e/design.spec.ts` — `test("frost and book tokens exist for bookmarks", …)` **바로 앞에** 추가:
```ts
test("every page has the small logo header, no login yet, and the SVG icon", async ({ page, request }) => {
  for (const path of ["/", "/privacy"]) {
    await page.goto(path);
    await expect(page.locator("header").first().getByRole("img", { name: "갈피" })).toBeVisible();
    await expect(page.getByText("로그인")).toHaveCount(0);
  }
  const icon = await request.get("/icon.svg");
  expect(icon.status()).toBe(200);
  expect(icon.headers()["content-type"]).toContain("image/svg+xml");
});
```

- [ ] **Step 2: 실패 확인**

Run: `cd web && npx vitest run src/components/Logo.test.tsx src/components/SiteHeader.test.tsx`
Expected: FAIL — `./Logo`, `./SiteHeader` 모듈 없음

- [ ] **Step 3: 토큰과 종이 결**

`web/src/styles/tokens.css` 전체(위 18줄은 그대로, `--header-h`와 "Design pass" 블록이 새것):
```css
:root {
  --paper: #FAF5EA; --paper-deep: #F0E6D0; --paper-line: #DDD0B4;
  --cloth: #7A4A2E; --cloth-edge: #5A3420;
  --ink: #2B2724; --ink-soft: #4A433D; --ink-muted: #7A6048; --blush: #E8998A;
  --frost-bg: rgba(250, 250, 247, 0.6); --frost-fallback: #F4F1EA;
  --frost-blur: blur(3px) saturate(1.1); --frost-edge: 1px solid rgba(255, 255, 255, 0.8);
  --shadow-ink: rgba(43, 39, 36, 0.25);
  --genre-korean-fiction: #A94C60; --genre-world-fiction: #7E5595; --genre-sf-fantasy: #44548F;
  --genre-mystery: #3E474C; --genre-essay: #4A7456; --genre-poetry: #A0593F; --genre-humanities: #7D6337;
  --genre-science: #2B7178; --genre-art-travel: #B8912F;
  --field-data: #3A6684; --field-ai: #5E55A0; --field-habit: #9E6232;
  --space-1: 4px; --space-2: 8px; --space-3: 12px; --space-4: 16px; --space-5: 24px; --space-6: 32px;
  --radius-card: 12px; --radius-pill: 9999px; --radius-book: 2px 10px 10px 2px; --radius-bookmark: 10px 10px 0 0;
  --touch: 44px; --column: 430px; --header-h: 52px;
  --dur-open-cover: 1000ms; --dur-flip-page: 550ms; --dur-bookmark-rise: 600ms;
  --dur-bookmark-away: 450ms; --dur-bookmark-down: 400ms; --dur-hold: 800ms; --dur-card-flip: 500ms;
  --ease-open: cubic-bezier(.6, .05, .25, 1); --ease-flip: cubic-bezier(.5, 0, .3, 1);
  --ease-rise: cubic-bezier(.34, 1.56, .64, 1);

  /* Design pass (09-30): textures and depth, CSS/SVG only — no image files, nothing animated. */
  --foil: #EAD9B0;                                   /* gold-foil letters on cloth: 5.3 : 1 on cloth, 7.7 : 1 on cloth-edge */
  --paper-rule: rgba(221, 208, 180, 0.55);           /* ruled lines on pages */
  --paper-grain: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='160' height='160'%3E%3Cfilter id='g'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='.85' numOctaves='2' stitchTiles='stitch'/%3E%3CfeColorMatrix values='0 0 0 0 .48 0 0 0 0 .38 0 0 0 0 .28 0 0 0 .07 0'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23g)'/%3E%3C/svg%3E");
  --leather-grain: radial-gradient(rgba(250, 245, 234, 0.12) 0.8px, transparent 1.2px) 0 0 / 5px 5px;
  --leather-sheen: linear-gradient(100deg, rgba(0, 0, 0, 0.16), rgba(255, 255, 255, 0.07) 45%, rgba(0, 0, 0, 0.12));
  --card-bg: rgba(255, 255, 255, 0.55);              /* cards and chips resting on the paper — whiter, no blur */
  --card-edge: 1px solid rgba(221, 208, 180, 0.7);
  --field-bg: #FFFFFF;                               /* text input */
  --foil-line: rgba(234, 217, 176, 0.45);            /* blind-stamped lines and bands on leather */
  --spine-shade: linear-gradient(90deg, rgba(0, 0, 0, 0.3), rgba(0, 0, 0, 0.06) 75%, rgba(255, 255, 255, 0.08));
  --tape: rgba(255, 255, 255, 0.7);                  /* the tape on a C-14 paper slip */
  --shadow-plate: 0 1px 2px rgba(0, 0, 0, 0.25);     /* the paper label on the cover */
  --shadow-soft: 0 4px 16px -4px rgba(43, 39, 36, 0.12);   /* cards resting on paper (static only) */
  --shadow-book: 0 18px 30px -16px rgba(43, 39, 36, 0.45); /* the book on the desk (static only) */
}
```

`web/src/app/globals.css` 전체(바뀐 곳: `.column` 배경에 종이 결, `main` 위 여백 16 → 8 — 머리글이 위에 생겨서):
```css
@import "../styles/tokens.css";

* { box-sizing: border-box; }
html, body { margin: 0; }
body {
  background: var(--paper-deep);
  color: var(--ink);
  font-family: var(--font-dodum), sans-serif;
  font-size: 15px;
  line-height: 1.7;
}
.column {
  max-width: var(--column);
  min-height: 100dvh;
  margin: 0 auto;
  background: var(--paper-grain), var(--paper);
  box-shadow: 0 0 0 1px var(--paper-line);
  display: flex;
  flex-direction: column;
}
.column > main { flex: 1; padding: var(--space-2) var(--space-4) var(--space-4); }
h1, h2, h3, .serif { font-family: var(--font-batang), serif; font-weight: 700; }
@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after { animation-duration: 1ms !important; transition-duration: 1ms !important; }
}
```

- [ ] **Step 4: 로고·머리글·파비콘**

`web/src/components/Logo.tsx`:
```tsx
/**
 * A-05 — the Stitch logo redrawn as SVG: "갈피" outlines taken from Gowun Batang Bold (SIL OFL 1.1, the title font)
 * plus the small book with a ribbon bookmark. `currentColor`, so CSS decides the colour. `app/icon.svg` uses the same paths.
 */
export const GLYPH_GAL = "M12.5 37.8Q11.6 37.8 10.8 36.9Q10 36.1 10 34.5V31.8Q9.9 31.6 9.5 31.3Q9 31 8.7 30.7Q8.4 30.4 8.4 30.2Q8.4 29.9 8.8 29.4Q9.1 28.8 9.5 28.8Q10.4 28.9 11.6 29Q12.8 29 13.6 29.1Q14.4 29.1 15.7 29.1Q17 29.1 18.6 29Q20.2 29 21.9 28.9Q23.5 28.8 24.9 28.7Q25 28 25 27.1Q25 26.3 25 25.5Q25 25.2 24.9 25.1Q24.8 25.1 24.6 25.1Q24.1 25.1 23 25.1Q22 25.2 20.6 25.3Q19.3 25.3 18 25.4Q16.8 25.5 16 25.5Q15.6 25.5 14.9 25.6Q14.2 25.6 13.4 25.7Q12.7 25.8 12.2 25.9Q11.4 26.1 11 26Q10.6 26 10.3 25.7Q9.9 25.4 9.3 24.8Q8.7 24.3 8.6 24.1Q8.6 23.8 8.9 23.3Q9.3 22.8 9.7 22.7Q11.3 23 13.3 23.1Q15.3 23.1 17.6 23Q19 23 20.5 22.9Q22 22.8 23.2 22.7Q24.5 22.5 25.1 22.3Q25.4 22.2 25.5 22.2Q25.6 22.2 25.8 22.2Q25.9 22.3 26 22.3L28.9 22.9Q29.5 23 29.3 23.8Q29.2 24.1 29 24.9Q28.7 25.7 28.5 26.7Q28.3 27.6 28.1 28.3Q28.6 28.6 29 28.9Q29.5 29.3 29.5 29.5Q29.5 30 29.1 30.6Q28.8 31.1 28.3 31.3Q27 31.2 25.2 31.2Q23.3 31.2 21.2 31.3Q19.1 31.3 17.2 31.4Q15.2 31.5 13.8 31.6V33.8Q13.8 34.5 13.9 34.9Q14.1 35.2 14.6 35.3Q16.1 35.4 18.2 35.3Q20.3 35.3 22.1 35.2Q25 35.2 26.8 34.8Q28.6 34.5 29.3 34.3Q29.7 34.1 30 34.2Q30.3 34.4 30.4 34.6Q30.8 35 31.1 35.6Q31.4 36.3 31.4 36.5Q31.4 36.8 30.9 37.3Q30.5 37.8 30.2 37.8Q29.6 37.7 28.5 37.7Q27.3 37.7 25.8 37.7Q24.3 37.6 22.8 37.7Q22.5 37.7 21.9 37.7Q21.2 37.7 20.3 37.7Q19 37.8 17.5 37.8Q16 37.8 14.6 37.8Q13.3 37.8 12.5 37.8ZM4 23.4Q3 23.7 2.2 23.5Q1.3 23.2 1.2 22.8Q1.2 22.6 1.3 22.2Q1.4 21.9 1.9 21.6Q3.4 20.8 5.4 19.4Q7.4 18 9.3 16.2Q11.2 14.3 12.8 12.1Q14.3 9.9 15.1 7.6Q15.2 7.2 14.8 7.2Q13.9 7.2 12.6 7.3Q11.4 7.4 10.6 7.4Q9.5 7.5 8.3 7.6Q7 7.8 5.8 8Q5.1 8.1 4.8 8.1Q4.4 8 4 7.6Q3.7 7.4 3.2 6.9Q2.6 6.3 2.4 6Q2.3 5.6 2.7 5.1Q3.1 4.6 3.4 4.6Q4.9 5 6.8 5Q8.6 5 10.2 5Q12.2 4.9 13.8 4.7Q15.4 4.4 15.9 4.1Q16.4 3.9 16.8 4Q17.4 4.2 18.3 4.6Q19.2 5 19.7 5.2Q20 5.3 20.2 5.5Q20.3 5.8 20.1 6.2Q19.9 6.7 19.4 7.8Q18.8 8.8 18.4 9.6Q17.4 11.4 15.9 13.4Q14.4 15.4 12.6 17.3Q10.7 19.2 8.5 20.8Q6.3 22.4 4 23.4ZM26.8 21.2Q26 21.2 25.8 20.4Q25.7 19.4 25.6 18.1Q25.6 16.9 25.6 16.2V6.2Q25.6 5.1 25.5 4.5Q25.4 3.9 25.1 3.6Q24.7 3.2 24 2.7Q23.6 2.4 23.4 2.1Q23.2 1.8 23.4 1.4Q23.7 0.7 24.2 0.5Q24.8 0.3 25.4 0.4Q26.3 0.6 27.3 1.1Q28.2 1.5 28.9 2Q29.6 2.4 29.6 3Q29.5 3.5 29.4 4.4Q29.3 5.3 29.3 6.2V12.3Q30.8 12.1 32.1 11.8Q33.4 11.4 33.9 11.3Q34.3 11.1 34.6 11.2Q34.9 11.3 35 11.6Q35.4 12 35.7 12.7Q36 13.4 36 13.7Q36 14.1 35.5 14.5Q35 14.9 34.7 14.9Q33.5 14.7 32.1 14.6Q30.6 14.6 29.3 14.6V16Q29.3 17 29.1 18.2Q28.8 19.4 28.3 20.3Q27.7 21.2 26.8 21.2Z";
export const GLYPH_PI = "M41.8 26.6Q41.4 26.6 41 26.6Q40.6 26.6 40.1 26.3Q39.9 26.1 39.4 25.7Q38.9 25.2 38.5 24.8Q38 24.4 38 24.2Q37.9 23.8 38.3 23.3Q38.6 22.8 38.9 22.8Q39.8 22.9 41.3 22.9Q42.7 23 43.8 23Q44.1 23 44.3 23Q44.2 21.9 44.2 21Q44.1 20 44 19Q44 17.9 43.8 16.4Q43.6 15.1 43.4 14.1Q43.2 13.2 42.1 12.4Q41.5 12 41.8 11.4Q42.1 10.7 42.5 10.5Q42.8 10.3 43.2 10.4Q43.6 10.4 44.3 10.6Q44.9 10.8 45.6 11.2Q46.4 11.6 46.9 12Q47.4 12.4 47.4 12.6Q47.4 13.2 47.3 14.2Q47.3 15.3 47.4 16.1L47.5 20.5Q47.5 20.9 47.5 21.5Q47.4 22.1 47.4 22.6Q47.4 22.8 47.4 22.8Q48.6 22.8 49.9 22.6Q51.2 22.5 52.4 22.4Q52.6 20.7 52.7 18.8Q52.9 17 53 15Q53 15 53 14.8Q53 13.6 52.9 12.8Q52.8 12 51.8 11.4Q51.4 11.2 51.3 11Q51.2 10.8 51.4 10.3Q51.9 9 53.3 9.3Q54.2 9.5 55.2 9.9Q56.2 10.3 56.8 10.6Q57.5 11.2 57.5 11.6Q57.3 12.2 57.2 12.9Q57 13.7 56.8 15.4L55.9 21.8Q57.3 21.6 58.5 21.3Q59.6 21.1 60.5 20.8Q61.2 20.6 61.5 20.8Q61.9 20.9 61.9 21.3Q61.9 22.6 59.5 23.4Q58.5 23.8 57 24.1Q55.6 24.4 53.9 24.7Q52.2 25 50.5 25.2Q48.8 25.4 47.4 25.6Q45.8 25.8 44.3 26.1Q42.8 26.3 41.8 26.6ZM64.3 36.4Q63.6 36.4 63.4 35.4Q63.3 34.7 63.2 33.8Q63.2 32.8 63.2 31.9Q63.2 31 63.2 30.4V6.8Q63.2 6.7 63.2 6.6Q63.2 5.2 62.9 4.4Q62.7 3.6 61.4 2.8Q61.2 2.6 61 2.4Q60.8 2.2 60.8 2Q60.8 1.5 61.2 1Q61.7 0.4 62.3 0.4Q62.8 0.4 63.5 0.6Q64.3 0.8 65.1 1.2Q65.9 1.5 66.4 1.9Q67.2 2.4 67.2 2.8Q67.2 3.4 67 4.5Q66.9 5.7 66.9 6.8L66.8 30.2Q66.8 31 66.7 32Q66.6 33.1 66.3 34.1Q66 35.1 65.5 35.7Q65 36.4 64.3 36.4ZM42.2 9.1Q42.1 9.1 42.1 9.1Q41.4 9.3 41.1 9.3Q40.9 9.2 40.4 8.8Q40.2 8.6 39.6 8Q39 7.3 38.8 7Q38.7 6.6 39.1 6.1Q39.5 5.6 39.8 5.6Q41.1 5.9 42.9 5.9Q44.6 6 46.8 5.9Q49.6 5.8 51.9 5.6Q54.2 5.4 55.8 5.1Q57.4 4.9 58 4.8Q58.8 4.6 59.1 5Q59.4 5.6 59.6 6.2Q59.9 6.9 59.9 7.1Q59.9 7.4 59.5 7.9Q59 8.3 58.8 8.3Q58.1 8.2 56.9 8.2Q55.6 8.2 54.2 8.2Q52.7 8.2 51.2 8.3Q49.7 8.4 48.6 8.4Q47 8.5 45.4 8.7Q43.8 8.8 42.2 9.1Z";
export const BOOK_ICON = "M88 -14H67a4 4 0 0 0 0 8h21zM69.5 -9.5H88";
export const RIBBON = "M77 -6v8l2 -1.6 2 1.6v-8";
const VIEW = { x: 0, y: -16, w: 90, h: 55 };
const ICON_VIEW = { x: 64, y: -16, w: 26, h: 20 };

function BookWithRibbon() {
  return (
    <g fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" strokeLinecap="round">
      <path d={BOOK_ICON} />
      <path d={RIBBON} />
    </g>
  );
}

/** Word mark + book. Read as "갈피". */
export function Logo({ className, height = 34 }: { className?: string; height?: number }) {
  return (
    <svg
      className={className}
      viewBox={`${VIEW.x} ${VIEW.y} ${VIEW.w} ${VIEW.h}`}
      height={height}
      width={Math.round((height * VIEW.w) / VIEW.h)}
      role="img"
      aria-label="갈피"
      focusable="false"
    >
      <path d={GLYPH_GAL} fill="currentColor" />
      <path d={GLYPH_PI} fill="currentColor" />
      <BookWithRibbon />
    </svg>
  );
}

/** The book-and-ribbon mark alone, as an ornament (decorative). */
export function LogoMark({ className, width = 26 }: { className?: string; width?: number }) {
  return (
    <svg
      className={className}
      viewBox={`${ICON_VIEW.x} ${ICON_VIEW.y} ${ICON_VIEW.w} ${ICON_VIEW.h}`}
      width={width}
      height={Math.round((width * ICON_VIEW.h) / ICON_VIEW.w)}
      aria-hidden="true"
      focusable="false"
    >
      <BookWithRibbon />
    </svg>
  );
}
```

`web/src/components/SiteHeader.tsx`:
```tsx
import { Logo } from "./Logo";
import styles from "./SiteHeader.module.css";

/** Small logo header on every screen (DESIGN A-05). No login place until P5: a button that does nothing would confuse. */
export function SiteHeader() {
  return (
    <header className={styles.header}>
      <Logo className={styles.logo} />
    </header>
  );
}
```

`web/src/components/SiteHeader.module.css`:
```css
.header { display: flex; align-items: center; height: var(--header-h); padding: 0 var(--space-4); }
.logo { display: block; color: var(--ink); }
```

`web/src/app/layout.tsx` 전체:
```tsx
import type { Metadata } from "next";
import { Gowun_Batang, Gowun_Dodum } from "next/font/google";
import { Footer } from "@/components/Footer";
import { SiteHeader } from "@/components/SiteHeader";
import "./globals.css";

const batang = Gowun_Batang({ weight: "700", subsets: ["latin"], display: "swap", preload: false, variable: "--font-batang" });
const dodum = Gowun_Dodum({ weight: "400", subsets: ["latin"], display: "swap", preload: false, variable: "--font-dodum" });

export const metadata: Metadata = {
  title: "갈피",
  description: "읽을 책, 갈피가 안 잡힐 때",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ko" className={`${batang.variable} ${dodum.variable}`}>
      <body>
        <div className="column">
          <SiteHeader />
          <main>{children}</main>
          <Footer />
        </div>
      </body>
    </html>
  );
}
```

`web/src/app/icon.svg` (종이색 둥근 네모 위에 같은 경로 — Next가 `<link rel="icon" type="image/svg+xml">`를 넣는다):
```svg
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">
  <rect width="64" height="64" rx="14" fill="#FAF5EA"/>
  <g transform="translate(2.3 24.4) scale(.66)" fill="#2B2724">
    <path d="M12.5 37.8Q11.6 37.8 10.8 36.9Q10 36.1 10 34.5V31.8Q9.9 31.6 9.5 31.3Q9 31 8.7 30.7Q8.4 30.4 8.4 30.2Q8.4 29.9 8.8 29.4Q9.1 28.8 9.5 28.8Q10.4 28.9 11.6 29Q12.8 29 13.6 29.1Q14.4 29.1 15.7 29.1Q17 29.1 18.6 29Q20.2 29 21.9 28.9Q23.5 28.8 24.9 28.7Q25 28 25 27.1Q25 26.3 25 25.5Q25 25.2 24.9 25.1Q24.8 25.1 24.6 25.1Q24.1 25.1 23 25.1Q22 25.2 20.6 25.3Q19.3 25.3 18 25.4Q16.8 25.5 16 25.5Q15.6 25.5 14.9 25.6Q14.2 25.6 13.4 25.7Q12.7 25.8 12.2 25.9Q11.4 26.1 11 26Q10.6 26 10.3 25.7Q9.9 25.4 9.3 24.8Q8.7 24.3 8.6 24.1Q8.6 23.8 8.9 23.3Q9.3 22.8 9.7 22.7Q11.3 23 13.3 23.1Q15.3 23.1 17.6 23Q19 23 20.5 22.9Q22 22.8 23.2 22.7Q24.5 22.5 25.1 22.3Q25.4 22.2 25.5 22.2Q25.6 22.2 25.8 22.2Q25.9 22.3 26 22.3L28.9 22.9Q29.5 23 29.3 23.8Q29.2 24.1 29 24.9Q28.7 25.7 28.5 26.7Q28.3 27.6 28.1 28.3Q28.6 28.6 29 28.9Q29.5 29.3 29.5 29.5Q29.5 30 29.1 30.6Q28.8 31.1 28.3 31.3Q27 31.2 25.2 31.2Q23.3 31.2 21.2 31.3Q19.1 31.3 17.2 31.4Q15.2 31.5 13.8 31.6V33.8Q13.8 34.5 13.9 34.9Q14.1 35.2 14.6 35.3Q16.1 35.4 18.2 35.3Q20.3 35.3 22.1 35.2Q25 35.2 26.8 34.8Q28.6 34.5 29.3 34.3Q29.7 34.1 30 34.2Q30.3 34.4 30.4 34.6Q30.8 35 31.1 35.6Q31.4 36.3 31.4 36.5Q31.4 36.8 30.9 37.3Q30.5 37.8 30.2 37.8Q29.6 37.7 28.5 37.7Q27.3 37.7 25.8 37.7Q24.3 37.6 22.8 37.7Q22.5 37.7 21.9 37.7Q21.2 37.7 20.3 37.7Q19 37.8 17.5 37.8Q16 37.8 14.6 37.8Q13.3 37.8 12.5 37.8ZM4 23.4Q3 23.7 2.2 23.5Q1.3 23.2 1.2 22.8Q1.2 22.6 1.3 22.2Q1.4 21.9 1.9 21.6Q3.4 20.8 5.4 19.4Q7.4 18 9.3 16.2Q11.2 14.3 12.8 12.1Q14.3 9.9 15.1 7.6Q15.2 7.2 14.8 7.2Q13.9 7.2 12.6 7.3Q11.4 7.4 10.6 7.4Q9.5 7.5 8.3 7.6Q7 7.8 5.8 8Q5.1 8.1 4.8 8.1Q4.4 8 4 7.6Q3.7 7.4 3.2 6.9Q2.6 6.3 2.4 6Q2.3 5.6 2.7 5.1Q3.1 4.6 3.4 4.6Q4.9 5 6.8 5Q8.6 5 10.2 5Q12.2 4.9 13.8 4.7Q15.4 4.4 15.9 4.1Q16.4 3.9 16.8 4Q17.4 4.2 18.3 4.6Q19.2 5 19.7 5.2Q20 5.3 20.2 5.5Q20.3 5.8 20.1 6.2Q19.9 6.7 19.4 7.8Q18.8 8.8 18.4 9.6Q17.4 11.4 15.9 13.4Q14.4 15.4 12.6 17.3Q10.7 19.2 8.5 20.8Q6.3 22.4 4 23.4ZM26.8 21.2Q26 21.2 25.8 20.4Q25.7 19.4 25.6 18.1Q25.6 16.9 25.6 16.2V6.2Q25.6 5.1 25.5 4.5Q25.4 3.9 25.1 3.6Q24.7 3.2 24 2.7Q23.6 2.4 23.4 2.1Q23.2 1.8 23.4 1.4Q23.7 0.7 24.2 0.5Q24.8 0.3 25.4 0.4Q26.3 0.6 27.3 1.1Q28.2 1.5 28.9 2Q29.6 2.4 29.6 3Q29.5 3.5 29.4 4.4Q29.3 5.3 29.3 6.2V12.3Q30.8 12.1 32.1 11.8Q33.4 11.4 33.9 11.3Q34.3 11.1 34.6 11.2Q34.9 11.3 35 11.6Q35.4 12 35.7 12.7Q36 13.4 36 13.7Q36 14.1 35.5 14.5Q35 14.9 34.7 14.9Q33.5 14.7 32.1 14.6Q30.6 14.6 29.3 14.6V16Q29.3 17 29.1 18.2Q28.8 19.4 28.3 20.3Q27.7 21.2 26.8 21.2Z"/>
    <path d="M41.8 26.6Q41.4 26.6 41 26.6Q40.6 26.6 40.1 26.3Q39.9 26.1 39.4 25.7Q38.9 25.2 38.5 24.8Q38 24.4 38 24.2Q37.9 23.8 38.3 23.3Q38.6 22.8 38.9 22.8Q39.8 22.9 41.3 22.9Q42.7 23 43.8 23Q44.1 23 44.3 23Q44.2 21.9 44.2 21Q44.1 20 44 19Q44 17.9 43.8 16.4Q43.6 15.1 43.4 14.1Q43.2 13.2 42.1 12.4Q41.5 12 41.8 11.4Q42.1 10.7 42.5 10.5Q42.8 10.3 43.2 10.4Q43.6 10.4 44.3 10.6Q44.9 10.8 45.6 11.2Q46.4 11.6 46.9 12Q47.4 12.4 47.4 12.6Q47.4 13.2 47.3 14.2Q47.3 15.3 47.4 16.1L47.5 20.5Q47.5 20.9 47.5 21.5Q47.4 22.1 47.4 22.6Q47.4 22.8 47.4 22.8Q48.6 22.8 49.9 22.6Q51.2 22.5 52.4 22.4Q52.6 20.7 52.7 18.8Q52.9 17 53 15Q53 15 53 14.8Q53 13.6 52.9 12.8Q52.8 12 51.8 11.4Q51.4 11.2 51.3 11Q51.2 10.8 51.4 10.3Q51.9 9 53.3 9.3Q54.2 9.5 55.2 9.9Q56.2 10.3 56.8 10.6Q57.5 11.2 57.5 11.6Q57.3 12.2 57.2 12.9Q57 13.7 56.8 15.4L55.9 21.8Q57.3 21.6 58.5 21.3Q59.6 21.1 60.5 20.8Q61.2 20.6 61.5 20.8Q61.9 20.9 61.9 21.3Q61.9 22.6 59.5 23.4Q58.5 23.8 57 24.1Q55.6 24.4 53.9 24.7Q52.2 25 50.5 25.2Q48.8 25.4 47.4 25.6Q45.8 25.8 44.3 26.1Q42.8 26.3 41.8 26.6ZM64.3 36.4Q63.6 36.4 63.4 35.4Q63.3 34.7 63.2 33.8Q63.2 32.8 63.2 31.9Q63.2 31 63.2 30.4V6.8Q63.2 6.7 63.2 6.6Q63.2 5.2 62.9 4.4Q62.7 3.6 61.4 2.8Q61.2 2.6 61 2.4Q60.8 2.2 60.8 2Q60.8 1.5 61.2 1Q61.7 0.4 62.3 0.4Q62.8 0.4 63.5 0.6Q64.3 0.8 65.1 1.2Q65.9 1.5 66.4 1.9Q67.2 2.4 67.2 2.8Q67.2 3.4 67 4.5Q66.9 5.7 66.9 6.8L66.8 30.2Q66.8 31 66.7 32Q66.6 33.1 66.3 34.1Q66 35.1 65.5 35.7Q65 36.4 64.3 36.4ZM42.2 9.1Q42.1 9.1 42.1 9.1Q41.4 9.3 41.1 9.3Q40.9 9.2 40.4 8.8Q40.2 8.6 39.6 8Q39 7.3 38.8 7Q38.7 6.6 39.1 6.1Q39.5 5.6 39.8 5.6Q41.1 5.9 42.9 5.9Q44.6 6 46.8 5.9Q49.6 5.8 51.9 5.6Q54.2 5.4 55.8 5.1Q57.4 4.9 58 4.8Q58.8 4.6 59.1 5Q59.4 5.6 59.6 6.2Q59.9 6.9 59.9 7.1Q59.9 7.4 59.5 7.9Q59 8.3 58.8 8.3Q58.1 8.2 56.9 8.2Q55.6 8.2 54.2 8.2Q52.7 8.2 51.2 8.3Q49.7 8.4 48.6 8.4Q47 8.5 45.4 8.7Q43.8 8.8 42.2 9.1Z"/>
    <g fill="none" stroke="#2B2724" stroke-width="1.6" stroke-linejoin="round" stroke-linecap="round">
      <path d="M88 -14H67a4 4 0 0 0 0 8h21zM69.5 -9.5H88"/>
      <path d="M77 -6v8l2 -1.6 2 1.6v-8"/>
    </g>
  </g>
</svg>
```

기본 아이콘을 지운다.
```bash
git rm web/src/app/favicon.ico
```

- [ ] **Step 5: 통과 확인**

Run: `cd web && npm run typecheck && npm run lint && npx vitest run && npm run build && npm run e2e`
Expected: 오류 0 / Vitest **47파일 351개 PASS** / build 경로 목록에 `○ /icon.svg` / e2e 전부 PASS (새 머리글·아이콘 테스트 포함). `/`와 `/privacy` 맨 위에 로고가 보이고 로그인 글자는 없다

- [ ] **Step 6: Commit**

```bash
git add web/src/styles/tokens.css web/src/app/globals.css web/src/app/layout.tsx web/src/app/icon.svg web/src/components/Logo.tsx web/src/components/Logo.test.tsx web/src/components/SiteHeader.tsx web/src/components/SiteHeader.module.css web/src/components/SiteHeader.test.tsx web/e2e/design.spec.ts
git commit -m "feat(design): redraw the Stitch logo as SVG for a header on every page and the favicon"
```

---

### Task 3: S-01 처음 — 책 그림, 입구 카드, 로그인 자리 없앰

**Files:**
- Modify: `web/src/components/flow/Home.tsx`, `web/src/components/flow/Home.module.css`, `web/src/components/flow/Home.test.tsx`

**Interfaces:**
- Consumes: `LogoMark` (Task 2), 토큰 `--card-bg`·`--card-edge`·`--shadow-soft`·`--leather-*`·`--spine-shade`·`--foil*` (Task 2)
- Produces: `Home({ onStart })` — 모양만 바뀜. `data-testid="account-slot"`은 없어진다(09-30 결정: 로그인 자리는 P5에). 버튼은 입구 둘뿐, 이름은 그대로(`/알고 싶은 게 있어요.*배우고 싶은 주제로…/`)

- [ ] **Step 1: 실패하는 테스트**

`web/src/components/flow/Home.test.tsx` 전체:
```tsx
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { Home } from "./Home";

describe("Home (S-01)", () => {
  it("offers the two entries with their PRD wording", () => {
    const onStart = vi.fn();
    render(<Home onStart={onStart} />);
    fireEvent.click(screen.getByRole("button", { name: /알고 싶은 게 있어요.*배우고 싶은 주제로, 아직 모르는 책 만나기/ }));
    fireEvent.click(screen.getByRole("button", { name: /그냥 한 권 만나고 싶어요.*밸런스 게임으로 내 취향에 맞는 한 권 만나기/ }));
    expect(onStart.mock.calls).toEqual([["target"], ["leaf"]]);
  });

  it("has no login place before P5 — only the two entries can be pressed", () => {
    render(<Home onStart={vi.fn()} />);
    expect(screen.queryByTestId("account-slot")).toBeNull();
    expect(screen.queryByText("로그인")).toBeNull();
    expect(screen.getAllByRole("button")).toHaveLength(2);
    expect(screen.getByRole("heading", { name: "갈피" })).toBeInTheDocument();
    expect(screen.getByText("읽을 책, 갈피가 안 잡힐 때")).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: 실패 확인**

Run: `cd web && npx vitest run src/components/flow/Home.test.tsx`
Expected: FAIL — `account-slot`이 아직 있음

- [ ] **Step 3: 구현**

`web/src/components/flow/Home.tsx` 전체:
```tsx
import type { CSSProperties } from "react";
import type { Entry } from "@/lib/recommend";
import { LogoMark } from "@/components/Logo";
import styles from "./Home.module.css";

interface Props { onStart: (entry: Entry) => void }

/** PRD F-01 wording. */
const ENTRIES: readonly { entry: Entry; title: string; mark: string; desc: string }[] = [
  { entry: "target", title: "알고 싶은 게 있어요", mark: "🎯", desc: "배우고 싶은 주제로, 아직 모르는 책 만나기" },
  { entry: "leaf", title: "그냥 한 권 만나고 싶어요", mark: "🍃", desc: "밸런스 게임으로 내 취향에 맞는 한 권 만나기" },
];

/** P-01: a closed cloth book with two bookmarks peeking out. Decorative only, no words. */
function ShelfBook() {
  return (
    <div className={styles.shelf} aria-hidden="true">
      <span className={styles.peek} style={{ "--tone": "var(--genre-essay)" } as CSSProperties} />
      <span className={styles.peek} style={{ "--tone": "var(--genre-korean-fiction)" } as CSSProperties} />
      <span className={styles.cover}>
        <span className={styles.spine} />
        <LogoMark className={styles.mark} width={44} />
      </span>
    </div>
  );
}

function Arrow() {
  return (
    <svg className={styles.arrow} viewBox="0 0 24 24" width="18" height="18" aria-hidden="true" focusable="false">
      <path d="M5 12h13M13 6l6 6-6 6" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

/** S-01 — no login needed to start. The header above carries the small logo; no login place until P5. */
export function Home({ onStart }: Props) {
  return (
    <div className={styles.home}>
      <section className={styles.hero}>
        <h1 className={styles.logo}>갈피</h1>
        <p className={styles.tagline}>읽을 책, 갈피가 안 잡힐 때</p>
        <ShelfBook />
      </section>
      <div className={styles.entries}>
        {ENTRIES.map((e) => (
          <button key={e.entry} type="button" className={styles.entry} onClick={() => onStart(e.entry)}>
            <span className={styles.entryText}>
              <span className={styles.entryTitle}>{e.title} <span aria-hidden="true">{e.mark}</span></span>
              <span className={styles.entryDesc}>{e.desc}</span>
            </span>
            <span className={styles.go}><Arrow /></span>
          </button>
        ))}
      </div>
    </div>
  );
}
```

`web/src/components/flow/Home.module.css` 전체:
```css
.home { display: flex; flex-direction: column; gap: var(--space-5); padding-bottom: var(--space-5); }
.hero { display: flex; flex-direction: column; align-items: center; padding-top: var(--space-4); text-align: center; }
.logo { margin: 0; font-size: 28px; line-height: 1.3; }
.tagline { margin: var(--space-1) 0 0; color: var(--ink-soft); }

/* P-01 book: landscape cloth cover, spine on the left, two frosted bookmarks peeking above (static — no blur needed). */
.shelf { position: relative; width: 224px; height: 176px; margin-top: var(--space-5); padding-top: 32px; }
.cover {
  position: relative; display: flex; align-items: center; justify-content: center;
  width: 100%; height: 144px; border-radius: var(--radius-book);
  background: var(--leather-grain), var(--leather-sheen), var(--cloth);
  box-shadow: inset 0 0 0 2px var(--cloth-edge), var(--shadow-book);
}
.spine {
  position: absolute; top: 0; bottom: 0; left: 0; width: 18px; border-radius: 3px 0 0 3px;
  background: var(--spine-shade), var(--cloth-edge);
}
.spine::before, .spine::after {
  content: ""; position: absolute; left: 3px; right: 3px; height: 2px; border-radius: 1px; background: var(--foil-line);
}
.spine::before { top: 18px; }
.spine::after { bottom: 18px; }
.mark { margin-left: 18px; color: var(--foil); }
.peek {
  position: absolute; top: 6px; width: 34px; height: 48px;
  border-radius: 17px 17px 2px 2px; background: var(--frost-fallback);
  border: var(--frost-edge); box-shadow: 0 1px 0 var(--paper-line);
}
.peek::before { /* the string */
  content: ""; position: absolute; top: -14px; left: 50%; width: 1.5px; height: 18px; margin-left: -0.75px; background: var(--tone);
}
.peek::after { /* the arched window */
  content: ""; position: absolute; top: 8px; left: 7px; right: 7px; height: 18px; border-radius: 10px 10px 2px 2px;
  background: var(--tone); opacity: 0.35;
}
.peek:nth-child(1) { left: 44px; transform: rotate(-4deg); }
.peek:nth-child(2) { right: 52px; top: 0; transform: rotate(3deg); }

.entries { display: flex; flex-direction: column; gap: var(--space-3); }
.entry {
  display: flex; align-items: center; justify-content: space-between; gap: var(--space-3);
  width: 100%; min-height: 88px; padding: var(--space-4);
  border: var(--card-edge); border-radius: var(--radius-card);
  background: var(--card-bg); color: var(--ink); font: inherit; text-align: left; cursor: pointer;
  box-shadow: var(--shadow-soft);
}
.entry:active { background: var(--paper-deep); }
.entry:focus-visible { outline: 3px solid var(--field-data); outline-offset: 2px; }
.entryText { display: flex; flex-direction: column; gap: var(--space-1); }
.entryTitle { font-family: var(--font-batang), serif; font-size: 18px; font-weight: 700; }
.entryDesc { font-size: 13px; color: var(--ink-muted); }
.go {
  display: flex; flex-shrink: 0; align-items: center; justify-content: center;
  width: 36px; height: 36px; border-radius: 50%; background: var(--paper-deep); color: var(--ink-soft);
}
.arrow { display: block; }
```

- [ ] **Step 4: 통과 확인**

Run: `cd web && npx vitest run && npm run lint && npm run e2e`
Expected: Vitest 351개 PASS / e2e 전부 PASS (`/그냥 한 권 만나고 싶어요/`·`/알고 싶은 게 있어요/` 버튼 이름 그대로)

- [ ] **Step 5: Commit**

```bash
git add web/src/components/flow/Home.tsx web/src/components/flow/Home.module.css web/src/components/flow/Home.test.tsx
git commit -m "feat(home): Stitch P-01 look — cloth book with peeking bookmarks, entry cards, no login place before P5"
```

---

### Task 4: 책갈피 저자 줄 — 200권 맞춤 검사 ×1.0·×1.15

**Files:**
- Modify: `web/src/components/Bookmark.tsx`, `web/src/components/Bookmark.module.css`, `web/src/components/GenreTag.module.css`, `web/src/components/Bookmark.test.tsx`, `web/src/components/flow/BookScene.test.tsx`, `web/e2e/design.spec.ts`

**Interfaces:**
- Consumes: `BookCard.author` (Task 1)
- Produces: 책갈피 카드 자식 순서 `[hole, window, tag, title, author, line, stitch, mark]` (e2e 맞춤 검사가 이 순서로 읽는다) · 읽어 주는 이름 `"제목, 저자, 한 줄, 장르"` (DESIGN 7절을 Task 7에서 고침)

**맞춤 판단 (검증 결과):** 160 × 344 틀(B안)에 저자 줄(12px, 한 줄)을 그냥 넣으면 ×1.15에서 61권이 넘친다(최대 약 16px). 틀 크기(사용자 결정)와 글자 크기(T-04)는 그대로 두고 **간격만** 줄이는 것이 가장 작은 고침이다: 요소 사이 4 → 3px, 위 여백 18 → 16px(구멍 7 + 8 = 15 아래), 제목 줄높이 1.4 → 1.3, 한 줄 1.35 → 1.3, 이름표 위아래 4 → 2px, "갈피" 줄높이 1.2 → 1. 저자는 한 줄 고정(`nowrap` + `…`) — ×1.0에서는 모두 온전히 보이고(두 이름이 10자를 넘으면 Task 1에서 "첫 이름 외"), ×1.15에서 아주 긴 한 사람 이름(예: 루키우스 안나이우스 세네카)만 "…"로 끝난다. 제목 두 줄·한 줄 네 줄 규칙은 그대로.

- [ ] **Step 1: 실패하는 테스트**

`web/src/components/Bookmark.test.tsx` 전체:
```tsx
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import type { ArtCombo } from "@/lib/art/combine";
import type { BookCard } from "@/lib/books/types";
import { Bookmark } from "./Bookmark";

const leaf: BookCard = {
  id: "9790000000008", entry: "leaf", title: "천천히 걷는 아침", author: "천아침", genre: "에세이", field: null,
  oneLiner: "오늘 아침은 몇 걸음이었을까요?", oneLinerStyle: "question",
};
const target: BookCard = {
  id: "9790000000101", entry: "target", title: "처음 만나는 쿼리", author: "김쿼리", genre: "데이터 분석", field: "데이터·통계",
  oneLiner: "표에서 원하는 줄만 꺼내는 쿼리를 익혀요", oneLinerStyle: "summary",
};
const art: ArtCombo = { animal: "fox", bg: "night", sky: "moon", ground: "books", rare: false };

describe("Bookmark", () => {
  it("reads title, author, one-liner and genre as one label", () => {
    render(<Bookmark card={leaf} art={art} />);
    expect(screen.getByRole("article", { name: "천천히 걷는 아침, 천아침, 오늘 아침은 몇 걸음이었을까요?, 에세이" })).toBeInTheDocument();
  });

  it("shows the author small, right under the title (PRD F-08)", () => {
    render(<Bookmark card={leaf} art={art} />);
    const title = screen.getByText("천천히 걷는 아침");
    expect(title.nextElementSibling).toHaveTextContent("천아침");
  });

  it("draws the chosen animal inside its own arched window", () => {
    const { container } = render(<Bookmark card={leaf} art={art} />);
    expect(container.querySelector("image")?.getAttribute("href")).toBe("/animals/fox.svg");
    expect(container.querySelector('[id="arch-9790000000008"]')).not.toBeNull();
    expect(container.querySelector("svg")?.getAttribute("aria-hidden")).toBe("true");
  });

  it("turns the frost off while it moves", () => {
    render(<Bookmark card={leaf} art={art} moving />);
    expect(screen.getByRole("article")).toHaveAttribute("data-moving");
  });

  it("shows a 🎯 book's topic on its field colour", () => {
    render(<Bookmark card={target} art={art} />);
    expect(screen.getByText("데이터 분석").getAttribute("style")).toContain("var(--field-data)");
  });
});
```

`web/src/components/flow/BookScene.test.tsx`의 S-05 이름 한 줄:
```ts
    expect(screen.getByRole("article", { name: "책 1, 저자 1, 한 줄 1, 통계" })).toBeInTheDocument();
```

`web/e2e/design.spec.ts` — 파일 끝의 `// C-02 text room: …` 주석부터 끝까지를 아래로 바꾼다:
```ts
// C-02 text room: every real book's title, author and one-liner must fit the 160 x 344 frame (title may clamp at 2 lines,
// the author stays on one line, the one-liner may not be cut). The second run scales the name tag, title, author,
// one-liner and "갈피" by 1.15 (Android large-text setting) and also requires the stitch line and "갈피" to sit above the
// swallowtail notch (7% of the card height, cut into the bottom centre). The book scene scales the whole bookmark
// uniformly (transform), which does not change this layout.
for (const scale of [1, 1.15]) {
  test(`every real book's title, author and one-liner fit the bookmark frame at text x${scale}`, async ({ page }) => {
    const books = JSON.parse(readFileSync("src/data/books.json", "utf8")) as { isbn: string; title: string; author: string; one_liner: string }[];
    expect(books).toHaveLength(200);
    await page.goto("/design");
    await page.evaluate(() => document.fonts.ready);

    const problems = await page.evaluate(({ all, textScale }) => {
      const card = document.querySelector("article")?.children[1] as HTMLElement;
      const [, win, tag, title, author, line, stitch, mark] = Array.from(card.children) as HTMLElement[];
      for (const el of [tag, title, author, line, mark]) el.style.fontSize = `${parseFloat(getComputedStyle(el).fontSize) * textScale}px`;
      const cardBox = card.getBoundingClientRect();
      const room = cardBox.bottom - parseFloat(getComputedStyle(card).paddingBottom) - 1;
      const notchY = cardBox.top + cardBox.height * 0.93;                // lowest point of the frame at the centre
      const naturalWindow = win.getBoundingClientRect().width * 0.76;     // art viewBox is 100 x 76
      const found: string[] = [];
      for (const b of all) {
        title.textContent = b.title;
        author.textContent = b.author;
        line.textContent = b.one_liner;
        const why: string[] = [];
        if (line.scrollHeight > line.clientHeight + 1) why.push("one-liner is cut");
        if (title.getBoundingClientRect().height > 2 * parseFloat(getComputedStyle(title).lineHeight) + 1) why.push("title over 2 lines");
        if (author.getBoundingClientRect().height > parseFloat(getComputedStyle(author).lineHeight) + 1) why.push("author over 1 line");
        // at normal size every author fits whole; at x1.15 a very long single name may end in "…" (one line kept)
        if (textScale === 1 && author.scrollWidth > author.clientWidth + 1) why.push("author is cut");
        if (line.getBoundingClientRect().bottom > stitch.getBoundingClientRect().top) why.push("text runs into the stitch line");
        if (mark.getBoundingClientRect().bottom > room + 0.5) why.push("갈피 mark leaves the card");
        if (mark.getBoundingClientRect().bottom > notchY) why.push("갈피 mark is caught by the swallowtail notch");
        if (stitch.getBoundingClientRect().bottom > mark.getBoundingClientRect().top) why.push("stitch line overlaps 갈피");
        if (Math.abs(win.getBoundingClientRect().height - naturalWindow) > 1) why.push("window is squeezed");
        if (why.length) found.push(`${b.isbn} ${b.title} / ${b.author}: ${why.join(", ")}`);
      }
      return found;
    }, { all: books.map(({ isbn, title, author, one_liner }) => ({ isbn, title, author, one_liner })), textScale: scale });
    expect(problems).toEqual([]);
  });
}
```

- [ ] **Step 2: 실패 확인**

Run: `cd web && npx vitest run src/components && npx playwright test e2e/design.spec.ts --project=phone -g "fit the bookmark"`
Expected: Vitest FAIL(저자 줄·이름 없음) / e2e FAIL — 카드 자식이 하나 모자라 `mark`가 `undefined`(evaluate 오류)

- [ ] **Step 3: 구현**

`web/src/components/Bookmark.tsx` 전체:
```tsx
import type { CSSProperties } from "react";
import type { ArtCombo } from "@/lib/art/combine";
import { toneOf } from "@/lib/books/taxonomy";
import type { BookCard } from "@/lib/books/types";
import { BookmarkArt } from "./BookmarkArt";
import { GenreTag } from "./GenreTag";
import styles from "./Bookmark.module.css";

interface Props { card: BookCard; art: ArtCombo; moving?: boolean }

/**
 * C-02 (DESIGN 4절): frost film, arched window, name tag, title, author (PRD F-08), one-liner, stitch line, swallowtail, string.
 * Never the Minumsa shape — no square card, no left vertical band, no two colour stripes.
 */
export function Bookmark({ card, art, moving = false }: Props) {
  const tone = toneOf(card);
  return (
    <article
      className={styles.bookmark}
      data-moving={moving ? "" : undefined}
      aria-label={`${card.title}, ${card.author}, ${card.oneLiner}, ${card.genre}`}
      style={{ "--tone": tone.bg } as CSSProperties}
    >
      <span className={styles.string} aria-hidden="true" />
      <div className={styles.card} aria-hidden="true">
        <span className={styles.hole} />
        <div className={styles.window}><BookmarkArt art={art} clipId={`arch-${card.id}`} /></div>
        <GenreTag card={card} />
        <h3 className={styles.title}>{card.title}</h3>
        <p className={styles.author}>{card.author}</p>
        <p className={styles.line}>{card.oneLiner}</p>
        <span className={styles.stitch} />
        <span className={styles.mark}>갈피</span>
      </div>
    </article>
  );
}
```

`web/src/components/Bookmark.module.css` 전체:
```css
/* DESIGN 4절: 160 × 344 (09-30: +24px so large text fits), string ~26px above, hole 8px, window = card − 18, swallowtail notch 7%.
   Text room: 2-line title + 1-line author + 4-line one-liner fits all 200 real books at normal and x1.15 text
   (e2e/design.spec.ts); nothing in the column may shrink. The author line (09-30) was paid for with tighter spacing, not
   smaller text: gap 4 → 3px, top padding 18 → 16px, title line-height 1.4 → 1.3, one-liner 1.35 → 1.3, name tag padding
   4 → 2px, "갈피" line-height 1.2 → 1. The notch is 7% of the height, so the bottom padding stays 25px to keep "갈피" above it.
   The book scene may scale the whole bookmark up (transform), never its parts. */
.bookmark { position: relative; width: 160px; padding-top: 26px; }
.string {
  position: absolute; top: 0; left: 50%; z-index: 1;
  width: 1.5px; height: 37px; margin-left: -0.75px; background: var(--tone);
}
.string::before {
  content: ""; position: absolute; top: -3px; left: 50%;
  width: 7px; height: 7px; margin-left: -3.5px; border-radius: 50%; background: var(--tone);
}
.card {
  position: relative;
  display: flex; flex-direction: column; align-items: center; gap: 3px;
  height: 344px; padding: 16px 9px 25px; text-align: center;
  border: var(--frost-edge); border-radius: var(--radius-bookmark);
  background: var(--frost-bg);
  -webkit-backdrop-filter: var(--frost-blur); backdrop-filter: var(--frost-blur);
  clip-path: polygon(0 0, 100% 0, 100% 100%, 50% 93%, 0 100%);
}
@supports not ((backdrop-filter: blur(1px)) or (-webkit-backdrop-filter: blur(1px))) {
  .card { background: var(--frost-fallback); }
}
/* T-03: no blur while moving (low-end Android). */
.bookmark[data-moving] .card { background: var(--frost-fallback); -webkit-backdrop-filter: none; backdrop-filter: none; }
.hole {
  position: absolute; top: 7px; left: 50%; width: 8px; height: 8px; margin-left: -4px;
  border-radius: 50%; background: var(--paper-deep); box-shadow: inset 0 0 0 1px var(--paper-line);
}
.window { flex-shrink: 0; width: 100%; }
.title {
  flex-shrink: 0; margin: 0; font-size: 15px; line-height: 1.3; color: var(--ink);
  display: -webkit-box; -webkit-box-orient: vertical; -webkit-line-clamp: 2; overflow: hidden;
}
/* PRD F-08: small, under the title, one line. On frost, so ink (DESIGN 7). */
.author {
  flex-shrink: 0; max-width: 100%; margin: -2px 0 0; font-size: 12px; line-height: 1.35; color: var(--ink);
  white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
}
.line {
  flex-shrink: 0; margin: 0; font-size: 13px; line-height: 1.3; color: var(--ink);
  display: -webkit-box; -webkit-box-orient: vertical; -webkit-line-clamp: 4; overflow: hidden;
}
.stitch { width: 100%; margin-top: auto; border-top: 1.5px dashed var(--tone); }
.mark { align-self: center; line-height: 1; font-family: var(--font-batang), serif; font-size: 12px; font-weight: 700; color: var(--ink); }
```

`web/src/components/GenreTag.module.css` 전체(위아래 여백만 2px — 끝 목록에서도 같은 알약):
```css
.tag {
  display: inline-block;
  padding: 2px var(--space-2);
  border-radius: var(--radius-pill);
  font-size: 12px;
  line-height: 1.2;
  white-space: nowrap;
}
```

- [ ] **Step 4: 통과 확인**

Run: `cd web && npx vitest run && npm run lint && npx playwright test e2e/design.spec.ts`
Expected: Vitest **352개 PASS** / design.spec 전부 PASS — 두 맞춤 테스트(×1 · ×1.15)의 `problems`가 `[]` (phone·laptop)

- [ ] **Step 5: Commit**

```bash
git add web/src/components/Bookmark.tsx web/src/components/Bookmark.module.css web/src/components/GenreTag.module.css web/src/components/Bookmark.test.tsx web/src/components/flow/BookScene.test.tsx web/e2e/design.spec.ts
git commit -m "feat(bookmark): author line under the title, all 200 books still fit at x1.0 and x1.15"
```

---

### Task 5: 책 장면(S-03~S-05) — 화면 가득, 가죽 표지, 가운데 책갈피, 데스크톱 넓게

**Files:**
- Modify: `web/src/components/flow/Book.tsx`, `web/src/components/flow/Book.module.css`, `web/src/components/flow/BookScene.tsx`, `web/src/components/flow/BookScene.module.css`, `web/src/components/flow/FirstPage.tsx`, `web/src/components/flow/FirstPage.module.css`, `web/src/components/flow/BookScene.test.tsx`, `web/src/app/globals.css`, `web/e2e/flow-target.spec.ts`
- Create: `web/e2e/scene.spec.ts`

**Interfaces:**
- Consumes: `LogoMark` (Task 2), 토큰(Task 2), 저자 줄 있는 `Bookmark` (Task 4), `OPEN_COVER`·`FLIP_PAGE` (`lib/motion.ts`)
- Produces: `COVER_ZOOM = 1.2` (`Book.tsx`) · `FirstPageTitle({ entry })` (`FirstPage.tsx`, S-04 왼쪽 쪽) · 책 장면 뿌리에 `data-wide-scene` · CSS 변수 `--book-h`(책 높이), `--bm-scale`(책갈피 배율) — `BookScene.module.css`의 `.scene`에서만 정한다. `Book`은 `var(--book-h, 340px)`를 읽는다

**크기 규칙 (검증한 값):**

| 화면 | 책갈피 배율 | 책 높이 | 확인 |
|---|---|---|---|
| 휴대폰, 높이 < 780 | 1 | clamp(340, 100dvh − 304, 420) | 375 × 667 → 363px, 스크롤 없음 |
| 휴대폰, 높이 ≥ 780 | 1.25 | clamp(420, 100dvh − 332, 520) | Pixel 7(839) → 507 |
| 휴대폰, 높이 ≥ 880 | 1.4 | clamp(500, 100dvh − 348, 600) | 430 × 932 → 584 |
| 데스크톱(폭 ≥ 768) | 1.25 / 높이 ≥ 880: 1.4 / ≥ 1000: 1.6 | min(100dvh − 198 − 106 × 배율, (min(92vw, 1000) − 10) / 1.43), 폭 = 높이 × 1.43 | 1440 × 900 → 약 791 × 554 |

높이에서 빼는 값 = 머리글 52 + main 여백 8 + 16 + 책 위 공간(106 × 배율 + 6, 책갈피가 책 위로 나오는 부분) + 틈 16 + 버튼 44 + 바닥 표시 52 + 여유 4. 책갈피 카드는 책 안으로 264 × 배율만 들어가므로 모든 구간에서 책 높이보다 짧다. 닫힌 책(S-03)은 1.2배로 보이다 펼치면서 1배가 된다 — 확대는 아래쪽 기준(`originY: 1`)이라 책 위 공간(0.2 × 책 높이 < 106 × 배율)으로만 커지고 아래 안내·버튼을 가리지 않는다. 데스크톱의 펼친 책은 두 쪽이 1 : 1.4(책 모양), 휴대폰은 기둥 폭에 맞춰 쪽이 세로로 긴 기록부 모양이다.

- [ ] **Step 1: 실패하는 테스트**

`web/e2e/scene.spec.ts`:
```ts
import { expect, type Page } from "@playwright/test";
import { test } from "./helpers";

// Design pass: from S-03 on, the book fills the column and the whole scene fits the screen without page scroll.
test.use({ reducedMotion: "reduce" });

const noPageScroll = (page: Page) => page.evaluate(() => document.documentElement.scrollHeight <= window.innerHeight);
const box = async (page: Page, selector: string) => {
  const b = await page.locator(selector).first().boundingBox();
  if (!b) throw new Error(`${selector} has no box`);
  return b;
};

/** 🎯 with one chip → S-03, checking each book step on the way to the first bookmark. */
async function walkTheBook(page: Page) {
  await page.goto("/");
  await page.getByRole("button", { name: /알고 싶은 게 있어요/ }).click();
  await page.getByRole("button", { name: "데이터 분석", exact: true }).click();
  await page.getByRole("button", { name: "책 펼치기" }).click();                  // S-02 submit

  const cover = page.getByRole("button", { name: "책 펼치기" });                  // S-03: the closed book
  await expect(page.getByText("눌러서 펼치기")).toBeVisible();
  const viewport = page.viewportSize();
  if (!viewport) throw new Error("viewport is not set");
  const closed = await cover.boundingBox();
  expect(closed?.height ?? 0).toBeGreaterThanOrEqual(viewport.height * 0.6);      // the cover fills the screen's height
  expect(await noPageScroll(page)).toBe(true);

  await cover.click();                                                            // S-04
  await expect(page.getByRole("heading", { name: "당신이 찾는 책" })).toBeVisible();
  await expect(page.getByRole("button", { name: "다음 장" })).toBeEnabled();
  expect(await noPageScroll(page)).toBe(true);

  await page.getByRole("button", { name: "다음 장" }).click();                    // S-05
  await expect(page.getByText("1 / 5")).toBeVisible();
  await expect(page.getByRole("button", { name: "궁금해요" })).toBeEnabled();
  expect(await noPageScroll(page)).toBe(true);

  const column = await box(page, ".column");
  const bookmark = await box(page, "article");
  const folio = await page.getByText("1 / 5").boundingBox();
  const curious = await page.getByRole("button", { name: "궁금해요" }).boundingBox();
  // centred on the gutter = the middle of the column, between the two pages
  expect(Math.abs(bookmark.x + bookmark.width / 2 - (column.x + column.width / 2))).toBeLessThanOrEqual(2);
  // buttons below the book (the folio sits on the page's bottom edge)
  expect(curious?.y ?? 0).toBeGreaterThan((folio?.y ?? 0) + (folio?.height ?? 0));
  return { bookmark, viewport };
}

test("S-03 → S-05 fit a 375 × 667 phone with the bookmark in the gutter", async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 667 });
  const { bookmark } = await walkTheBook(page);
  expect(bookmark.width).toBeGreaterThanOrEqual(159);                              // the 160px frame, never smaller
});

test("on a tall screen the book and the bookmark grow", async ({ page }) => {
  const { bookmark, viewport } = await walkTheBook(page);                         // phone: Pixel 7 · laptop: 1440 × 900
  expect(viewport.height).toBeGreaterThanOrEqual(780);
  expect(bookmark.width).toBeGreaterThanOrEqual(160 * 1.25 - 1);
});

test("desktop: the book scene leaves the 430px column, buttons stay a short row", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "laptop", "desktop layout only");
  const { viewport } = await walkTheBook(page);
  const folio = await page.getByText("1 / 5").boundingBox();                     // bottom right of the right-hand page
  expect((folio?.x ?? 0) + (folio?.width ?? 0) - viewport.width / 2).toBeGreaterThan(215);
  const pass = await page.getByRole("button", { name: "패스" }).boundingBox();
  const curious = await page.getByRole("button", { name: "궁금해요" }).boundingBox();
  expect((curious?.x ?? 0) + (curious?.width ?? 0) - (pass?.x ?? 0)).toBeLessThanOrEqual(480);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
});
```

`web/e2e/flow-target.spec.ts` — 노트북 단언(책갈피가 430 기둥 안)을 T-04b 새 규칙으로 바꾼다:
```ts
  if (testInfo.project.name === "laptop") {
    // DESIGN T-04b (09-30): on a desktop the book scene leaves the 430px column — the bookmark stays on screen, no sideways scroll
    const column = await page.locator(".column").boundingBox();
    const bookmark = await page.getByRole("article").boundingBox();
    if (!column || !bookmark) throw new Error("layout boxes missing");
    expect(column.width).toBeGreaterThan(430);
    expect(bookmark.x).toBeGreaterThanOrEqual(0);
    expect(bookmark.x + bookmark.width).toBeLessThanOrEqual(1440);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  }
```
같은 테스트에서 `await expect(page.getByRole("listitem")).toHaveCount(3);` 바로 다음 줄에 추가(목록은 다시 기둥 안):
```ts
  if (testInfo.project.name === "laptop") expect((await page.locator(".column").boundingBox())?.width).toBe(430);  // back in the column
```

`web/src/components/flow/BookScene.test.tsx` — `it("S-04: summary on the page, one edit …` **앞에** 추가:
```tsx
  it("S-04: the title page faces the summary once the book is open", () => {
    render(<BookScene state={{ ...first, entry: "leaf", choices: ["A", "A", "A", "A", "A", "A", "A", "A", "A"] }} {...handlers()} />);
    const heading = screen.getByRole("heading", { name: "당신이 찾는 책" });
    const summaryPage = screen.getByText("분량").closest("ul")?.parentElement;
    expect(summaryPage).toBeTruthy();
    expect(summaryPage?.contains(heading)).toBe(false);
  });

```

- [ ] **Step 2: 실패 확인**

Run: `cd web && npx vitest run src/components/flow/BookScene.test.tsx && npx playwright test e2e/scene.spec.ts e2e/flow-target.spec.ts`
Expected: Vitest FAIL(제목과 요약이 같은 쪽) / scene.spec FAIL — 닫힌 표지 높이가 화면의 60% 미만(340px), 375 × 667에서 머리글 때문에 스크롤, 책갈피가 가운데가 아님 / flow-target laptop FAIL — 기둥이 430

- [ ] **Step 3: 책(C-01) — 가죽 표지, 책등, 라벨, 천 테두리**

`web/src/components/flow/Book.tsx` 전체:
```tsx
"use client";
import type { ReactNode } from "react";
import { motion } from "motion/react";
import { LogoMark } from "@/components/Logo";
import { FLIP_PAGE, OPEN_COVER } from "@/lib/motion";
import styles from "./Book.module.css";

/** S-03: the closed book is shown this much larger (its cover is the thing to see and press); it settles to 1 as it opens. */
export const COVER_ZOOM = 1.2;

interface Props {
  open: boolean;
  onPress?: () => void;   // S-03 only
  left?: ReactNode;       // inside of the cover once open
  right?: ReactNode;      // right-hand page
}

/**
 * C-01 — leather cover over a cream page (CSS 3D: perspective + backface), with a cloth rim around the open spread.
 * Closed, the cover is centred and zoomed; opening swings it left around the spine (T-06 open-cover) while the book settles
 * to full size. The zoom grows upward (origin at the bottom) into the room the scene keeps for the bookmark, so nothing
 * below moves. Transform only — no filter, no animated shadow. initial={false}: a resumed flow does not replay it.
 */
export function Book({ open, onPress, left, right }: Props) {
  return (
    <motion.div
      className={styles.book}
      style={{ originY: 1 }}
      initial={false}
      animate={open ? { x: "0%", scale: 1 } : { x: `${-25 * COVER_ZOOM}%`, scale: COVER_ZOOM }}
      transition={OPEN_COVER}
    >
      <div className={styles.board} aria-hidden="true" />
      <div className={styles.pageRight}>{right}</div>
      <motion.div className={styles.cover} initial={false} animate={{ rotateY: open ? -180 : 0 }} transition={OPEN_COVER}>
        <button
          type="button"
          className={styles.front}
          onClick={onPress}
          disabled={!onPress}
          aria-label="책 펼치기"
          aria-hidden={open || undefined}
          tabIndex={open ? -1 : undefined}
        >
          <span className={styles.spine} aria-hidden="true"><span className={styles.spineTitle}>갈피</span></span>
          <span className={styles.frame} aria-hidden="true">
            <span className={styles.plate}>
              <span className={styles.coverTitle}>갈피</span>
              <span className={styles.coverLine}>읽을 책, 갈피가 안 잡힐 때</span>
            </span>
            <LogoMark className={styles.coverMark} width={40} />
          </span>
        </button>
        <div className={styles.back}><div className={styles.pageLeft}>{left}</div></div>
      </motion.div>
    </motion.div>
  );
}

/** Lined paper. Each new `turn` (> 0) flips one sheet over the page once (T-06 flip-page). */
export function RuledPage({ turn = 0 }: { turn?: number }) {
  return (
    <div className={styles.ruled}>
      {turn > 0 && (
        <motion.div
          key={turn}
          className={styles.sheet}
          aria-hidden="true"
          initial={{ rotateY: 0, opacity: 1 }}
          animate={{ rotateY: -180, opacity: 0 }}
          transition={FLIP_PAGE}
        />
      )}
    </div>
  );
}
```

`web/src/components/flow/Book.module.css` 전체:
```css
/* Spread = two pages side by side; the cover is the right half and turns around the spine (the centre line).
   The height comes from the scene (--book-h). The cover boards stand 5px out around the pages (the cloth rim);
   the scene keeps that 5px free on each side. */
.book { position: relative; width: 100%; height: var(--book-h, 340px); perspective: 1600px; }
/* back board under the right-hand page — also the closed book's back cover edge */
.board {
  position: absolute; top: -5px; bottom: -5px; left: 50%; right: -5px;
  border-radius: var(--radius-book);
  background: var(--leather-grain), var(--cloth);
  box-shadow: var(--shadow-book);
}
.pageRight {
  position: absolute; top: 0; bottom: 0; left: 50%; width: 50%; overflow: hidden;
  background: var(--paper); border-radius: 0 8px 8px 0;
  box-shadow: inset 14px 0 14px -12px var(--shadow-ink);      /* the gutter */
}
.cover {
  position: absolute; top: -5px; bottom: -5px; left: 50%; right: -5px; z-index: 2;
  transform-style: preserve-3d; transform-origin: left center;
}
.front, .back { position: absolute; inset: 0; backface-visibility: hidden; -webkit-backface-visibility: hidden; }
/* A-06: leather in CSS only — grain dots + a soft sheen over the cloth colour; blind-stamped frame, a paper title
   label like an old record book (P-04 "기록부"), foil ornament. The label reuses the S-01 tagline — no new words. */
.front {
  display: block; width: 100%; padding: 0; border: 0;
  border-radius: var(--radius-book);
  background: var(--leather-grain), var(--leather-sheen), var(--cloth);
  box-shadow: inset 0 0 0 1px var(--cloth-edge), var(--shadow-book);
  color: var(--foil); font: inherit; cursor: pointer;
}
.front:disabled { cursor: default; }
.front:focus-visible { outline: 3px solid var(--field-data); outline-offset: 3px; }
.spine {
  position: absolute; top: 0; bottom: 0; left: 0; width: 24px;
  display: flex; align-items: center; justify-content: center;
  border-radius: 2px 0 0 2px;
  background: var(--spine-shade), var(--cloth-edge);
}
.spine::before, .spine::after {   /* raised bands */
  content: ""; position: absolute; left: 4px; right: 4px; height: 2px; border-radius: 1px; background: var(--foil-line);
}
.spine::before { top: 22px; }
.spine::after { bottom: 22px; }
.spineTitle {
  writing-mode: vertical-rl; font-family: var(--font-batang), serif; font-size: 12px; font-weight: 700;
  letter-spacing: 6px; line-height: 1; color: var(--foil);
}
.frame {
  position: absolute; top: 18px; bottom: 18px; left: 38px; right: 16px;
  display: flex; flex-direction: column; align-items: center; justify-content: space-between;
  padding: 22% var(--space-3) 18%;
  border: 1px solid var(--foil-line); border-radius: 6px;
}
.plate {
  display: flex; flex-direction: column; align-items: center; gap: var(--space-2);
  width: 100%; padding: var(--space-4) var(--space-2);
  border-radius: 4px; background: var(--paper); color: var(--ink);
  box-shadow: inset 0 0 0 3px var(--paper), inset 0 0 0 4px var(--paper-line), var(--shadow-plate);
}
.coverTitle { font-family: var(--font-batang), serif; font-size: 28px; font-weight: 700; letter-spacing: 6px; line-height: 1; padding-left: 6px; }
.coverLine { font-size: 12px; line-height: 1.4; color: var(--ink-muted); word-break: keep-all; text-wrap: balance; }
.coverMark { display: block; color: var(--foil); }
.back {
  transform: rotateY(180deg); padding: 5px 0 5px 5px;
  background: var(--leather-grain), var(--cloth); border-radius: 10px 2px 2px 10px;   /* --radius-book, mirrored */
}
.pageLeft {
  position: relative; height: 100%; overflow: hidden;
  background: var(--paper); border-radius: 8px 0 0 8px;
  box-shadow: inset -14px 0 14px -12px var(--shadow-ink);    /* the gutter */
}
.ruled {
  position: absolute; inset: 0; perspective: 1600px;
  background: repeating-linear-gradient(to bottom, transparent 0 27px, var(--paper-rule) 27px 28px);
}
.sheet {
  position: absolute; inset: 0; transform-origin: left center;
  background: var(--paper); border-left: 1px solid var(--paper-line);
}
```

- [ ] **Step 4: 첫 장(C-10) — 왼쪽 제목 쪽, 오른쪽 요약**

`web/src/components/flow/FirstPage.tsx` 전체:
```tsx
import { LogoMark } from "@/components/Logo";
import type { BalanceChoice, Entry } from "@/lib/recommend";
import { lengthWord, targetSummary, tasteLines } from "@/lib/flow/summary";
import type { TargetForm } from "@/lib/flow/target";
import type { GoalMatch } from "@/lib/goal/match";
import styles from "./FirstPage.module.css";

interface Props {
  entry: Entry;
  choices: readonly BalanceChoice[];
  form: TargetForm;
  goal: GoalMatch | null;
  notices: readonly string[];
}

const DOTS = { 2: "●●", 1: "●○", 0: "○○" } as const;

/** S-04 left page (inside of the cover): the chapter title, like a book's first page. */
export function FirstPageTitle({ entry }: { entry: Entry }) {
  return (
    <div className={styles.titlePage}>
      <LogoMark className={styles.ornament} width={32} />
      <h2 className={styles.title}>당신이 찾는 책</h2>
      {entry === "leaf" && <p className={styles.caption}>당신의 책 취향</p>}
    </div>
  );
}

/** S-04 right page (C-10) + honest notes (C-14). 🍃 shows the taste from the raw answers — never a type name. */
export function FirstPage({ entry, choices, form, goal, notices }: Props) {
  return (
    <div className={styles.page}>
      {entry === "leaf" ? (
        <ul className={styles.rows}>
          {tasteLines(choices).map((line) => (
            <li key={line.axis} className={styles.row}>
              <span>{line.text}</span>
              <span className={styles.dots} aria-hidden="true">{DOTS[line.strength]}</span>
            </li>
          ))}
          <li className={styles.row}><span>분량</span><span>{lengthWord(choices[8])}</span></li>
        </ul>
      ) : (
        <dl className={styles.rows}>
          {targetSummary(form, goal).map((r) => (
            <div key={r.label} className={styles.row}><dt>{r.label}</dt><dd>{r.value}</dd></div>
          ))}
        </dl>
      )}
      {notices.map((n) => <p key={n} className={styles.note} role="status">{n}</p>)}
    </div>
  );
}
```

`web/src/components/flow/FirstPage.module.css` 전체:
```css
/* S-04 spread: title page on the left, the summary on the right. Rows are ledger lines. */
.titlePage {
  position: absolute; inset: 0;
  display: flex; flex-direction: column; align-items: center; justify-content: center; gap: var(--space-2);
  padding: var(--space-4) var(--space-3); text-align: center;
}
.ornament { color: var(--ink-muted); }
.title { margin: 0; font-size: 22px; line-height: 1.35; word-break: keep-all; }
.caption { margin: 0; font-size: 13px; color: var(--ink-muted); }
.page {
  position: absolute; inset: 0; overflow-y: auto;
  display: flex; flex-direction: column; gap: var(--space-3);
  padding: var(--space-4) var(--space-3) var(--space-4) var(--space-4); background: var(--paper);
}
.rows { display: flex; flex-direction: column; margin: 0; padding: 0; list-style: none; }
.row {
  display: flex; justify-content: space-between; gap: var(--space-2); padding: 6px 0;
  border-bottom: 1px dashed var(--paper-line);
  font-size: 13px; line-height: 1.5; word-break: keep-all;
}
.row dt { color: var(--ink-muted); }
/* a 30-character goal with no spaces has no keep-all break point: let it wrap anywhere */
.row dd { min-width: 0; margin: 0; text-align: right; overflow-wrap: anywhere; }
.dots { letter-spacing: 1px; white-space: nowrap; }
@media (min-height: 780px) {
  .row { font-size: 14px; }
}
/* T-04b desktop: the pages are about 400px wide — the words grow with them. */
@media (min-width: 768px) {
  .title { font-size: 28px; }
  .caption { font-size: 15px; }
  .page { padding: var(--space-5) var(--space-5) var(--space-5) var(--space-6); }
  .row { padding: var(--space-2) 0; font-size: 16px; }
  .note { font-size: 14px; }
}
/* C-14: a paper slip, taped to the page. */
.note {
  position: relative; margin: var(--space-2) 0 0; padding: var(--space-3) var(--space-3) var(--space-2);
  border-radius: var(--radius-card); background: var(--paper-deep);
  font-size: 12px; line-height: 1.5; word-break: keep-all;
}
.note::before {
  content: ""; position: absolute; top: -5px; left: 50%; width: 40px; height: 10px; margin-left: -20px;
  border-radius: 2px; background: var(--tape); box-shadow: 0 0 0 1px var(--paper-line);
}
```

- [ ] **Step 5: 장면 — 크기, 가운데 책갈피, 쪽 번호, 데스크톱**

`web/src/components/flow/BookScene.tsx` 전체 (바뀐 곳: `FirstPageTitle`을 왼쪽 쪽에, 뿌리에 `data-wide-scene`, "n / 전체"를 버튼 줄에서 책 위 `folio`로, 책갈피를 `.scaled`로 감쌈 — 이벤트·상태·버튼은 그대로):
```tsx
"use client";
import { useState } from "react";
import { AnimatePresence, motion, type Variants } from "motion/react";
import { Bookmark } from "@/components/Bookmark";
import { Button } from "@/components/Button";
import type { FlowState, Reaction } from "@/lib/flow/state";
import { firstPageNotices } from "@/lib/flow/summary";
import { BOOKMARK_AWAY, BOOKMARK_DOWN, BOOKMARK_RISE } from "@/lib/motion";
import { Book, RuledPage } from "./Book";
import { FirstPage, FirstPageTitle } from "./FirstPage";
import styles from "./BookScene.module.css";

/** No wording in the docs for a failed draw request — new copy, logged in context.md. */
export const DRAW_FAILED = "책을 불러오지 못했어요";

/** T-06: rise with a bounce; 궁금해요 flies up with a tilt; 패스 drops down. */
const BOOKMARK: Variants = {
  hidden: { y: 120, opacity: 0, rotate: 0 },
  shown: { y: 0, opacity: 1, rotate: 0, transition: BOOKMARK_RISE },
  gone: (reaction: Reaction) => (reaction === "curious"
    ? { y: -180, rotate: -8, opacity: 0, transition: BOOKMARK_AWAY }
    : { y: 180, opacity: 0, transition: BOOKMARK_DOWN }),
};

interface Props {
  state: FlowState;
  onOpen: () => void;
  onEdit: () => void;
  onNext: () => void;
  onRetry: () => void;
  onReact: (reaction: Reaction) => void;
  onHome: () => void;
}

/**
 * S-03 · S-04 · S-05 share one book so the cover keeps its place between steps. The book fills the column; the bookmark
 * rises out of the gutter, centred between the two pages. Buttons sit below the book; the page count is the folio.
 */
export function BookScene({ state, onOpen, onEdit, onNext, onRetry, onReact, onHome }: Props) {
  const [busy, setBusy] = useState(true);            // a bookmark is still moving: reactions wait (and frost stays off)
  const [last, setLast] = useState<Reaction>("pass");
  const { step, status, draw } = state;
  const picks = draw?.picks ?? [];
  const pick = step === "bookmarks" ? picks[state.index] : undefined;
  const noBooks = status === "ready" && picks.length === 0;
  const editLabel = state.goal && !state.goal.matched ? "다시 쓰기" : "한 번 고치기";

  const react = (reaction: Reaction) => {
    if (busy) return;
    setBusy(true);
    setLast(reaction);
    onReact(reaction);
  };

  const left = step === "first" && state.opened ? <FirstPageTitle entry={state.entry ?? "leaf"} /> : <RuledPage />;
  const right = step === "bookmarks"
    ? <RuledPage turn={state.index} />
    : state.opened && (
      <FirstPage
        entry={state.entry ?? "leaf"}
        choices={state.choices}
        form={state.form}
        goal={state.goal}
        notices={firstPageNotices(state.entry, state.goal, draw)}
      />
    );

  return (
    <div className={styles.scene} data-wide-scene="">
      <div className={styles.stage}>
        <Book open={state.opened} onPress={step === "book" ? onOpen : undefined} left={left} right={right} />
        {pick && <p className={styles.folio}>{`${state.index + 1} / ${picks.length}`}</p>}
        {pick && (
          <div className={styles.slot}>
            <AnimatePresence mode="wait" custom={last}>
              <motion.div
                key={pick.card.id}
                custom={last}
                variants={BOOKMARK}
                initial="hidden"
                animate="shown"
                exit="gone"
                onAnimationComplete={(definition) => { if (definition === "shown") setBusy(false); }}
              >
                <div className={styles.scaled}><Bookmark card={pick.card} art={pick.art} moving={busy} /></div>
              </motion.div>
            </AnimatePresence>
          </div>
        )}
      </div>

      {step === "book" && <p className={styles.hint}>눌러서 펼치기</p>}

      {step === "first" && (
        <div className={styles.actions}>
          {status === "error" && <p className={styles.error} role="alert">{DRAW_FAILED}</p>}
          {status === "error" ? (
            <>
              <Button variant="secondary" onClick={onHome}>처음으로</Button>
              <Button onClick={onRetry}>다시 시도</Button>
            </>
          ) : (
            <>
              {!state.edited && <Button variant="secondary" onClick={onEdit}>{editLabel}</Button>}
              {noBooks
                ? <Button onClick={onHome}>처음으로</Button>
                : <Button onClick={onNext} disabled={status !== "ready"}>다음 장</Button>}
            </>
          )}
        </div>
      )}

      {step === "bookmarks" && pick && (
        <div className={styles.actions}>
          <Button variant="secondary" disabled={busy} onClick={() => react("pass")}>패스</Button>
          <Button disabled={busy} onClick={() => react("curious")}>궁금해요</Button>
        </div>
      )}
    </div>
  );
}
```

`web/src/components/flow/BookScene.module.css` 전체:
```css
/* The scene fills the column (design pass 09-30): the book is the full width and as tall as the screen allows without
   page scroll on a 375 × 667 phone; on taller screens the book and the bookmark grow (--book-h, --bm-scale).
   Room above the book = the bookmark's part that sticks out (DESIGN 4절: 80px card + 26px string = 106px at scale 1).
   The bookmark grows by a uniform transform, so the text-fit check of the 160 × 344 frame (e2e/design.spec.ts) holds. */
.scene {
  --book-h: clamp(340px, calc(100dvh - 304px), 420px);
  --bm-scale: 1;
  display: flex; flex-direction: column; gap: var(--space-4);
  padding-top: calc(106px * var(--bm-scale) + 6px);
}
/* Height left for the book = viewport − header 52 − main padding 8 + 16 − room above (106 × scale + 6) − gap 16
   − buttons 44 − footer 52, less 4px of slack. */
@media (min-height: 780px) {
  .scene { --book-h: clamp(420px, calc(100dvh - 332px), 520px); --bm-scale: 1.25; }
}
@media (min-height: 880px) {
  .scene { --book-h: clamp(500px, calc(100dvh - 348px), 600px); --bm-scale: 1.4; }
}
/* T-04b desktop (≥ 768px wide): the scene has left the 430px column (globals.css). The spread keeps book proportions —
   two 1 : 1.4 pages, 1.43 : 1 — as large as the screen allows and at most 1000px wide; the bookmark grows by height
   band; the buttons stay a centred row of at most 480px. Kept after the phone bands so it wins on a desktop. */
@media (min-width: 768px) {
  .scene {
    --bm-scale: 1.25;
    --book-h: min(calc(100dvh - 198px - 106px * var(--bm-scale)), calc((min(92vw, 1000px) - 10px) / 1.43));
  }
}
@media (min-width: 768px) and (min-height: 880px) {
  .scene { --bm-scale: 1.4; }
}
@media (min-width: 768px) and (min-height: 1000px) {
  .scene { --bm-scale: 1.6; }
}
.stage { position: relative; margin: 0 5px; }   /* the cloth rim stands 5px out */
@media (min-width: 768px) {
  .stage { width: calc(var(--book-h) * 1.43); margin: 0 auto; }
}
/* Centred on the gutter (the spine line), between the two pages. */
.slot {
  position: absolute; top: calc(-106px * var(--bm-scale)); left: 0; right: 0; z-index: 3;
  display: flex; justify-content: center; pointer-events: none;
}
.scaled { transform: scale(var(--bm-scale)); transform-origin: 50% 0; }
/* P-05: the page count sits on the page like a folio, bottom right — clear of the centred bookmark. */
.folio {
  position: absolute; right: var(--space-3); bottom: var(--space-2); z-index: 1; margin: 0;
  padding: 0 var(--space-2); border-radius: var(--radius-pill); background: var(--paper-deep);
  font-size: 12px; line-height: 22px; color: var(--ink-soft);
}
.hint { margin: 0; text-align: center; font-size: 13px; color: var(--ink-muted); }
.actions { display: flex; flex-wrap: wrap; justify-content: center; align-items: center; gap: var(--space-3); }
.actions > button { flex: 1 1 0; min-width: 120px; }
.error { flex-basis: 100%; margin: 0; text-align: center; font-size: 13px; }
@media (min-width: 768px) {
  .actions { width: 100%; max-width: 480px; margin: 0 auto; }
}
```

`web/src/app/globals.css` — `h1, h2, h3, .serif { … }` 줄 **앞에** 추가:
```css
/* T-04b (09-30): on a desktop the book scenes (S-03~S-05) leave the 430px column and grow with the screen. */
@media (min-width: 768px) {
  .column:has([data-wide-scene]) { max-width: none; }
}
```

- [ ] **Step 6: 통과 확인**

Run: `cd web && npm run typecheck && npm run lint && npx vitest run && npm run e2e`
Expected: 오류 0 / Vitest **353개 PASS** / e2e 전부 PASS — phone 27 + laptop 28, 데스크톱 전용 1개는 phone에서 skip. 특히 `scene.spec.ts`: 375 × 667·Pixel 7·1440 × 900에서 S-03·S-04·S-05 세로 스크롤 없음, 책갈피 가운데(±2px), 버튼이 책 아래, 노트북에서 오른쪽 쪽이 화면 가운데에서 215px 넘게, 버튼 줄 ≤ 480px, 가로 스크롤 없음

- [ ] **Step 7: 눈으로 확인 (휴대폰 흔들림·성능)**

`npm run dev` → 크롬 개발자 도구 기기 모드 375 × 667, 430 × 932, 그리고 창 1440 × 900에서 🍃 한 번 완주. 확인할 것: 닫힌 책을 누르면 표지가 왼쪽으로 넘어가며 책이 1배로 줄어든다(1초) / 책갈피가 두 쪽 사이에서 올라오고, 올라오는 동안은 흐림이 꺼져 있다가 멈추면 켜진다 / 궁금해요 = 위로 기울며, 패스 = 아래로 / 오른쪽 쪽이 한 장 넘어간다 / Performance 패널 CPU 4× 느리게에서 긴 프레임이 이어지지 않는다(움직이는 것은 transform·opacity뿐) / `prefers-reduced-motion`(렌더링 탭)이면 확대·회전 없이 바로 바뀐다

- [ ] **Step 8: Commit**

```bash
git add web/src/components/flow/Book.tsx web/src/components/flow/Book.module.css web/src/components/flow/BookScene.tsx web/src/components/flow/BookScene.module.css web/src/components/flow/FirstPage.tsx web/src/components/flow/FirstPage.module.css web/src/components/flow/BookScene.test.tsx web/src/app/globals.css web/e2e/scene.spec.ts web/e2e/flow-target.spec.ts
git commit -m "feat(book): the book fills the screen, leather cover, bookmark rises from the gutter, wide on desktop"
```

---

### Task 6: S-02 🍃 밸런스·S-02 🎯 입력·궁금해요 목록

**Files:**
- Modify: `web/src/components/flow/BalanceGame.module.css`, `web/src/components/flow/HoldButton.module.css`, `web/src/components/flow/TargetInput.tsx`, `web/src/components/flow/TargetInput.module.css`, `web/src/components/flow/EndList.tsx`, `web/src/components/flow/EndList.module.css`, `web/src/components/flow/EndList.test.tsx`

**Interfaces:**
- Consumes: 토큰(Task 2), `toneOf` (`lib/books/taxonomy`), `BookCard.author` (Task 1)
- Produces: 모양만. 버튼 이름·이벤트 그대로(🎯 주 버튼 이름은 아이콘이 `aria-hidden`이라 계속 "책 펼치기")

- [ ] **Step 1: 실패하는 테스트**

`web/src/components/flow/EndList.test.tsx`의 목록 글자 단언:
```ts
    expect(screen.getAllByRole("listitem").map((li) => li.textContent)).toEqual(["에세이책 a저자 a한 줄 a", "에세이책 c저자 c한 줄 c"]);
```

- [ ] **Step 2: 실패 확인**

Run: `cd web && npx vitest run src/components/flow/EndList.test.tsx`
Expected: FAIL — 저자가 목록에 없음

- [ ] **Step 3: 궁금해요 목록**

`web/src/components/flow/EndList.tsx` 전체:
```tsx
import type { CSSProperties } from "react";
import { Button } from "@/components/Button";
import { GenreTag } from "@/components/GenreTag";
import { toneOf } from "@/lib/books/taxonomy";
import type { PickView, Reaction } from "@/lib/flow/state";
import styles from "./EndList.module.css";

interface Props { picks: readonly PickView[]; reactions: readonly Reaction[]; onHome: () => void }

/** P3 stand-in for S-06/S-08: the 궁금해요 books in order, then [처음으로]. S-06 proper (cover, intro, YES24) is P4. */
export function EndList({ picks, reactions, onHome }: Props) {
  const curious = picks.filter((_, i) => reactions[i] === "curious");
  return (
    <section className={styles.end}>
      {curious.length > 0 && (
        <>
          <h1 className={styles.title}>궁금해요 책</h1>
          <ul className={styles.list}>
            {curious.map((p) => (
              <li key={p.card.id} className={styles.item} style={{ "--tone": toneOf(p.card).bg } as CSSProperties}>
                <GenreTag card={p.card} />
                <strong className={styles.bookTitle}>{p.card.title}</strong>
                <span className={styles.author}>{p.card.author}</span>
                <span className={styles.line}>{p.card.oneLiner}</span>
              </li>
            ))}
          </ul>
        </>
      )}
      <Button onClick={onHome}>처음으로</Button>
    </section>
  );
}
```

`web/src/components/flow/EndList.module.css` 전체 (끈은 오른쪽 위의 가는 선 — 왼쪽 색 띠 금지):
```css
.end { display: flex; flex-direction: column; gap: var(--space-5); padding-top: var(--space-4); }
.title { margin: 0; font-size: 20px; }
.list { display: flex; flex-direction: column; gap: var(--space-3); margin: 0; padding: 0; list-style: none; }
/* Each curious book on a frosted slip with its bookmark string on top — never a left colour band (DESIGN 1-3). */
.item {
  position: relative;
  display: flex; flex-direction: column; align-items: flex-start; gap: var(--space-1);
  padding: var(--space-4); border: var(--card-edge); border-radius: var(--radius-card);
  background: var(--card-bg); box-shadow: var(--shadow-soft); word-break: keep-all;
}
.item::before {
  content: ""; position: absolute; top: -8px; right: 24px; width: 1.5px; height: 16px; background: var(--tone);
}
.bookTitle { font-family: var(--font-batang), serif; font-size: 16px; line-height: 1.45; }
.author { font-size: 12px; color: var(--ink-muted); }
.line { font-size: 13px; color: var(--ink-soft); }
```

- [ ] **Step 4: S-02 🍃 (P-02)**

`web/src/components/flow/BalanceGame.module.css` 전체:
```css
.game { display: flex; flex-direction: column; gap: var(--space-4); padding-top: var(--space-2); }
.progress { display: grid; grid-template-columns: repeat(9, 1fr); gap: var(--space-1); margin: 0; padding: 0; list-style: none; }
.cell { height: 6px; border-radius: var(--radius-pill); background: var(--paper-line); }
.cell[data-state="done"] { background: var(--cloth); }
.cell[data-state="unsure"] { background: var(--ink-muted); opacity: 0.45; }
.cell[data-state="now"] { background: var(--ink-muted); }
.count { margin: 0; font-size: 12px; color: var(--ink-muted); text-align: right; }
.question { margin: var(--space-2) 0 var(--space-4); font-size: 20px; line-height: 1.5; text-align: center; word-break: keep-all; }
/* P-02: two frosted cards resting on the paper, "vs" in a small seal between. The choice reads in the title font.
   P-02 note: choices wrapped too narrowly — two wide cards, keep-all line breaks. */
.pair { display: grid; grid-template-columns: 1fr auto 1fr; align-items: stretch; gap: var(--space-2); }
.card {
  min-height: 160px; padding: var(--space-5) var(--space-3);
  border: var(--card-edge); border-radius: var(--radius-card);
  background: var(--card-bg); color: var(--ink); box-shadow: var(--shadow-soft);
  font: inherit; font-family: var(--font-batang), serif; font-size: 16px; font-weight: 700; line-height: 1.6;
  word-break: keep-all; cursor: pointer;
}
.card:active { background: var(--paper-deep); }
.card:focus-visible { outline: 3px solid var(--field-data); outline-offset: 2px; }
.vs {
  align-self: center; display: flex; align-items: center; justify-content: center;
  width: 32px; height: 32px; border-radius: 50%; background: var(--paper-deep);
  font-family: var(--font-batang), serif; font-size: 13px; color: var(--ink-muted);
}
```

`web/src/components/flow/HoldButton.module.css` 전체:
```css
.hold {
  position: relative; overflow: hidden; align-self: center;
  min-height: var(--touch); padding: 0 var(--space-5);
  border: 1px dashed var(--ink-muted); border-radius: var(--radius-pill);
  background: var(--card-bg); color: var(--ink-soft);
  font: inherit; font-size: 13px; cursor: pointer;
  user-select: none; -webkit-user-select: none; -webkit-touch-callout: none; touch-action: none;
}
.hold:focus-visible { outline: 3px solid var(--field-data); outline-offset: 2px; }
.gauge {
  position: absolute; inset: 0; background: var(--paper-deep);
  transform: scaleX(0); transform-origin: left center;
}
.hold[data-holding] .gauge { transform: scaleX(1); transition: transform var(--dur-hold) linear; }
.label { position: relative; }
```

- [ ] **Step 5: S-02 🎯 (P-03)**

`web/src/components/flow/TargetInput.tsx` — `interface Props …` 줄 바로 다음에 아이콘을 추가하고,
```tsx
/** P-03: an open-book mark before the label (decorative — the button still reads "책 펼치기"). */
function BookIcon() {
  return (
    <svg className={styles.icon} viewBox="0 0 24 24" width="18" height="18" aria-hidden="true" focusable="false">
      <path d="M12 6.5C10 5 7 4.5 3.5 5v13c3.5-.5 6.5 0 8.5 1.5 2-1.5 5-2 8.5-1.5V5C17 4.5 14 5 12 6.5zm0 0v13" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" />
    </svg>
  );
}
```
주 버튼 한 줄을 바꾼다.
```tsx
      <Button type="submit" className={styles.submit}><BookIcon />책 펼치기</Button>
```

`web/src/components/flow/TargetInput.module.css` 전체:
```css
.form { display: flex; flex-direction: column; gap: var(--space-5); padding-top: var(--space-2); }
.title { margin: 0; font-size: 20px; }
.group { display: flex; flex-direction: column; gap: var(--space-2); }
.label { display: flex; align-items: center; gap: var(--space-2); margin: 0; font-family: var(--font-batang), serif; font-size: 15px; font-weight: 700; }
/* P-03: 필수 / 선택 as small tinted pills. */
.badge {
  padding: 0 var(--space-2); border-radius: var(--radius-pill); background: var(--paper-deep);
  font-family: var(--font-dodum), sans-serif; font-size: 12px; font-weight: 400; line-height: 20px; color: var(--ink-muted);
}
/* C-09: required notice in ink with an underline instead of red. */
.required {
  padding: 0 var(--space-2); font-family: var(--font-dodum), sans-serif; font-size: 12px; font-weight: 400; line-height: 20px;
  color: var(--ink); text-decoration: underline; text-underline-offset: 3px;
}
.chips { display: flex; flex-wrap: wrap; gap: var(--space-2); }
.chip {
  min-height: var(--touch); padding: 0 var(--space-4);
  border: var(--card-edge); border-radius: var(--radius-pill);
  background: var(--card-bg); color: var(--ink); font: inherit; font-size: 14px; cursor: pointer;
}
.chip[aria-pressed="true"] { background: var(--ink); border-color: var(--ink); color: var(--paper); }
.chip:focus-visible { outline: 3px solid var(--field-data); outline-offset: 2px; }
.input {
  min-height: var(--touch); padding: 0 var(--space-4);
  border: 1px solid var(--ink); border-radius: var(--radius-card);
  background: var(--field-bg); color: var(--ink); font: inherit; font-size: 15px;
}
.hint { margin: 0; font-size: 12px; line-height: 1.6; color: var(--ink-muted); }
.hint a { color: var(--ink-muted); }
/* inline body link: ink underline; the 44px rule does not apply to text links */
.hint a.policy { color: var(--ink); text-decoration: underline; text-underline-offset: 3px; }
.missing { margin: 0; font-size: 13px; color: var(--ink); text-decoration: underline; text-underline-offset: 3px; }
.submit { align-self: stretch; display: flex; align-items: center; justify-content: center; gap: var(--space-2); }
.icon { flex-shrink: 0; }
```

- [ ] **Step 6: 통과 확인**

Run: `cd web && npx vitest run && npm run lint && npm run e2e`
Expected: Vitest **353개 PASS** / e2e 전부 PASS (🎯 "책 펼치기" 두 번 누르기, "직접 쓰기"·칩 이름, 🍃 `[data-side="left"]`, 꾹 누르기 Enter 모두 그대로)

- [ ] **Step 7: Commit**

```bash
git add web/src/components/flow/BalanceGame.module.css web/src/components/flow/HoldButton.module.css web/src/components/flow/TargetInput.tsx web/src/components/flow/TargetInput.module.css web/src/components/flow/EndList.tsx web/src/components/flow/EndList.module.css web/src/components/flow/EndList.test.tsx
git commit -m "feat(flow): Stitch look for the balance game, target input and curious list"
```

---

### Task 7: 문서 기록과 최종 검증

**Files:**
- Modify: `docs/DESIGN.md`, `docs/context.md`, `docs/tasks.md`, `docs/process.md`

**Interfaces:**
- Consumes: Task 1~6 결과
- Produces: 문서만 (`docs/stitch/DESIGN.md`는 Stitch 생성용 파생본이라 이번에는 고치지 않는다 — 다시 시안을 만들 때 원본에서 갱신)

- [ ] **Step 1: `docs/DESIGN.md`**

① 버전 표에 행 추가:
```markdown
| v0.2 | 2026-09-30 | 디자인 반영 계획(`plans/2026-09-30-design-pass.md`), Stitch P-00~P-05, 사용자 지시(화면 가득·가운데 책갈피·데스크톱 넓게) | 구현 |
```
② T-04b 둘째 불릿 다음에 추가:
```markdown
- **책 장면(S-03~S-05)은 데스크톱에서 기둥을 벗어나 화면에 맞춰 커진다** (09-30) — 폭 768px 이상에서 펼친 책은 두 쪽이 1 : 1.4인 모양으로 화면 높이와 폭(최대 1000px) 중 작은 쪽에 맞추고, 책갈피도 함께 커진다(1.25~1.6배). 버튼은 책 아래 가운데 한 줄(최대 480px). 처음·밸런스·입력·궁금해요 목록은 430px 기둥 그대로
- 휴대폰에서도 S-03~S-05는 기둥 폭을 채우고 화면 높이만큼 커진다 — 375 × 667에서 스크롤 없음, 높이 780·880px부터 책갈피 1.25·1.4배
```
③ T-06 표 아래에 한 줄:
```markdown
닫힌 책(S-03)은 1.2배로 보이다가 `open-cover`(1000ms) 동안 1배로 돌아온다. 움직이는 것은 transform·opacity만 — filter·그림자는 움직이지 않는다.
```
④ T-06 다음에 새 절:
```markdown
### T-07 질감·깊이 (09-30, CSS/SVG만 — 그림 파일 없음)

| 토큰 | 값 | 쓰는 곳 |
|---|---|---|
| `foil` | `#EAD9B0` | 가죽 위 금박 글자 (cloth 위 5.3 : 1, cloth-edge 위 7.7 : 1) |
| `foil-line` | `rgba(234,217,176,.45)` | 가죽에 눌러 찍은 테두리·책등 띠 |
| `leather-grain` · `leather-sheen` · `spine-shade` | 점 무늬 · 비스듬한 광택 · 책등 그늘 (그라디언트) | 표지·책등 |
| `paper-grain` | SVG 노이즈(data URI, 160px 타일, 불투명도 .07) | 화면 종이 |
| `paper-rule` | `rgba(221,208,180,.55)` | 책장 줄 |
| `card-bg` · `card-edge` | `rgba(255,255,255,.55)` · `1px solid rgba(221,208,180,.7)` | 입구 카드·밸런스 카드·칩·목록 (흐림 없음) |
| `field-bg` | `#FFFFFF` | 직접 쓰기 칸 |
| `tape` | `rgba(255,255,255,.7)` | C-14 쪽지의 테이프 |
| `shadow-soft` · `shadow-book` · `shadow-plate` | 움직이지 않는 그림자 | 카드 · 책 · 표지 라벨 |
| `header-h` | `52px` | 로고 머리글 |
```
⑤ 3절 표: C-01 핵심을 `가죽 표지(cloth + 결·광택, 책등 세로 글씨 "갈피", 종이 제목 라벨 — S-01 태그라인) + 크림 책장(옅은 줄) + 5px 천 테두리. 화면 가득(T-04b). 표지 열기(닫힌 책 1.2배 → 1배)·장 넘기기`로, C-02 핵심을 `… + 장르 이름표 + 제목 + **저자 줄** + 한 줄 + …`로, C-06에 `쪽 번호 "n / 5"는 오른쪽 쪽 아래 알약(P-05)`을 덧붙인다
⑥ 4절 그림에서 `│ 제목     │  ← 고운바탕 15/700, 두 줄까지` 다음 줄에 `│ 저자     │  ← 고운돋움 12, 한 줄 (넘치면 …), 두 이름이 길면 "첫 이름 외"`를 넣고, 표 끝에 두 행 추가:
```markdown
| 글자 간격 (09-30 저자 줄) | 요소 사이 3px, 위 여백 16px, 제목 줄높이 1.3, 한 줄 1.3, 이름표 위아래 2px, "갈피" 줄높이 1 — 글자 크기는 그대로. 200권 ×1.0·×1.15 맞춤은 `web/e2e/design.spec.ts` |
| 책 장면에서 | 두 쪽 사이 가운데(책 사이)에 꽂혀 올라온다. 크기는 통째로 1~1.6배(transform) — 틀 안 배치는 160 × 344와 같다 |
```
⑦ A-05 행의 누가 칸 끝에 `→ **적용(09-30)**: 고운바탕 Bold 글자 윤곽 + 선으로 그린 책·리본, \`web/src/components/Logo.tsx\`·\`web/src/app/icon.svg\``를 덧붙인다
⑧ 6절 S-01 행: `로고(A-05) 머리글, 제목·태그라인, 책 그림, 🎯/🍃 두 입구 카드, C-15 (우측 위 로그인/내 서재는 P5)`
⑨ 7절: `책갈피는 "제목, 한 줄, 장르"를 읽어준다` → `책갈피는 "제목, 저자, 한 줄, 장르"를 읽어준다`
⑩ 8절: `- [ ] 로고 다듬기 (A-05)` → `- [x] 로고 (A-05) — Stitch 로고를 SVG로 (09-30)`

- [ ] **Step 2: `docs/context.md`**

맨 위 `Last Updated`를 `2026-09-30 — 디자인 반영`으로 바꾸고, 09-30 결정 표 끝(보안 행 다음)에 추가:
```markdown
| 09-30 | 디자인 반영 구현: 모든 화면 위 로고 머리글(누를 수 없는 그림, 로그인 자리 없음 — P3의 빈 자리 `account-slot`도 없앰), Stitch 로고 = 고운바탕 Bold 윤곽 SVG(파비콘 겸용, 기본 favicon.ico 삭제). **S-03부터 책이 화면을 채운다** — 휴대폰은 기둥 폭·화면 높이(375 × 667에서 스크롤 없음), 데스크톱(≥ 768px)은 기둥을 벗어나 1 : 1.43 펼침, 책갈피는 **두 쪽 사이 가운데**에서 통째로 1~1.6배. 쪽 번호는 오른쪽 쪽 아래 알약(P-05). 첫 장은 왼쪽 제목 쪽 + 오른쪽 요약. 저자 = `d1_selected.csv` author 정리(역자·그림은 버리고, 셋 이상·등저·두 이름 10자 초과는 "첫 이름 외"), 책갈피 읽기 이름에 저자 추가. 저자 줄 자리는 글자 크기 대신 간격을 줄여 마련(×1.15에서 61권 넘침 → 0) | 사용자 지시(화면 가득·가운데 책갈피·표지 크게·데스크톱 넓게). 새 문구를 만들지 않으려고 표지 라벨은 S-01 태그라인, 책등은 "갈피"(시안의 "갈피 기록부"·"Volume I"은 새 문구). 반투명 위 글자는 ink(DESIGN 7절)라 저자도 ink 12px |
```

- [ ] **Step 3: `docs/tasks.md`, `docs/process.md`**

`docs/tasks.md`:
```markdown
- [x] 디자인 반영 — Stitch 시안 적용, 로고 SVG, 저자 줄, 로고 머리글, 화면 가득 책·가운데 책갈피·데스크톱 넓게 (`docs/plans/2026-09-30-design-pass.md`) (9/30)
```
`docs/process.md`의 `- 사용자 판단: 동작은 되지만 Stitch 디자인이 빠짐 → …` 줄 다음에:
```markdown
- 디자인 반영 완료 (9/30) — `docs/plans/2026-09-30-design-pass.md`. 다음: P7 휴대폰·카톡 브라우저 점검 → 5명 반응
```

- [ ] **Step 4: 최종 검증**

```bash
cd web
npm run typecheck && npm run lint
npx vitest run && npm run test:cov
npm run build
npx playwright test --repeat-each=2
```
Expected: 오류 0 / Vitest 47파일 353개, 커버리지 기준 통과(`src/lib/recommend` 100%) / build 통과 / Playwright 110 passed · 2 skipped

눈으로 확인(스크린샷 폴더의 `after-*`와 같은지): 375 × 667·430 × 932·1440 × 900에서 S-01 · S-02 🍃 · S-02 🎯 · S-03 · S-04 · S-05 · 궁금해요 목록. 따르지 않을 부분 11건이 하나도 없는지, 로그인 글자가 없는지, 12px 미만 글씨가 없는지(개발자 도구 Computed), 주 버튼이 화면마다 하나인지.

- [ ] **Step 5: 코드 리뷰 요청**

superpowers:requesting-code-review로 `git diff main...feat/design-pass`를 리뷰받는다 — 확인 포인트: 따르지 않을 부분 11건, 민음사 모양, 문구 변화 없음(`git diff main -- web/src/components web/src/app | grep '^+.*[가-힣]'`로 새 한글 훑기 — 표지 라벨·책등의 재사용 문구, 주석, 테스트의 저자 말고는 없어야 함), tokens만 쓰는지(`grep -nE "rgba\(|#[0-9A-Fa-f]{3,6}" web/src/components -r --include=*.module.css`가 빈 결과), 움직이는 요소에 filter 없음.

- [ ] **Step 6: Commit**

```bash
git add docs/DESIGN.md docs/context.md docs/tasks.md docs/process.md
git commit -m "docs: record the design pass — full-screen book, gutter bookmark, author line, SVG logo"
```

병합·배포는 **사용자 확인 후** (`feat/design-pass` → `main`, Vercel이 main을 배포).

---

## 완료 기준 (사용자 결정 → 태스크)

- [ ] ① Stitch 모양: S-01(Task 3) · S-02 🍃·🎯(Task 6) · S-03·S-04·S-05(Task 5) · 궁금해요 목록(Task 6) — 따르지 않을 부분 11건 없음(Task 7 Step 4·5)
- [ ] ② 책갈피 저자 줄 — 데이터(Task 1) + 컴포넌트·200권 ×1.0·×1.15 맞춤(Task 4)
- [ ] ③ Stitch 로고 SVG — 머리글·파비콘(Task 2)
- [ ] ④ 모든 화면 위 작은 로고 머리글, 로그인 글자·자리 없음(Task 2·3)
- [ ] ⑤ 동작·이벤트·문구·테스트 그대로(모든 태스크의 e2e), 토큰만(Task 2 + Task 7 grep), 12px 이상·44px 이상·주 버튼 하나·버튼은 책 아래·다크 모드 없음·민음사 모양 없음·T-06·움직이는 동안 흐림 끔(Task 5 Step 7)
- [ ] ⑥ 질감 CSS/SVG만, 저사양 안드로이드(움직이는 요소에 filter 없음, 그림자 애니메이션 없음 — Task 5 Step 7)
- [ ] 추가 지시: S-03부터 화면 가득·375 × 667 스크롤 없음·가운데 책갈피·큰 표지·읽기 쉬운 첫 장(Task 5, `scene.spec.ts`) · 데스크톱 책 장면은 기둥 밖(Task 5, `scene.spec.ts`·`flow-target.spec.ts`, DESIGN T-04b는 Task 7)

---

## 이 계획이 스펙과 다르게 정한 것 (검토용)

| 스펙 | 이 계획 | 이유 |
|---|---|---|
| P3 계획·`Home.test`: S-01 우측 위는 누를 수 없는 빈 자리(`account-slot`) | 자리 자체를 없앰, 테스트는 "로그인 글자·버튼 없음"으로 | 09-30 결정 "로그인 자리는 P5에" + 사용자 결정 4 |
| DESIGN 7절 책갈피 읽기 = "제목, 한 줄, 장르" | "제목, 저자, 한 줄, 장르" | 저자 줄(F-08)이 화면에 생김 — 화면 읽기에도 같은 정보 |
| 저자 줄을 작게·연하게(P-05는 옅은 색) | 12px `ink` | DESIGN 7절 "반투명 위 글자는 ink만", 12px 미만 금지 |
| 저자 줄 추가 = 글자가 더 들어갈 자리 필요 | 틀(160 × 344)·글자 크기 그대로, 간격만 줄임. 저자는 한 줄 + "…", 두 이름이 길면 "첫 이름 외" | 사용자 결정(B안 344px), T-04 글자 크기 |
| P-05: 책갈피가 오른쪽 쪽에 | 두 쪽 사이 가운데 | 사용자 지시(09-30) |
| P-04 책등 "갈피 기록부", P-01 "갈피의 서재·Volume I·Galpi Archive" | 책등 "갈피", 표지 라벨 = S-01 태그라인 | 새 문구 금지 |
| P3: "n / 전체"는 버튼 아래 | 오른쪽 쪽 아래 알약(P-05) | 시안 + 375 × 667에서 스크롤 없이 책을 키울 높이 확보. 글자·위치 찾기(`getByText`) 그대로 |
| T-04b: 데스크톱 전용 레이아웃 없음 | 책 장면만 폭 768px 이상에서 기둥을 벗어남(`:has()`) | 사용자 지시(09-30). 나머지 화면은 기둥 그대로 |
| 책 모양 = 쪽 1 : 1.4 | 휴대폰은 기둥 폭 × 화면 높이라 쪽이 세로로 긴 기록부 모양(최대 약 1 : 3), 데스크톱은 1 : 1.4 | 사용자 지시 "책 폭 가득, 쪽은 더 길게"와 "스크롤 없음"을 동시에 — 닫힌 표지도 길쭉해짐(사용자 확인 필요) |
| T-04 로고 28/700 | 머리글 로고 SVG 높이 34px(글자 약 23px), S-01 제목 글자 28px 그대로 | 머리글은 작게(사용자 결정 4) |
| create-next-app `favicon.ico` | 삭제, `app/icon.svg` | 로고를 파비콘으로(사용자 결정 3) |
| 이름표 위아래 여백 4px | 2px (끝 목록 알약도 같이) | 저자 줄 자리 |
