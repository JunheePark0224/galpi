# P3 흐름 화면 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 처음 화면에서 🎯·🍃 입구를 골라 조건 입력(🎯 한 화면 / 🍃 밸런스 9문항) → 책 등장·펼치기 → 첫 장(한 번 고치기) → 책갈피 5장(궁금해요/패스) → 궁금해요 책 목록까지 휴대폰(Pixel 7)과 노트북(1440, 가운데 430px 기둥)에서 끝까지 가고, 그 사이 이벤트 E-01·02·03·05·06·07·08·21·24·25(+ 같은 화면에 생기는 E-20·22)가 쌓인다.

**Architecture:** `/` 한 페이지 안에서 순수 리듀서(`lib/flow/state.ts`)가 화면 단계를 정하고, 상태를 sessionStorage에 저장해 새로고침해도 같은 장으로 돌아온다(카톡 안 브라우저가 탭을 다시 불러도 이어짐). 뽑기는 서버 라우트 `POST /api/books/draw`가 앱 안 정적 JSON(`src/data/books.json`, 우리 태그 + 제목만)과 P1 `lib/recommend`로 한다 — 입구마다 도우미 하나(`drawLeaf`/`drawTarget`). 화면 컴포넌트는 props만 받는다. 화면을 건너는 이벤트는 `Flow.tsx` 핸들러에서, 화면 안의 작은 조작(칩·밸런스 답·꾹 누르기)은 그 컴포넌트에서 `track()`으로 보낸다. 움직임은 "단순하게 먼저": Motion(표지 회전·책갈피 오르내림·장 넘김) + CSS 3D(perspective, backface).

**Tech Stack:** Next.js 16.3.6 (App Router) · React 19.2.8 · TypeScript · Motion 13.4 (`motion/react`) · tsx 4.23 (데이터 복사 스크립트) · Vitest 5 + Testing Library · Playwright 1.63 (phone = Pixel 7, laptop = 1440×900)

**Spec:** `docs/PRD.md` v0.2 (F-01~F-08, S-01~S-05, 4절 이벤트) · `docs/PHASES.md` P3 · `docs/DESIGN.md` v0.1 (T-01~T-06, T-04b, C-01~C-15, 4절 책갈피 규격, A-01~A-06) · `docs/balance-game.md` v0.2 · `docs/target-chips.md` v0.2 · `docs/book-pool.md` v0.1 · `docs/stitch/exports/README.md` (따르지 않을 부분) · 로드맵 3-1·3-2·3-3 (`docs/plans/2026-09-29-roadmap.md`)

**계획 속 코드 검증 (09-30):** 임시 폴더(현재 `web/` 복사본 + `motion`·`tsx` 설치)에 이 계획의 코드를 태스크 순서대로 그대로 넣고 실행 — `npm run books:import` 200권·키워드 20개, Vitest 36파일 230개 통과(각 태스크의 개수 표기와 일치), `src/lib/recommend` 커버리지 100% 유지, `tsc`·`eslint` 오류·경고 0, `next build` 통과, Playwright 22개 × 2회 반복(`--repeat-each=2`) 전부 통과. 검증 중 고친 것 3가지: 빌드가 `rgba(255,255,255,.8)`를 `#fffc`로 줄여 토큰 단언을 정규식으로, Next의 빈 `role="alert"` 알림 영역 때문에 필수 안내는 `getByText`로, 테스트가 끝날 때 전송 중이던 이벤트로 `route.fulfill`이 실패하던 것을 기록 도우미에서 잡고 상태 수를 기다린 뒤 단언.

## Global Constraints

- 구현 전에 `web/AGENTS.md`를 읽는다 (Next 16 — 라우트 핸들러·클라이언트 컴포넌트는 `node_modules/next/dist/docs/01-app/`에서 확인)
- PRD에 없는 기능은 만들지 않는다. `docs/stitch/exports/README.md`의 "따르지 않을 부분" 11건(아래 메뉴 바, 영어 "Recommendations", 프로필 그림, 자동 보관 안내, 빈 세기 점, "갈피를 터치하여…", 취향 일치도, "갈피 코멘터리", 공유 버튼, 읽기 조건 희귀 책갈피, 수채화 그림)은 만들지 않는다. P-03의 "지금 수준"·"지금 상황 한 줄" 칸은 PRD F-02에서 삭제됐으므로 만들지 않는다
- 로그인은 만들지 않는다(P5). S-01 우측 위는 누를 수 없는 빈 자리만
- 모바일 우선. 데스크톱은 `layout.tsx`의 가운데 기둥(`--column` 430px) 그대로. 누르는 곳 44px 이상. 한 화면에 주 버튼 하나. 반응·다음 버튼은 책 아래. 다크 모드 없음
- 색·간격·모서리는 `tokens.css` 변수만(T-01~T-05). 움직임 값은 T-06 그대로(`lib/motion.ts`가 초 단위로 옮긴 값). 12px 미만 글씨 금지 — 이름표도 12px. 반투명 위 글자는 `ink`
- 책갈피: 반투명 필름 + 아치 창(동물 × 배경 × 하늘 소품 × 땅 소품) + 장르 이름표 + 제목 + 한 줄 + 바느질 선 + 제비꼬리 + 끈 + "갈피". **민음사 모양(네모 카드·왼쪽 세로 띠·두 줄 색 띠) 금지**
- 바닥 표시 "정보 제공: 예스24 · 예스24와 무관한 개인 프로젝트"는 `Footer` 그대로
- 책 데이터는 우리 것만: isbn · 우리 태그 · 우리 한 줄 + 제목(`data/processed/d1_selected.csv`, 이미 git에 있는 서지 정보). YES24 책소개·가격·표지·평점은 없다. P3에서 책을 DB에서 읽지 않는다
- 🎯 직접 쓰기는 **단어 매칭만**(LLM은 P4). 우리 주제 6개·키워드 목록(`keyword_vocab.json` v1.1, 20개) 밖의 말을 만들지 않는다
- 이벤트는 `track()` 하나. `next dev`·Vitest·E2E는 `TRACK_STORE=off`(실제 events 테이블에 쓰지 않음)
- 화면 문구는 아래 "문구 표" 그대로. 새 문구는 표의 "새 문구" 두 줄뿐
- 파일 하나 300줄 이하. 커밋 메시지는 영어 conventional commits

### 문구 표

| 자리 | 문구 | 출처 |
|---|---|---|
| S-01 로고·태그라인 | 갈피 / 읽을 책, 갈피가 안 잡힐 때 | 현재 `page.tsx`·metadata, P-01 |
| S-01 🎯 | 알고 싶은 게 있어요 🎯 / 배우고 싶은 주제로, 아직 모르는 책 만나기 | PRD 2절 흐름·F-01 |
| S-01 🍃 | 그냥 한 권 만나고 싶어요 🍃 / 밸런스 게임으로 내 취향에 맞는 한 권 만나기 | PRD 2절 흐름·F-01 |
| S-02 🎯 | 제목 "알고 싶은 게 있어요" · 무엇을 알고 싶어요(필수) · 분량(선택) · 읽는 방식(선택) · 보기 6개 + 직접 쓰기 · 예시 "SQL, 엑셀 함수, 번아웃, 발표 준비 …" · "주제나 고민을 적어 주세요 · 제목·작가로 찾을 땐 예스24 검색을 이용해 주세요 ↗" · "이름·연락처는 적지 마세요" · [책 펼치기] | target-chips 1·5절, DESIGN 6절 |
| S-02 🍃 | 질문 9개·선택지 그대로, "vs", "갈피를 못 잡겠어요", "n / 9" | balance-game 2절, P-02 |
| S-03 | 눌러서 펼치기 | PRD 2절 흐름 |
| S-04 | 당신이 찾는 책 · 당신의 책 취향 · "확실히 따뜻함" · "따뜻함 · 여운 둘 다 좋아요" · 분량 얇게/두껍게/상관없음 · 무엇을/분량/읽는 방식 · `coverageNotice()` · `EXHAUSTED_NOTICE` · [한 번 고치기] (찾은 책 0이면 [다시 쓰기]) · [다음 장] | PRD F-07, balance-game 2절, target-chips 1·3절, book-pool ⑧ |
| S-05 | [패스] [궁금해요] · "n / 전체" | PRD F-08 |
| 끝 | 궁금해요 책 · [처음으로] | PRD S-06 이름, S-08 |
| **새 문구** | "보기 하나를 고르거나 직접 써 주세요" (무엇을이 비었을 때 — target-chips 1절에 "안내를 띄우고 멈춘다"만 있고 문구가 없음) | Task 10에서 `context.md`에 기록 |
| **새 문구** | "책을 불러오지 못했어요" + [다시 시도] (뽑기 요청 실패) | 같음 |

### 이벤트 표 (PRD 4절 · 로드맵 3-2)

| ID | 이름 | 언제 · 어디서 | props |
|---|---|---|---|
| E-01 | `visit` | 페이지 열 때 (`TrackVisit`, 그대로) | — |
| E-02 | `entry_selected` | S-01 입구 누름 (`Flow`) | `entry` |
| E-03 | `chip_selected` | 🎯 칩 누름 (`TargetInput`) | `question`: "topic"·"len"·"way", `value`(끄면 null, 직접 쓰기는 "direct"), `edit` |
| E-05 | `book_opened` | S-03 책 누름 (`Flow`) | — |
| E-06 | `first_page_edited` | 고친 입력을 다시 낼 때 (`Flow`) | `entry`, `items`: 🍃 `["q3", …]` / 🎯 `"what"`·`"len"`·`"way"` 중 바뀐 것 |
| E-07 | `bookmark_shown` | 책갈피가 나올 때 — [다음 장]·반응 핸들러 (`Flow`) | `book_id`, `index`(1부터), `one_liner_style`, `kind`(recommended/random), `art` |
| E-08 | `bookmark_reacted` | [패스]/[궁금해요] (`Flow`) | `book_id`, `index`, `reaction`: "pass"·"curious", `kind` |
| E-20 | `home_clicked` | 끝 화면·빈 뽑기의 [처음으로] (`Flow`) | `curious` |
| E-21 | `goal_free_written` | 직접 쓰기로 제출 (`Flow`) | `text`(30자), `topic`, `keywords`, `matched`, `method`: "word" |
| E-22 | `goal_coverage` | 직접 쓰기 뽑기 결과 도착 (`Flow`) | `bucket`: "0"·"1-3"·"4+", `found` |
| E-24 | `balance_answered` | 🍃 답 (`BalanceGame`) | `question`, `choice`: "A"·"B"·"unsure", `side`: "left"·"right"·null, `ms`, `edit` |
| E-25 | `unsure_hold_cancelled` | 꾹 누르다 0.8초 전에 뗌 (`BalanceGame`) | `question`, `held_ms`, `edit` |

- 공통 속성 `entry`·`round`는 `lib/track/common.ts`가 sessionStorage에 둔다. `Flow`가 입구를 고를 때 `setEntry(entry)`, [처음으로]에서 이벤트를 보낸 **뒤** `setEntry(null)`. `nextRound()`는 P4 다시 뽑기에서 부른다(P3에서는 부르지 않음 — 회차 1)
- E-20·E-22는 이번 목록 밖이지만 그 화면(끝 화면 [처음으로], 직접 쓰기 안내)이 P3에 생기므로 원칙 3("이벤트는 화면과 함께")대로 같이 심는다

---

## File Structure

| 파일 | 책임 |
|---|---|
| `web/playwright.config.ts` | E2E 전용 포트 3217, 남의 서버 재사용 안 함, `TRACK_STORE=off`·`BOOKS_SOURCE=sample` |
| `web/.env.development` | `TRACK_STORE=off` (비밀 없음, git에 올림) |
| `web/src/lib/track/common.ts` | `entry`·`round`를 sessionStorage에 보관 |
| `web/src/styles/tokens.css` | frost-blur/edge, 책·책갈피 모서리, 그림자 토큰 추가 |
| `web/src/lib/books/taxonomy.ts` | 주제·분야·장르 목록, 칩 이름, 이름표 색(`toneOf`) |
| `web/src/lib/books/types.ts` | `CatalogBook`, `BookCard`, `CardPick`, `DrawResponse`, `Vocab` |
| `web/src/lib/books/normalize.ts` | 초안 행 검사·정리, CSV 제목, 키워드 목록 정리 |
| `web/scripts/import-books.ts` | `books_v1.json`(없으면 `books_v1_draft.json`) → `src/data/books.json`, `keyword_vocab.json` → `src/data/vocab.json` |
| `web/src/data/books.sample.json` | 테스트·E2E용 가짜 책 30권 |
| `web/src/data/books.json`, `vocab.json` | 스크립트 결과 (git에 올림) |
| `web/src/lib/goal/match.ts` | 직접 쓰기 → 주제·키워드 단어 매칭 |
| `web/src/lib/books/catalog.ts` | 책 목록 고르기(sample/real), `toBook`, `toCard` |
| `web/src/lib/books/request.ts` | 뽑기 요청 엄격 검사 |
| `web/src/lib/books/draw.ts` | `drawLeaf`, `drawTarget` (입구별 뽑기 도우미) |
| `web/src/app/api/books/draw/route.ts` | `POST /api/books/draw` |
| `web/src/lib/art/combine.ts` | 그림 조합(동물 × 배경 × 하늘 × 땅), 씨앗으로 재현 |
| `web/public/animals/*.svg` | `Galpi/assets/animals` 복사본 |
| `web/src/components/BookmarkArt.tsx`, `Bookmark.tsx`, `GenreTag.tsx` | C-03, C-02, C-04 |
| `web/src/lib/flow/questions.ts` | 밸런스 9문항 (문구·좌우) |
| `web/src/lib/flow/target.ts` | 🎯 입력 모양, 칩 이름, `TargetAnswers` 만들기 |
| `web/src/lib/flow/summary.ts` | 첫 장 요약·안내, 고친 항목, 찾은 책 구간 |
| `web/src/lib/flow/state.ts` | 흐름 리듀서 |
| `web/src/lib/flow/storage.ts` | 흐름 상태 sessionStorage 저장·복원 |
| `web/src/lib/flow/api.ts` | 뽑기 요청 몸통, fetch, 그림 붙이기 |
| `web/src/lib/motion.ts` | T-06 → Motion transition 값 |
| `web/src/components/flow/HoldButton.tsx`, `BalanceGame.tsx` | C-08, C-07 (S-02 🍃) |
| `web/src/components/flow/Home.tsx`, `TargetInput.tsx` | S-01, S-02 🎯 (C-09) |
| `web/src/components/flow/Book.tsx`, `FirstPage.tsx`, `BookScene.tsx`, `EndList.tsx` | C-01, C-10·C-14, S-03~05, 끝 화면 |
| `web/src/components/flow/Flow.tsx`, `FlowRoot.tsx` | 상태·이벤트 연결, 서버 HTML과 복원 사이 다리 |
| `web/src/app/page.tsx` | `TrackVisit` + `FlowRoot` |
| `web/e2e/helpers.ts`, `flow-target.spec.ts`, `flow-leaf.spec.ts` | 🎯·🍃 완주 E2E |

테스트는 각 파일 옆 `*.test.ts(x)`.

---
### Task 1: P0 남은 일 — E2E 포트, `.env.development`, 새로고침에도 남는 entry·round, 토큰, 패키지

**Files:**
- Modify: `web/playwright.config.ts`, `web/.gitignore`, `Galpi/.gitignore`, `web/src/lib/track/common.ts`, `web/src/lib/track/common.test.ts`, `web/src/styles/tokens.css`, `web/e2e/design.spec.ts`, `web/package.json` (패키지 두 개)
- Create: `web/.env.development`

**Interfaces:**
- Consumes: P0 `commonProps()`, `setEntry()`, `nextRound()` (`web/src/lib/track/common.ts`)
- Produces: `setEntry(entry: "leaf" | "target" | null): void`·`nextRound(): void` — 이제 sessionStorage(`galpi.entry`, `galpi.round`)에 저장되어 같은 탭의 새로고침 뒤에도 `commonProps().entry/round`가 유지된다. CSS 변수 `--frost-blur`, `--frost-edge`, `--radius-book`, `--radius-bookmark`, `--shadow-ink`. 패키지 `motion`, `tsx`. E2E 서버는 `http://localhost:3217`

- [ ] **Step 0: 작업 브랜치**

P1이 `main`에 병합된 뒤에 시작한다(`git log main --oneline | grep "export reason labels"`가 한 줄 나와야 함). 아니면 멈추고 보고.
```bash
cd Galpi
git switch main
git switch -c feat/p3-flow-screens
```

- [ ] **Step 1: 실패하는 테스트 — entry·round가 모듈을 다시 불러와도 남는다**

`web/src/lib/track/common.test.ts` 맨 아래에 추가한다.
```ts
describe("entry and round survive a reload in the same tab session", () => {
  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
    vi.resetModules();
  });

  it("reads entry and round back after the module is loaded again", async () => {
    const before = await import("./common");
    before.setEntry("target");
    before.nextRound();
    vi.resetModules();
    const after = await import("./common");
    const p = after.commonProps();
    expect(p.entry).toBe("target");
    expect(p.round).toBe(2);
  });

  it("clears entry back to null", async () => {
    const m = await import("./common");
    m.setEntry("leaf");
    m.setEntry(null);
    expect(m.commonProps().entry).toBeNull();
  });

  it("starts at round 1 with no entry in a new session", async () => {
    const m = await import("./common");
    const p = m.commonProps();
    expect(p.round).toBe(1);
    expect(p.entry).toBeNull();
  });
});
```

`web/e2e/design.spec.ts` 맨 아래에 추가한다.
```ts
test("frost and book tokens exist for bookmarks", async ({ page }) => {
  await page.goto("/design");
  const values = await page.evaluate(() => {
    const s = getComputedStyle(document.documentElement);
    return ["--frost-blur", "--frost-edge", "--radius-book", "--radius-bookmark"].map((k) => s.getPropertyValue(k).trim());
  });
  const [blur, edge, book, bookmark] = values;
  expect([blur, book, bookmark]).toEqual(["blur(3px) saturate(1.1)", "2px 10px 10px 2px", "10px 10px 0 0"]);
  // the production build minifies rgba(255, 255, 255, 0.8) to #fffc
  expect(edge).toMatch(/^1px solid (rgba\(255, 255, 255, 0\.8\)|#fffc)$/);
});
```

- [ ] **Step 2: 실패 확인**

Run: `cd web && npx vitest run src/lib/track/common.test.ts`
Expected: FAIL — "reads entry and round back…"에서 `expected null to be 'target'` (지금은 모듈 변수라 새로 불러오면 사라짐)

- [ ] **Step 3: `common.ts` 고치기**

`web/src/lib/track/common.ts` 전체를 다음으로 바꾼다 (`store`·`generateId`·`read`·`write`·`getOrCreate`·`detectDevice`는 그대로, 모듈 변수 `entry`·`round`를 sessionStorage로 옮김).
```ts
import { SCREEN_VERSION, type CommonProps } from "./schema";

const ANON = "galpi.anon";
const SEEN = "galpi.seen";
const SESSION = "galpi.session";
const RETURNING = "galpi.returning";
// entry and round live in sessionStorage: a reload in the same tab keeps them (the flow screen resumes too).
const ENTRY = "galpi.entry";
const ROUND = "galpi.round";

let userId: string | null = null;

// In-memory storage for stable IDs when storage is unavailable
const memory: Record<string, string> = {};

function store(kind: "local" | "session"): Storage | null {
  try {
    return kind === "local" ? window.localStorage : window.sessionStorage;
  } catch {
    return null;
  }
}

function generateId(): string {
  if (typeof crypto !== "undefined" && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  // RFC4122-v4 shaped string using Math.random when crypto.randomUUID unavailable
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

function read(s: Storage | null, key: string): string | null {
  if (!s) return null;
  try {
    return s.getItem(key);
  } catch {
    return null;
  }
}

function write(s: Storage | null, key: string, value: string): void {
  if (!s) return;
  try {
    s.setItem(key, value);
  } catch {
    // blocked storage: memory keeps the value
  }
}

function getOrCreate(s: Storage | null, key: string): { value: string; created: boolean } {
  const existing = read(s, key) ?? memory[key];
  if (existing) return { value: existing, created: false };
  const value = generateId();
  memory[key] = value;
  write(s, key, value);
  return { value, created: true };
}

function readSession(key: string): string | undefined {
  return read(store("session"), key) ?? memory[key];
}

function writeSession(key: string, value: string): void {
  memory[key] = value;
  write(store("session"), key, value);
}

function currentEntry(): CommonProps["entry"] {
  const value = readSession(ENTRY);
  return value === "leaf" || value === "target" ? value : null;
}

function currentRound(): number {
  const n = Number(readSession(ROUND));
  return Number.isInteger(n) && n >= 1 ? n : 1;
}

export function detectDevice(ua: string): { device: "phone" | "desktop"; in_app_browser: boolean } {
  const phone = /Mobi|Android|iPhone|iPod/i.test(ua);
  const inApp = /KAKAOTALK|Instagram|FBAN|FBAV|NAVER\(inapp|Line\//i.test(ua);
  return { device: phone ? "phone" : "desktop", in_app_browser: inApp };
}

export function setEntry(next: CommonProps["entry"]): void { writeSession(ENTRY, next ?? ""); }
export function nextRound(): void { writeSession(ROUND, String(currentRound() + 1)); }
export function setUserId(id: string | null): void { userId = id; }

export function commonProps(): CommonProps {
  const local = store("local");
  const session = store("session");

  const anon = getOrCreate(local, ANON);
  const sessionId = getOrCreate(session, SESSION);

  // Decided once when the session is created, then reused for every event of that session.
  if (sessionId.created) {
    const seenBefore = (read(local, SEEN) ?? memory[SEEN]) === "1";
    const flag = seenBefore ? "1" : "0";
    memory[RETURNING] = flag;
    write(session, RETURNING, flag);
  }
  const returning = (read(session, RETURNING) ?? memory[RETURNING]) === "1";

  memory[SEEN] = "1";
  write(local, SEEN, "1");

  return {
    anon_id: anon.value,
    user_id: userId,
    session_id: sessionId.value,
    round: currentRound(),
    entry: currentEntry(),
    screen_version: SCREEN_VERSION,
    referrer: typeof document === "undefined" ? "" : document.referrer,
    returning,
    ...detectDevice(typeof navigator === "undefined" ? "" : navigator.userAgent),
  };
}
```

- [ ] **Step 4: 토큰 추가**

`web/src/styles/tokens.css` 전체를 다음으로 바꾼다 (DESIGN T-03·T-05 값 그대로, 페이지 안쪽 그림자 하나 추가).
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
  --touch: 44px; --column: 430px;
  --dur-open-cover: 1000ms; --dur-flip-page: 550ms; --dur-bookmark-rise: 600ms;
  --dur-bookmark-away: 450ms; --dur-bookmark-down: 400ms; --dur-hold: 800ms; --dur-card-flip: 500ms;
  --ease-open: cubic-bezier(.6, .05, .25, 1); --ease-flip: cubic-bezier(.5, 0, .3, 1);
  --ease-rise: cubic-bezier(.34, 1.56, .64, 1);
}
```

- [ ] **Step 5: `.env.development`와 제외 목록**

`web/.env.development` (비밀 없음 — git에 올린다):
```
# Tracked on purpose — no secrets here.
# `next dev` accepts events but never writes them to the real Supabase events table.
TRACK_STORE=off
```

`web/.gitignore`의 `!.env.example` 바로 아래에 한 줄 추가:
```gitignore
!.env.development
```

`Galpi/.gitignore`의 `!.env.example` 바로 아래에 한 줄 추가:
```gitignore
!web/.env.development
```

- [ ] **Step 6: E2E 전용 포트**

`web/playwright.config.ts` 전체를 다음으로 바꾼다.
```ts
import { defineConfig, devices } from "@playwright/test";

// A port no other local app uses. Never attach to a server we did not start: it may be a stale build.
const PORT = 3217;

export default defineConfig({
  testDir: "./e2e",
  webServer: {
    command: `npm run build && npm run start -- -p ${PORT}`,
    port: PORT,
    reuseExistingServer: false,
    timeout: 180_000,
    // Next does not let .env files override an already-set env var: E2E never writes to the real events table.
    env: { TRACK_STORE: "off" },
  },
  use: { baseURL: `http://localhost:${PORT}` },
  projects: [
    { name: "phone", use: { ...devices["Pixel 7"] } },
    { name: "laptop", use: { viewport: { width: 1440, height: 900 } } },
  ],
});
```

- [ ] **Step 7: 패키지**

Run:
```bash
cd web
npm i motion@^13.4.6
npm i -D tsx@^4.23.15
```
Expected: `package.json` dependencies에 `"motion"`, devDependencies에 `"tsx"`

- [ ] **Step 8: 확인**

Run:
```bash
cd web
npx vitest run src/lib/track
node -e "const {loadEnvConfig}=require('@next/env'); loadEnvConfig(process.cwd(), true, {info(){},error(){}}); console.log('dev TRACK_STORE=' + process.env.TRACK_STORE)"
cd .. && (git check-ignore -q web/.env.development && echo "IGNORED (wrong)" || echo "trackable") && (git check-ignore -q web/.env.local && echo "env.local ignored")
cd web && npm run typecheck && npm run lint && npm run e2e
```
Expected: vitest 전부 PASS / `dev TRACK_STORE=off` / `trackable` / `env.local ignored` / typecheck·lint 오류 없음 / e2e 전부 PASS (phone·laptop, 새 토큰 테스트 포함). 3217 포트가 이미 쓰이고 있으면 Playwright가 멈추는 것이 맞다 — 그 서버를 끄고 다시 실행.

- [ ] **Step 9: Commit**

```bash
git add web/playwright.config.ts web/.env.development web/.gitignore .gitignore web/src/lib/track/common.ts web/src/lib/track/common.test.ts web/src/styles/tokens.css web/e2e/design.spec.ts web/package.json web/package-lock.json
git commit -m "chore: pin e2e to its own port, track .env.development, keep entry and round across reloads"
```

---

### Task 2: 책 데이터 — 분류표, 초안 검사·복사 스크립트, 가짜 책 30권

**Files:**
- Create: `web/src/lib/books/taxonomy.ts`, `web/src/lib/books/types.ts`, `web/src/lib/books/normalize.ts`, `web/scripts/import-books.ts`, `web/src/data/books.sample.json`
- Create (스크립트 결과, git에 올림): `web/src/data/books.json`, `web/src/data/vocab.json`
- Modify: `web/package.json` (script 한 줄)
- Test: `web/src/lib/books/taxonomy.test.ts`, `web/src/lib/books/normalize.test.ts`, `web/src/lib/books/data.test.ts`

**Interfaces:**
- Consumes: `AXES`, `AxisKey`, `Tag`, `Way`, `Entry`, `DrawPick` (`web/src/lib/recommend/types.ts`)
- Produces:
  - `taxonomy.ts`: `FIELD_OF_TOPIC`, `type Topic` (`"데이터 분석" | "통계" | "AI 활용" | "업무 자동화" | "습관·집중" | "시간·생산성"`), `type Field`, `TOPIC_CHIPS: readonly { topic: Topic; label: string }[]`, `TOPICS: readonly Topic[]`, `LEAF_GENRES`, `WAYS: readonly Way[]`, `toneOf(card: { entry: Entry; genre: string; field: string | null }): { bg: string; fg: string }`
  - `types.ts`: `CatalogBook` (🍃/🎯 판별 유니온 — isbn, entry, title, genre, field, topic, pages, way, axes, keywords, one_liner, one_liner_style), `BookCard { id; entry; title; genre; field; oneLiner; oneLinerStyle }`, `CardPick { card: BookCard; kind: DrawPick["kind"] }`, `DrawResponse { picks: CardPick[]; exhausted: boolean; widened: boolean; found: number | null; keywords: string[] }`, `VocabTopic { keywords: Record<string, string>; terms: string[] }`, `Vocab = Record<string, VocabTopic>`
  - `normalize.ts`: `normalizeBook(raw, titles): CatalogBook`, `normalizeCatalog(rows: unknown, titles): CatalogBook[]`, `parseCsv(text): string[][]`, `titlesFromCsv(text): Map<string, string>`, `normalizeVocab(raw: unknown): Vocab`
  - `npm run books:import` → `src/data/books.json` (`CatalogBook[]`), `src/data/vocab.json` (`Vocab`, 20 키워드). `src/data/books.sample.json` (`CatalogBook[]` 30권: 🍃 12 · 🎯 18, 데이터 분석 5권 중 SQL 2권, AI 활용에는 제미나이 책이 없음)

- [ ] **Step 1: 실패하는 테스트**

`web/src/lib/books/taxonomy.test.ts`:
```ts
import { describe, expect, it } from "vitest";
import { FIELD_OF_TOPIC, LEAF_GENRES, TOPIC_CHIPS, TOPICS, toneOf } from "./taxonomy";

describe("taxonomy", () => {
  it("keeps the six topics in chip order with the verbatim chip labels", () => {
    expect(TOPICS).toEqual(["데이터 분석", "통계", "AI 활용", "업무 자동화", "습관·집중", "시간·생산성"]);
    expect(TOPIC_CHIPS.map((c) => c.label)).toEqual(["데이터 분석", "통계", "AI 똑똑하게 쓰기", "업무 자동화", "습관·집중", "시간·생산성"]);
  });

  it("maps topics to the three fields", () => {
    expect(new Set(Object.values(FIELD_OF_TOPIC))).toEqual(new Set(["데이터·통계", "AI·IT 활용", "습관·자기계발"]));
    expect(FIELD_OF_TOPIC["업무 자동화"]).toBe("AI·IT 활용");
  });

  it("has the nine 🍃 genres", () => {
    expect(LEAF_GENRES).toHaveLength(9);
  });

  it("colours name tags by genre, by field for 🎯, ink text only on 예술·여행", () => {
    expect(toneOf({ entry: "leaf", genre: "에세이", field: null })).toEqual({ bg: "var(--genre-essay)", fg: "#FFFFFF" });
    expect(toneOf({ entry: "leaf", genre: "예술·여행", field: null })).toEqual({ bg: "var(--genre-art-travel)", fg: "var(--ink)" });
    expect(toneOf({ entry: "target", genre: "통계", field: "데이터·통계" })).toEqual({ bg: "var(--field-data)", fg: "#FFFFFF" });
    expect(toneOf({ entry: "leaf", genre: "요리", field: null }).bg).toBe("var(--ink-muted)");
  });
});
```

`web/src/lib/books/normalize.test.ts`:
```ts
import { describe, expect, it } from "vitest";
import { normalizeBook, normalizeCatalog, normalizeVocab, parseCsv, titlesFromCsv } from "./normalize";

const TITLES = new Map([["9791111111111", "모순"], ["9792222222222", "처음 만나는 SQL"]]);
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
    expect(normalizeBook(leafRow, TITLES)).toEqual({
      isbn: "9791111111111", entry: "leaf", title: "모순", genre: "한국 소설", field: null, topic: null, pages: 308, way: null,
      axes: { temp: 1, pull: -1, gain: 0, world: 1 }, keywords: [], one_liner: "사랑과 현실 사이에서 무엇을 고를까요?", one_liner_style: "question",
    });
  });

  it("derives field and genre of a 🎯 row from its topic", () => {
    const b = normalizeBook({ ...targetRow, field: undefined, genre: undefined }, TITLES);
    expect(b).toMatchObject({
      entry: "target", title: "처음 만나는 SQL", topic: "데이터 분석", genre: "데이터 분석", field: "데이터·통계",
      way: "실습", axes: null, keywords: ["SQL", "시각화"],
    });
  });

  it("accepts Korean one-liner style names", () => {
    expect(normalizeBook({ ...targetRow, one_liner_style: "요약형" }, TITLES).one_liner_style).toBe("summary");
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
    expect(() => normalizeBook(row, TITLES)).toThrow(message);
  });
});

describe("normalizeCatalog", () => {
  it("accepts a list or an isbn-keyed object", () => {
    expect(normalizeCatalog([leafRow, targetRow], TITLES)).toHaveLength(2);
    const { isbn, ...rest } = leafRow;
    expect(normalizeCatalog({ [isbn]: rest }, TITLES)[0].isbn).toBe(isbn);
  });

  it("rejects duplicates and empty sources", () => {
    expect(() => normalizeCatalog([leafRow, leafRow], TITLES)).toThrow(/duplicate isbn/);
    expect(() => normalizeCatalog([], TITLES)).toThrow(/no books/);
  });
});

describe("CSV titles", () => {
  it("reads quoted titles with commas and a BOM", () => {
    const csv = "﻿entry,slot,title,isbn\r\nleaf,시,\"꽃, 그리고 \"\"나\"\"\",9791111111111\nleaf,시,모순,9792222222222\n";
    expect(parseCsv(csv)[1]).toEqual(["leaf", "시", "꽃, 그리고 \"나\"", "9791111111111"]);
    expect(titlesFromCsv(csv).get("9792222222222")).toBe("모순");
  });

  it("needs isbn and title columns", () => {
    expect(() => titlesFromCsv("a,b\n1,2\n")).toThrow(/isbn and title/);
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

`web/src/lib/books/data.test.ts`:
```ts
import { describe, expect, it } from "vitest";
import real from "@/data/books.json";
import sample from "@/data/books.sample.json";
import vocab from "@/data/vocab.json";
import { normalizeCatalog } from "./normalize";
import { TOPICS } from "./taxonomy";
import type { CatalogBook } from "./types";

const asRows = (books: CatalogBook[]) => books.map((b) => ({ ...b, slot: b.entry === "leaf" ? b.genre : b.topic }));

describe("app book data", () => {
  it.each([["books.sample.json", sample], ["books.json", real]])("%s passes the import checks unchanged", (_, data) => {
    const books = data as unknown as CatalogBook[];
    const titles = new Map(books.map((b) => [b.isbn, b.title]));
    expect(normalizeCatalog(asRows(books), titles)).toEqual(books);
  });

  it("sample has 12 🍃 and 18 🎯 books, enough for one full 🎯 draw in 데이터 분석", () => {
    const books = sample as unknown as CatalogBook[];
    expect(books.filter((b) => b.entry === "leaf")).toHaveLength(12);
    const target = books.filter((b) => b.entry === "target");
    expect(target).toHaveLength(18);
    expect(target.filter((b) => b.topic === "데이터 분석")).toHaveLength(5);
    expect(target.filter((b) => b.keywords.includes("SQL"))).toHaveLength(2);
  });

  it("vocab.json covers all six topics with the 20 keywords of v1.1", () => {
    expect(Object.keys(vocab)).toEqual([...TOPICS]);
    const count = Object.values(vocab).reduce((n, t) => n + Object.keys(t.keywords).length, 0);
    expect(count).toBe(20);
  });
});
```

- [ ] **Step 2: 실패 확인**

Run: `cd web && npx vitest run src/lib/books`
Expected: FAIL — `Failed to resolve import "./taxonomy"` 등

- [ ] **Step 3: 분류표·타입**

`web/src/lib/books/taxonomy.ts`:
```ts
import type { Entry, Way } from "../recommend/types";

/** docs/plans/2026-09-30-d3-tags.md — topic → field. For 🎯 books genre === topic. */
export const FIELD_OF_TOPIC = {
  "데이터 분석": "데이터·통계",
  통계: "데이터·통계",
  "AI 활용": "AI·IT 활용",
  "업무 자동화": "AI·IT 활용",
  "습관·집중": "습관·자기계발",
  "시간·생산성": "습관·자기계발",
} as const;
export type Topic = keyof typeof FIELD_OF_TOPIC;
export type Field = (typeof FIELD_OF_TOPIC)[Topic];

/** docs/target-chips.md 1절 — chip order and labels. Only "AI 활용" is shown with another label. */
export const TOPIC_CHIPS: readonly { topic: Topic; label: string }[] = [
  { topic: "데이터 분석", label: "데이터 분석" },
  { topic: "통계", label: "통계" },
  { topic: "AI 활용", label: "AI 똑똑하게 쓰기" },
  { topic: "업무 자동화", label: "업무 자동화" },
  { topic: "습관·집중", label: "습관·집중" },
  { topic: "시간·생산성", label: "시간·생산성" },
];
export const TOPICS: readonly Topic[] = TOPIC_CHIPS.map((c) => c.topic);

/** docs/book-pool.md 1절 */
export const LEAF_GENRES = ["한국 소설", "외국 소설", "SF·판타지", "추리·스릴러", "에세이", "시", "인문", "과학 교양", "예술·여행"] as const;
export type LeafGenre = (typeof LEAF_GENRES)[number];

export const WAYS: readonly Way[] = ["개념", "실습", "사례"];

const GENRE_TONE: Record<LeafGenre, string> = {
  "한국 소설": "--genre-korean-fiction", "외국 소설": "--genre-world-fiction", "SF·판타지": "--genre-sf-fantasy",
  "추리·스릴러": "--genre-mystery", 에세이: "--genre-essay", 시: "--genre-poetry", 인문: "--genre-humanities",
  "과학 교양": "--genre-science", "예술·여행": "--genre-art-travel",
};
const FIELD_TONE: Record<Field, string> = { "데이터·통계": "--field-data", "AI·IT 활용": "--field-ai", "습관·자기계발": "--field-habit" };

/** DESIGN T-02 — name-tag colours. White text everywhere except 예술·여행 (ink, 5.0 : 1). */
export function toneOf(card: { entry: Entry; genre: string; field: string | null }): { bg: string; fg: string } {
  if (card.entry === "target") {
    return { bg: `var(${FIELD_TONE[card.field as Field] ?? "--ink-muted"})`, fg: "#FFFFFF" };
  }
  const tone = GENRE_TONE[card.genre as LeafGenre] ?? "--ink-muted";
  return { bg: `var(${tone})`, fg: card.genre === "예술·여행" ? "var(--ink)" : "#FFFFFF" };
}
```

`web/src/lib/books/types.ts`:
```ts
import type { AxisKey, DrawPick, Entry, Tag, Way } from "../recommend/types";

export type OneLinerStyle = "summary" | "question";

interface CatalogBase {
  isbn: string;
  title: string;
  genre: string;
  pages: number;
  keywords: string[];
  one_liner: string;
  one_liner_style: OneLinerStyle;
}

/** Roadmap 3-3 books columns (minus slot) + title. Our own tags only — no YES24 text. */
export type CatalogBook =
  | (CatalogBase & { entry: "leaf"; field: null; topic: null; way: null; axes: Record<AxisKey, Tag> })
  | (CatalogBase & { entry: "target"; field: string; topic: string; way: Way; axes: null });

/** What the browser gets for one bookmark: no scores, no tags beyond the name tag. */
export interface BookCard {
  id: string;
  entry: Entry;
  title: string;
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

- [ ] **Step 4: 검사·정리 함수**

`web/src/lib/books/normalize.ts`:
```ts
import { AXES, type AxisKey, type Tag, type Way } from "../recommend/types";
import { FIELD_OF_TOPIC, LEAF_GENRES, TOPICS, WAYS, type Topic } from "./taxonomy";
import type { CatalogBook, OneLinerStyle, Vocab } from "./types";

type Row = Record<string, unknown>;

const STYLE: Record<string, OneLinerStyle> = { summary: "summary", question: "question", 요약형: "summary", 질문형: "question" };
const bad = (isbn: string, why: string) => new Error(`${isbn || "(no isbn)"}: ${why}`);

function base(raw: Row, titles: ReadonlyMap<string, string>) {
  const isbn = typeof raw.isbn === "string" ? raw.isbn : String(raw.isbn ?? "");
  if (!/^\d{13}$/.test(isbn)) throw bad(isbn, "isbn must be 13 digits");
  const title = titles.get(isbn);
  if (!title) throw bad(isbn, "no title in d1_selected.csv");
  const pages = Number(raw.pages);
  if (!Number.isInteger(pages) || pages <= 0) throw bad(isbn, "pages must be a positive integer");
  const oneLiner = typeof raw.one_liner === "string" ? raw.one_liner.trim() : "";
  if (!oneLiner) throw bad(isbn, "one_liner is empty");
  const style = STYLE[String(raw.one_liner_style)];
  if (!style) throw bad(isbn, `unknown one_liner_style ${String(raw.one_liner_style)}`);
  return { isbn, title, pages, one_liner: oneLiner, one_liner_style: style };
}

/** One row of books_v1(_draft).json → CatalogBook. Genre / field / topic are derived from entry + slot. */
export function normalizeBook(raw: Row, titles: ReadonlyMap<string, string>): CatalogBook {
  const b = base(raw, titles);
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

export function normalizeCatalog(rows: unknown, titles: ReadonlyMap<string, string>): CatalogBook[] {
  const list: Row[] = Array.isArray(rows)
    ? (rows as Row[])
    : typeof rows === "object" && rows !== null
      ? Object.entries(rows as Record<string, Row>).map(([isbn, r]) => ({ isbn, ...r }))
      : [];
  if (!list.length) throw new Error("no books in source");
  const books = list.map((r) => normalizeBook(r, titles));
  const seen = new Set<string>();
  for (const book of books) {
    if (seen.has(book.isbn)) throw bad(book.isbn, "duplicate isbn");
    seen.add(book.isbn);
  }
  return books;
}

/** Minimal RFC 4180 reader: quoted fields, doubled quotes, CRLF, BOM. */
export function parseCsv(text: string): string[][] {
  const src = text.replace(/^﻿/, "");
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

export function titlesFromCsv(text: string): Map<string, string> {
  const [head = [], ...rows] = parseCsv(text);
  const iIsbn = head.indexOf("isbn");
  const iTitle = head.indexOf("title");
  if (iIsbn < 0 || iTitle < 0) throw new Error("d1_selected.csv needs isbn and title columns");
  return new Map(rows.map((r) => [r[iIsbn], r[iTitle]]));
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

- [ ] **Step 5: 복사 스크립트**

`web/scripts/import-books.ts`:
```ts
// Run from web/:  npm run books:import
// ../data/processed/books_v1.json (reviewed, D4) — or books_v1_draft.json (D3) until it exists —
// + d1_selected.csv titles + keyword_vocab.json  →  src/data/books.json, src/data/vocab.json.
// Only our own tags, one-liners and titles: no YES24 text.
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { normalizeCatalog, normalizeVocab, titlesFromCsv } from "../src/lib/books/normalize";

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
const titles = titlesFromCsv(readFileSync(path.join(processed, "d1_selected.csv"), "utf8"));
const books = normalizeCatalog(readJson(source), titles);
write("books.json", books);
const leaf = books.filter((b) => b.entry === "leaf").length;
console.log(`books.json: ${books.length} books (leaf ${leaf}, target ${books.length - leaf}) from ${path.basename(source)}`);
```

`web/package.json`의 `"scripts"`에 한 줄 추가 (`"e2e"` 다음):
```json
"books:import": "tsx scripts/import-books.ts"
```

- [ ] **Step 6: 가짜 책 30권**

`web/src/data/books.sample.json` — 가짜 제목·가짜 ISBN(`97900000000xx`, `97900000001xx`). 실제 책이 아니며 테스트와 E2E(`BOOKS_SOURCE=sample`)만 쓴다. 키워드는 v1.1 이름(+ 초안처럼 v1 이름 몇 개).
```json
[
 {"isbn":"9790000000001","entry":"leaf","title":"여름의 우편함","genre":"한국 소설","field":null,"topic":null,"pages":280,"way":null,"axes":{"temp":1,"pull":-1,"gain":-1,"world":1},"keywords":[],"one_liner":"보내지 못한 편지는 어디로 갈까요?","one_liner_style":"question"},
 {"isbn":"9790000000002","entry":"leaf","title":"골목 끝 집의 불빛","genre":"한국 소설","field":null,"topic":null,"pages":320,"way":null,"axes":{"temp":-1,"pull":-1,"gain":-1,"world":1},"keywords":[],"one_liner":"그 집의 불은 왜 늘 켜져 있었을까요?","one_liner_style":"question"},
 {"isbn":"9790000000003","entry":"leaf","title":"먼 바다의 등대지기","genre":"외국 소설","field":null,"topic":null,"pages":410,"way":null,"axes":{"temp":1,"pull":1,"gain":-1,"world":1},"keywords":[],"one_liner":"혼자 지키는 불빛은 외로울까요?","one_liner_style":"question"},
 {"isbn":"9790000000004","entry":"leaf","title":"두 번째 달의 도시","genre":"SF·판타지","field":null,"topic":null,"pages":450,"way":null,"axes":{"temp":-1,"pull":-1,"gain":0,"world":-1},"keywords":[],"one_liner":"달이 둘이면 밤은 더 밝을까요?","one_liner_style":"question"},
 {"isbn":"9790000000005","entry":"leaf","title":"하루를 파는 서점","genre":"SF·판타지","field":null,"topic":null,"pages":300,"way":null,"axes":{"temp":1,"pull":-1,"gain":-1,"world":-1},"keywords":[],"one_liner":"하루를 판다면 어떤 날을 고를까요?","one_liner_style":"question"},
 {"isbn":"9790000000006","entry":"leaf","title":"마지막 기차의 승객","genre":"추리·스릴러","field":null,"topic":null,"pages":380,"way":null,"axes":{"temp":-1,"pull":-1,"gain":0,"world":1},"keywords":[],"one_liner":"그 기차에는 몇 명이 타고 있었을까요?","one_liner_style":"question"},
 {"isbn":"9790000000007","entry":"leaf","title":"빈 방의 알리바이","genre":"추리·스릴러","field":null,"topic":null,"pages":420,"way":null,"axes":{"temp":-1,"pull":-1,"gain":0,"world":1},"keywords":[],"one_liner":"아무도 없던 방에서 무슨 일이 있었을까요?","one_liner_style":"question"},
 {"isbn":"9790000000008","entry":"leaf","title":"천천히 걷는 아침","genre":"에세이","field":null,"topic":null,"pages":220,"way":null,"axes":{"temp":1,"pull":1,"gain":-1,"world":0},"keywords":[],"one_liner":"오늘 아침은 몇 걸음이었을까요?","one_liner_style":"question"},
 {"isbn":"9790000000009","entry":"leaf","title":"혼자 먹는 저녁","genre":"에세이","field":null,"topic":null,"pages":240,"way":null,"axes":{"temp":1,"pull":1,"gain":-1,"world":0},"keywords":[],"one_liner":"혼자 먹는 밥도 따뜻할 수 있을까요?","one_liner_style":"question"},
 {"isbn":"9790000000010","entry":"leaf","title":"창가의 단어들","genre":"시","field":null,"topic":null,"pages":120,"way":null,"axes":{"temp":-1,"pull":1,"gain":-1,"world":-1},"keywords":[],"one_liner":"비 오는 날의 단어는 무슨 색일까요?","one_liner_style":"question"},
 {"isbn":"9790000000011","entry":"leaf","title":"질문하는 사람들","genre":"인문","field":null,"topic":null,"pages":350,"way":null,"axes":{"temp":0,"pull":1,"gain":1,"world":0},"keywords":[],"one_liner":"좋은 질문은 어디서 올까요?","one_liner_style":"question"},
 {"isbn":"9790000000012","entry":"leaf","title":"별빛이 걸린 시간","genre":"과학 교양","field":null,"topic":null,"pages":330,"way":null,"axes":{"temp":0,"pull":-1,"gain":1,"world":0},"keywords":[],"one_liner":"별빛은 얼마나 먼 길을 왔을까요?","one_liner_style":"question"},
 {"isbn":"9790000000101","entry":"target","title":"처음 만나는 쿼리","genre":"데이터 분석","field":"데이터·통계","topic":"데이터 분석","pages":240,"way":"실습","axes":null,"keywords":["SQL"],"one_liner":"표에서 원하는 줄만 꺼내는 쿼리를 익혀요","one_liner_style":"summary"},
 {"isbn":"9790000000102","entry":"target","title":"쿼리로 답하는 질문들","genre":"데이터 분석","field":"데이터·통계","topic":"데이터 분석","pages":310,"way":"사례","axes":null,"keywords":["SQL"],"one_liner":"현업 질문을 쿼리 한 줄로 푸는 과정을 따라가요","one_liner_style":"summary"},
 {"isbn":"9790000000103","entry":"target","title":"숫자로 말하는 보고서","genre":"데이터 분석","field":"데이터·통계","topic":"데이터 분석","pages":280,"way":"사례","axes":null,"keywords":["시각화"],"one_liner":"분석 결과를 한 장으로 설명하는 법을 배워요","one_liner_style":"summary"},
 {"isbn":"9790000000104","entry":"target","title":"분석 질문 세우기","genre":"데이터 분석","field":"데이터·통계","topic":"데이터 분석","pages":260,"way":"개념","axes":null,"keywords":[],"one_liner":"질문을 세우고 데이터를 고르는 순서를 알아요","one_liner_style":"summary"},
 {"isbn":"9790000000105","entry":"target","title":"표 하나로 끝내는 분석","genre":"데이터 분석","field":"데이터·통계","topic":"데이터 분석","pages":420,"way":"실습","axes":null,"keywords":["엑셀"],"one_liner":"표 하나로 분석 흐름을 끝까지 해 봐요","one_liner_style":"summary"},
 {"isbn":"9790000000106","entry":"target","title":"평균에서 확률까지","genre":"통계","field":"데이터·통계","topic":"통계","pages":230,"way":"개념","axes":null,"keywords":["기초 통계","확률"],"one_liner":"평균과 분산부터 확률까지 차근차근 짚어요","one_liner_style":"summary"},
 {"isbn":"9790000000107","entry":"target","title":"직접 그리는 회귀선","genre":"통계","field":"데이터·통계","topic":"통계","pages":390,"way":"실습","axes":null,"keywords":["회귀분석"],"one_liner":"회귀선을 직접 그리며 예측 모형을 만들어요","one_liner_style":"summary"},
 {"isbn":"9790000000108","entry":"target","title":"검정 결과 바로 읽기","genre":"통계","field":"데이터·통계","topic":"통계","pages":250,"way":"개념","axes":null,"keywords":["가설검정"],"one_liner":"검정 결과를 오해 없이 읽는 법을 알려줘요","one_liner_style":"summary"},
 {"isbn":"9790000000109","entry":"target","title":"대화형 AI 업무 노트","genre":"AI 활용","field":"AI·IT 활용","topic":"AI 활용","pages":270,"way":"실습","axes":null,"keywords":["챗GPT","프롬프트 엔지니어링"],"one_liner":"질문 한 줄을 바꿔 더 좋은 답을 얻는 법을 익혀요","one_liner_style":"summary"},
 {"isbn":"9790000000110","entry":"target","title":"AI 동료와 일하기","genre":"AI 활용","field":"AI·IT 활용","topic":"AI 활용","pages":300,"way":"사례","axes":null,"keywords":["클로드","AI 에이전트"],"one_liner":"AI에게 일을 나눠 맡긴 사례를 모아 보여줘요","one_liner_style":"summary"},
 {"isbn":"9790000000111","entry":"target","title":"생성형 AI의 속사정","genre":"AI 활용","field":"AI·IT 활용","topic":"AI 활용","pages":360,"way":"개념","axes":null,"keywords":["LLM 원리"],"one_liner":"AI가 답을 만드는 원리를 쉽게 풀어요","one_liner_style":"summary"},
 {"isbn":"9790000000112","entry":"target","title":"반복 업무 자동화 첫 주","genre":"업무 자동화","field":"AI·IT 활용","topic":"업무 자동화","pages":330,"way":"실습","axes":null,"keywords":["파이썬 자동화"],"one_liner":"반복하던 파일 정리를 코드 몇 줄로 끝내요","one_liner_style":"summary"},
 {"isbn":"9790000000113","entry":"target","title":"문서 작업을 맡기는 법","genre":"업무 자동화","field":"AI·IT 활용","topic":"업무 자동화","pages":240,"way":"실습","axes":null,"keywords":["코파일럿·M365"],"one_liner":"문서와 메일 작업을 AI 비서에게 맡겨 봐요","one_liner_style":"summary"},
 {"isbn":"9790000000114","entry":"target","title":"하루 한 시간 아끼기","genre":"업무 자동화","field":"AI·IT 활용","topic":"업무 자동화","pages":280,"way":"사례","axes":null,"keywords":["AI 업무 활용"],"one_liner":"자동화로 하루 한 시간을 아낀 사례를 모았어요","one_liner_style":"summary"},
 {"isbn":"9790000000115","entry":"target","title":"2분짜리 습관","genre":"습관·집중","field":"습관·자기계발","topic":"습관·집중","pages":260,"way":"사례","axes":null,"keywords":["습관"],"one_liner":"아주 작은 습관이 쌓이는 과정을 보여줘요","one_liner_style":"summary"},
 {"isbn":"9790000000116","entry":"target","title":"흩어지는 주의 붙잡기","genre":"습관·집중","field":"습관·자기계발","topic":"습관·집중","pages":340,"way":"개념","axes":null,"keywords":["집중력","뇌과학"],"one_liner":"산만해지는 이유를 뇌의 작동으로 설명해요","one_liner_style":"summary"},
 {"isbn":"9790000000117","entry":"target","title":"일을 끝내는 하루","genre":"시간·생산성","field":"습관·자기계발","topic":"시간·생산성","pages":250,"way":"사례","axes":null,"keywords":["일하는 법"],"one_liner":"일을 끝내는 사람들의 하루 순서를 따라가요","one_liner_style":"summary"},
 {"isbn":"9790000000118","entry":"target","title":"끝까지 가는 계획표","genre":"시간·생산성","field":"습관·자기계발","topic":"시간·생산성","pages":290,"way":"실습","axes":null,"keywords":["계획·목표"],"one_liner":"주간 계획표를 채우며 끝까지 가는 법을 익혀요","one_liner_style":"summary"}
]
```

- [ ] **Step 7: 실제 초안 복사**

D3 초안(`data/processed/books_v1_draft.json`, 200권)이 이미 있다. 검수본(`books_v1.json`)이 생기면 같은 명령이 그것을 먼저 쓴다.

Run:
```bash
cd web
mkdir -p src/data
npm run books:import
```
Expected:
```
vocab.json: 20 keywords
books.json: 200 books (leaf 100, target 100) from books_v1_draft.json
```
오류(`…: no title in d1_selected.csv`, `unknown leaf genre …` 등)가 나면 **초안을 고치지 말고** 멈추고 그 줄을 보고한다. 초안의 🎯 `keywords`에는 v1 이름(시각화·엑셀·R 등 v1.1에서 접힌 말)이 섞여 있다 — 그대로 둔다(점수는 요청 키워드와 겹칠 때만 오르고, 요청 키워드는 v1.1 20개 안에서만 나온다).

- [ ] **Step 8: 통과 확인**

Run: `npx vitest run src/lib/books && npm run typecheck && npm run lint`
Expected: PASS (taxonomy 4, normalize 17, data 4), 타입·린트 오류 없음

- [ ] **Step 9: Commit**

```bash
git add web/src/lib/books web/scripts/import-books.ts web/src/data web/package.json
git commit -m "feat(books): import our tags and titles into the app with a 30-book sample"
```

---

### Task 3: 🎯 직접 쓰기 — 단어 매칭

**Files:**
- Create: `web/src/lib/goal/match.ts`
- Test: `web/src/lib/goal/match.test.ts`

**Interfaces:**
- Consumes: `TOPIC_CHIPS`, `TOPICS`, `type Topic` (Task 2 `taxonomy.ts`), `type Vocab` (Task 2 `types.ts`)
- Produces: `GOAL_MAX = 30`, `interface GoalMatch { text: string; topic: Topic; keywords: string[]; matched: boolean; method: "word" }`, `matchGoal(input: string, vocab: Vocab): GoalMatch`
  - 순서: ① 키워드 패턴 — 가장 많이 맞은 주제, 같으면 칩 순서 ② 주제 이름·칩 이름·접힌 말의 낱말 ③ 아무것도 없으면 `matched: false` + 글자 쌍이 가장 많이 겹치는 주제(하나도 없으면 첫 칩 "데이터 분석"). ③은 첫 장에서 `coverageNotice(0, …)`로 솔직하게 알린다

- [ ] **Step 1: 실패하는 테스트**

`web/src/lib/goal/match.test.ts`:
```ts
import { describe, expect, it } from "vitest";
import type { Vocab } from "@/lib/books/types";
import { GOAL_MAX, matchGoal } from "./match";

// A slice of keyword_vocab.json v1.1 so this test does not move when the real list grows.
const VOCAB: Vocab = {
  "데이터 분석": { keywords: { SQL: "SQL|쿼리|데이터베이스" }, terms: ["파이썬", "엑셀", "시각화"] },
  통계: { keywords: { 회귀분석: "회귀", 확률: "확률" }, terms: ["베이즈"] },
  "AI 활용": { keywords: { 챗GPT: "챗GPT|ChatGPT" }, terms: [] },
  "업무 자동화": { keywords: { "파이썬 자동화": "파이썬|Python", "AI 업무 활용": "챗GPT|ChatGPT|생성형 ?AI" }, terms: ["노션"] },
  "습관·집중": { keywords: { "마음·회복": "회복 ?탄력성|스트레스|번아웃|불안" }, terms: ["도파민"] },
  "시간·생산성": { keywords: { "일하는 법": "일 ?잘하는|업무 ?효율|생산성" }, terms: ["시간 관리"] },
};

describe("matchGoal", () => {
  it("finds a keyword from our closed list", () => {
    expect(matchGoal("SQL 공부", VOCAB)).toEqual({ text: "SQL 공부", topic: "데이터 분석", keywords: ["SQL"], matched: true, method: "word" });
  });

  it("matches keyword patterns without caring about case", () => {
    expect(matchGoal("chatgpt 잘 쓰기", VOCAB)).toMatchObject({ topic: "AI 활용", keywords: ["챗GPT"], matched: true });
  });

  it("breaks keyword ties by chip order", () => {
    // 챗GPT is a keyword in both AI 활용 and 업무 자동화 (AI 업무 활용): AI 활용 comes first.
    expect(matchGoal("ChatGPT", VOCAB).topic).toBe("AI 활용");
  });

  it("prefers keywords over topic words", () => {
    expect(matchGoal("파이썬으로 엑셀 정리", VOCAB)).toMatchObject({ topic: "업무 자동화", keywords: ["파이썬 자동화"] });
  });

  it("finds worries, not only subjects", () => {
    expect(matchGoal("번아웃", VOCAB)).toMatchObject({ topic: "습관·집중", keywords: ["마음·회복"], matched: true });
  });

  it("falls back to topic names and folded words", () => {
    expect(matchGoal("시간 관리가 어려워요", VOCAB)).toMatchObject({ topic: "시간·생산성", keywords: [], matched: true });
    expect(matchGoal("통계", VOCAB)).toMatchObject({ topic: "통계", keywords: [], matched: true });
    expect(matchGoal("AI", VOCAB)).toMatchObject({ topic: "AI 활용", matched: true });
  });

  it("says honestly when nothing in our list matched", () => {
    expect(matchGoal("발표 준비", VOCAB)).toEqual({ text: "발표 준비", topic: "데이터 분석", keywords: [], matched: false, method: "word" });
    expect(matchGoal("   ", VOCAB)).toMatchObject({ matched: false, text: "" });
  });

  it("keeps at most 30 characters", () => {
    expect(matchGoal(`  ${"가".repeat(40)}  `, VOCAB).text).toHaveLength(GOAL_MAX);
  });
});
```

- [ ] **Step 2: 실패 확인**

Run: `cd web && npx vitest run src/lib/goal`
Expected: FAIL — `Failed to resolve import "./match"`

- [ ] **Step 3: 구현**

`web/src/lib/goal/match.ts`:
```ts
import { TOPIC_CHIPS, TOPICS, type Topic } from "@/lib/books/taxonomy";
import type { Vocab } from "@/lib/books/types";

/** target-chips.md 1절: 직접 쓰기 is 30 characters. */
export const GOAL_MAX = 30;

export interface GoalMatch {
  text: string;          // what the person wrote, trimmed, at most 30 characters (E-21)
  topic: Topic;
  keywords: string[];    // only names from our closed keyword list
  matched: boolean;      // false: nothing in our list matched — topic is only the nearest guess
  method: "word";        // P4 adds "llm"
}

const squash = (s: string) => s.toLowerCase().replace(/\s+/g, "");

function bigrams(s: string): Set<string> {
  const out = new Set<string>();
  for (let i = 0; i < s.length - 1; i++) out.add(s.slice(i, i + 2));
  return out;
}

/** Topic name, chip label, folded / too-common words and keyword names, cut at "·" and spaces (2+ letters). */
function topicWords(topic: Topic, vocab: Vocab): string[] {
  const label = TOPIC_CHIPS.find((c) => c.topic === topic)?.label ?? topic;
  const words = [topic, label, ...(vocab[topic]?.terms ?? []), ...Object.keys(vocab[topic]?.keywords ?? {})];
  return [...new Set(words.flatMap((w) => w.split(/[·\s]+/)).map(squash).filter((w) => w.length >= 2))];
}

/** Highest score wins; chip order breaks ties; all zero keeps the first chip. */
function rank(score: (topic: Topic) => number): { topic: Topic; score: number } {
  return TOPICS.reduce<{ topic: Topic; score: number }>((best, topic) => {
    const s = score(topic);
    return s > best.score ? { topic, score: s } : best;
  }, { topic: TOPICS[0], score: 0 });
}

/** P3 word matching for 직접 쓰기 — only inside our topics and keywords (P4 puts the LLM in front of this). */
export function matchGoal(input: string, vocab: Vocab): GoalMatch {
  const text = input.trim().slice(0, GOAL_MAX);
  const flat = squash(text);
  const base = { text, keywords: [] as string[], method: "word" as const };
  if (!flat) return { ...base, topic: TOPICS[0], matched: false };

  let top: { topic: Topic; keywords: string[] } | null = null;
  for (const topic of TOPICS) {
    const hits = Object.entries(vocab[topic]?.keywords ?? {})
      .filter(([, pattern]) => new RegExp(pattern, "i").test(text))
      .map(([name]) => name);
    if (hits.length > (top?.keywords.length ?? 0)) top = { topic, keywords: hits };
  }
  if (top) return { ...base, ...top, matched: true };

  const byWords = rank((topic) => topicWords(topic, vocab).filter((w) => flat.includes(w)).length);
  if (byWords.score > 0) return { ...base, topic: byWords.topic, matched: true };

  const grams = bigrams(flat);
  const nearest = rank((topic) => topicWords(topic, vocab).reduce((n, w) => n + [...bigrams(w)].filter((g) => grams.has(g)).length, 0));
  return { ...base, topic: nearest.topic, matched: false };
}
```

- [ ] **Step 4: 통과 확인 (+ 실제 목록으로 한 번)**

Run:
```bash
npx vitest run src/lib/goal
npx tsx -e "import v from './src/data/vocab.json'; import { matchGoal } from './src/lib/goal/match'; for (const s of ['SQL 공부','번아웃','M365 쓰는 법','365일 습관','엑셀 함수','발표 준비']) console.log(s, JSON.stringify(matchGoal(s, v as never)))"
```
Expected: PASS (8 tests). 실제 목록: `SQL 공부 → 데이터 분석 ["SQL"]`, `번아웃 → 습관·집중 ["마음·회복"]`, `M365 쓰는 법 → 업무 자동화 ["코파일럿·M365"]`, `365일 습관 → 습관·집중 ["습관"]`, `엑셀 함수 → 데이터 분석 [] matched true`, `발표 준비 → 데이터 분석 [] matched false`

- [ ] **Step 5: Commit**

```bash
git add web/src/lib/goal
git commit -m "feat(goal): match a written goal to our topics and keywords by words"
```

---

### Task 4: 뽑기 서버 — `POST /api/books/draw` (로드맵의 P4 항목을 P3로 당김)

**Files:**
- Create: `web/src/lib/books/catalog.ts`, `web/src/lib/books/request.ts`, `web/src/lib/books/draw.ts`, `web/src/app/api/books/draw/route.ts`
- Modify: `web/playwright.config.ts` (`BOOKS_SOURCE: "sample"`)
- Test: `web/src/lib/books/draw.test.ts`, `web/src/app/api/books/draw/route.test.ts`

**Interfaces:**
- Consumes: `drawBookmarks`, `leafAnswersFrom`, `leafScore`, `targetScore`, `maxPossibleLeaf`, `maxPossibleTarget`, `LEAF_PARAMS`, `TARGET_PARAMS`, `QUESTION_AXIS`, `mulberry32`, 타입 `Book`, `BalanceChoice`, `TargetAnswers`, `DrawResult`, `Rng`, `Tag`, `Way` (`@/lib/recommend`); Task 2 `CatalogBook`, `BookCard`, `DrawResponse`, `Vocab`, `FIELD_OF_TOPIC`, `TOPICS`, `WAYS`
- Produces:
  - `catalog(): CatalogBook[]` (`BOOKS_SOURCE=sample`이면 가짜 30권), `toBook(b: CatalogBook): Book`, `toCard(b: CatalogBook): BookCard` — `catalog.ts`
  - `type DrawQuery = { entry: "leaf"; choices: BalanceChoice[] } | { entry: "target"; answers: TargetAnswers }`, `interface DrawRequest { query: DrawQuery; seen: string[]; seed: number | null }`, `parseDrawRequest(body: unknown, vocab: Vocab): DrawRequest | null`, `MAX_SEEN = 1000` — `request.ts`
  - `drawLeaf(choices: BalanceChoice[], seen: ReadonlySet<string>, rng: Rng, books: CatalogBook[]): DrawResponse`, `drawTarget(answers: TargetAnswers, seen: ReadonlySet<string>, rng: Rng, books: CatalogBook[]): DrawResponse` — `draw.ts`
  - HTTP: `POST /api/books/draw` 몸통 `{ entry: "leaf", choices: BalanceChoice[9], seen?: string[], seed?: number }` 또는 `{ entry: "target", answers: { topic, way: Way | null, len: -1 | 0 | 1, keywords: string[] }, seen?: string[], seed?: number }` → 200 `DrawResponse` / 잘못된 몸통 400 `{ error }`
  - 규칙: 🍃 무작위 풀 = 🍃 전체, 🎯 무작위 풀 = 같은 분야. 🎯는 **그 주제 책 어디에도 없는 요청 키워드를 점수 전에 뺀다**(그래야 `maxPossibleTarget`이 불가능한 키워드로 부풀지 않는다). `found` = 남은 키워드를 가진 주제 책 수(키워드를 안 물었으면 주제 책 수)

- [ ] **Step 1: 실패하는 테스트 — 입구별 도우미**

`web/src/lib/books/draw.test.ts`:
```ts
// @vitest-environment node
import { describe, expect, it } from "vitest";
import sample from "@/data/books.sample.json";
import { mulberry32 } from "@/lib/recommend";
import { drawLeaf, drawTarget } from "./draw";
import type { CatalogBook } from "./types";

const BOOKS = sample as unknown as CatalogBook[];
const byId = new Map(BOOKS.map((b) => [b.isbn, b]));
const none = new Set<string>();
const LEAF_CHOICES = ["A", "A", "B", "A", "A", "B", "B", "A", "A"] as const;

describe("drawLeaf", () => {
  it("draws five different 🍃 books, one of them random", () => {
    const res = drawLeaf([...LEAF_CHOICES], none, mulberry32(7), BOOKS);
    expect(res.picks).toHaveLength(5);
    expect(new Set(res.picks.map((p) => p.card.id)).size).toBe(5);
    expect(res.picks.filter((p) => p.kind === "random")).toHaveLength(1);
    expect(res.picks.every((p) => p.card.entry === "leaf")).toBe(true);
    expect(res.found).toBeNull();
    expect(res.keywords).toEqual([]);
  });

  it("never returns a book already shown in this session", () => {
    const seen = new Set(BOOKS.filter((b) => b.entry === "leaf").slice(0, 6).map((b) => b.isbn));
    const res = drawLeaf([...LEAF_CHOICES], seen, mulberry32(3), BOOKS);
    expect(res.picks).toHaveLength(5);
    expect(res.picks.some((p) => seen.has(p.card.id))).toBe(false);
  });

  it("returns an empty, exhausted draw when every 🍃 book was shown", () => {
    const seen = new Set(BOOKS.map((b) => b.isbn));
    expect(drawLeaf([...LEAF_CHOICES], seen, mulberry32(1), BOOKS)).toMatchObject({ picks: [], exhausted: true });
  });
});

describe("drawTarget", () => {
  it("keeps recommended picks in the topic and the random one in the same field", () => {
    const res = drawTarget({ topic: "데이터 분석", way: "실습", len: 1, keywords: [] }, none, mulberry32(5), BOOKS);
    expect(res.picks).toHaveLength(5);
    for (const p of res.picks) {
      const book = byId.get(p.card.id);
      if (p.kind === "recommended") expect(book?.topic).toBe("데이터 분석");
      else expect(book?.field).toBe("데이터·통계");
    }
    expect(res.found).toBe(5);
  });

  it("counts keyword matches for the coverage notice", () => {
    const res = drawTarget({ topic: "데이터 분석", way: null, len: 0, keywords: ["SQL"] }, none, mulberry32(2), BOOKS);
    expect(res.keywords).toEqual(["SQL"]);
    expect(res.found).toBe(2);
  });

  it("drops keywords no book in the topic has", () => {
    const res = drawTarget({ topic: "AI 활용", way: null, len: 0, keywords: ["챗GPT", "제미나이"] }, none, mulberry32(2), BOOKS);
    expect(res.keywords).toEqual(["챗GPT"]);
    expect(res.found).toBe(1);
    const nothing = drawTarget({ topic: "AI 활용", way: null, len: 0, keywords: ["제미나이"] }, none, mulberry32(2), BOOKS);
    expect(nothing.keywords).toEqual([]);
    expect(nothing.found).toBe(0);
  });

  it("does not call a draw exhausted because of an impossible keyword", () => {
    const habit = (i: number): CatalogBook => ({
      isbn: `97911111111${String(i).padStart(2, "0")}`, entry: "target", title: `습관 ${i}`, genre: "습관·집중",
      field: "습관·자기계발", topic: "습관·집중", pages: 300, way: "사례", axes: null, keywords: ["습관"],
      one_liner: "습관을 만드는 법을 알려줘요", one_liner_style: "summary",
    });
    const five = [1, 2, 3, 4, 5].map(habit);
    // Without dropping, maxPossible would be 9 (three keywords) and a mean score of 3 would look exhausted.
    const res = drawTarget({ topic: "습관·집중", way: null, len: 0, keywords: ["습관", "뇌과학", "집중력"] }, none, mulberry32(3), five);
    expect(res.keywords).toEqual(["습관"]);
    expect(res.exhausted).toBe(false);
  });
});
```

`web/src/app/api/books/draw/route.test.ts`:
```ts
// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { POST } from "./route";

const NINE = ["A", "unsure", "B", "A", "A", "B", "B", "A", "A"];
const req = (body: unknown) =>
  new Request("http://x/api/books/draw", { method: "POST", body: typeof body === "string" ? body : JSON.stringify(body) });

describe("POST /api/books/draw", () => {
  beforeEach(() => vi.stubEnv("BOOKS_SOURCE", "sample"));
  afterEach(() => vi.unstubAllEnvs());

  it("draws 🍃 books for nine balance answers", async () => {
    const res = await POST(req({ entry: "leaf", choices: NINE, seen: [], seed: 7 }));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.picks).toHaveLength(5);
    expect(body.found).toBeNull();
  });

  it("is reproducible for a seed", async () => {
    const a = await (await POST(req({ entry: "leaf", choices: NINE, seed: 11 }))).json();
    const b = await (await POST(req({ entry: "leaf", choices: NINE, seed: 11 }))).json();
    expect(a).toEqual(b);
  });

  it("draws 🎯 books with the coverage count", async () => {
    const res = await POST(req({ entry: "target", answers: { topic: "데이터 분석", way: null, len: 0, keywords: ["SQL"] }, seen: [], seed: 1 }));
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ found: 2, keywords: ["SQL"] });
  });

  it("sends only what a bookmark shows — no scores, no tags", async () => {
    const body = await (await POST(req({ entry: "leaf", choices: NINE, seed: 3 }))).json();
    expect(Object.keys(body.picks[0]).sort()).toEqual(["card", "kind"]);
    expect(Object.keys(body.picks[0].card).sort()).toEqual(["entry", "field", "genre", "id", "oneLiner", "oneLinerStyle", "title"]);
  });

  it.each([
    ["not JSON", "{"],
    ["an unknown entry", { entry: "shelf" }],
    ["eight answers", { entry: "leaf", choices: NINE.slice(1) }],
    ["an unknown answer", { entry: "leaf", choices: [...NINE.slice(1), "C"] }],
    ["an unknown topic", { entry: "target", answers: { topic: "요리", way: null, len: 0, keywords: [] } }],
    ["an unknown way", { entry: "target", answers: { topic: "통계", way: "독학", len: 0, keywords: [] } }],
    ["a length outside -1..1", { entry: "target", answers: { topic: "통계", way: null, len: 2, keywords: [] } }],
    ["a keyword of another topic", { entry: "target", answers: { topic: "통계", way: null, len: 0, keywords: ["SQL"] } }],
    ["too many keywords", { entry: "target", answers: { topic: "통계", way: null, len: 0, keywords: ["확률", "확률", "확률", "확률", "확률", "확률"] } }],
    ["seen that is not a list of ids", { entry: "leaf", choices: NINE, seen: "9790000000001" }],
    ["a seen id that is not a string", { entry: "leaf", choices: NINE, seen: [9790000000001] }],
    ["a negative seed", { entry: "leaf", choices: NINE, seed: -1 }],
    ["a body over the size cap", { entry: "leaf", choices: NINE, seen: Array.from({ length: 2500 }, (_, i) => `id-${i}-padding`) }],
  ])("rejects %s with 400", async (_, body) => {
    expect((await POST(req(body))).status).toBe(400);
  });
});
```

- [ ] **Step 2: 실패 확인**

Run: `cd web && npx vitest run src/lib/books/draw.test.ts src/app/api/books`
Expected: FAIL — `Failed to resolve import "./draw"` / `"./route"`

- [ ] **Step 3: 책 목록·카드**

`web/src/lib/books/catalog.ts`:
```ts
import real from "@/data/books.json";
import sample from "@/data/books.sample.json";
import type { Book } from "@/lib/recommend";
import type { BookCard, CatalogBook } from "./types";

/** BOOKS_SOURCE=sample (E2E, tests) draws from the 30-book fixture; otherwise the imported catalogue. Read on every call. */
export function catalog(): CatalogBook[] {
  return (process.env.BOOKS_SOURCE === "sample" ? sample : real) as unknown as CatalogBook[];
}

export function toBook(b: CatalogBook): Book {
  if (b.entry === "leaf") return { id: b.isbn, entry: "leaf", genre: b.genre, pages: b.pages, axes: b.axes };
  return { id: b.isbn, entry: "target", field: b.field, topic: b.topic, genre: b.genre, pages: b.pages, way: b.way, keywords: b.keywords };
}

export function toCard(b: CatalogBook): BookCard {
  return { id: b.isbn, entry: b.entry, title: b.title, genre: b.genre, field: b.field, oneLiner: b.one_liner, oneLinerStyle: b.one_liner_style };
}
```

- [ ] **Step 4: 요청 검사**

`web/src/lib/books/request.ts`:
```ts
import { QUESTION_AXIS, type BalanceChoice, type Tag, type TargetAnswers, type Way } from "@/lib/recommend";
import { TOPICS, WAYS } from "./taxonomy";
import type { Vocab } from "./types";

export type DrawQuery = { entry: "leaf"; choices: BalanceChoice[] } | { entry: "target"; answers: TargetAnswers };
export interface DrawRequest { query: DrawQuery; seen: string[]; seed: number | null }

export const MAX_SEEN = 1000;
const MAX_ID = 32;
const MAX_KEYWORDS = 5;
const CHOICES: ReadonlySet<unknown> = new Set(["A", "B", "unsure"]);

const isObject = (x: unknown): x is Record<string, unknown> => typeof x === "object" && x !== null && !Array.isArray(x);

function parseSeen(x: unknown): string[] | null {
  if (x === undefined) return [];
  if (!Array.isArray(x) || x.length > MAX_SEEN) return null;
  return x.every((id) => typeof id === "string" && id.length > 0 && id.length <= MAX_ID) ? (x as string[]) : null;
}

/** undefined = invalid, null = not given. */
function parseSeed(x: unknown): number | null | undefined {
  if (x === undefined) return null;
  return typeof x === "number" && Number.isInteger(x) && x >= 0 && x < 2 ** 32 ? x : undefined;
}

function parseTarget(x: unknown, vocab: Vocab): TargetAnswers | null {
  if (!isObject(x)) return null;
  const { topic, way, len, keywords } = x;
  if (typeof topic !== "string" || !(TOPICS as readonly string[]).includes(topic)) return null;
  if (way !== null && !WAYS.includes(way as Way)) return null;
  if (len !== -1 && len !== 0 && len !== 1) return null;
  if (!Array.isArray(keywords) || keywords.length > MAX_KEYWORDS) return null;
  const known = vocab[topic]?.keywords ?? {};
  if (!keywords.every((k) => typeof k === "string" && Object.hasOwn(known, k))) return null;
  return { topic, way: way as Way | null, len: len as Tag, keywords: keywords as string[] };
}

/** Strict check of the draw body: anything unexpected is a 400, never a silent default. */
export function parseDrawRequest(body: unknown, vocab: Vocab): DrawRequest | null {
  if (!isObject(body)) return null;
  const seen = parseSeen(body.seen);
  const seed = parseSeed(body.seed);
  if (!seen || seed === undefined) return null;
  if (body.entry === "leaf") {
    const c = body.choices;
    if (!Array.isArray(c) || c.length !== QUESTION_AXIS.length || !c.every((v) => CHOICES.has(v))) return null;
    return { query: { entry: "leaf", choices: c as BalanceChoice[] }, seen, seed };
  }
  if (body.entry === "target") {
    const answers = parseTarget(body.answers, vocab);
    return answers ? { query: { entry: "target", answers }, seen, seed } : null;
  }
  return null;
}
```

- [ ] **Step 5: 입구별 뽑기 도우미**

`web/src/lib/books/draw.ts`:
```ts
import {
  drawBookmarks, leafAnswersFrom, leafScore, maxPossibleLeaf, maxPossibleTarget, targetScore, LEAF_PARAMS, TARGET_PARAMS,
  type BalanceChoice, type DrawResult, type Rng, type TargetAnswers,
} from "@/lib/recommend";
import { toBook, toCard } from "./catalog";
import { FIELD_OF_TOPIC, type Topic } from "./taxonomy";
import type { CatalogBook, DrawResponse } from "./types";

function respond(res: DrawResult, pool: CatalogBook[], extra: Pick<DrawResponse, "found" | "keywords">): DrawResponse {
  const byId = new Map(pool.map((b) => [b.isbn, b]));
  return {
    picks: res.picks.map((p) => ({ card: toCard(byId.get(p.book.id) as CatalogBook), kind: p.kind })),
    exhausted: res.exhausted,
    widened: res.widened,
    ...extra,
  };
}

/** 🍃: balance answers → axis scores; the random slot comes from every 🍃 book (book-pool.md ⑦). */
export function drawLeaf(choices: BalanceChoice[], seen: ReadonlySet<string>, rng: Rng, books: CatalogBook[]): DrawResponse {
  const pool = books.filter((b) => b.entry === "leaf");
  const answers = leafAnswersFrom(choices);
  const res = drawBookmarks(
    pool.map(toBook),
    { score: (b) => (b.entry === "leaf" ? leafScore(b, answers) : null), maxPossible: maxPossibleLeaf(answers) },
    { ...LEAF_PARAMS, seen, rng, inRandomPool: (b) => b.entry === "leaf" },
  );
  return respond(res, pool, { found: null, keywords: [] });
}

/** 🎯: topic is required; keywords no book in the topic has are dropped before scoring; the random slot stays in the field. */
export function drawTarget(answers: TargetAnswers, seen: ReadonlySet<string>, rng: Rng, books: CatalogBook[]): DrawResponse {
  const pool = books.filter((b) => b.entry === "target");
  const inTopic = pool.filter((b) => b.topic === answers.topic);
  const keywords = answers.keywords.filter((k) => inTopic.some((b) => b.keywords.includes(k)));
  const scored: TargetAnswers = { ...answers, keywords };
  const field = FIELD_OF_TOPIC[answers.topic as Topic];
  const res = drawBookmarks(
    pool.map(toBook),
    { score: (b) => (b.entry === "target" ? targetScore(b, scored) : null), maxPossible: maxPossibleTarget(scored) },
    { ...TARGET_PARAMS, seen, rng, inRandomPool: (b) => b.entry === "target" && b.field === field },
  );
  const found = answers.keywords.length
    ? inTopic.filter((b) => b.keywords.some((k) => keywords.includes(k))).length
    : inTopic.length;
  return respond(res, pool, { found, keywords });
}
```

- [ ] **Step 6: 라우트**

`web/src/app/api/books/draw/route.ts`:
```ts
import vocab from "@/data/vocab.json";
import { catalog } from "@/lib/books/catalog";
import { drawLeaf, drawTarget } from "@/lib/books/draw";
import { parseDrawRequest } from "@/lib/books/request";
import type { Vocab } from "@/lib/books/types";
import { mulberry32 } from "@/lib/recommend";

// 1000 seen ids × ~16 bytes + answers stay well under this.
const MAX_BYTES = 32_000;

export async function POST(request: Request): Promise<Response> {
  const raw = await request.text();
  if (new TextEncoder().encode(raw).length > MAX_BYTES) return Response.json({ error: "too large" }, { status: 400 });
  let body: unknown;
  try {
    body = JSON.parse(raw);
  } catch {
    return Response.json({ error: "invalid json" }, { status: 400 });
  }
  const parsed = parseDrawRequest(body, vocab as Vocab);
  if (!parsed) return Response.json({ error: "invalid draw request" }, { status: 400 });

  const rng = mulberry32(parsed.seed ?? crypto.getRandomValues(new Uint32Array(1))[0]);
  const seen = new Set(parsed.seen);
  const books = catalog();
  const result = parsed.query.entry === "leaf"
    ? drawLeaf(parsed.query.choices, seen, rng, books)
    : drawTarget(parsed.query.answers, seen, rng, books);
  return Response.json(result);
}
```

`web/playwright.config.ts`의 `webServer.env`를 다음으로 바꾼다 (E2E는 가짜 30권으로 — 실제 책이 바뀌어도 E2E가 흔들리지 않게):
```ts
    env: { TRACK_STORE: "off", BOOKS_SOURCE: "sample" },
```
그 위 주석 끝에 한 줄 추가: `// BOOKS_SOURCE=sample: flows draw from the 30-book fixture so assertions never depend on the real catalogue.`

- [ ] **Step 7: 통과 확인**

Run: `npx vitest run src/lib/books src/app/api && npm run typecheck && npm run lint`
Expected: PASS (draw 7, route 17), 타입·린트 오류 없음

- [ ] **Step 8: Commit**

```bash
git add web/src/lib/books web/src/app/api/books web/playwright.config.ts
git commit -m "feat(api): draw bookmarks on the server with one helper per entry"
```

---

### Task 5: 책갈피 — 그림 조합(C-03), 책갈피(C-02), 이름표(C-04)

**Files:**
- Create: `web/src/lib/art/combine.ts`, `web/src/components/BookmarkArt.tsx`, `web/src/components/Bookmark.tsx`, `web/src/components/Bookmark.module.css`, `web/src/components/GenreTag.tsx`, `web/src/components/GenreTag.module.css`, `web/public/animals/*.svg` (복사)
- Modify: `web/vitest.setup.ts` (컴포넌트 테스트 사이 DOM 비우기), `web/src/app/design/page.tsx`, `web/e2e/design.spec.ts`
- Test: `web/src/lib/art/combine.test.ts`, `web/src/components/Bookmark.test.tsx`

**Interfaces:**
- Consumes: `mulberry32`, `type Rng` (`@/lib/recommend`), Task 2 `toneOf`, `BookCard`
- Produces:
  - `ANIMALS` (`"cat" | "bear" | "rabbit" | "fox" | "duck" | "whale" | "owl"`), `BACKGROUNDS` (peach·leaf·sky·butter·lavender·night → `{ sky, hill }`), `SKY_PROPS` (moon·cloud·stars·birds·bigStar), `GROUND_PROPS` (grass·flowers·books·mushroom·none), 타입 `Animal`, `Background`, `SkyProp`, `GroundProp`, `interface ArtCombo { animal; bg; sky; ground; rare: boolean }`, `artFromSeed(seed: number): ArtCombo`, `artsForDraw(count: number, seed: number): ArtCombo[]` (한 번 뽑기 안에서는 동물이 겹치지 않게), `newArtSeed(): number` — `lib/art/combine.ts`
  - `<BookmarkArt art={ArtCombo} clipId={string} />`, `<Bookmark card={BookCard} art={ArtCombo} moving?={boolean} />` (접근 이름 "제목, 한 줄, 장르"), `<GenreTag card={Pick<BookCard, "entry" | "genre" | "field">} />`

- [ ] **Step 1: 동물 그림 복사**

Run (Galpi 폴더에서):
```bash
mkdir -p web/public/animals
cp assets/animals/*.svg web/public/animals/
ls web/public/animals
```
Expected: `bear.svg cat.svg duck.svg fox.svg owl.svg rabbit.svg whale.svg`. 원본은 `assets/animals/`(사용자가 고치면 다시 복사). 아래 테스트가 빠진 파일을 잡는다.

- [ ] **Step 2: 실패하는 테스트**

`web/vitest.setup.ts` 전체를 다음으로 바꾼다 (Vitest `globals`가 꺼져 있어 Testing Library가 스스로 비우지 못한다 — 같은 파일의 테스트끼리 DOM이 섞이지 않게):
```ts
import "@testing-library/jest-dom/vitest";
import { cleanup } from "@testing-library/react";
import { afterEach } from "vitest";

afterEach(() => cleanup());
```

`web/src/lib/art/combine.test.ts`:
```ts
// @vitest-environment node
import { existsSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { ANIMALS, BACKGROUNDS, GROUND_PROPS, SKY_PROPS, artFromSeed, artsForDraw, newArtSeed } from "./combine";

describe("bookmark art", () => {
  it("has 7 × 6 × 5 × 5 = 1,050 combinations (DESIGN 5절)", () => {
    expect(ANIMALS.length * Object.keys(BACKGROUNDS).length * SKY_PROPS.length * GROUND_PROPS.length).toBe(1050);
  });

  it("redraws the same picture from the same seed", () => {
    expect(artFromSeed(42)).toEqual(artFromSeed(42));
    expect(artFromSeed(42)).toEqual(artsForDraw(1, 42)[0]);
  });

  it("uses only known parts and marks nothing rare yet", () => {
    for (let seed = 0; seed < 200; seed++) {
      const a = artFromSeed(seed);
      expect(ANIMALS).toContain(a.animal);
      expect(Object.keys(BACKGROUNDS)).toContain(a.bg);
      expect(SKY_PROPS).toContain(a.sky);
      expect(GROUND_PROPS).toContain(a.ground);
      expect(a.rare).toBe(false);
    }
  });

  it("reaches every animal and never repeats one inside a draw of five", () => {
    const seen = new Set<string>();
    for (let seed = 0; seed < 300; seed++) {
      const five = artsForDraw(5, seed);
      expect(new Set(five.map((a) => a.animal)).size).toBe(5);
      five.forEach((a) => seen.add(a.animal));
    }
    expect(seen.size).toBe(ANIMALS.length);
  });

  it("still returns a picture for every pick when a draw has more picks than animals", () => {
    expect(artsForDraw(9, 1)).toHaveLength(9);
  });

  it("makes 32-bit seeds", () => {
    const s = newArtSeed();
    expect(Number.isInteger(s) && s >= 0 && s < 2 ** 32).toBe(true);
  });

  it("has an SVG in public/animals for every animal", () => {
    for (const animal of ANIMALS) expect(existsSync(path.resolve("public", "animals", `${animal}.svg`))).toBe(true);
  });
});
```

`web/src/components/Bookmark.test.tsx`:
```tsx
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import type { ArtCombo } from "@/lib/art/combine";
import type { BookCard } from "@/lib/books/types";
import { Bookmark } from "./Bookmark";

const leaf: BookCard = {
  id: "9790000000008", entry: "leaf", title: "천천히 걷는 아침", genre: "에세이", field: null,
  oneLiner: "오늘 아침은 몇 걸음이었을까요?", oneLinerStyle: "question",
};
const target: BookCard = {
  id: "9790000000101", entry: "target", title: "처음 만나는 쿼리", genre: "데이터 분석", field: "데이터·통계",
  oneLiner: "표에서 원하는 줄만 꺼내는 쿼리를 익혀요", oneLinerStyle: "summary",
};
const art: ArtCombo = { animal: "fox", bg: "night", sky: "moon", ground: "books", rare: false };

describe("Bookmark", () => {
  it("reads title, one-liner and genre as one label", () => {
    render(<Bookmark card={leaf} art={art} />);
    expect(screen.getByRole("article", { name: "천천히 걷는 아침, 오늘 아침은 몇 걸음이었을까요?, 에세이" })).toBeInTheDocument();
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

- [ ] **Step 3: 실패 확인**

Run: `cd web && npx vitest run src/lib/art src/components/Bookmark.test.tsx`
Expected: FAIL — `Failed to resolve import "./combine"` / `"./Bookmark"`

- [ ] **Step 4: 그림 조합**

`web/src/lib/art/combine.ts`:
```ts
import { mulberry32, type Rng } from "@/lib/recommend";

/** DESIGN A-01 — files in public/animals (copied from Galpi/assets/animals). */
export const ANIMALS = ["cat", "bear", "rabbit", "fox", "duck", "whale", "owl"] as const;
/** DESIGN A-02 — sky + hill pairs (시안 이름: 복숭아·풀잎·하늘·버터·라벤더·밤). */
export const BACKGROUNDS = {
  peach: { sky: "#F9DCCB", hill: "#E7B597" },
  leaf: { sky: "#E4EFD9", hill: "#A9C69A" },
  sky: { sky: "#DCEAF5", hill: "#A7C2A0" },
  butter: { sky: "#FBF0C9", hill: "#D8C27E" },
  lavender: { sky: "#E7E1F3", hill: "#B8ACD6" },
  night: { sky: "#3E4569", hill: "#5B6B58" },
} as const;
/** DESIGN A-03 */
export const SKY_PROPS = ["moon", "cloud", "stars", "birds", "bigStar"] as const;
export const GROUND_PROPS = ["grass", "flowers", "books", "mushroom", "none"] as const;

export type Animal = (typeof ANIMALS)[number];
export type Background = keyof typeof BACKGROUNDS;
export type SkyProp = (typeof SKY_PROPS)[number];
export type GroundProp = (typeof GROUND_PROPS)[number];

/** PRD D-05: saved with a bookmark so the library redraws it as it was. `rare` is stored now, used later (F-21). */
export interface ArtCombo { animal: Animal; bg: Background; sky: SkyProp; ground: GroundProp; rare: boolean }

const BG_KEYS = Object.keys(BACKGROUNDS) as Background[];

function shuffled<T>(items: readonly T[], rng: Rng): T[] {
  const out = [...items];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

/** Pictures for one draw, reproducible from the seed. Animals do not repeat while there are enough of them. */
export function artsForDraw(count: number, seed: number): ArtCombo[] {
  const rng = mulberry32(seed);
  const pick = <T>(items: readonly T[]): T => items[Math.floor(rng() * items.length)];
  const animals = shuffled(ANIMALS, rng);
  return Array.from({ length: count }, (_, i) => ({
    animal: i < animals.length ? animals[i] : pick(ANIMALS),
    bg: pick(BG_KEYS),
    sky: pick(SKY_PROPS),
    ground: pick(GROUND_PROPS),
    rare: false,
  }));
}

export function artFromSeed(seed: number): ArtCombo {
  return artsForDraw(1, seed)[0];
}

export function newArtSeed(): number {
  return crypto.getRandomValues(new Uint32Array(1))[0];
}
```

- [ ] **Step 5: 그림·이름표·책갈피 컴포넌트**

`web/src/components/BookmarkArt.tsx`:
```tsx
import { BACKGROUNDS, type ArtCombo, type GroundProp, type SkyProp } from "@/lib/art/combine";

// Window: 100 × 76, arch radius = half the width (DESIGN 4절). Hill surface sits near y = 52–55.
const ARCH = "M0 76 V50 A50 50 0 0 1 100 50 V76 Z";
const HILL = "M-5 76 V60 Q50 44 105 60 V76 Z";
// A-03: sky props white-ish, ground props calm colours.
const WHITE = "#FFFFFF";
const MOON = "#FFF6DA";
const STAR = "#FFF1B8";
const GRASS = "#5F7F52";

function starPath(cx: number, cy: number, outer: number, inner: number, points: number): string {
  const parts: string[] = [];
  for (let i = 0; i < points * 2; i++) {
    const angle = (Math.PI / points) * i - Math.PI / 2;
    const r = i % 2 === 0 ? outer : inner;
    parts.push(`${i ? "L" : "M"}${(cx + r * Math.cos(angle)).toFixed(1)} ${(cy + r * Math.sin(angle)).toFixed(1)}`);
  }
  return `${parts.join(" ")} Z`;
}

function Sky({ kind, sky }: { kind: SkyProp; sky: string }) {
  switch (kind) {
    case "moon":
      return (<g><circle cx="75" cy="22" r="7" fill={MOON} /><circle cx="78.5" cy="19.5" r="6" fill={sky} /></g>);
    case "cloud":
      return (<g fill={WHITE} opacity="0.92"><ellipse cx="72" cy="25" rx="10" ry="4.5" /><circle cx="68" cy="22" r="4.5" /><circle cx="75" cy="20.5" r="5.5" /></g>);
    case "stars":
      return (<g fill={WHITE}><path d={starPath(70, 18, 3.2, 1.1, 4)} /><path d={starPath(80, 26, 2.4, 0.8, 4)} /><path d={starPath(26, 24, 2.6, 0.9, 4)} /></g>);
    case "birds":
      return (<g stroke={WHITE} strokeWidth="1.3" fill="none" strokeLinecap="round"><path d="M64 23 q3 -3 6 0 q3 -3 6 0" /><path d="M74 16 q2 -2 4 0 q2 -2 4 0" /></g>);
    case "bigStar":
      return <path d={starPath(74, 22, 7, 3, 5)} fill={STAR} />;
  }
}

function Ground({ kind }: { kind: GroundProp }) {
  switch (kind) {
    case "grass":
      return (<path d="M10 56 l2 -7 l2 7 M15 56 l2 -9 l2 9 M82 56 l2 -8 l2 8 M87 56 l2 -6 l2 6" stroke={GRASS} strokeWidth="1.5" fill="none" strokeLinecap="round" strokeLinejoin="round" />);
    case "flowers":
      return (<g><path d="M14 56 V48 M86 56 V50" stroke={GRASS} strokeWidth="1.4" /><circle cx="14" cy="47" r="2.8" fill="#E8998A" /><circle cx="86" cy="49" r="2.4" fill="#F2D16B" /></g>);
    case "books":
      return (<g><rect x="78" y="51.5" width="15" height="4.5" rx="1" fill="#7A4A2E" /><rect x="79.5" y="47" width="12" height="4.5" rx="1" fill="#3A6684" /><rect x="81" y="43" width="9.5" height="4" rx="1" fill="#B8912F" /></g>);
    case "mushroom":
      return (<g><rect x="12.5" y="49" width="4" height="7" rx="1.5" fill="#F4EBDD" /><path d="M8 50 a6.5 5 0 0 1 13 0 Z" fill="#C4574A" /><circle cx="12" cy="47.5" r="1" fill={WHITE} /><circle cx="16.5" cy="46.8" r="0.9" fill={WHITE} /></g>);
    case "none":
      return null;
  }
}

/** C-03 — sky, one sky prop, hill, the animal at 55% sitting on the hill, one ground prop. Decorative only. */
export function BookmarkArt({ art, clipId }: { art: ArtCombo; clipId: string }) {
  const bg = BACKGROUNDS[art.bg];
  return (
    <svg viewBox="0 0 100 76" width="100%" aria-hidden="true" focusable="false" style={{ display: "block" }}>
      <defs><clipPath id={clipId}><path d={ARCH} /></clipPath></defs>
      <g clipPath={`url(#${clipId})`}>
        <rect width="100" height="76" fill={bg.sky} />
        <Sky kind={art.sky} sky={bg.sky} />
        <path d={HILL} fill={bg.hill} />
        <image href={`/animals/${art.animal}.svg`} x="22.5" y="12" width="55" height="55" />
        <Ground kind={art.ground} />
      </g>
    </svg>
  );
}
```

`web/src/components/GenreTag.tsx`:
```tsx
import { toneOf } from "@/lib/books/taxonomy";
import type { BookCard } from "@/lib/books/types";
import styles from "./GenreTag.module.css";

/** C-04 — pill in the genre colour (🎯: field colour + topic name). */
export function GenreTag({ card }: { card: Pick<BookCard, "entry" | "genre" | "field"> }) {
  const tone = toneOf(card);
  return <span className={styles.tag} style={{ background: tone.bg, color: tone.fg }}>{card.genre}</span>;
}
```

`web/src/components/GenreTag.module.css`:
```css
.tag {
  display: inline-block;
  padding: var(--space-1) var(--space-2);
  border-radius: var(--radius-pill);
  font-size: 12px;
  line-height: 1.2;
  white-space: nowrap;
}
```

`web/src/components/Bookmark.tsx`:
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
 * C-02 (DESIGN 4절): frost film, arched window, name tag, title, one-liner, stitch line, swallowtail, string.
 * Never the Minumsa shape — no square card, no left vertical band, no two colour stripes.
 */
export function Bookmark({ card, art, moving = false }: Props) {
  const tone = toneOf(card);
  return (
    <article
      className={styles.bookmark}
      data-moving={moving ? "" : undefined}
      aria-label={`${card.title}, ${card.oneLiner}, ${card.genre}`}
      style={{ "--tone": tone.bg } as CSSProperties}
    >
      <span className={styles.string} aria-hidden="true" />
      <div className={styles.card} aria-hidden="true">
        <span className={styles.hole} />
        <div className={styles.window}><BookmarkArt art={art} clipId={`arch-${card.id}`} /></div>
        <GenreTag card={card} />
        <h3 className={styles.title}>{card.title}</h3>
        <p className={styles.line}>{card.oneLiner}</p>
        <span className={styles.stitch} />
        <span className={styles.mark}>갈피</span>
      </div>
    </article>
  );
}
```

`web/src/components/Bookmark.module.css`:
```css
/* DESIGN 4절: 1 : 2 (160 × 320), string ~26px above, hole 8px, window = card − 18, swallowtail notch 7%. */
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
  display: flex; flex-direction: column; align-items: flex-start; gap: var(--space-1);
  height: 320px; padding: 20px 9px 26px;
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
.window { width: 100%; margin-bottom: var(--space-1); }
.title {
  margin: var(--space-1) 0 0; font-size: 15px; line-height: 1.4; color: var(--ink);
  display: -webkit-box; -webkit-box-orient: vertical; -webkit-line-clamp: 2; overflow: hidden;
}
.line {
  margin: 0; font-size: 13px; line-height: 1.45; color: var(--ink);
  display: -webkit-box; -webkit-box-orient: vertical; -webkit-line-clamp: 3; overflow: hidden;
}
.stitch { width: 100%; margin-top: auto; border-top: 1.5px dashed var(--tone); }
.mark { align-self: center; font-family: var(--font-batang), serif; font-size: 12px; font-weight: 700; color: var(--ink); }
```

- [ ] **Step 6: /design에 책갈피 두 장**

`web/src/app/design/page.tsx`의 import 아래에 추가:
```tsx
import { Bookmark } from "@/components/Bookmark";
import { artFromSeed } from "@/lib/art/combine";
import type { BookCard } from "@/lib/books/types";

const DEMO: BookCard[] = [
  { id: "demo-leaf", entry: "leaf", title: "천천히 걷는 아침", genre: "에세이", field: null, oneLiner: "오늘 아침은 몇 걸음이었을까요?", oneLinerStyle: "question" },
  { id: "demo-target", entry: "target", title: "처음 만나는 쿼리", genre: "데이터 분석", field: "데이터·통계", oneLiner: "표에서 원하는 줄만 꺼내는 쿼리를 익혀요", oneLinerStyle: "summary" },
];
```
그리고 `버튼` 절의 `</div>` 다음, 마지막 `</>` 앞에 추가:
```tsx
      <h2>책갈피</h2>
      <div style={{ display: "flex", gap: 16, paddingTop: 8, background: "var(--paper-deep)" }}>
        {DEMO.map((card, i) => <Bookmark key={card.id} card={card} art={artFromSeed(i + 1)} />)}
      </div>
```

`web/e2e/design.spec.ts` 맨 아래에 추가:
```ts
test("design page shows a bookmark with its reading label", async ({ page }) => {
  await page.goto("/design");
  await expect(page.getByRole("article", { name: /천천히 걷는 아침/ })).toBeVisible();
});
```

- [ ] **Step 7: 통과 확인 + 눈으로 확인**

Run: `npx vitest run && npm run typecheck && npm run lint`
Expected: 전부 PASS (combine 7, Bookmark 4 포함)

Run: `npm run dev` → 휴대폰 크기(DevTools 412px)로 `http://localhost:3000/design` → 책갈피 두 장을 스크린샷으로 남겨 사용자에게 보여 준다(디자인 결정은 시각 확인). 확인할 것: 아치 창 안 동물이 언덕에 앉아 있음(55%), 제비꼬리 아래 끝, 끈·구멍, 이름표 12px, **네모 카드·왼쪽 세로 띠·두 줄 색 띠 없음**. 크기·위치 조정 요청이 오면 `BookmarkArt.tsx` 좌표만 고친다.

- [ ] **Step 8: Commit**

```bash
git add web/src/lib/art web/src/components/BookmarkArt.tsx web/src/components/Bookmark.tsx web/src/components/Bookmark.module.css web/src/components/Bookmark.test.tsx web/src/components/GenreTag.tsx web/src/components/GenreTag.module.css web/public/animals web/vitest.setup.ts web/src/app/design/page.tsx web/e2e/design.spec.ts
git commit -m "feat(bookmark): seeded animal art and the frosted arch bookmark"
```

---

### Task 6: 흐름 로직 — 문항, 🎯 입력 모양, 첫 장 요약·안내, 리듀서, 저장

**Files:**
- Create: `web/src/lib/flow/questions.ts`, `web/src/lib/flow/target.ts`, `web/src/lib/flow/summary.ts`, `web/src/lib/flow/state.ts`, `web/src/lib/flow/storage.ts`
- Test: `web/src/lib/flow/questions.test.ts`, `web/src/lib/flow/target.test.ts`, `web/src/lib/flow/summary.test.ts`, `web/src/lib/flow/state.test.ts`, `web/src/lib/flow/storage.test.ts`

**Interfaces:**
- Consumes: `QUESTION_AXIS`, `AXES`, `AXIS_LABEL`, `WAY_LABEL`, `coverageNotice`, `EXHAUSTED_NOTICE`, 타입 `BalanceChoice`, `Entry`, `AxisKey`, `TargetAnswers`, `Tag`, `Way` (`@/lib/recommend` — `AXIS_LABEL`·`WAY_LABEL`은 P1 수정 커밋 `5e65b69`에서 공개됨); Task 2 `TOPIC_CHIPS`, `Topic`, `BookCard`; Task 3 `GoalMatch`; Task 5 `ArtCombo`
- Produces:
  - `questions.ts`: `interface BalanceQuestion { n: number; text: string; a: string; b: string; aOnLeft: boolean }`, `QUESTIONS` (9개, balance-game 2절 그대로)
  - `target.ts`: `type LenChoice = "thin" | "normal" | "thick"`, `interface TargetForm { topic: Topic | null; free: string | null; len: LenChoice | null; way: Way | null }` (`free !== null`이면 직접 쓰기), `EMPTY_FORM`, `LEN_CHIPS`, `WAY_CHIPS`, `FREE_PLACEHOLDER`, `formReady(f): boolean`, `targetAnswersFrom(f, goal: GoalMatch | null): TargetAnswers`
  - `summary.ts`: `ANY = "상관없음"`, `interface TasteLine { axis: AxisKey; text: string; strength: 0 | 1 | 2 }`, `tasteLines(choices): TasteLine[]` (**원래 답 9개로** — `LeafAnswers`가 아님), `lengthWord(choice?)`, `targetSummary(form, goal): { label: string; value: string }[]`, `firstPageNotices(entry, goal, draw): string[]`, `coverageBucket(found): "0" | "1-3" | "4+"`, `editedQuestions(before, after): string[]`, `editedTargetFields(before, after): string[]`
  - `state.ts`: `type Step = "home" | "leaf" | "target" | "book" | "first" | "bookmarks" | "end"`, `STEPS`, `type Reaction = "pass" | "curious"`, `interface PickView { card: BookCard; kind: "recommended" | "random"; art: ArtCombo }`, `interface DrawView { picks: PickView[]; exhausted: boolean; found: number | null; keywords: string[] }`, `type DrawStatus`, `interface FlowState`, `INITIAL`, `type FlowAction`, `flowReducer(state, action): FlowState`
  - `storage.ts`: `FLOW_KEY = "galpi.flow"`, `loadFlow(): FlowState`, `saveFlow(state): void`
  - 흐름 규칙: 🍃 9번째 답·🎯 제출·[다시 시도]가 `drawId`를 1 올린다(= 뽑기 요청). 책이 이미 펼쳐져 있으면(고치기 뒤) 곧장 `first`. [다음 장]·반응 때 보여 준 책만 `seen`에 넣는다. 뽑기가 0~5권이어도 그 수만큼만 장이 있다. [처음으로]는 `seen`만 남긴다

- [ ] **Step 1: 실패하는 테스트**

`web/src/lib/flow/questions.test.ts`:
```ts
import { describe, expect, it } from "vitest";
import { QUESTION_AXIS } from "@/lib/recommend";
import { QUESTIONS } from "./questions";

describe("balance questions", () => {
  it("has one question per axis slot of P1 (4 axes × 2 + length)", () => {
    expect(QUESTIONS).toHaveLength(QUESTION_AXIS.length);
    expect(QUESTIONS.map((q) => q.n)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9]);
  });

  it("puts A on the right for the second question of each axis only", () => {
    expect(QUESTIONS.map((q) => q.aOnLeft)).toEqual([true, true, true, true, false, false, false, false, true]);
  });

  it("keeps the wording of balance-game.md", () => {
    expect(QUESTIONS[0]).toEqual({ n: 1, text: "책을 덮은 뒤, 남았으면 하는 건?", a: "몽글몽글 따뜻함", b: "한동안 멍한 여운", aOnLeft: true });
    expect(QUESTIONS[5].a).toBe("\"이 문장 좀 봐\"");
    expect(QUESTIONS[8].b).toBe("든든하게 두꺼운 책");
  });
});
```

`web/src/lib/flow/target.test.ts`:
```ts
import { describe, expect, it } from "vitest";
import { EMPTY_FORM, WAY_CHIPS, formReady, targetAnswersFrom } from "./target";

describe("🎯 form", () => {
  it("needs a topic or a non-empty written goal", () => {
    expect(formReady(EMPTY_FORM)).toBe(false);
    expect(formReady({ ...EMPTY_FORM, topic: "통계" })).toBe(true);
    expect(formReady({ ...EMPTY_FORM, free: "   " })).toBe(false);
    expect(formReady({ ...EMPTY_FORM, free: "SQL" })).toBe(true);
  });

  it("maps chips to scoring answers (얇게 +1, 보통 0, 두꺼워도 좋아요 -1)", () => {
    expect(targetAnswersFrom({ topic: "통계", free: null, len: "thin", way: "실습" }, null)).toEqual({ topic: "통계", way: "실습", len: 1, keywords: [] });
    expect(targetAnswersFrom({ topic: "통계", free: null, len: "thick", way: null }, null).len).toBe(-1);
    expect(targetAnswersFrom({ topic: "통계", free: null, len: "normal", way: null }, null).len).toBe(0);
  });

  it("takes topic and keywords from a written goal", () => {
    const goal = { text: "SQL", topic: "데이터 분석" as const, keywords: ["SQL"], matched: true, method: "word" as const };
    expect(targetAnswersFrom({ ...EMPTY_FORM, free: "SQL" }, goal)).toEqual({ topic: "데이터 분석", way: null, len: 0, keywords: ["SQL"] });
  });

  it("labels 읽는 방식 chips as target-chips.md does", () => {
    expect(WAY_CHIPS.map((c) => c.label)).toEqual(["개념부터 쉽게", "따라 하며 실습 (바로 써먹기)", "사례로 술술"]);
  });
});
```

`web/src/lib/flow/summary.test.ts`:
```ts
import { describe, expect, it } from "vitest";
import { EXHAUSTED_NOTICE, type BalanceChoice } from "@/lib/recommend";
import type { GoalMatch } from "@/lib/goal/match";
import type { DrawView } from "./state";
import {
  coverageBucket, editedQuestions, editedTargetFields, firstPageNotices, lengthWord, targetSummary, tasteLines,
} from "./summary";
import { EMPTY_FORM } from "./target";

const nine = (...c: BalanceChoice[]) => c;
const goal = (over: Partial<GoalMatch> = {}): GoalMatch =>
  ({ text: "SQL 공부", topic: "데이터 분석", keywords: ["SQL"], matched: true, method: "word", ...over });
const draw = (over: Partial<DrawView> = {}): DrawView =>
  ({ picks: [], exhausted: false, found: null, keywords: [], ...over });
const onePick: DrawView["picks"] = [{
  card: { id: "1", entry: "target", title: "t", genre: "데이터 분석", field: "데이터·통계", oneLiner: "o", oneLinerStyle: "summary" },
  kind: "recommended", art: { animal: "cat", bg: "peach", sky: "moon", ground: "none", rare: false },
}];

describe("tasteLines (from the raw answers, balance-game.md 2절)", () => {
  it("says 확실히 when both answers of an axis agree", () => {
    const lines = tasteLines(nine("A", "B", "A", "B", "A", "B", "A", "B", "A"));
    expect(lines.map((l) => [l.text, l.strength])).toEqual([
      ["확실히 따뜻함", 2], ["확실히 몰입", 2], ["확실히 알게 됨", 2], ["확실히 딴 세상", 2],
    ]);
  });

  it("says 둘 다 좋아요 when they split, and names one side when the other was unsure", () => {
    // 온도 A+B 갈림 / 끌림 unsure+B → 몰입(●○) / 얻는 것 unsure+unsure → 둘 다 좋아요(○○) / 세계 A+B 갈림
    const lines = tasteLines(nine("A", "unsure", "unsure", "A", "B", "B", "unsure", "B", "unsure"));
    expect(lines.map((l) => [l.text, l.strength])).toEqual([
      ["따뜻함 · 여운 둘 다 좋아요", 0], ["몰입", 1], ["알게 됨 · 마음 둘 다 좋아요", 0], ["현실 · 딴 세상 둘 다 좋아요", 0],
    ]);
  });

  it("names the length answer", () => {
    expect([lengthWord("A"), lengthWord("B"), lengthWord("unsure"), lengthWord(undefined)]).toEqual(["얇게", "두껍게", "상관없음", "상관없음"]);
  });
});

describe("targetSummary", () => {
  it("shows chip labels and 상관없음 for empty optional fields", () => {
    expect(targetSummary({ topic: "AI 활용", free: null, len: "thin", way: null }, null)).toEqual([
      { label: "무엇을", value: "AI 똑똑하게 쓰기" }, { label: "분량", value: "얇게" }, { label: "읽는 방식", value: "상관없음" },
    ]);
  });

  it("shows the written goal as written", () => {
    expect(targetSummary({ ...EMPTY_FORM, free: "SQL 공부", way: "실습" }, goal())[0]).toEqual({ label: "무엇을", value: "“SQL 공부”" });
    expect(targetSummary({ ...EMPTY_FORM, free: "SQL 공부", way: "실습" }, goal())[2].value).toBe("따라 하며 실습");
  });
});

describe("firstPageNotices", () => {
  it("is honest when nothing in our list matched the written goal — and never adds the exhausted notice then", () => {
    const g = goal({ keywords: [], matched: false, text: "발표 준비" });
    expect(firstPageNotices("target", g, draw({ exhausted: true, picks: onePick }))).toEqual(["아직 이 주제 책이 없어요. 가장 가까운 '데이터 분석' 책을 펼칠게요"]);
  });

  it("tells how many keyword books there are, and drops the exhausted notice in the same round", () => {
    expect(firstPageNotices("target", goal(), draw({ found: 2, keywords: ["SQL"], exhausted: true, picks: onePick })))
      .toEqual(["SQL 책은 아직 2권이에요. 나머지는 가까운 '데이터 분석' 책이에요"]);
  });

  it("uses the 0-book wording when the server dropped every requested keyword", () => {
    expect(firstPageNotices("target", goal({ keywords: ["제미나이"], topic: "AI 활용" }), draw({ found: 0, keywords: [], picks: onePick })))
      .toEqual(["아직 이 주제 책이 없어요. 가장 가까운 'AI 활용' 책을 펼칠게요"]);
  });

  it("shows the exhausted notice for 🎯 when there is no coverage notice", () => {
    expect(firstPageNotices("target", goal(), draw({ found: 6, keywords: ["SQL"], exhausted: true, picks: onePick }))).toEqual([EXHAUSTED_NOTICE]);
    expect(firstPageNotices("target", null, draw({ exhausted: true, picks: onePick }))).toEqual([EXHAUSTED_NOTICE]);
  });

  it("does not show the 🎯 exhausted notice to 🍃 unless the draw is empty", () => {
    expect(firstPageNotices("leaf", null, draw({ exhausted: true, picks: onePick }))).toEqual([]);
    expect(firstPageNotices("leaf", null, draw({ exhausted: true, picks: [] }))).toEqual([EXHAUSTED_NOTICE]);
  });

  it("waits for the draw before counting books", () => {
    expect(firstPageNotices("target", goal(), null)).toEqual([]);
  });
});

describe("edit tracking and coverage buckets", () => {
  it("lists changed balance questions", () => {
    expect(editedQuestions(nine("A", "A", "A", "A", "A", "A", "A", "A", "A"), nine("A", "B", "A", "A", "A", "A", "A", "A", "unsure"))).toEqual(["q2", "q9"]);
  });

  it("lists changed 🎯 fields", () => {
    const before = { topic: null, free: "SQL", len: null, way: null } as const;
    expect(editedTargetFields(before, { ...before, len: "thin" })).toEqual(["len"]);
    expect(editedTargetFields(before, { ...before, free: null, topic: "통계", way: "개념" })).toEqual(["what", "way"]);
    expect(editedTargetFields(before, { ...before })).toEqual([]);
  });

  it("buckets found books as PRD E-22 does", () => {
    expect([0, 1, 3, 4, 17].map(coverageBucket)).toEqual(["0", "1-3", "1-3", "4+", "4+"]);
  });
});
```

`web/src/lib/flow/state.test.ts`:
```ts
import { describe, expect, it } from "vitest";
import type { BalanceChoice } from "@/lib/recommend";
import { INITIAL, flowReducer, type DrawView, type FlowAction, type FlowState } from "./state";

const art = { animal: "cat", bg: "peach", sky: "moon", ground: "none", rare: false } as const;
const view = (n: number): DrawView => ({
  picks: Array.from({ length: n }, (_, i) => ({
    card: { id: `b${i}`, entry: "leaf" as const, title: `책 ${i}`, genre: "에세이", field: null, oneLiner: "한 줄일까요?", oneLinerStyle: "question" as const },
    kind: i === 0 ? ("random" as const) : ("recommended" as const),
    art,
  })),
  exhausted: false, found: null, keywords: [],
});
const run = (actions: FlowAction[], from: FlowState = INITIAL) => actions.reduce(flowReducer, from);
const answers = (c: BalanceChoice = "A"): FlowAction[] => Array.from({ length: 9 }, () => ({ type: "answer" as const, choice: c }));
const form = { topic: "통계" as const, free: null, len: null, way: null };

describe("flowReducer", () => {
  it("starts an entry and keeps what this session has already shown", () => {
    const s = run([{ type: "start", entry: "leaf" }], { ...INITIAL, seen: ["x"], index: 3 });
    expect(s).toEqual({ ...INITIAL, step: "leaf", entry: "leaf", seen: ["x"] });
  });

  it("asks for a draw after the ninth answer", () => {
    const eight = run([{ type: "start", entry: "leaf" }, ...answers().slice(0, 8)]);
    expect(eight).toMatchObject({ step: "leaf", status: "idle", drawId: 0 });
    const nine = flowReducer(eight, { type: "answer", choice: "B" });
    expect(nine).toMatchObject({ step: "book", status: "loading", drawId: 1, draw: null });
    expect(nine.choices).toHaveLength(9);
    expect(flowReducer(nine, { type: "answer", choice: "A" })).toBe(nine);
  });

  it("asks for a draw when the 🎯 form is sent", () => {
    const s = run([{ type: "start", entry: "target" }, { type: "submitTarget", form, goal: null }]);
    expect(s).toMatchObject({ step: "book", status: "loading", drawId: 1, form });
  });

  it("takes only the answer to the latest request", () => {
    const loading = run([{ type: "start", entry: "leaf" }, ...answers()]);
    expect(flowReducer(loading, { type: "drawn", id: 0, draw: view(5) })).toBe(loading);
    expect(flowReducer(loading, { type: "drawn", id: 1, draw: view(5) })).toMatchObject({ status: "ready", draw: view(5) });
  });

  it("retries a failed draw with a new request id", () => {
    const failed = run([{ type: "start", entry: "leaf" }, ...answers(), { type: "drawFailed", id: 1 }]);
    expect(failed.status).toBe("error");
    expect(flowReducer(failed, { type: "retry" })).toMatchObject({ status: "loading", drawId: 2 });
  });

  it("opens the book once, then shows bookmarks one by one and counts only shown books as seen", () => {
    const ready = run([{ type: "start", entry: "leaf" }, ...answers(), { type: "drawn", id: 1, draw: view(5) }]);
    const opened = flowReducer(ready, { type: "open" });
    expect(opened).toMatchObject({ step: "first", opened: true, seen: [] });
    const first = flowReducer(opened, { type: "next" });
    expect(first).toMatchObject({ step: "bookmarks", index: 0, seen: ["b0"] });
    const end = run([{ type: "react", reaction: "curious" }, { type: "react", reaction: "pass" }, { type: "react", reaction: "pass" },
      { type: "react", reaction: "curious" }, { type: "react", reaction: "pass" }], first);
    expect(end).toMatchObject({ step: "end", reactions: ["curious", "pass", "pass", "curious", "pass"], seen: ["b0", "b1", "b2", "b3", "b4"] });
  });

  it("has only as many pages as picks when a draw is short", () => {
    const first = run([{ type: "start", entry: "leaf" }, ...answers(), { type: "drawn", id: 1, draw: view(3) }, { type: "open" }, { type: "next" }]);
    const end = run([{ type: "react", reaction: "pass" }, { type: "react", reaction: "pass" }, { type: "react", reaction: "pass" }], first);
    expect(end.step).toBe("end");
  });

  it("stays on the first page when the draw is empty or not back yet", () => {
    const loading = run([{ type: "start", entry: "leaf" }, ...answers(), { type: "open" }]);
    expect(flowReducer(loading, { type: "next" })).toBe(loading);
    const empty = flowReducer(loading, { type: "drawn", id: 1, draw: view(0) });
    expect(flowReducer(empty, { type: "next" })).toBe(empty);
  });

  it("allows one 🍃 edit and goes straight back to the open book", () => {
    const first = run([{ type: "start", entry: "leaf" }, ...answers(), { type: "drawn", id: 1, draw: view(5) }, { type: "open" }]);
    const editing = flowReducer(first, { type: "edit" });
    expect(editing).toMatchObject({ step: "leaf", edited: true, choices: [], prevChoices: first.choices });
    const back = run(answers("B"), editing);
    expect(back).toMatchObject({ step: "first", status: "loading", drawId: 2, opened: true });
    expect(flowReducer(back, { type: "edit" })).toBe(back);
  });

  it("allows one 🎯 edit that keeps the previous form", () => {
    const first = run([{ type: "start", entry: "target" }, { type: "submitTarget", form, goal: null }, { type: "open" }]);
    const editing = flowReducer(first, { type: "edit" });
    expect(editing).toMatchObject({ step: "target", edited: true, prevForm: form });
    expect(flowReducer(editing, { type: "submitTarget", form: { ...form, len: "thin" }, goal: null })).toMatchObject({ step: "first", drawId: 2 });
  });

  it("goes home keeping only the seen books", () => {
    const end = run([{ type: "start", entry: "leaf" }, ...answers(), { type: "drawn", id: 1, draw: view(1) }, { type: "open" }, { type: "next" }, { type: "react", reaction: "pass" }]);
    expect(flowReducer(end, { type: "home" })).toEqual({ ...INITIAL, seen: ["b0"] });
  });

  it("ignores actions that do not belong to the current step", () => {
    expect(flowReducer(INITIAL, { type: "open" })).toBe(INITIAL);
    expect(flowReducer(INITIAL, { type: "react", reaction: "pass" })).toBe(INITIAL);
    expect(flowReducer(INITIAL, { type: "submitTarget", form, goal: null })).toBe(INITIAL);
    expect(flowReducer(INITIAL, { type: "retry" })).toBe(INITIAL);
  });
});
```

`web/src/lib/flow/storage.test.ts`:
```ts
import { afterEach, describe, expect, it, vi } from "vitest";
import { INITIAL, type FlowState } from "./state";
import { FLOW_KEY, loadFlow, saveFlow } from "./storage";

describe("flow storage", () => {
  afterEach(() => {
    sessionStorage.clear();
    vi.restoreAllMocks();
  });

  it("round-trips the state in this tab", () => {
    const s: FlowState = { ...INITIAL, step: "leaf", entry: "leaf", choices: ["A", "B"] };
    saveFlow(s);
    expect(loadFlow()).toEqual(s);
  });

  it("turns a request cut off by a reload into a retry", () => {
    saveFlow({ ...INITIAL, step: "book", entry: "leaf", status: "loading", drawId: 1 });
    expect(loadFlow()).toMatchObject({ step: "book", status: "error" });
  });

  it.each([
    ["nothing saved", null],
    ["broken JSON", "{"],
    ["another version", JSON.stringify({ v: 0, state: { ...INITIAL, step: "leaf" } })],
    ["an unknown step", JSON.stringify({ v: 1, state: { ...INITIAL, step: "shelf" } })],
  ])("starts over on %s", (_, raw) => {
    if (raw !== null) sessionStorage.setItem(FLOW_KEY, raw);
    expect(loadFlow()).toEqual(INITIAL);
  });

  it("never throws when storage is blocked", () => {
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => { throw new Error("blocked"); });
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => { throw new Error("blocked"); });
    expect(() => saveFlow(INITIAL)).not.toThrow();
    expect(loadFlow()).toEqual(INITIAL);
  });
});
```

- [ ] **Step 2: 실패 확인**

Run: `cd web && npx vitest run src/lib/flow`
Expected: FAIL — `Failed to resolve import "./questions"` 등

- [ ] **Step 3: 문항·🎯 입력 모양**

`web/src/lib/flow/questions.ts`:
```ts
/** docs/balance-game.md 2절 — wording and sides verbatim. The second question of each axis puts A on the right. */
export interface BalanceQuestion { n: number; text: string; a: string; b: string; aOnLeft: boolean }

export const QUESTIONS: readonly BalanceQuestion[] = [
  { n: 1, text: "책을 덮은 뒤, 남았으면 하는 건?", a: "몽글몽글 따뜻함", b: "한동안 멍한 여운", aOnLeft: true },
  { n: 2, text: "딱 하나만 가질 수 있다면?", a: "밑줄 긋고 싶은 문장", b: "다음 장이 궁금해 못 자는 밤", aOnLeft: true },
  { n: 3, text: "다 읽고 난 나는?", a: "뭔가 하나 알게 된 나", b: "마음이 조금 달라진 나", aOnLeft: true },
  { n: 4, text: "책 속 세상은?", a: "옆집 이야기 같은 현실", b: "여기 없는 딴 세상", aOnLeft: true },
  { n: 5, text: "비 오는 날 창가에서 펼칠 책은?", a: "담요처럼 포근한 책", b: "빗소리처럼 쓸쓸한 책", aOnLeft: false },
  { n: 6, text: "친구에게 책을 권할 때 내가 할 말은?", a: "\"이 문장 좀 봐\"", b: "\"앉은 자리에서 다 읽었어\"", aOnLeft: false },
  { n: 7, text: "책을 덮고 제일 먼저 하고 싶은 건?", a: "누군가에게 알려주기", b: "조용히 곱씹어 보기", aOnLeft: false },
  { n: 8, text: "여행을 떠난다면 어디로?", a: "골목 구석구석 동네 여행", b: "아무도 안 가본 낯선 행성", aOnLeft: false },
  { n: 9, text: "오늘 가방에 넣을 책은?", a: "쏙 들어가는 얇은 책", b: "든든하게 두꺼운 책", aOnLeft: true },
];
```

`web/src/lib/flow/target.ts`:
```ts
import { WAY_LABEL, type Tag, type TargetAnswers, type Way } from "@/lib/recommend";
import { TOPIC_CHIPS, type Topic } from "@/lib/books/taxonomy";
import type { GoalMatch } from "@/lib/goal/match";

export type LenChoice = "thin" | "normal" | "thick";

/** S-02 🎯 inputs. free !== null means 직접 쓰기 (then topic is null). Empty optional fields mean 상관없음. */
export interface TargetForm { topic: Topic | null; free: string | null; len: LenChoice | null; way: Way | null }

export const EMPTY_FORM: TargetForm = { topic: null, free: null, len: null, way: null };

/** docs/target-chips.md 1절 — labels verbatim. */
export const LEN_CHIPS: readonly { value: LenChoice; label: string; tag: Tag }[] = [
  { value: "thin", label: "얇게", tag: 1 },
  { value: "normal", label: "보통", tag: 0 },
  { value: "thick", label: "두꺼워도 좋아요", tag: -1 },
];
export const WAY_CHIPS: readonly { value: Way; label: string }[] = [
  { value: "개념", label: WAY_LABEL.개념 },
  { value: "실습", label: `${WAY_LABEL.실습} (바로 써먹기)` },
  { value: "사례", label: WAY_LABEL.사례 },
];
export const FREE_PLACEHOLDER = "SQL, 엑셀 함수, 번아웃, 발표 준비 …";

export function formReady(f: TargetForm): boolean {
  return f.free !== null ? f.free.trim().length > 0 : f.topic !== null;
}

export function targetAnswersFrom(f: TargetForm, goal: GoalMatch | null): TargetAnswers {
  return {
    topic: goal?.topic ?? f.topic ?? TOPIC_CHIPS[0].topic,
    way: f.way,
    len: LEN_CHIPS.find((c) => c.value === f.len)?.tag ?? 0,
    keywords: goal?.keywords ?? [],
  };
}
```

- [ ] **Step 4: 첫 장 요약·안내**

`web/src/lib/flow/summary.ts`:
```ts
import {
  AXES, AXIS_LABEL, EXHAUSTED_NOTICE, WAY_LABEL, coverageNotice, type AxisKey, type BalanceChoice, type Entry,
} from "@/lib/recommend";
import { TOPIC_CHIPS } from "@/lib/books/taxonomy";
import type { GoalMatch } from "@/lib/goal/match";
import type { DrawView } from "./state";
import { LEN_CHIPS, type TargetForm } from "./target";

/** target-chips.md 1절: an empty field means 상관없음. */
export const ANY = "상관없음";

export interface TasteLine { axis: AxisKey; text: string; strength: 0 | 1 | 2 }

/**
 * balance-game.md 2절 — built from the raw answers (question i and i + 4 share an axis), never from LeafAnswers:
 * same side twice → "확실히 X" (●●), one side + 못 잡겠어요 → "X" (●○), split or both unsure → "X · Y 둘 다 좋아요" (○○).
 */
export function tasteLines(choices: readonly BalanceChoice[]): TasteLine[] {
  return AXES.map((axis, i) => {
    const [a, b] = AXIS_LABEL[axis];
    const first = choices[i] ?? "unsure";
    const second = choices[i + 4] ?? "unsure";
    const word = (c: BalanceChoice) => (c === "A" ? a : b);
    if (first === second && first !== "unsure") return { axis, text: `확실히 ${word(first)}`, strength: 2 };
    if (first === "unsure" && second !== "unsure") return { axis, text: word(second), strength: 1 };
    if (second === "unsure" && first !== "unsure") return { axis, text: word(first), strength: 1 };
    return { axis, text: `${a} · ${b} 둘 다 좋아요`, strength: 0 };
  });
}

export function lengthWord(choice: BalanceChoice | undefined): string {
  if (choice === "A") return "얇게";
  if (choice === "B") return "두껍게";
  return ANY;
}

export function targetSummary(f: TargetForm, goal: GoalMatch | null): { label: string; value: string }[] {
  const what = goal ? `“${goal.text}”` : (TOPIC_CHIPS.find((c) => c.topic === f.topic)?.label ?? ANY);
  return [
    { label: "무엇을", value: what },
    { label: "분량", value: LEN_CHIPS.find((c) => c.value === f.len)?.label ?? ANY },
    { label: "읽는 방식", value: f.way ? WAY_LABEL[f.way] : ANY },
  ];
}

/**
 * C-14 notes on the first page. Coverage (target-chips.md 3절) comes first; the exhausted note (book-pool.md ⑧, 🎯 only,
 * or any empty draw) is never shown in the same round as a coverage note.
 */
export function firstPageNotices(entry: Entry | null, goal: GoalMatch | null, draw: DrawView | null): string[] {
  let coverage: string | null = null;
  if (entry === "target" && goal) {
    if (!goal.matched) coverage = coverageNotice(0, goal.text, goal.topic);
    else if (goal.keywords.length && draw && draw.found !== null) {
      coverage = coverageNotice(draw.found, draw.keywords[0] ?? goal.keywords[0], goal.topic);
    }
  }
  if (coverage) return [coverage];
  if (draw && (draw.picks.length === 0 || (entry === "target" && draw.exhausted))) return [EXHAUSTED_NOTICE];
  return [];
}

/** PRD E-22 buckets. */
export function coverageBucket(found: number): "0" | "1-3" | "4+" {
  if (found <= 0) return "0";
  return found < 4 ? "1-3" : "4+";
}

/** E-06 items for 🍃: question numbers whose answer changed. */
export function editedQuestions(before: readonly BalanceChoice[], after: readonly BalanceChoice[]): string[] {
  return after.flatMap((c, i) => (c !== before[i] ? [`q${i + 1}`] : []));
}

/** E-06 items for 🎯: "what" (topic or written goal), "len", "way". */
export function editedTargetFields(before: TargetForm, after: TargetForm): string[] {
  const what = before.topic !== after.topic || (before.free === null) !== (after.free === null)
    || (before.free ?? "").trim() !== (after.free ?? "").trim();
  return [
    ...(what ? ["what"] : []),
    ...(before.len !== after.len ? ["len"] : []),
    ...(before.way !== after.way ? ["way"] : []),
  ];
}
```

- [ ] **Step 5: 리듀서·저장**

`web/src/lib/flow/state.ts`:
```ts
import type { BalanceChoice, Entry } from "@/lib/recommend";
import type { ArtCombo } from "@/lib/art/combine";
import type { BookCard } from "@/lib/books/types";
import type { GoalMatch } from "@/lib/goal/match";
import { QUESTIONS } from "./questions";
import { EMPTY_FORM, type TargetForm } from "./target";

export type Step = "home" | "leaf" | "target" | "book" | "first" | "bookmarks" | "end";
export const STEPS: readonly Step[] = ["home", "leaf", "target", "book", "first", "bookmarks", "end"];
export type Reaction = "pass" | "curious";
export interface PickView { card: BookCard; kind: "recommended" | "random"; art: ArtCombo }
export interface DrawView { picks: PickView[]; exhausted: boolean; found: number | null; keywords: string[] }
export type DrawStatus = "idle" | "loading" | "ready" | "error";

export interface FlowState {
  step: Step;
  entry: Entry | null;
  choices: BalanceChoice[];               // 🍃 answers of this pass
  prevChoices: BalanceChoice[] | null;    // 🍃 answers before the one edit (E-06)
  form: TargetForm;
  prevForm: TargetForm | null;            // 🎯 form before the one edit (E-06)
  goal: GoalMatch | null;                 // 🎯 written goal, matched to our list
  status: DrawStatus;
  drawId: number;                         // +1 for every draw request; late answers to older requests are ignored
  draw: DrawView | null;
  opened: boolean;
  edited: boolean;                        // the one edit of F-07 is used
  index: number;                          // current bookmark (0-based)
  reactions: Reaction[];
  seen: string[];                         // books shown in this session — excluded from later draws (F-05)
}

export const INITIAL: FlowState = {
  step: "home", entry: null, choices: [], prevChoices: null, form: EMPTY_FORM, prevForm: null, goal: null,
  status: "idle", drawId: 0, draw: null, opened: false, edited: false, index: 0, reactions: [], seen: [],
};

export type FlowAction =
  | { type: "start"; entry: Entry }
  | { type: "answer"; choice: BalanceChoice }
  | { type: "submitTarget"; form: TargetForm; goal: GoalMatch | null }
  | { type: "drawn"; id: number; draw: DrawView }
  | { type: "drawFailed"; id: number }
  | { type: "retry" }
  | { type: "open" }
  | { type: "edit" }
  | { type: "next" }
  | { type: "react"; reaction: Reaction }
  | { type: "home" };

/** Ask for a new draw: to S-03 the first time, straight back to the open book after an edit. */
function requestDraw(s: FlowState): FlowState {
  return { ...s, status: "loading", drawId: s.drawId + 1, draw: null, step: s.opened ? "first" : "book" };
}

const addSeen = (seen: string[], id: string) => (seen.includes(id) ? seen : [...seen, id]);

export function flowReducer(s: FlowState, a: FlowAction): FlowState {
  switch (a.type) {
    case "start":
      return { ...INITIAL, seen: s.seen, entry: a.entry, step: a.entry };
    case "answer": {
      if (s.step !== "leaf" || s.choices.length >= QUESTIONS.length) return s;
      const next = { ...s, choices: [...s.choices, a.choice] };
      return next.choices.length === QUESTIONS.length ? requestDraw(next) : next;
    }
    case "submitTarget":
      return s.step === "target" ? requestDraw({ ...s, form: a.form, goal: a.goal }) : s;
    case "drawn":
      return s.status === "loading" && a.id === s.drawId ? { ...s, status: "ready", draw: a.draw } : s;
    case "drawFailed":
      return s.status === "loading" && a.id === s.drawId ? { ...s, status: "error" } : s;
    case "retry":
      return s.status === "error" ? { ...s, status: "loading", drawId: s.drawId + 1 } : s;
    case "open":
      return s.step === "book" ? { ...s, opened: true, step: "first" } : s;
    case "edit":
      if (s.step !== "first" || s.edited) return s;
      return s.entry === "leaf"
        ? { ...s, edited: true, prevChoices: s.choices, choices: [], step: "leaf" }
        : { ...s, edited: true, prevForm: s.form, step: "target" };
    case "next":
      if (s.step !== "first" || s.status !== "ready" || !s.draw || s.draw.picks.length === 0) return s;
      return { ...s, step: "bookmarks", index: 0, reactions: [], seen: addSeen(s.seen, s.draw.picks[0].card.id) };
    case "react": {
      if (s.step !== "bookmarks" || !s.draw) return s;
      const reactions = [...s.reactions, a.reaction];
      const index = s.index + 1;
      if (index >= s.draw.picks.length) return { ...s, reactions, step: "end" };
      return { ...s, reactions, index, seen: addSeen(s.seen, s.draw.picks[index].card.id) };
    }
    case "home":
      return { ...INITIAL, seen: s.seen };
  }
}
```

`web/src/lib/flow/storage.ts`:
```ts
import { INITIAL, STEPS, type FlowState } from "./state";

export const FLOW_KEY = "galpi.flow";
const VERSION = 1;

/** Resume this tab's flow after a reload (KakaoTalk's in-app browser reloads often). A request cut off by the reload becomes a retry. */
export function loadFlow(): FlowState {
  try {
    const raw = window.sessionStorage.getItem(FLOW_KEY);
    if (!raw) return INITIAL;
    const saved = JSON.parse(raw) as { v?: unknown; state?: Partial<FlowState> };
    const state = saved.state;
    if (saved.v !== VERSION || !state || !STEPS.includes(state.step as FlowState["step"])) return INITIAL;
    const full = { ...INITIAL, ...state } as FlowState;
    return full.status === "loading" ? { ...full, status: "error" } : full;
  } catch {
    return INITIAL;
  }
}

export function saveFlow(state: FlowState): void {
  try {
    window.sessionStorage.setItem(FLOW_KEY, JSON.stringify({ v: VERSION, state }));
  } catch {
    // storage blocked: the flow still works, it just cannot resume after a reload
  }
}
```

- [ ] **Step 6: 통과 확인**

Run: `npx vitest run src/lib/flow && npm run typecheck && npm run lint`
Expected: PASS (questions 3, target 4, summary 14, state 12, storage 7), 타입·린트 오류 없음

- [ ] **Step 7: Commit**

```bash
git add web/src/lib/flow
git commit -m "feat(flow): flow reducer, first-page summary from raw answers and session resume"
```

---

### Task 7: S-02 🍃 — 꾹 누르기 버튼(C-08)과 밸런스 카드(C-07)

**Files:**
- Create: `web/src/components/flow/HoldButton.tsx`, `web/src/components/flow/HoldButton.module.css`, `web/src/components/flow/BalanceGame.tsx`, `web/src/components/flow/BalanceGame.module.css`
- Test: `web/src/components/flow/HoldButton.test.tsx`, `web/src/components/flow/BalanceGame.test.tsx`

**Interfaces:**
- Consumes: `track(name, props)` (`@/lib/track/client`), Task 6 `QUESTIONS`, 타입 `BalanceChoice`
- Produces:
  - `HOLD_MS = 800`, `<HoldButton label onHold={() => void} onCancel={(heldMs: number) => void} />` — 누르기(포인터·Enter·Space) 800ms **타이머**가 끝나면 `onHold`, 그 전에 떼면 `onCancel`. 게이지는 보여주기만. 길게 누르기 메뉴·글자 선택 막음
  - `<BalanceGame choices={readonly BalanceChoice[]} edit={boolean} onAnswer={(c: BalanceChoice) => void} />` — 지금 문항 = `choices.length`. E-24 `balance_answered`, E-25 `unsure_hold_cancelled`를 스스로 보낸다. 카드에 `data-side="left" | "right"`

- [ ] **Step 1: 실패하는 테스트**

`web/src/components/flow/HoldButton.test.tsx`:
```tsx
import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { HOLD_MS, HoldButton } from "./HoldButton";

describe("HoldButton", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  const setup = () => {
    const onHold = vi.fn();
    const onCancel = vi.fn();
    render(<HoldButton label="갈피를 못 잡겠어요" onHold={onHold} onCancel={onCancel} />);
    return { onHold, onCancel, button: screen.getByRole("button", { name: "갈피를 못 잡겠어요" }) };
  };

  it("fires once the 0.8s timer runs out, not before", () => {
    const { onHold, onCancel, button } = setup();
    fireEvent.pointerDown(button);
    act(() => { vi.advanceTimersByTime(HOLD_MS - 1); });
    expect(onHold).not.toHaveBeenCalled();
    act(() => { vi.advanceTimersByTime(1); });
    expect(onHold).toHaveBeenCalledTimes(1);
    fireEvent.pointerUp(button);
    expect(onCancel).not.toHaveBeenCalled();
  });

  it("reports a release before 0.8s as a cancel", () => {
    const { onHold, onCancel, button } = setup();
    fireEvent.pointerDown(button);
    act(() => { vi.advanceTimersByTime(300); });
    fireEvent.pointerUp(button);
    act(() => { vi.advanceTimersByTime(1000); });
    expect(onHold).not.toHaveBeenCalled();
    expect(onCancel).toHaveBeenCalledTimes(1);
    expect(onCancel).toHaveBeenCalledWith(expect.any(Number));
  });

  it("holds with Enter and ignores key repeat", () => {
    const { onHold, button } = setup();
    fireEvent.keyDown(button, { key: "Enter" });
    fireEvent.keyDown(button, { key: "Enter", repeat: true });
    act(() => { vi.advanceTimersByTime(HOLD_MS); });
    expect(onHold).toHaveBeenCalledTimes(1);
  });

  it("blocks the long-press menu and shows the gauge only while holding", () => {
    const { button } = setup();
    expect(fireEvent.contextMenu(button)).toBe(false);
    fireEvent.pointerDown(button);
    expect(button).toHaveAttribute("data-holding");
    fireEvent.pointerUp(button);
    expect(button).not.toHaveAttribute("data-holding");
  });
});
```

`web/src/components/flow/BalanceGame.test.tsx`:
```tsx
import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { track } from "@/lib/track/client";
import { BalanceGame } from "./BalanceGame";

vi.mock("@/lib/track/client", () => ({ track: vi.fn() }));

describe("BalanceGame", () => {
  afterEach(() => {
    vi.clearAllMocks();
    vi.useRealTimers();
  });

  it("asks question 1 with A on the left and logs the answer", () => {
    const onAnswer = vi.fn();
    render(<BalanceGame choices={[]} edit={false} onAnswer={onAnswer} />);
    expect(screen.getByRole("heading", { name: "책을 덮은 뒤, 남았으면 하는 건?" })).toBeInTheDocument();
    expect(screen.getByText("1 / 9")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "몽글몽글 따뜻함" }));
    expect(onAnswer).toHaveBeenCalledWith("A");
    expect(track).toHaveBeenCalledWith("balance_answered", expect.objectContaining({ question: 1, choice: "A", side: "left", edit: false }));
  });

  it("puts A on the right from question 5", () => {
    const onAnswer = vi.fn();
    const { container } = render(<BalanceGame choices={["A", "A", "A", "A"]} edit onAnswer={onAnswer} />);
    expect(container.querySelector('[data-side="left"]')).toHaveTextContent("빗소리처럼 쓸쓸한 책");
    fireEvent.click(screen.getByRole("button", { name: "빗소리처럼 쓸쓸한 책" }));
    expect(onAnswer).toHaveBeenCalledWith("B");
    expect(track).toHaveBeenCalledWith("balance_answered", expect.objectContaining({ question: 5, choice: "B", side: "left", edit: true }));
  });

  it("answers 못 잡겠어요 after the hold and logs a cancelled hold before it", () => {
    vi.useFakeTimers();
    const onAnswer = vi.fn();
    render(<BalanceGame choices={["A"]} edit={false} onAnswer={onAnswer} />);
    const hold = screen.getByRole("button", { name: "갈피를 못 잡겠어요" });
    fireEvent.pointerDown(hold);
    act(() => { vi.advanceTimersByTime(200); });
    fireEvent.pointerUp(hold);
    expect(track).toHaveBeenCalledWith("unsure_hold_cancelled", expect.objectContaining({ question: 2, held_ms: expect.any(Number) }));
    fireEvent.pointerDown(hold);
    act(() => { vi.advanceTimersByTime(800); });
    expect(onAnswer).toHaveBeenCalledWith("unsure");
    expect(track).toHaveBeenCalledWith("balance_answered", expect.objectContaining({ question: 2, choice: "unsure", side: null }));
  });

  it("marks answered and 못 잡겠어요 cells in the progress bar", () => {
    const { container } = render(<BalanceGame choices={["A", "unsure", "B"]} edit={false} onAnswer={vi.fn()} />);
    expect(container.querySelectorAll('[data-state="done"]')).toHaveLength(2);
    expect(container.querySelectorAll('[data-state="unsure"]')).toHaveLength(1);
    expect(container.querySelectorAll('[data-state="now"]')).toHaveLength(1);
  });
});
```

- [ ] **Step 2: 실패 확인**

Run: `cd web && npx vitest run src/components/flow`
Expected: FAIL — `Failed to resolve import "./HoldButton"`

- [ ] **Step 3: 꾹 누르기 버튼**

`web/src/components/flow/HoldButton.tsx`:
```tsx
"use client";
import { useEffect, useRef, useState, type KeyboardEvent, type PointerEvent } from "react";
import styles from "./HoldButton.module.css";

/** DESIGN T-06 hold: the timer decides when it passes; the gauge only shows it (a janky frame cannot delay it). */
export const HOLD_MS = 800;
const HOLD_KEYS = new Set(["Enter", " "]);

interface Props {
  label: string;
  onHold: () => void;
  onCancel: (heldMs: number) => void;
}

/** C-08 — "갈피를 못 잡겠어요": press and hold for 0.8s (pointer, Enter or Space). */
export function HoldButton({ label, onHold, onCancel }: Props) {
  const [holding, setHolding] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const startedAt = useRef(0);

  useEffect(() => () => {
    if (timer.current) clearTimeout(timer.current);
  }, []);

  const start = () => {
    if (timer.current) return;
    startedAt.current = performance.now();
    setHolding(true);
    timer.current = setTimeout(() => {
      timer.current = null;
      setHolding(false);
      onHold();
    }, HOLD_MS);
  };

  const stop = () => {
    if (!timer.current) return;
    clearTimeout(timer.current);
    timer.current = null;
    setHolding(false);
    onCancel(Math.round(performance.now() - startedAt.current));
  };

  const onPointerDown = (e: PointerEvent<HTMLButtonElement>) => {
    try {
      e.currentTarget.setPointerCapture(e.pointerId);
    } catch {
      // synthetic pointer (tests) — capture is only a nicety
    }
    start();
  };
  const onKeyDown = (e: KeyboardEvent<HTMLButtonElement>) => {
    if (!HOLD_KEYS.has(e.key)) return;
    e.preventDefault();               // no click on Enter keydown
    if (!e.repeat) start();
  };
  const onKeyUp = (e: KeyboardEvent<HTMLButtonElement>) => {
    if (HOLD_KEYS.has(e.key)) stop();
  };

  return (
    <button
      type="button"
      className={styles.hold}
      data-holding={holding ? "" : undefined}
      onPointerDown={onPointerDown}
      onPointerUp={stop}
      onPointerCancel={stop}
      onPointerLeave={stop}
      onContextMenu={(e) => e.preventDefault()}
      onKeyDown={onKeyDown}
      onKeyUp={onKeyUp}
    >
      <span className={styles.gauge} aria-hidden="true" />
      <span className={styles.label}>{label}</span>
    </button>
  );
}
```

`web/src/components/flow/HoldButton.module.css`:
```css
.hold {
  position: relative; overflow: hidden; align-self: center;
  min-height: var(--touch); padding: 0 var(--space-5);
  border: 1px dashed var(--ink-muted); border-radius: var(--radius-pill);
  background: var(--paper); color: var(--ink-muted);
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

- [ ] **Step 4: 밸런스 카드**

`web/src/components/flow/BalanceGame.tsx`:
```tsx
"use client";
import { useEffect, useRef } from "react";
import type { BalanceChoice } from "@/lib/recommend";
import { QUESTIONS } from "@/lib/flow/questions";
import { track } from "@/lib/track/client";
import { HoldButton } from "./HoldButton";
import styles from "./BalanceGame.module.css";

interface Props {
  choices: readonly BalanceChoice[];
  edit: boolean;
  onAnswer: (choice: BalanceChoice) => void;
}

type Side = { side: "left" | "right"; choice: "A" | "B"; text: string };

/** S-02 🍃 (C-07): nine two-way questions, tap to go on; the second question of each axis swaps sides. */
export function BalanceGame({ choices, edit, onAnswer }: Props) {
  const i = Math.min(choices.length, QUESTIONS.length - 1);
  const q = QUESTIONS[i];
  const shownAt = useRef(0);
  useEffect(() => { shownAt.current = performance.now(); }, [i]);
  const elapsed = () => Math.round(performance.now() - shownAt.current);

  const left: Side = q.aOnLeft ? { side: "left", choice: "A", text: q.a } : { side: "left", choice: "B", text: q.b };
  const right: Side = q.aOnLeft ? { side: "right", choice: "B", text: q.b } : { side: "right", choice: "A", text: q.a };

  const choose = (s: Side) => {
    track("balance_answered", { question: q.n, choice: s.choice, side: s.side, ms: elapsed(), edit });
    onAnswer(s.choice);
  };
  const unsure = () => {
    track("balance_answered", { question: q.n, choice: "unsure", side: null, ms: elapsed(), edit });
    onAnswer("unsure");
  };
  const cancelled = (heldMs: number) => track("unsure_hold_cancelled", { question: q.n, held_ms: heldMs, edit });

  return (
    <section className={styles.game} aria-labelledby="balance-question">
      <ol className={styles.progress} aria-hidden="true">
        {QUESTIONS.map((question, k) => (
          <li
            key={question.n}
            className={styles.cell}
            data-state={k < choices.length ? (choices[k] === "unsure" ? "unsure" : "done") : k === i ? "now" : undefined}
          />
        ))}
      </ol>
      <p className={styles.count}>{`${i + 1} / ${QUESTIONS.length}`}</p>
      <h1 id="balance-question" className={styles.question}>{q.text}</h1>
      <div className={styles.pair}>
        <button type="button" className={styles.card} data-side="left" onClick={() => choose(left)}>{left.text}</button>
        <span className={styles.vs} aria-hidden="true">vs</span>
        <button type="button" className={styles.card} data-side="right" onClick={() => choose(right)}>{right.text}</button>
      </div>
      <HoldButton key={q.n} label="갈피를 못 잡겠어요" onHold={unsure} onCancel={cancelled} />
    </section>
  );
}
```

`web/src/components/flow/BalanceGame.module.css`:
```css
.game { display: flex; flex-direction: column; gap: var(--space-4); padding-top: var(--space-4); }
.progress { display: grid; grid-template-columns: repeat(9, 1fr); gap: var(--space-1); margin: 0; padding: 0; list-style: none; }
.cell { height: 6px; border-radius: var(--radius-pill); background: var(--paper-line); }
.cell[data-state="done"] { background: var(--ink); }
.cell[data-state="unsure"] { background: var(--ink-muted); opacity: 0.45; }
.cell[data-state="now"] { background: var(--ink-muted); }
.count { margin: 0; font-size: 12px; color: var(--ink-muted); text-align: right; }
.question { margin: var(--space-2) 0 var(--space-4); font-size: 20px; line-height: 1.5; text-align: center; word-break: keep-all; }
/* P-02 note: choices wrapped too narrowly — two wide cards, keep-all line breaks. */
.pair { display: grid; grid-template-columns: 1fr auto 1fr; align-items: stretch; gap: var(--space-2); }
.card {
  min-height: 140px; padding: var(--space-4) var(--space-3);
  border: 1px solid var(--paper-line); border-radius: var(--radius-card);
  background: var(--paper); color: var(--ink);
  font: inherit; font-size: 15px; line-height: 1.6; word-break: keep-all; cursor: pointer;
}
.card:active { background: var(--paper-deep); }
.card:focus-visible { outline: 3px solid var(--field-data); outline-offset: 2px; }
.vs { align-self: center; font-family: var(--font-batang), serif; font-size: 14px; color: var(--ink-muted); }
```

- [ ] **Step 5: 통과 확인**

Run: `npx vitest run src/components/flow && npm run typecheck && npm run lint`
Expected: PASS (HoldButton 4, BalanceGame 4). 린트는 오류 0 (HoldButton 정리 effect의 ref 경고 1건은 허용 — 언마운트 때 남은 타이머를 지우는 것이 의도)

- [ ] **Step 6: Commit**

```bash
git add web/src/components/flow/HoldButton.* web/src/components/flow/BalanceGame.*
git commit -m "feat(flow): balance game with a timer-based 0.8s unsure hold"
```

---

### Task 8: S-01 처음 화면과 S-02 🎯 한 화면 입력(C-09)

**Files:**
- Create: `web/src/components/flow/Home.tsx`, `web/src/components/flow/Home.module.css`, `web/src/components/flow/TargetInput.tsx`, `web/src/components/flow/TargetInput.module.css`
- Test: `web/src/components/flow/Home.test.tsx`, `web/src/components/flow/TargetInput.test.tsx`

**Interfaces:**
- Consumes: `track` (`@/lib/track/client`), `Button` (`@/components/Button`), Task 2 `TOPIC_CHIPS`, `Topic`, Task 3 `GOAL_MAX`, Task 6 `TargetForm`, `LenChoice`, `LEN_CHIPS`, `WAY_CHIPS`, `FREE_PLACEHOLDER`, `formReady`, 타입 `Entry`, `Way`
- Produces:
  - `<Home onStart={(entry: Entry) => void} />` — 우측 위는 `data-testid="account-slot"` 빈 자리(P5)
  - `MISSING_WHAT = "보기 하나를 고르거나 직접 써 주세요"`, `<TargetInput initial={TargetForm} edit={boolean} onSubmit={(form: TargetForm) => void} />` — E-03 `chip_selected`를 스스로 보낸다. 제출하는 `free`는 앞뒤 공백을 자르고 30자까지

- [ ] **Step 1: 실패하는 테스트**

`web/src/components/flow/Home.test.tsx`:
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

  it("keeps the top-right login place empty and not clickable (P5)", () => {
    render(<Home onStart={vi.fn()} />);
    expect(screen.getByTestId("account-slot")).toBeEmptyDOMElement();
    expect(screen.getAllByRole("button")).toHaveLength(2);
    expect(screen.getByRole("heading", { name: "갈피" })).toBeInTheDocument();
    expect(screen.getByText("읽을 책, 갈피가 안 잡힐 때")).toBeInTheDocument();
  });
});
```

`web/src/components/flow/TargetInput.test.tsx`:
```tsx
import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { EMPTY_FORM } from "@/lib/flow/target";
import { track } from "@/lib/track/client";
import { MISSING_WHAT, TargetInput } from "./TargetInput";

vi.mock("@/lib/track/client", () => ({ track: vi.fn() }));

const submit = () => fireEvent.click(screen.getByRole("button", { name: "책 펼치기" }));

describe("TargetInput (S-02 🎯)", () => {
  afterEach(() => vi.clearAllMocks());

  it("stops with a notice when 무엇을 is empty", () => {
    const onSubmit = vi.fn();
    render(<TargetInput initial={EMPTY_FORM} edit={false} onSubmit={onSubmit} />);
    submit();
    expect(screen.getByRole("alert")).toHaveTextContent(MISSING_WHAT);
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it("sends a chosen topic with the optional chips and logs every chip", () => {
    const onSubmit = vi.fn();
    render(<TargetInput initial={EMPTY_FORM} edit={false} onSubmit={onSubmit} />);
    fireEvent.click(screen.getByRole("button", { name: "AI 똑똑하게 쓰기" }));
    fireEvent.click(screen.getByRole("button", { name: "얇게" }));
    fireEvent.click(screen.getByRole("button", { name: "사례로 술술" }));
    submit();
    expect(onSubmit).toHaveBeenCalledWith({ topic: "AI 활용", free: null, len: "thin", way: "사례" });
    expect(vi.mocked(track).mock.calls).toEqual([
      ["chip_selected", { question: "topic", value: "AI 활용", edit: false }],
      ["chip_selected", { question: "len", value: "thin", edit: false }],
      ["chip_selected", { question: "way", value: "사례", edit: false }],
    ]);
  });

  it("turns an optional chip off when tapped again", () => {
    render(<TargetInput initial={EMPTY_FORM} edit={false} onSubmit={vi.fn()} />);
    const thin = screen.getByRole("button", { name: "얇게" });
    fireEvent.click(thin);
    fireEvent.click(thin);
    expect(thin).toHaveAttribute("aria-pressed", "false");
    expect(track).toHaveBeenLastCalledWith("chip_selected", { question: "len", value: null, edit: false });
  });

  it("takes a written goal instead of a topic, trimmed", () => {
    const onSubmit = vi.fn();
    render(<TargetInput initial={{ ...EMPTY_FORM, topic: "통계" }} edit={false} onSubmit={onSubmit} />);
    fireEvent.click(screen.getByRole("button", { name: "직접 쓰기" }));
    const box = screen.getByRole("textbox", { name: "직접 쓰기" });
    expect(box).toHaveAttribute("maxLength", "30");
    expect(box).toHaveAttribute("placeholder", "SQL, 엑셀 함수, 번아웃, 발표 준비 …");
    fireEvent.change(box, { target: { value: "  SQL 공부  " } });
    submit();
    expect(onSubmit).toHaveBeenCalledWith({ topic: null, free: "SQL 공부", len: null, way: null });
  });

  it("counts an empty written goal as missing", () => {
    const onSubmit = vi.fn();
    render(<TargetInput initial={EMPTY_FORM} edit={false} onSubmit={onSubmit} />);
    fireEvent.click(screen.getByRole("button", { name: "직접 쓰기" }));
    submit();
    expect(screen.getByRole("alert")).toBeInTheDocument();
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it("shows the YES24 search hint and the privacy line under the written goal", () => {
    render(<TargetInput initial={{ ...EMPTY_FORM, free: "" }} edit={false} onSubmit={vi.fn()} />);
    const link = screen.getByRole("link", { name: /예스24 검색을 이용해 주세요/ });
    expect(link).toHaveAttribute("target", "_blank");
    expect(link).toHaveAttribute("rel", "noopener noreferrer");
    expect(screen.getByText(/주제나 고민을 적어 주세요/)).toBeInTheDocument();
    expect(screen.getByText("이름·연락처는 적지 마세요")).toBeInTheDocument();
  });

  it("starts from the previous answers when editing", () => {
    render(<TargetInput initial={{ topic: "통계", free: null, len: "thick", way: "개념" }} edit onSubmit={vi.fn()} />);
    expect(screen.getByRole("button", { name: "통계" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("button", { name: "두꺼워도 좋아요" })).toHaveAttribute("aria-pressed", "true");
    fireEvent.click(screen.getByRole("button", { name: "보통" }));
    expect(track).toHaveBeenCalledWith("chip_selected", { question: "len", value: "normal", edit: true });
  });
});
```

- [ ] **Step 2: 실패 확인**

Run: `cd web && npx vitest run src/components/flow/Home.test.tsx src/components/flow/TargetInput.test.tsx`
Expected: FAIL — `Failed to resolve import "./Home"` / `"./TargetInput"`

- [ ] **Step 3: 처음 화면**

`web/src/components/flow/Home.tsx`:
```tsx
import type { Entry } from "@/lib/recommend";
import styles from "./Home.module.css";

interface Props { onStart: (entry: Entry) => void }

/** PRD F-01 wording. */
const ENTRIES: readonly { entry: Entry; title: string; mark: string; desc: string }[] = [
  { entry: "target", title: "알고 싶은 게 있어요", mark: "🎯", desc: "배우고 싶은 주제로, 아직 모르는 책 만나기" },
  { entry: "leaf", title: "그냥 한 권 만나고 싶어요", mark: "🍃", desc: "밸런스 게임으로 내 취향에 맞는 한 권 만나기" },
];

/** S-01 — no login needed to start. */
export function Home({ onStart }: Props) {
  return (
    <div className={styles.home}>
      <header className={styles.top}>
        {/* Top right: [로그인] / [내 서재] arrive in P5. Only the place is kept now. */}
        <span className={styles.accountSlot} aria-hidden="true" data-testid="account-slot" />
      </header>
      <section className={styles.hero}>
        <h1 className={styles.logo}>갈피</h1>
        <p className={styles.tagline}>읽을 책, 갈피가 안 잡힐 때</p>
      </section>
      <div className={styles.entries}>
        {ENTRIES.map((e) => (
          <button key={e.entry} type="button" className={styles.entry} onClick={() => onStart(e.entry)}>
            <span className={styles.entryTitle}>{e.title} <span aria-hidden="true">{e.mark}</span></span>
            <span className={styles.entryDesc}>{e.desc}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
```

`web/src/components/flow/Home.module.css`:
```css
.home { display: flex; flex-direction: column; gap: var(--space-5); padding-bottom: var(--space-5); }
.top { display: flex; justify-content: flex-end; min-height: var(--touch); }
.accountSlot { width: 72px; height: var(--touch); }
.hero { padding: var(--space-6) 0 var(--space-4); text-align: center; }
.logo { margin: 0; font-size: 28px; }
.tagline { margin: var(--space-2) 0 0; color: var(--ink-soft); }
.entries { display: flex; flex-direction: column; gap: var(--space-3); }
.entry {
  display: flex; flex-direction: column; align-items: flex-start; gap: var(--space-1);
  width: 100%; min-height: 88px; padding: var(--space-4);
  border: 1px solid var(--paper-line); border-radius: var(--radius-card);
  background: var(--paper); color: var(--ink); font: inherit; text-align: left; cursor: pointer;
  box-shadow: 0 1px 0 var(--paper-line);
}
.entry:active { background: var(--paper-deep); }
.entry:focus-visible { outline: 3px solid var(--field-data); outline-offset: 2px; }
.entryTitle { font-family: var(--font-batang), serif; font-size: 18px; font-weight: 700; }
.entryDesc { font-size: 13px; color: var(--ink-muted); }
```

- [ ] **Step 4: 🎯 입력**

`web/src/components/flow/TargetInput.tsx`:
```tsx
"use client";
import { useRef, useState, type FormEvent } from "react";
import type { Way } from "@/lib/recommend";
import { Button } from "@/components/Button";
import { TOPIC_CHIPS, type Topic } from "@/lib/books/taxonomy";
import { FREE_PLACEHOLDER, LEN_CHIPS, WAY_CHIPS, formReady, type LenChoice, type TargetForm } from "@/lib/flow/target";
import { GOAL_MAX } from "@/lib/goal/match";
import { track } from "@/lib/track/client";
import styles from "./TargetInput.module.css";

/** target-chips.md 1절 says "안내를 띄우고 멈춘다" without wording — new copy, logged in context.md. */
export const MISSING_WHAT = "보기 하나를 고르거나 직접 써 주세요";
// Plain text link, new tab, no logo; a search page would need the typed text in the URL — the home page has search.
const YES24_HOME = "https://www.yes24.com/";

interface Props { initial: TargetForm; edit: boolean; onSubmit: (form: TargetForm) => void }

/** S-02 🎯 (C-09): one screen — 무엇을 (required: 6 chips or 직접 쓰기) · 분량 · 읽는 방식. */
export function TargetInput({ initial, edit, onSubmit }: Props) {
  const [form, setForm] = useState<TargetForm>(initial);
  const [missing, setMissing] = useState(false);
  const freeInput = useRef<HTMLInputElement>(null);

  const change = (patch: Partial<TargetForm>, question: "topic" | "len" | "way", value: string | null) => {
    setForm((f) => ({ ...f, ...patch }));
    setMissing(false);
    track("chip_selected", { question, value, edit });
  };
  const pickTopic = (topic: Topic) => change({ topic, free: null }, "topic", topic);
  const pickFree = () => {
    change({ topic: null, free: form.free ?? "" }, "topic", "direct");
    setTimeout(() => freeInput.current?.focus(), 0);
  };
  const toggleLen = (len: LenChoice) => {
    const next = form.len === len ? null : len;
    change({ len: next }, "len", next);
  };
  const toggleWay = (way: Way) => {
    const next = form.way === way ? null : way;
    change({ way: next }, "way", next);
  };

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (!formReady(form)) {
      setMissing(true);
      return;
    }
    onSubmit({ ...form, free: form.free === null ? null : form.free.trim().slice(0, GOAL_MAX) });
  };

  return (
    <form className={styles.form} onSubmit={submit} noValidate>
      <h1 className={styles.title}>알고 싶은 게 있어요</h1>

      <div role="group" aria-labelledby="what-label" className={styles.group}>
        <p id="what-label" className={styles.label}>
          무엇을 알고 싶어요 <span className={missing ? styles.required : styles.badge}>필수</span>
        </p>
        <div className={styles.chips}>
          {TOPIC_CHIPS.map((c) => (
            <button key={c.topic} type="button" className={styles.chip}
              aria-pressed={form.free === null && form.topic === c.topic} onClick={() => pickTopic(c.topic)}>
              {c.label}
            </button>
          ))}
          <button type="button" className={styles.chip} aria-pressed={form.free !== null} onClick={pickFree}>직접 쓰기</button>
        </div>
        {form.free !== null && (
          <>
            <input
              ref={freeInput}
              className={styles.input}
              aria-label="직접 쓰기"
              maxLength={GOAL_MAX}
              placeholder={FREE_PLACEHOLDER}
              value={form.free}
              onChange={(e) => {
                const free = e.target.value;
                setForm((f) => ({ ...f, free }));
                setMissing(false);
              }}
            />
            <p className={styles.hint}>
              주제나 고민을 적어 주세요 · 제목·작가로 찾을 땐{" "}
              <a href={YES24_HOME} target="_blank" rel="noopener noreferrer">예스24 검색을 이용해 주세요 ↗</a>
            </p>
            <p className={styles.hint}>이름·연락처는 적지 마세요</p>
          </>
        )}
        {missing && <p role="alert" className={styles.missing}>{MISSING_WHAT}</p>}
      </div>

      <div role="group" aria-labelledby="len-label" className={styles.group}>
        <p id="len-label" className={styles.label}>분량 <span className={styles.badge}>선택</span></p>
        <div className={styles.chips}>
          {LEN_CHIPS.map((c) => (
            <button key={c.value} type="button" className={styles.chip} aria-pressed={form.len === c.value} onClick={() => toggleLen(c.value)}>
              {c.label}
            </button>
          ))}
        </div>
      </div>

      <div role="group" aria-labelledby="way-label" className={styles.group}>
        <p id="way-label" className={styles.label}>읽는 방식 <span className={styles.badge}>선택</span></p>
        <div className={styles.chips}>
          {WAY_CHIPS.map((c) => (
            <button key={c.value} type="button" className={styles.chip} aria-pressed={form.way === c.value} onClick={() => toggleWay(c.value)}>
              {c.label}
            </button>
          ))}
        </div>
      </div>

      <Button type="submit" className={styles.submit}>책 펼치기</Button>
    </form>
  );
}
```

`web/src/components/flow/TargetInput.module.css`:
```css
.form { display: flex; flex-direction: column; gap: var(--space-5); padding-top: var(--space-4); }
.title { margin: 0; font-size: 20px; }
.group { display: flex; flex-direction: column; gap: var(--space-2); }
.label { display: flex; align-items: center; gap: var(--space-2); margin: 0; font-size: 15px; }
.badge { font-size: 12px; color: var(--ink-muted); }
/* C-09: required notice in ink with an underline instead of red. */
.required { font-size: 12px; color: var(--ink); text-decoration: underline; text-underline-offset: 3px; }
.chips { display: flex; flex-wrap: wrap; gap: var(--space-2); }
.chip {
  min-height: var(--touch); padding: 0 var(--space-4);
  border: 1px solid var(--paper-line); border-radius: var(--radius-pill);
  background: var(--paper); color: var(--ink); font: inherit; font-size: 14px; cursor: pointer;
}
.chip[aria-pressed="true"] { background: var(--ink); border-color: var(--ink); color: var(--paper); }
.chip:focus-visible { outline: 3px solid var(--field-data); outline-offset: 2px; }
.input {
  min-height: var(--touch); padding: 0 var(--space-4);
  border: 1px solid var(--ink); border-radius: var(--radius-card);
  background: var(--paper); color: var(--ink); font: inherit; font-size: 15px;
}
.hint { margin: 0; font-size: 12px; line-height: 1.6; color: var(--ink-muted); }
.hint a { color: var(--ink-muted); }
.missing { margin: 0; font-size: 13px; color: var(--ink); text-decoration: underline; text-underline-offset: 3px; }
.submit { align-self: stretch; }
```

- [ ] **Step 5: 통과 확인**

Run: `npx vitest run src/components && npm run typecheck && npm run lint`
Expected: PASS (Home 2, TargetInput 7 포함), 타입·린트 오류 없음

- [ ] **Step 6: Commit**

```bash
git add web/src/components/flow/Home.* web/src/components/flow/TargetInput.*
git commit -m "feat(flow): entry screen and the one-screen 🎯 input"
```

---

### Task 9: S-03·S-04·S-05와 끝 화면 — 책(C-01), 첫 장(C-10·C-14), 책갈피 장(C-06), 궁금해요 목록

**Files:**
- Create: `web/src/lib/motion.ts`, `web/src/components/flow/Book.tsx`, `web/src/components/flow/Book.module.css`, `web/src/components/flow/FirstPage.tsx`, `web/src/components/flow/FirstPage.module.css`, `web/src/components/flow/BookScene.tsx`, `web/src/components/flow/BookScene.module.css`, `web/src/components/flow/EndList.tsx`, `web/src/components/flow/EndList.module.css`
- Modify: `web/src/components/Button.module.css` (눌리지 않는 상태)
- Test: `web/src/components/flow/BookScene.test.tsx`, `web/src/components/flow/EndList.test.tsx`

**Interfaces:**
- Consumes: `motion`, `AnimatePresence`, `type Variants` (`motion/react`), `Button`, Task 5 `Bookmark`, `GenreTag`, Task 6 `FlowState`, `PickView`, `Reaction`, `firstPageNotices`, `tasteLines`, `lengthWord`, `targetSummary`, `TargetForm`, Task 3 `GoalMatch`
- Produces:
  - `lib/motion.ts`: `OPEN_COVER`, `FLIP_PAGE`, `BOOKMARK_RISE`, `BOOKMARK_AWAY`, `BOOKMARK_DOWN` (T-06을 초 단위로)
  - `<Book open onPress? left? right? />`, `<RuledPage turn? />`
  - `<FirstPage entry choices form goal notices />`
  - `DRAW_FAILED = "책을 불러오지 못했어요"`, `<BookScene state={FlowState} onOpen onEdit onNext onRetry onReact={(r: Reaction) => void} onHome />` — S-03(책을 눌러 펼침)·S-04([한 번 고치기]/[다시 쓰기] 보조 + [다음 장] 주, 실패면 [다시 시도], 빈 뽑기면 [처음으로])·S-05(책 위 책갈피 + 책 아래 [패스] 보조 [궁금해요] 주 + "n / 전체"). 책갈피가 올라오는 동안에는 반응 버튼이 잠긴다
  - `<EndList picks reactions onHome />` — 궁금해요 책만 목록(0이면 [처음으로]만)

- [ ] **Step 1: 실패하는 테스트**

`web/src/components/flow/BookScene.test.tsx`:
```tsx
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { EXHAUSTED_NOTICE } from "@/lib/recommend";
import { INITIAL, type DrawView, type FlowState } from "@/lib/flow/state";
import { BookScene, DRAW_FAILED } from "./BookScene";

const art = { animal: "owl", bg: "sky", sky: "cloud", ground: "grass", rare: false } as const;
const view = (n: number): DrawView => ({
  picks: Array.from({ length: n }, (_, i) => ({
    card: { id: `b${i}`, entry: "target" as const, title: `책 ${i}`, genre: "통계", field: "데이터·통계", oneLiner: `한 줄 ${i}`, oneLinerStyle: "summary" as const },
    kind: "recommended" as const,
    art,
  })),
  exhausted: false, found: null, keywords: [],
});
const first: FlowState = {
  ...INITIAL, step: "first", entry: "target", opened: true, status: "ready", drawId: 1, draw: view(5),
  form: { topic: "통계", free: null, len: "thin", way: null },
};
const handlers = () => ({ onOpen: vi.fn(), onEdit: vi.fn(), onNext: vi.fn(), onRetry: vi.fn(), onReact: vi.fn(), onHome: vi.fn() });

describe("BookScene", () => {
  it("S-03: the closed book is the thing to press", () => {
    const h = handlers();
    render(<BookScene state={{ ...first, step: "book", opened: false, status: "loading", draw: null }} {...h} />);
    expect(screen.getByText("눌러서 펼치기")).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "당신이 찾는 책" })).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "책 펼치기" }));
    expect(h.onOpen).toHaveBeenCalledTimes(1);
  });

  it("S-04: summary on the page, one edit and the next page below the book", () => {
    const h = handlers();
    render(<BookScene state={first} {...h} />);
    expect(screen.getByRole("heading", { name: "당신이 찾는 책" })).toBeInTheDocument();
    expect(screen.getByText("얇게")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "한 번 고치기" }));
    fireEvent.click(screen.getByRole("button", { name: "다음 장" }));
    expect(h.onEdit).toHaveBeenCalledTimes(1);
    expect(h.onNext).toHaveBeenCalledTimes(1);
  });

  it("S-04: waits for the draw and hides the edit once it is used", () => {
    render(<BookScene state={{ ...first, status: "loading", draw: null, edited: true }} {...handlers()} />);
    expect(screen.getByRole("button", { name: "다음 장" })).toBeDisabled();
    expect(screen.queryByRole("button", { name: "한 번 고치기" })).toBeNull();
  });

  it("S-04: offers 다시 쓰기 with the honest note when the written goal matched nothing", () => {
    const goal = { text: "발표 준비", topic: "데이터 분석" as const, keywords: [], matched: false, method: "word" as const };
    render(<BookScene state={{ ...first, form: { topic: null, free: "발표 준비", len: null, way: null }, goal }} {...handlers()} />);
    expect(screen.getByRole("button", { name: "다시 쓰기" })).toBeInTheDocument();
    expect(screen.getByText("아직 이 주제 책이 없어요. 가장 가까운 '데이터 분석' 책을 펼칠게요")).toBeInTheDocument();
  });

  it("S-04: offers a retry when the draw failed", () => {
    const h = handlers();
    render(<BookScene state={{ ...first, status: "error", draw: null }} {...h} />);
    expect(screen.getByRole("alert")).toHaveTextContent(DRAW_FAILED);
    fireEvent.click(screen.getByRole("button", { name: "다시 시도" }));
    expect(h.onRetry).toHaveBeenCalledTimes(1);
  });

  it("S-04: sends the person home when the draw is empty", () => {
    const h = handlers();
    render(<BookScene state={{ ...first, draw: view(0) }} {...h} />);
    expect(screen.getByText(EXHAUSTED_NOTICE)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "다음 장" })).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "처음으로" }));
    expect(h.onHome).toHaveBeenCalledTimes(1);
  });

  it("S-04 🍃: the taste summary comes from the raw answers", () => {
    const choices = ["A", "A", "unsure", "B", "A", "B", "unsure", "A", "B"] as FlowState["choices"];
    render(<BookScene state={{ ...first, entry: "leaf", choices }} {...handlers()} />);
    expect(screen.getByText("당신의 책 취향")).toBeInTheDocument();
    expect(screen.getByText("확실히 따뜻함")).toBeInTheDocument();
    expect(screen.getByText("문장 · 몰입 둘 다 좋아요")).toBeInTheDocument();
    expect(screen.getByText("두껍게")).toBeInTheDocument();
  });

  it("S-05: the bookmark sits on the book, pass / curious below, with the count of a short draw", () => {
    render(<BookScene state={{ ...first, step: "bookmarks", index: 1, draw: view(3) }} {...handlers()} />);
    expect(screen.getByRole("article", { name: "책 1, 한 줄 1, 통계" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "패스" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "궁금해요" })).toBeInTheDocument();
    expect(screen.getByText("2 / 3")).toBeInTheDocument();
  });
});
```

`web/src/components/flow/EndList.test.tsx`:
```tsx
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { PickView } from "@/lib/flow/state";
import { EndList } from "./EndList";

const pick = (id: string): PickView => ({
  card: { id, entry: "leaf", title: `책 ${id}`, genre: "에세이", field: null, oneLiner: `한 줄 ${id}`, oneLinerStyle: "question" },
  kind: "recommended",
  art: { animal: "cat", bg: "peach", sky: "moon", ground: "none", rare: false },
});

describe("EndList", () => {
  it("lists only the curious books and goes home", () => {
    const onHome = vi.fn();
    render(<EndList picks={[pick("a"), pick("b"), pick("c")]} reactions={["curious", "pass", "curious"]} onHome={onHome} />);
    expect(screen.getByRole("heading", { name: "궁금해요 책" })).toBeInTheDocument();
    expect(screen.getAllByRole("listitem").map((li) => li.textContent)).toEqual(["에세이책 a한 줄 a", "에세이책 c한 줄 c"]);
    fireEvent.click(screen.getByRole("button", { name: "처음으로" }));
    expect(onHome).toHaveBeenCalledTimes(1);
  });

  it("shows only 처음으로 when nothing was curious", () => {
    render(<EndList picks={[pick("a")]} reactions={["pass"]} onHome={vi.fn()} />);
    expect(screen.queryByRole("heading")).toBeNull();
    expect(screen.getByRole("button", { name: "처음으로" })).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: 실패 확인**

Run: `cd web && npx vitest run src/components/flow/BookScene.test.tsx src/components/flow/EndList.test.tsx`
Expected: FAIL — `Failed to resolve import "./BookScene"` / `"./EndList"`

- [ ] **Step 3: 움직임 값과 버튼 잠김 모양**

`web/src/lib/motion.ts`:
```ts
/** DESIGN T-06 for Motion, in seconds — keep in step with tokens.css (--dur-*, --ease-*). */
export const OPEN_COVER = { duration: 1, ease: [0.6, 0.05, 0.25, 1] } as const;
export const FLIP_PAGE = { duration: 0.55, ease: [0.5, 0, 0.3, 1] } as const;
export const BOOKMARK_RISE = { duration: 0.6, ease: [0.34, 1.56, 0.64, 1] } as const;
export const BOOKMARK_AWAY = { duration: 0.45, ease: "easeIn" } as const;
export const BOOKMARK_DOWN = { duration: 0.4, ease: "easeIn" } as const;
```

`web/src/components/Button.module.css` 맨 아래에 추가:
```css
.btn:disabled { opacity: 0.45; cursor: default; }
.btn:disabled:active { transform: none; }
```

- [ ] **Step 4: 책(C-01)**

`web/src/components/flow/Book.tsx`:
```tsx
"use client";
import type { ReactNode } from "react";
import { motion } from "motion/react";
import { FLIP_PAGE, OPEN_COVER } from "@/lib/motion";
import styles from "./Book.module.css";

interface Props {
  open: boolean;
  onPress?: () => void;   // S-03 only
  left?: ReactNode;       // inside of the cover once open
  right?: ReactNode;      // right-hand page
}

/**
 * C-01 — cloth cover over a cream page (CSS 3D: perspective + backface). Closed, the cover is centred;
 * opening swings it left around the spine (T-06 open-cover). initial={false}: a resumed flow does not replay it.
 */
export function Book({ open, onPress, left, right }: Props) {
  return (
    <motion.div className={styles.book} initial={false} animate={{ x: open ? "0%" : "-25%" }} transition={OPEN_COVER}>
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
          <span className={styles.coverTitle}>갈피</span>
        </button>
        <div className={styles.back}>{left}</div>
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

`web/src/components/flow/Book.module.css`:
```css
/* Spread = two pages side by side; the cover is the right half and turns around the spine (the centre line). */
.book { position: relative; width: 100%; height: 340px; perspective: 1600px; }
.pageRight {
  position: absolute; top: 0; bottom: 0; left: 50%; width: 50%; overflow: hidden;
  background: var(--paper); border: 1px solid var(--paper-line); border-radius: var(--radius-book);
  box-shadow: inset 10px 0 12px -10px var(--shadow-ink);
}
.cover {
  position: absolute; top: 0; bottom: 0; left: 50%; width: 50%; z-index: 2;
  transform-style: preserve-3d; transform-origin: left center;
}
.front, .back { position: absolute; inset: 0; backface-visibility: hidden; -webkit-backface-visibility: hidden; }
/* A-06: cloth texture in CSS only. */
.front {
  display: flex; align-items: center; justify-content: center; width: 100%; padding: 0; border: 0;
  border-radius: var(--radius-book);
  background: repeating-linear-gradient(45deg, rgba(255, 255, 255, 0.04) 0 2px, transparent 2px 5px), var(--cloth);
  box-shadow: inset 0 0 0 3px var(--cloth-edge), inset 14px 0 0 -10px var(--cloth-edge);
  color: var(--paper); font: inherit; cursor: pointer;
}
.front:disabled { cursor: default; }
.front:focus-visible { outline: 3px solid var(--field-data); outline-offset: 3px; }
.back {
  transform: rotateY(180deg); overflow: hidden;
  background: var(--paper); border: 1px solid var(--paper-line); border-radius: 10px 2px 2px 10px;
}
.coverTitle { font-family: var(--font-batang), serif; font-size: 20px; font-weight: 700; letter-spacing: 6px; writing-mode: vertical-rl; }
.ruled {
  position: absolute; inset: 0; perspective: 1600px;
  background: repeating-linear-gradient(to bottom, transparent 0 27px, var(--paper-deep) 27px 28px);
}
.sheet {
  position: absolute; inset: 0; transform-origin: left center;
  background: var(--paper); border-left: 1px solid var(--paper-line);
}
```

- [ ] **Step 5: 첫 장(C-10·C-14)**

`web/src/components/flow/FirstPage.tsx`:
```tsx
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

/** S-04 "당신이 찾는 책" (C-10) + honest notes (C-14). 🍃 shows the taste from the raw answers — never a type name. */
export function FirstPage({ entry, choices, form, goal, notices }: Props) {
  return (
    <div className={styles.page}>
      <h2 className={styles.title}>당신이 찾는 책</h2>
      {entry === "leaf" ? (
        <>
          <p className={styles.caption}>당신의 책 취향</p>
          <ul className={styles.rows}>
            {tasteLines(choices).map((line) => (
              <li key={line.axis} className={styles.row}>
                <span>{line.text}</span>
                <span className={styles.dots} aria-hidden="true">{DOTS[line.strength]}</span>
              </li>
            ))}
            <li className={styles.row}><span>분량</span><span>{lengthWord(choices[8])}</span></li>
          </ul>
        </>
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

`web/src/components/flow/FirstPage.module.css`:
```css
.page {
  position: absolute; inset: 0; overflow-y: auto;
  display: flex; flex-direction: column; gap: var(--space-2);
  padding: var(--space-3); background: var(--paper);
}
.title { margin: 0; font-size: 20px; }
.caption { margin: 0; font-size: 12px; color: var(--ink-muted); }
.rows { display: flex; flex-direction: column; gap: var(--space-1); margin: 0; padding: 0; list-style: none; }
.row { display: flex; justify-content: space-between; gap: var(--space-2); font-size: 13px; line-height: 1.5; word-break: keep-all; }
.row dt { color: var(--ink-muted); }
.row dd { margin: 0; text-align: right; }
.dots { letter-spacing: 1px; white-space: nowrap; }
/* C-14: a paper slip. */
.note {
  margin: var(--space-2) 0 0; padding: var(--space-2) var(--space-3);
  border-radius: var(--radius-card); background: var(--paper-deep);
  font-size: 12px; line-height: 1.5; word-break: keep-all;
}
```

- [ ] **Step 6: 책 장면(S-03·04·05)**

`web/src/components/flow/BookScene.tsx`:
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
import { FirstPage } from "./FirstPage";
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

/** S-03 · S-04 · S-05 share one book so the cover keeps its place between steps. Buttons sit below the book. */
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
    <div className={styles.scene}>
      <div className={styles.stage}>
        <Book open={state.opened} onPress={step === "book" ? onOpen : undefined} left={<RuledPage />} right={right} />
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
                <Bookmark card={pick.card} art={pick.art} moving={busy} />
              </motion.div>
            </AnimatePresence>
          </div>
        )}
      </div>

      {step === "book" && <p className={styles.hint}>눌러서 펼치기</p>}

      {step === "first" && (
        <div className={styles.actions}>
          {status === "error" && <p className={styles.error} role="alert">{DRAW_FAILED}</p>}
          {status === "error"
            ? <Button variant="secondary" onClick={onRetry}>다시 시도</Button>
            : !state.edited && <Button variant="secondary" onClick={onEdit}>{editLabel}</Button>}
          {noBooks
            ? <Button onClick={onHome}>처음으로</Button>
            : <Button onClick={onNext} disabled={status !== "ready"}>다음 장</Button>}
        </div>
      )}

      {step === "bookmarks" && pick && (
        <div className={styles.actions}>
          <Button variant="secondary" disabled={busy} onClick={() => react("pass")}>패스</Button>
          <Button disabled={busy} onClick={() => react("curious")}>궁금해요</Button>
          <p className={styles.count}>{`${state.index + 1} / ${picks.length}`}</p>
        </div>
      )}
    </div>
  );
}
```

`web/src/components/flow/BookScene.module.css`:
```css
/* The bookmark sticks out above the book by ~25% of its height (DESIGN 4절): 80px card + 26px string = 106px. */
.scene { display: flex; flex-direction: column; gap: var(--space-4); padding-top: 112px; }
.stage { position: relative; }
.slot {
  position: absolute; top: -106px; left: 50%; z-index: 3; width: 50%;
  display: flex; justify-content: center; pointer-events: none;
}
.hint { margin: 0; text-align: center; font-size: 13px; color: var(--ink-muted); }
.actions { display: flex; flex-wrap: wrap; justify-content: center; align-items: center; gap: var(--space-3); }
.actions > button { flex: 1 1 0; min-width: 120px; }
.count { flex-basis: 100%; margin: 0; text-align: center; font-size: 12px; color: var(--ink-muted); }
.error { flex-basis: 100%; margin: 0; text-align: center; font-size: 13px; }
```

- [ ] **Step 7: 끝 화면**

`web/src/components/flow/EndList.tsx`:
```tsx
import { Button } from "@/components/Button";
import { GenreTag } from "@/components/GenreTag";
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
              <li key={p.card.id} className={styles.item}>
                <GenreTag card={p.card} />
                <strong className={styles.bookTitle}>{p.card.title}</strong>
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

`web/src/components/flow/EndList.module.css`:
```css
.end { display: flex; flex-direction: column; gap: var(--space-5); padding-top: var(--space-6); }
.title { margin: 0; font-size: 20px; }
.list { display: flex; flex-direction: column; gap: var(--space-3); margin: 0; padding: 0; list-style: none; }
.item {
  display: flex; flex-direction: column; align-items: flex-start; gap: var(--space-1);
  padding: var(--space-4); border: 1px solid var(--paper-line); border-radius: var(--radius-card); background: var(--paper);
}
.bookTitle { font-family: var(--font-batang), serif; font-size: 15px; }
.line { font-size: 13px; color: var(--ink-soft); }
```

- [ ] **Step 8: 통과 확인**

Run: `npx vitest run src/components && npm run typecheck && npm run lint`
Expected: PASS (BookScene 8, EndList 2 포함), 타입·린트 오류 없음

- [ ] **Step 9: Commit**

```bash
git add web/src/lib/motion.ts web/src/components/Button.module.css web/src/components/flow/Book.* web/src/components/flow/FirstPage.* web/src/components/flow/BookScene.* web/src/components/flow/EndList.*
git commit -m "feat(flow): book, first page, rising bookmarks and the curious list"
```

---

### Task 10: 흐름 연결 — `Flow`·`FlowRoot`·`/`, 이벤트, 🎯·🍃 완주 E2E (휴대폰·노트북)

**Files:**
- Create: `web/src/lib/flow/api.ts`, `web/src/components/flow/Flow.tsx`, `web/src/components/flow/FlowRoot.tsx`, `web/e2e/helpers.ts`, `web/e2e/flow-target.spec.ts`, `web/e2e/flow-leaf.spec.ts`
- Modify: `web/src/app/page.tsx`, `docs/plans/2026-09-29-roadmap.md`, `docs/context.md`, `docs/tasks.md`, `docs/process.md`
- Test: `web/src/lib/flow/api.test.ts`, E2E 위 두 파일

**Interfaces:**
- Consumes: 앞 태스크 전부 — `flowReducer`, `FlowAction`, `FlowState`, `Reaction`, `loadFlow`, `saveFlow`, `coverageBucket`, `editedQuestions`, `editedTargetFields`, `targetAnswersFrom`, `TargetForm`, `matchGoal`, `artsForDraw`, `newArtSeed`, `DrawResponse`, `Vocab`, `Home`, `BalanceGame`, `TargetInput`, `BookScene`, `EndList`, `track`, `setEntry`, `MotionConfig` (`motion/react`), `TrackVisit`
- Produces:
  - `api.ts`: `drawBody(s: FlowState): Record<string, unknown>`, `requestDraw(body): Promise<DrawResponse>` (실패면 throw), `toDrawView(res: DrawResponse, artSeed: number): DrawView`
  - `<Flow />` — 이벤트 표의 E-02·05·06·07·08·20·21·22를 보내고, `drawId`가 바뀌는 동작마다 뽑기를 요청한다. 단계가 바뀌면 맨 위로 스크롤
  - `<FlowRoot />` — 서버 HTML은 S-01, 브라우저에서 저장된 흐름으로 이어짐(수화 불일치 없음)
  - E2E 도우미 `recordEvents(page)`, `named(events, name)`, `reactToBookmarks(page, reactions, total?)`

- [ ] **Step 1: 실패하는 테스트 — 요청 몸통·그림 붙이기**

`web/src/lib/flow/api.test.ts`:
```ts
// @vitest-environment node
import { afterEach, describe, expect, it, vi } from "vitest";
import type { DrawResponse } from "@/lib/books/types";
import { drawBody, requestDraw, toDrawView } from "./api";
import { INITIAL } from "./state";

const card = (id: string) => ({ id, entry: "leaf" as const, title: id, genre: "시", field: null, oneLiner: "?", oneLinerStyle: "question" as const });
const RES: DrawResponse = {
  picks: ["a", "b", "c", "d", "e"].map((id, i) => ({ card: card(id), kind: i === 0 ? "random" : "recommended" })),
  exhausted: false, widened: false, found: null, keywords: [],
};

describe("flow api", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("sends the answers and the books this session has shown (🍃)", () => {
    expect(drawBody({ ...INITIAL, entry: "leaf", choices: ["A", "B"], seen: ["x"] })).toEqual({ entry: "leaf", choices: ["A", "B"], seen: ["x"] });
  });

  it("sends scoring answers built from the form and the matched goal (🎯)", () => {
    const goal = { text: "SQL", topic: "데이터 분석" as const, keywords: ["SQL"], matched: true, method: "word" as const };
    expect(drawBody({ ...INITIAL, entry: "target", form: { topic: null, free: "SQL", len: "thin", way: "실습" }, goal }))
      .toEqual({ entry: "target", answers: { topic: "데이터 분석", way: "실습", len: 1, keywords: ["SQL"] }, seen: [] });
  });

  it("gives every pick its own animal and keeps the order", () => {
    const view = toDrawView(RES, 9);
    expect(view.picks.map((p) => p.card.id)).toEqual(["a", "b", "c", "d", "e"]);
    expect(view.picks.map((p) => p.kind)).toEqual(["random", "recommended", "recommended", "recommended", "recommended"]);
    expect(new Set(view.picks.map((p) => p.art.animal)).size).toBe(5);
  });

  it("posts JSON to /api/books/draw", async () => {
    const fetchMock = vi.fn().mockResolvedValue(Response.json(RES));
    vi.stubGlobal("fetch", fetchMock);
    expect(await requestDraw({ entry: "leaf" })).toEqual(RES);
    expect(fetchMock).toHaveBeenCalledWith("/api/books/draw", expect.objectContaining({ method: "POST", body: "{\"entry\":\"leaf\"}" }));
  });

  it("throws on a failed request so the page can offer a retry", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("{}", { status: 400 })));
    await expect(requestDraw({})).rejects.toThrow(/400/);
  });
});
```

Run: `cd web && npx vitest run src/lib/flow/api.test.ts`
Expected: FAIL — `Failed to resolve import "./api"`

- [ ] **Step 2: 요청 도우미**

`web/src/lib/flow/api.ts`:
```ts
import { artsForDraw } from "@/lib/art/combine";
import type { DrawResponse } from "@/lib/books/types";
import type { DrawView, FlowState } from "./state";
import { targetAnswersFrom } from "./target";

/** Body for POST /api/books/draw (checked strictly on the server). */
export function drawBody(s: FlowState): Record<string, unknown> {
  if (s.entry === "leaf") return { entry: "leaf", choices: s.choices, seen: s.seen };
  return { entry: "target", answers: targetAnswersFrom(s.form, s.goal), seen: s.seen };
}

export async function requestDraw(body: Record<string, unknown>): Promise<DrawResponse> {
  const res = await fetch("/api/books/draw", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`draw failed: ${res.status}`);
  return (await res.json()) as DrawResponse;
}

/** Pictures are drawn in the browser, once per draw (PRD F-08: random each time; P5 saves the combo). */
export function toDrawView(res: DrawResponse, artSeed: number): DrawView {
  const arts = artsForDraw(res.picks.length, artSeed);
  return {
    picks: res.picks.map((p, i) => ({ card: p.card, kind: p.kind, art: arts[i] })),
    exhausted: res.exhausted,
    found: res.found,
    keywords: res.keywords,
  };
}
```

Run: `npx vitest run src/lib/flow/api.test.ts`
Expected: PASS (5 tests)

- [ ] **Step 3: E2E 먼저 — 도우미와 🎯·🍃 완주 (실패 확인)**

`web/e2e/helpers.ts`:
```ts
import { expect, type Page } from "@playwright/test";

export interface Sent { name: string; props: Record<string, unknown>; common: Record<string, unknown> }

/** Records every track() call and the server's answer (TRACK_STORE=off: accepted, never stored). */
export async function recordEvents(page: Page): Promise<{ events: Sent[]; statuses: number[] }> {
  const events: Sent[] = [];
  const statuses: number[] = [];
  // Chromium only exposes sendBeacon bodies to Playwright when the request is routed.
  await page.route("**/api/track", async (route) => {
    events.push(JSON.parse(route.request().postData() ?? "{}") as Sent);
    try {
      const res = await route.fetch();
      statuses.push(res.status());
      await route.fulfill({ response: res });
    } catch {
      // the test ended while this event was still in flight — callers wait for statuses before asserting them
    }
  });
  return { events, statuses };
}

export const named = (events: Sent[], name: string) => events.filter((e) => e.name === name);

/** Reacts to bookmarks in order; each click waits until the bookmark has finished rising (buttons re-enable). */
export async function reactToBookmarks(page: Page, reactions: readonly ("궁금해요" | "패스")[], total = reactions.length) {
  for (let i = 0; i < reactions.length; i++) {
    await expect(page.getByText(`${i + 1} / ${total}`)).toBeVisible();
    await page.getByRole("button", { name: reactions[i], exact: true }).click();
  }
}
```

`web/e2e/flow-target.spec.ts`:
```ts
import { expect, test } from "@playwright/test";
import { named, reactToBookmarks, recordEvents } from "./helpers";

// Motion and CSS shorten to fades under reduced motion — same flow, faster run. Books: BOOKS_SOURCE=sample.
test.use({ reducedMotion: "reduce" });

test("🎯 chips → book → first page → five bookmarks → curious list", async ({ page }, testInfo) => {
  const { events, statuses } = await recordEvents(page);
  await page.goto("/");
  await page.getByRole("button", { name: /알고 싶은 게 있어요/ }).click();
  await page.getByRole("button", { name: "데이터 분석", exact: true }).click();
  await page.getByRole("button", { name: "얇게", exact: true }).click();
  await page.getByRole("button", { name: "따라 하며 실습 (바로 써먹기)" }).click();
  await page.getByRole("button", { name: "책 펼치기" }).click();          // S-02 submit

  await expect(page.getByText("눌러서 펼치기")).toBeVisible();
  await page.getByRole("button", { name: "책 펼치기" }).click();          // S-03: the closed book
  await expect(page.getByRole("heading", { name: "당신이 찾는 책" })).toBeVisible();
  await expect(page.getByText("조건에 딱 맞는 책은 여기까지예요")).toBeVisible();  // sample: 데이터 분석 has 5 books
  await page.getByRole("button", { name: "다음 장" }).click();

  await expect(page.getByText("1 / 5")).toBeVisible();
  if (testInfo.project.name === "laptop") {
    const column = await page.locator(".column").boundingBox();
    const bookmark = await page.getByRole("article").boundingBox();
    if (!column || !bookmark) throw new Error("layout boxes missing");
    expect(column.width).toBe(430);
    expect(bookmark.x).toBeGreaterThanOrEqual(column.x);
    expect(bookmark.x + bookmark.width).toBeLessThanOrEqual(column.x + column.width);
  }
  await reactToBookmarks(page, ["궁금해요", "패스", "궁금해요", "패스", "궁금해요"]);

  await expect(page.getByRole("heading", { name: "궁금해요 책" })).toBeVisible();
  await expect(page.getByRole("listitem")).toHaveCount(3);
  await page.getByRole("button", { name: "처음으로" }).click();
  await expect(page.getByRole("button", { name: /그냥 한 권 만나고 싶어요/ })).toBeVisible();

  await expect.poll(() => named(events, "home_clicked").length).toBe(1);
  expect(named(events, "visit")).toHaveLength(1);
  expect(named(events, "entry_selected").map((e) => e.props)).toEqual([{ entry: "target" }]);
  expect(named(events, "chip_selected").map((e) => [e.props.question, e.props.value])).toEqual([["topic", "데이터 분석"], ["len", "thin"], ["way", "실습"]]);
  expect(named(events, "book_opened")).toHaveLength(1);
  const shown = named(events, "bookmark_shown");
  expect(shown).toHaveLength(5);
  expect(new Set(shown.map((e) => e.props.book_id)).size).toBe(5);
  expect(shown.filter((e) => e.props.kind === "random")).toHaveLength(1);
  expect(shown.every((e) => e.common.entry === "target" && e.common.round === 1 && e.props.one_liner_style === "summary")).toBe(true);
  expect(shown.map((e) => e.props.index)).toEqual([1, 2, 3, 4, 5]);
  expect(named(events, "bookmark_reacted").map((e) => e.props.reaction)).toEqual(["curious", "pass", "curious", "pass", "curious"]);
  expect(named(events, "home_clicked")[0]).toMatchObject({ props: { curious: 3 }, common: { entry: "target" } });
  await expect.poll(() => statuses.length).toBe(events.length);
  expect(statuses.every((s) => s === 202)).toBe(true);
});

test("🎯 written goal → honest count → one edit → five bookmarks", async ({ page }) => {
  const { events } = await recordEvents(page);
  await page.goto("/");
  await page.getByRole("button", { name: /알고 싶은 게 있어요/ }).click();
  await page.getByRole("button", { name: "책 펼치기" }).click();          // nothing chosen yet
  // getByText, not getByRole("alert"): Next adds its own empty role="alert" route announcer.
  await expect(page.getByText("보기 하나를 고르거나 직접 써 주세요")).toBeVisible();
  await page.getByRole("button", { name: "직접 쓰기" }).click();
  await page.getByRole("textbox", { name: "직접 쓰기" }).fill("SQL 공부");
  await page.getByRole("button", { name: "책 펼치기" }).click();
  await page.getByRole("button", { name: "책 펼치기" }).click();          // open the book

  const notice = "SQL 책은 아직 2권이에요. 나머지는 가까운 '데이터 분석' 책이에요";
  await expect(page.getByText(notice)).toBeVisible();
  await expect(page.getByText("조건에 딱 맞는 책은 여기까지예요")).toHaveCount(0);

  await page.getByRole("button", { name: "한 번 고치기" }).click();
  await expect(page.getByRole("textbox", { name: "직접 쓰기" })).toHaveValue("SQL 공부");
  await page.getByRole("button", { name: "얇게", exact: true }).click();
  await page.getByRole("button", { name: "책 펼치기" }).click();          // straight back to the open book
  await expect(page.getByText(notice)).toBeVisible();
  await expect(page.getByRole("button", { name: "한 번 고치기" })).toHaveCount(0);
  await page.getByRole("button", { name: "다음 장" }).click();
  await reactToBookmarks(page, ["패스", "패스", "패스", "패스", "패스"]);
  await expect(page.getByRole("heading", { name: "궁금해요 책" })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "처음으로" })).toBeVisible();

  await expect.poll(() => named(events, "bookmark_reacted").length).toBe(5);
  expect(named(events, "goal_free_written").map((e) => e.props)).toEqual([
    { text: "SQL 공부", topic: "데이터 분석", keywords: ["SQL"], matched: true, method: "word" },
    { text: "SQL 공부", topic: "데이터 분석", keywords: ["SQL"], matched: true, method: "word" },
  ]);
  expect(named(events, "goal_coverage")[0].props).toEqual({ bucket: "1-3", found: 2 });
  expect(named(events, "first_page_edited").map((e) => e.props)).toEqual([{ entry: "target", items: ["len"] }]);
  expect(named(events, "chip_selected").map((e) => [e.props.value, e.props.edit])).toEqual([["direct", false], ["thin", true]]);
});
```

`web/e2e/flow-leaf.spec.ts`:
```ts
import { expect, test, type Page } from "@playwright/test";
import { named, reactToBookmarks, recordEvents } from "./helpers";

test.use({ reducedMotion: "reduce" });

/** Keyboard hold (Enter) — same timer as touch; deterministic on both projects. */
async function holdUnsure(page: Page, ms: number) {
  await page.getByRole("button", { name: "갈피를 못 잡겠어요" }).focus();
  await page.keyboard.down("Enter");
  await page.waitForTimeout(ms);
  await page.keyboard.up("Enter");
}

/** Taps the left card from question `from` to 9, waiting for each question to appear. */
async function answerLeft(page: Page, from: number) {
  for (let q = from; q <= 9; q++) {
    await expect(page.getByText(`${q} / 9`)).toBeVisible();
    await page.locator('[data-side="left"]').click();
  }
}

test("🍃 nine answers (one held 못 잡겠어요) → book → five bookmarks", async ({ page }) => {
  const { events, statuses } = await recordEvents(page);
  await page.goto("/");
  await page.getByRole("button", { name: /그냥 한 권 만나고 싶어요/ }).click();
  await expect(page.getByRole("heading", { name: "책을 덮은 뒤, 남았으면 하는 건?" })).toBeVisible();
  await holdUnsure(page, 300);                                           // let go early: still question 1
  await expect(page.getByText("1 / 9")).toBeVisible();
  await holdUnsure(page, 1000);                                          // the 0.8s timer passes
  await answerLeft(page, 2);                                             // Q2–4 A, Q5–8 B (A sits right), Q9 A

  await page.getByRole("button", { name: "책 펼치기" }).click();
  await expect(page.getByText("당신의 책 취향")).toBeVisible();
  await expect(page.getByText("여운", { exact: true })).toBeVisible();   // temp: 못 잡겠어요 + B
  await expect(page.getByText("문장 · 몰입 둘 다 좋아요")).toBeVisible();
  await page.getByRole("button", { name: "다음 장" }).click();
  await reactToBookmarks(page, ["궁금해요", "패스", "패스", "궁금해요", "패스"]);
  await expect(page.getByRole("listitem")).toHaveCount(2);

  await expect.poll(() => named(events, "bookmark_reacted").length).toBe(5);
  const answers = named(events, "balance_answered");
  expect(answers).toHaveLength(9);
  expect(answers[0].props).toMatchObject({ question: 1, choice: "unsure", side: null, edit: false });
  expect(answers[4].props).toMatchObject({ question: 5, choice: "B", side: "left" });
  expect(answers.every((e) => typeof e.props.ms === "number")).toBe(true);
  const cancelled = named(events, "unsure_hold_cancelled");
  expect(cancelled).toHaveLength(1);
  expect(cancelled[0].props.question).toBe(1);
  expect(cancelled[0].props.held_ms as number).toBeGreaterThan(200);
  const shown = named(events, "bookmark_shown");
  expect(shown).toHaveLength(5);
  expect(shown.every((e) => e.common.entry === "leaf" && e.props.one_liner_style === "question")).toBe(true);
  expect(shown.every((e) => typeof (e.props.art as { animal?: string }).animal === "string")).toBe(true);
  await expect.poll(() => statuses.length).toBe(events.length);
  expect(statuses.every((s) => s === 202)).toBe(true);
});

test("🍃 a reload keeps the page and the entry/round of later events", async ({ page }) => {
  const { events } = await recordEvents(page);
  await page.goto("/");
  await page.getByRole("button", { name: /그냥 한 권 만나고 싶어요/ }).click();
  await answerLeft(page, 1);
  await page.getByRole("button", { name: "책 펼치기" }).click();
  await page.getByRole("button", { name: "다음 장" }).click();
  await reactToBookmarks(page, ["궁금해요"], 5);
  await expect(page.getByText("2 / 5")).toBeVisible();
  await expect(page.getByRole("button", { name: "궁금해요" })).toBeEnabled();
  const label = await page.getByRole("article").getAttribute("aria-label");

  await page.reload();
  await expect(page.getByText("2 / 5")).toBeVisible();
  await expect(page.getByRole("article")).toHaveAttribute("aria-label", label ?? "");
  await expect.poll(() => named(events, "visit").length).toBe(2);
  expect(named(events, "visit")[1].common).toMatchObject({ entry: "leaf", round: 1 });
  expect(named(events, "bookmark_shown")).toHaveLength(2);              // a reload is not a new showing
});
```

Run: `npm run e2e -- e2e/flow-target.spec.ts e2e/flow-leaf.spec.ts`
Expected: FAIL — `/`가 아직 P0 자리 화면이라 "알고 싶은 게 있어요" 버튼이 없다

- [ ] **Step 4: 흐름 연결**

`web/src/components/flow/Flow.tsx`:
```tsx
"use client";
import { useEffect, useReducer } from "react";
import { MotionConfig } from "motion/react";
import vocab from "@/data/vocab.json";
import type { BalanceChoice, Entry } from "@/lib/recommend";
import { newArtSeed } from "@/lib/art/combine";
import type { Vocab } from "@/lib/books/types";
import { drawBody, requestDraw, toDrawView } from "@/lib/flow/api";
import { flowReducer, type FlowAction, type FlowState, type Reaction } from "@/lib/flow/state";
import { loadFlow, saveFlow } from "@/lib/flow/storage";
import { coverageBucket, editedQuestions, editedTargetFields } from "@/lib/flow/summary";
import type { TargetForm } from "@/lib/flow/target";
import { matchGoal } from "@/lib/goal/match";
import { setEntry } from "@/lib/track/common";
import { track } from "@/lib/track/client";
import { BalanceGame } from "./BalanceGame";
import { BookScene } from "./BookScene";
import { EndList } from "./EndList";
import { Home } from "./Home";
import { TargetInput } from "./TargetInput";

const VOCAB = vocab as Vocab;

/** S-01 → S-05 + the curious list. Cross-screen events are sent here, in the handlers (never from effects). */
export function Flow() {
  const [state, dispatch] = useReducer(flowReducer, undefined, loadFlow);

  useEffect(() => { saveFlow(state); }, [state]);
  useEffect(() => { window.scrollTo(0, 0); }, [state.step]);

  const runDraw = async (s: FlowState) => {
    try {
      const res = await requestDraw(drawBody(s));
      if (s.entry === "target" && s.goal) {
        const found = s.goal.matched ? (res.found ?? 0) : 0;
        track("goal_coverage", { bucket: coverageBucket(found), found });
      }
      dispatch({ type: "drawn", id: s.drawId, draw: toDrawView(res, newArtSeed()) });
    } catch {
      dispatch({ type: "drawFailed", id: s.drawId });
    }
  };

  /** Apply an action; start a draw whenever the action asked for one. */
  const act = (action: FlowAction): FlowState => {
    const next = flowReducer(state, action);
    dispatch(action);
    if (next.drawId !== state.drawId) void runDraw(next);
    return next;
  };

  const trackShown = (s: FlowState) => {
    const pick = s.draw?.picks[s.index];
    if (!pick) return;
    track("bookmark_shown", {
      book_id: pick.card.id, index: s.index + 1, one_liner_style: pick.card.oneLinerStyle, kind: pick.kind, art: pick.art,
    });
  };

  const start = (entry: Entry) => {
    setEntry(entry);
    track("entry_selected", { entry });
    act({ type: "start", entry });
  };

  const answer = (choice: BalanceChoice) => {
    const next = act({ type: "answer", choice });
    if (next.drawId !== state.drawId && state.prevChoices) {
      track("first_page_edited", { entry: "leaf", items: editedQuestions(state.prevChoices, next.choices) });
    }
  };

  const submitTarget = (form: TargetForm) => {
    const goal = form.free !== null ? matchGoal(form.free, VOCAB) : null;
    if (goal) {
      track("goal_free_written", { text: goal.text, topic: goal.topic, keywords: goal.keywords, matched: goal.matched, method: goal.method });
    }
    if (state.prevForm) track("first_page_edited", { entry: "target", items: editedTargetFields(state.prevForm, form) });
    act({ type: "submitTarget", form, goal });
  };

  const open = () => {
    track("book_opened");
    act({ type: "open" });
  };

  const nextPage = () => {
    const next = act({ type: "next" });
    if (next.step === "bookmarks") trackShown(next);
  };

  const react = (reaction: Reaction) => {
    const pick = state.draw?.picks[state.index];
    if (state.step !== "bookmarks" || !pick) return;
    track("bookmark_reacted", { book_id: pick.card.id, index: state.index + 1, reaction, kind: pick.kind });
    const next = act({ type: "react", reaction });
    if (next.step === "bookmarks") trackShown(next);
  };

  const home = () => {
    track("home_clicked", { curious: state.reactions.filter((r) => r === "curious").length });
    setEntry(null);
    act({ type: "home" });
  };

  const inBook = state.step === "book" || state.step === "first" || state.step === "bookmarks";

  return (
    <MotionConfig reducedMotion="user">
      {state.step === "home" && <Home onStart={start} />}
      {state.step === "leaf" && <BalanceGame choices={state.choices} edit={state.edited} onAnswer={answer} />}
      {state.step === "target" && <TargetInput initial={state.form} edit={state.edited} onSubmit={submitTarget} />}
      {inBook && (
        <BookScene
          state={state}
          onOpen={open}
          onEdit={() => act({ type: "edit" })}
          onNext={nextPage}
          onRetry={() => act({ type: "retry" })}
          onReact={react}
          onHome={home}
        />
      )}
      {state.step === "end" && <EndList picks={state.draw?.picks ?? []} reactions={state.reactions} onHome={home} />}
    </MotionConfig>
  );
}
```

`web/src/components/flow/FlowRoot.tsx`:
```tsx
"use client";
import { useSyncExternalStore } from "react";
import { Flow } from "./Flow";
import { Home } from "./Home";

const subscribe = () => () => {};
const noop = () => {};

/** Server HTML (and the hydration pass) is S-01; the browser then resumes the saved flow without a mismatch. */
export function FlowRoot() {
  const inBrowser = useSyncExternalStore(subscribe, () => true, () => false);
  return inBrowser ? <Flow /> : <Home onStart={noop} />;
}
```

`web/src/app/page.tsx` 전체를 다음으로 바꾼다:
```tsx
import { TrackVisit } from "@/components/TrackVisit";
import { FlowRoot } from "@/components/flow/FlowRoot";

export default function Page() {
  return (
    <>
      <TrackVisit />
      <FlowRoot />
    </>
  );
}
```

Run: `npm run typecheck && npm run lint && npx vitest run`
Expected: 오류 없음, 전부 PASS

- [ ] **Step 5: 전체 E2E 통과 확인**

Run: `npm run e2e`
Expected: 전부 PASS — `smoke`, `design`(5), `visit`, `flow-target`(2), `flow-leaf`(2) × phone·laptop = 22개. `visit.spec`의 "정확히 한 번"도 그대로 통과해야 한다(S-01은 visit 말고 아무것도 보내지 않는다).

실패하면 `npx playwright show-report`로 스크린샷·트레이스를 보고 원인을 고친다(대기 시간을 늘리거나 단언을 약하게 하지 않는다).

- [ ] **Step 6: 휴대폰 움직임 확인 (PHASES "끊기지 않는다")**

Run: `npm run build && npm run start -- -p 3218` (다른 터미널) → Chrome DevTools: Pixel 7 기기 모드 + Performance 패널 CPU 4× 느리게 → `http://localhost:3218`에서 🍃 한 바퀴(책 펼치기, 책갈피 5장)를 기록한다.
Expected: 표지 열기·책갈피 오르내림 동안 긴 프레임(50ms 넘는 것)이 거의 없고, 책갈피가 움직이는 동안 흐림(backdrop-filter)이 꺼졌다가 멈추면 켜진다(요소 검사에서 `data-moving` 확인). 기록 스크린샷을 `docs/process.md` P3 절에 남긴다. 확인이 끝나면 서버를 끈다.

- [ ] **Step 7: 문서**

`docs/plans/2026-09-29-roadmap.md` 2절 폴더 구조의 한 줄을 바꾼다:
```
      api/books/draw/route.ts          뽑기 (P3 — 앱 안 JSON에서, P4에 DB로)
```

`docs/context.md` 의사결정 기록 표 마지막 줄(09-29 "갈피의 용도 확정") 아래에 추가하고, 맨 위 `Last Updated`를 `2026-09-30 — P3 흐름 화면 구현`으로 바꾼다:
```
| 09-30 | P3 책 데이터 = 앱 안 정적 JSON(`web/src/data/books.json`, `npm run books:import`로 `books_v1.json` → 없으면 `books_v1_draft.json`에서 복사·검사). **제목**은 `d1_selected.csv`에서 붙임(이미 git에 있는 서지 정보, YES24 소개·가격·표지 아님). 테스트·E2E는 가짜 30권(`BOOKS_SOURCE=sample`) | 배포가 가까워 DB 적재(P4)를 기다리지 않음. 책갈피에 제목이 필요한데 로드맵 3-3 열에는 제목이 없음 |
| 09-30 | 뽑기 라우트 `/api/books/draw`를 P3로 당김. 🎯 요청 키워드 중 그 주제 책에 없는 것은 점수 전에 뺌, 커버리지 안내가 뜨는 회차에는 "여기까지예요"를 함께 띄우지 않음 | 흐름 화면이 실제 뽑기로 돌아야 5명 반응을 볼 수 있음. 없는 키워드가 최고 가능 점수를 부풀려 늘 "바닥"으로 보이던 문제(P1 최종 리뷰) |
| 09-30 | 🎯 직접 쓰기(P3) = 단어 매칭만: ① v1.1 키워드 패턴 ② 주제·칩 이름·접힌 말 ③ 없으면 글자 쌍이 가장 겹치는 주제 + "아직 이 주제 책이 없어요…" + [다시 쓰기] | LLM 분류는 P4. 목록 밖 말을 만들지 않고, 못 찾았음을 솔직하게 |
| 09-30 | 새 문구 2개: "보기 하나를 고르거나 직접 써 주세요"(무엇을 비었을 때), "책을 불러오지 못했어요" + [다시 시도](뽑기 실패). 🍃 한 축이 "한쪽 + 못 잡겠어요"면 그쪽 이름만(●○) | 문서에 문구가 없던 자리. 밸런스 표시는 문서의 두 경우(같음·갈림) 사이를 채움 |
| 09-30 | 이름표 글씨 11 → **12px**, 첫인상 한 줄은 반투명 위라 **ink**(T-01의 ink-soft 대신) | DESIGN 안의 두 규칙이 부딪힘 — "12px 미만 금지", "반투명 위 글자는 ink만"을 따름 |
| 09-30 | 흐름 상태를 sessionStorage에 저장 — 새로고침해도 같은 장, 공통 속성 entry·round도 유지. 🎯 E-20(처음으로)·E-22(찾은 책 구간)도 P3에서 심음 | 카톡 안 브라우저는 탭을 자주 다시 불러옴. 원칙 3(이벤트는 화면과 함께) |
```

`docs/tasks.md` 🛠 개발의 P3 줄을 다음으로 바꾼다:
```
- [x] P3 흐름 화면 — S-01~05 + 궁금해요 목록, `/api/books/draw`, 이벤트 E-01·02·03·05·06·07·08·20·21·22·24·25, 🎯·🍃 완주 E2E(휴대폰·노트북) (`docs/plans/2026-09-30-p3-flow-screens.md`)
```

`docs/process.md` 맨 아래에 추가:
```
### P3. 흐름 화면 (09-30, `docs/plans/2026-09-30-p3-flow-screens.md`)
- S-01 처음 → S-02 🍃 밸런스 9문항(0.8초 타이머 꾹 누르기) / 🎯 한 화면 입력(직접 쓰기 단어 매칭) → S-03 책 펼치기(CSS 3D) → S-04 첫 장(한 번 고치기, 솔직한 안내) → S-05 책갈피(동물 × 배경 × 소품, 반투명·아치 창·제비꼬리) → 궁금해요 목록
- 뽑기는 서버 `/api/books/draw` + 앱 안 JSON(D3 초안 200권), 새로고침해도 같은 장
- 검증: Vitest 전부 통과, E2E 🎯 2 · 🍃 2 × 휴대폰·노트북 통과, 휴대폰 4× 느리게 움직임 기록(스크린샷)
- 다음: 5명 반응 보기 가능(PHASES P3 완료 기준) → P4
```

- [ ] **Step 8: 전체 검증**

Run:
```bash
cd web
npm run typecheck && npm run lint && npm run test:cov && npm run build && npm run e2e
cd .. && git grep -nE "AQ\.[A-Za-z0-9_-]{10,}|KakaoAK [0-9a-f]{20,}|sk-ant-" -- web ':!*.md' || echo "no secrets"
```
Expected: 모두 통과, `src/lib/recommend` 커버리지 100% 유지, `no secrets`

- [ ] **Step 9: Commit**

```bash
git add web/src/lib/flow/api.ts web/src/lib/flow/api.test.ts web/src/components/flow/Flow.tsx web/src/components/flow/FlowRoot.tsx web/src/app/page.tsx web/e2e docs/plans/2026-09-29-roadmap.md docs/context.md docs/tasks.md docs/process.md
git commit -m "feat(flow): wire S-01 to S-05 with events and phone/laptop e2e runs"
```

---

## P3 완료 기준 확인 (`docs/PHASES.md`)

- [ ] 휴대폰 크기 E2E로 🎯·🍃 각각 처음 → 5장 완주 — `flow-target.spec.ts`, `flow-leaf.spec.ts` (project `phone`)
- [ ] 노트북 크기(1440px)에서 가운데 기둥(최대 430px)으로 같은 흐름 완주 — 같은 스펙 (project `laptop`, 책갈피가 기둥 안에 있는지 단언)
- [ ] 표의 이벤트가 모두 쌓인다 — E-01(`visit`)·E-02·E-03·E-05·E-06·E-07·E-08·E-21·E-24·E-25 (+ E-20·E-22) 모두 E2E 단언으로 확인, 서버가 전부 202
- [ ] 움직임이 휴대폰에서 끊기지 않는다 — Task 10 Step 6 기록
- [ ] 5명 반응 보기 가능 — `npm run build && npm run start` 로컬 또는 P7 배포 뒤. 배포는 **사용자 확인 후**
- [ ] `docs/process.md` 기록, `docs/tasks.md` 체크, `feat/p3-flow-screens` → `main` 병합

## 이 계획이 스펙과 다르게 정한 것 (검토용)

| 스펙 | 이 계획 | 이유 |
|---|---|---|
| 로드맵 2절: `api/books/draw` = P4 | P3에서 만듦 (앱 안 JSON) | 컨트롤러 결정 — 흐름이 실제 뽑기로 돌아야 함 |
| 로드맵 3-3 `books` 열에 제목 없음 | `books.json`에 `title` 추가 (`d1_selected.csv`) | 책갈피에 제목이 필요(F-08). YES24 소개·가격·표지는 여전히 저장 안 함 |
| DESIGN T-04 이름표 11px | 12px | 같은 문서의 "12px 미만 금지" |
| DESIGN T-01 첫인상 한 줄 = ink-soft | 책갈피 위는 ink (끝 목록의 종이 위는 ink-soft) | 같은 문서 7절 "반투명 위 글자는 ink만" |
| target-chips 3절 0권: "가장 가까운 주제" | 단어 매칭으로 못 찾으면 글자 쌍 겹침으로 고른 주제 | LLM(P4) 전까지의 최선. 문구는 그대로 |
| book-pool ⑧ 바닥 알림 + [조건 하나 풀기] [같은 분야 다른 주제] | 문구만. 버튼은 없음 — [한 번 고치기]가 조건 풀기를 대신 | 두 버튼은 다시 뽑기(P4 S-08)와 함께 설계 |
| balance-game: 같음 → "확실히", 갈림 → "둘 다" | 한쪽 + 못 잡겠어요 → 그쪽 이름만(●○), 둘 다 못 잡겠어요 → "둘 다 좋아요"(○○) | 문서가 두 경우만 정의 |
| PHASES P3 이벤트 목록 | E-20·E-22 추가 | 그 화면이 P3에 생김(원칙 3) |
| target-chips 1절 "예스24 검색 링크" | 예스24 첫 화면 링크(검색창 있음) | 검색 URL에 사용자가 쓴 말을 넣지 않기 위해 |
| stitch P-03 "지금 수준"·"상황 한 줄" 칸 | 만들지 않음 | PRD F-02·F-04에서 삭제됨 |
