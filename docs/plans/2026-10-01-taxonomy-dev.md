# 택소노미 개발 라운드 (taxonomy v0.3) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** `docs/taxonomy.md` v0.2의 4-4 마이그레이션 명세를 **한 번의 개발 라운드로** 코드에 반영한다 — 이벤트·속성 이름과 값, 중복 `entry` 삭제, 새 속성(E-08 `one_liner_style`, E-20 `source`), 새 이벤트 E-26 `goal_submitted`, `round` +1 규칙(3-1a), `goal_text`는 Supabase에만(6-2·6-3, `/privacy` 두 문장), 코드 명세 `EVENT_SPEC`로 `track()` 호출·`/api/track`을 검사, 문서 ↔ csv ↔ 코드 자동 검사(7-3), Amplitude 대기열 보완(2-7 a·b). 화면·문구·흐름은 그대로(바뀌는 문구는 `/privacy` 두 문장뿐).

**Architecture:** `web/src/lib/track/schema.ts`에 **`EVENT_SPEC` 하나**(25개 이벤트 × 속성마다 `type`·`array`·`nullable`·`only`·`max`)를 두고 세 곳이 그것만 본다 — ① `PropsOf<N>` 매핑 타입으로 `track<N>(name, props)`의 호출 15곳을 `tsc`가 검사 ② `props.ts`의 `parseProps`로 `/api/track`이 명세 밖 속성을 버림(이벤트는 저장, 버린 키 이름만 서버 로그) ③ 같은 파일의 `forAmplitude`가 `only: "supabase"` 속성(`goal_text`)을 Amplitude 사본에서 뺌. `round`는 화면이 아니라 `track()`이 `ROUND_ENDING_EVENTS`(E-19·E-20)를 두 곳에 보낸 **직후** `nextRound()`. 동기화 검사는 Vitest `taxonomy.test.ts`(csv-parse로 `docs/taxonomy.csv`를 읽어 명명 규칙·csv ↔ `EVENT_SPEC` ↔ md 제목 ↔ 앱 소스의 `track("…"` 호출 대조)와 E2E `specMismatches`(보낸 이벤트마다 props·common 키 = 명세).

**Tech Stack:** Next.js 16.3.6 (App Router) · React 19.2.8 · TypeScript 5 · Vitest 5.0.2 + Testing Library · Playwright 1.63 (phone = Pixel 7, laptop = 1440 × 900, 포트 3217) · `@amplitude/unified` 1.1.38 (`track(name, props, { time })` — `EventOptions.time`는 설치된 `analytics-core` 타입에서 확인) · **새 devDependency `csv-parse` ^7.0.3** (`csv-parse/sync`, taxonomy 7-3 ② 지정)

**Spec:** `docs/taxonomy.md` v0.2 — 2절(명명·허용 동사·2-7 속성 단위 예외와 Amplitude 경로 a·b·2-8 상태) · 3절(공통 속성, **3-1a `round` 규칙**) · 4절(4-1·4-2 이벤트별 상세, **4-4 마이그레이션 표**) · 6절(6-2, **6-3 `/privacy` 문장**) · 7절(7-1 순서, 7-2 CLAUDE.md 규칙·커밋 체크리스트, **7-3 자동 검사**) · 9절(결정 Q1~Q5) — 와 `docs/taxonomy.csv`(13열, UTF-8 BOM). 함께 읽기: `docs/PRD.md` 4절, `Galpi/CLAUDE.md`, `docs/plans/2026-09-30-amplitude.md`, `docs/process.md` 마지막 절(재개 지점)

**계획 속 코드 검증 (10-01):** 임시 폴더(`…/scratchpad/taxonomy-dev/`)에 `web/`(node_modules·.next·`.env.local` 제외)과 `docs/`·`CLAUDE.md`를 같은 상대 위치로 복사하고 **자체 `npm ci`**(junction 없음), 이 계획의 코드를 태스크 순서대로 넣으며 확인했다. 최종 상태:
- 시작: Vitest **50파일 397개**, Playwright **72개**(목록 기준, 그중 8개는 한 프로젝트 전용이라 다른 프로젝트에서 skip), `tsc`·`eslint` 0
- 태스크별 Vitest: Task 1 → 50파일 402개 · Task 2 → 50파일 405개 · Task 3 → 51파일 426개 · Task 4 → 52파일 432개 · Task 5 → 52파일 434개 · Task 6 → 53파일 493개 · Task 7 → 53파일 493개
- 최종: `tsc`·`eslint` 오류·경고 0 · `test:cov` **53파일 493개 통과**, 종료 코드 0(`src/lib/recommend` 100% 문턱 유지, 새 `props.ts`·`schema.ts` 100%) · `next build` 통과(경로 목록 그대로) · Playwright **74개**(새 `spec-check` 1 × 2프로젝트) → **66 통과 · 8 skip**(skip은 시작과 같은 데스크톱/휴대폰 전용 검사)
- 검증 중 고친 것: ① csv Note 문구에 쉼표를 넣자 따옴표 없는 칸이 14열이 됨 → taxonomy 테스트 #1(csv-parse의 열 수 검사)이 바로 잡음, 새 Note 문구는 쉼표·따옴표 금지(스크립트가 검사) ② `amplitude.test.ts`의 "키 없이 보낸 이벤트는 대기열에 남지 않는다" 테스트를 앞쪽 describe에 두자 SDK 목(mock)이 먼저 불려 기존 "한가할 때까지 SDK를 안 부른다" 테스트가 깨짐 → `sendToAmplitude` describe 안으로 ③ `PropsOf`가 속성 없는 이벤트에 `{}`를 주면 TS가 초과 속성을 검사하지 않아 `track("entry_selected", { entry })`가 통과함 → 빈 명세는 `Record<string, never>` ④ `isEventName("constructor")`가 참이 되지 않게 own key 검사 ⑤ 첫 장(S-04)이 직접 쓴 글을 보여 Session Replay가 화면 글자로 담을 수 있음(6-2 확인 항목) → `data-amp-mask`
- 계획 재현 검사: 시작 커밋(`0202ca8`과 같은 트리)에 이 계획의 diff·파일·스크립트를 **적힌 순서대로** 적용한 결과가 위에서 검증한 트리와 같다(`npm install`이 만드는 `package.json`·`package-lock.json` 줄만 제외) — 블록이 빠지거나 순서가 어긋나지 않았다
- 주의(계획을 옮겨 적는 사람에게): 이 계획의 코드 블록은 저장소 파일에서 그대로 뽑았다. `route.test.ts`의 `"\u0000"`·`"\ufffd"` 같은 **이스케이프 글자는 글자 그대로**(백슬래시 + u) 옮긴다 — 실제 문자로 바꾸면 테스트 뜻이 달라진다

## Global Constraints

- 브랜치 **`feat/amplitude`** (Galpi 저장소에 이미 체크아웃 — 바꾸지 않는다). 시작 전 `git status --short`가 비어 있어야 한다. 구현 전에 `web/AGENTS.md`를 읽는다
- **이름은 taxonomy 4-4 "제안" 열 그대로.** 이 계획과 csv가 다르면 csv·md가 맞다(taxonomy 7-3 ④ — 테스트 기대값만 바꿔 통과시키지 않는다)
- **동작·화면·문구 그대로.** 바뀌는 문구는 `/privacy` 6-3의 두 문장(해요체, 표의 "바꿀 문장(안)" 그대로)과 갱신일뿐. 이벤트가 나는 순간도 그대로 — 새로 생기는 것은 E-26(🎯 [책 펼치기] 제출이 통과될 때)과 속성 두 개뿐
- **`web/.env.local`에는 실제 키가 있다 — 열거나 출력하거나 커밋하지 않는다.** Amplitude 키는 코드·문서·테스트 어디에도 쓰지 않는다(테스트는 가짜 `"test-key-not-real"`만). E2E는 키 없이 돈다(`playwright.config.ts`의 `NEXT_PUBLIC_AMPLITUDE_API_KEY: ""`, `TRACK_STORE: "off"` 그대로)
- **Supabase의 기존 테스트 기록은 옛 이름 그대로 둔다** — 옮기는 SQL·백필·별칭 없음. P7(실데이터 시작) 전에 지운다(taxonomy 4-4 "언제")
- 의존성은 `csv-parse` 하나만 devDependency로 추가(taxonomy 7-3 ② 지정). 그 밖의 패키지 추가 없음
- 파일 하나 300줄 이하. `common.test.ts`(이미 327줄)는 이름만 바꾸고 줄을 늘리지 않는다 — 새 회차 테스트는 `client.test.ts`에
- 커밋: 영어 conventional commits, 본문에 taxonomy 7-2 체크리스트 줄 `- [x] events: taxonomy.md · taxonomy.csv · schema.ts changed together (or no event change)`, 끝에 `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`. 이 라운드는 마이그레이션이라 csv·md는 검사가 켜지는 Task 6·7에서 맞추고, 체크리스트 줄에 그 사실을 적는다(아래 "스펙과 다르게 정한 것")
- 명령은 `web/`에서(`npm run …`, `npx …`), 문서 스크립트는 `Galpi/`에서. Windows Git Bash 기준
- 실패한 검사를 "관계없는 오류"로 넘기지 않는다. 각 태스크 끝에 typecheck·lint·해당 테스트가 통과해야 커밋한다

---

## File Structure

| 파일 | 책임 | 태스크 |
|---|---|---|
| `web/src/lib/track/schema.ts` | **`EVENT_SPEC`**(25개 이벤트의 속성 명세), `PropSpec`·`PropType`, `EventName`·`EVENT_NAMES`, **`PropsOf<N>`**, `isEventName`(own key만), `CommonProps`(`is_returning`·`is_in_app_browser`), **`COMMON_KEYS`**, `parseCommon`, `cutText` / Task 2에서 **`ROUND_ENDING_EVENTS`** | 1·2 |
| `web/src/lib/track/client.ts` | `track<N extends EventName>(name, props: PropsOf<N>)` — Supabase·Amplitude 두 곳, 끝나는 판이면 그 뒤 `nextRound()` | 1·2 |
| `web/src/lib/track/common.ts` | 공통 속성 이름 `is_returning`·`is_in_app_browser` (`detectDevice` 포함) | 1 |
| `web/src/lib/track/props.ts` (새) | `parseProps(name, raw)` — 서버 검사(명세 밖·Amplitude 전용·타입 틀림 → 버림 + 목록) / `forAmplitude(name, props)` — Supabase 전용 속성 뺀 사본 | 3·4 |
| `web/src/app/api/track/route.ts` | `parseProps` 적용, 버린 키를 이름만(최대 10개, 40자) `console.warn` | 3 |
| `web/src/lib/track/amplitude.ts` | `site_visited`에 `prompt_version`, `forAmplitude`, **시작 전 대기열(키 있을 때만, 50개)**, 대기열 이벤트의 **`time`** | 1·4·5 |
| `web/src/components/TrackVisit.tsx`, `flow/Flow.tsx`, `flow/BalanceGame.tsx`, `flow/TargetInput.tsx` | 호출 15곳을 새 이름·속성으로, E-26, `home_clicked.source` | 1 |
| `web/src/lib/flow/target.ts` | `goalSubmittedProps(form, goal, isEdit)` — E-26 속성 | 1 |
| `web/src/lib/flow/summary.ts` | E-06 🎯 바뀐 항목 `"what"` → `"topic"` | 1 |
| `web/src/components/flow/FirstPage.tsx` (+ 새 test) | 직접 쓴 글이 보이는 첫 장에 `data-amp-mask` | 4 |
| `web/src/app/privacy/page.tsx`, `web/src/lib/privacy.ts` | 6-3 두 문장, 갱신일 2026-10-01 | 4 |
| `web/src/components/AmplitudeInit.tsx` | 주석만(대기열이 순서를 대신함) | 5 |
| `web/src/lib/track/taxonomy.test.ts` (새) | 7-3 ② 검사 #1~#10 | 6 |
| `web/e2e/helpers.ts`, `e2e/spec-check.spec.ts` (새), `e2e/flow-*.spec.ts` | 7-3 ③ `specMismatches` | 1·2·6 |
| `docs/taxonomy.csv` | 구현된 줄 Status `live`, E-10·E-18 `pick_type` → `planned-P4`, Note 정리(일회성 스크립트) | 6 |
| `docs/taxonomy.md`, `PRD.md`, `README.md`, `target-chips.md`, `deploy.md`, `DESIGN.md`, `context.md`, `process.md`, `tasks.md`, `Galpi/CLAUDE.md` | v0.3 기록, 옛 이름(앞으로 쓰일 문서만), CLAUDE.md 규칙 3-1·체크리스트(일회성 스크립트) | 7 |
| 테스트: `schema.test.ts`, `client.test.ts`, `common.test.ts`, `amplitude.test.ts`, `props.test.ts`(새), `route.test.ts`, `store.test.ts`, `target.test.ts`, `summary.test.ts`, `TargetInput.test.tsx`, `BalanceGame.test.tsx`, `page.test.tsx`, `e2e/guard·visit·flow-leaf·flow-target` | 각 태스크 | 1~6 |

### 이름 바꾸기 한눈에 (4-4 그대로)

| 무엇 | 현재 → v0.3 |
|---|---|
| 이벤트 | `visit` → `site_visited` · `goal_free_written` → `free_goal_written` · `goal_coverage` → `goal_coverage_checked` · (PRD만) `yes24_clicked` → `yes24_link_clicked` |
| 공통 | `returning` → `is_returning` · `in_app_browser` → `is_in_app_browser` |
| E-02 · E-06 | `entry` 삭제(공통 `entry`와 중복) |
| E-03 | `question` → `chip_type` · `value` → `chip_value` · 값 `"direct"` → `"free"` · `edit` → `is_edit` |
| E-24 · E-25 | `question` → `question_no` · E-24 `ms` → `elapsed_ms` · `edit` → `is_edit` |
| E-21 | `text` → `goal_text`(**Supabase only**, 30자) · `matched` → `is_matched` |
| E-22 | `bucket` → `coverage_bucket` · `found` → `found_count` |
| E-06 | `items` → `changed_items` · 🎯 값 `"what"` → `"topic"` |
| E-07 · E-08 | `index` → `position` · `kind` → `pick_type` · E-08에 `one_liner_style` 추가 |
| E-20 | `curious` → `curious_count` · `source`(`first_page` / `end`) 추가 |
| 새 E-26 | `goal_submitted` { `topic`, `is_free_text`, `len`, `way`, `is_edit` } |
| 명세에만(P4) | E-10 `result_book_viewed.pick_type`, E-18 `yes24_link_clicked.pick_type`(null 허용) |

---

### Task 1: 이름 마이그레이션 — `EVENT_SPEC`, 타입 있는 `track()`, 호출 15곳, E-26

**Files:**
- Modify: `web/src/lib/track/schema.ts`(전체 교체), `web/src/lib/track/client.ts`(전체 교체), `web/src/lib/track/common.ts`, `web/src/lib/track/amplitude.ts`, `web/src/components/TrackVisit.tsx`, `web/src/components/flow/Flow.tsx`, `web/src/components/flow/BalanceGame.tsx`, `web/src/components/flow/TargetInput.tsx`, `web/src/lib/flow/target.ts`, `web/src/lib/flow/summary.ts`
- Test: `web/src/lib/track/schema.test.ts`, `client.test.ts`, `common.test.ts`, `amplitude.test.ts`, `store.test.ts`, `web/src/app/api/track/route.test.ts`, `web/src/lib/flow/target.test.ts`, `summary.test.ts`, `web/src/components/flow/TargetInput.test.tsx`, `BalanceGame.test.tsx`, `web/e2e/guard.spec.ts`, `visit.spec.ts`, `flow-leaf.spec.ts`, `flow-target.spec.ts`

**Interfaces:**
- Consumes: 지금 코드 — `commonProps()`, `nextRound()`, `setEntry()`(`common.ts`), `sendToAmplitude(name, props, common)`(`amplitude.ts`), `matchGoal()`·`GoalMatch`(`lib/goal/match.ts`), `targetAnswersFrom()`(`lib/flow/target.ts`), `PickView.kind`·`BookCard.oneLinerStyle`
- Produces: `type PropType = "string" | "number" | "boolean" | "object" | readonly (string | null)[]` · `interface PropSpec { type; array?: true; nullable?: true; only?: "supabase" | "amplitude"; max?: number }` · `EVENT_SPEC`(25개, `as const satisfies Record<string, Readonly<Record<string, PropSpec>>>`) · `type EventName = keyof typeof EVENT_SPEC` · `EVENT_NAMES: EventName[]` · `type PropsOf<N extends EventName>`(Amplitude 전용 속성 제외, 속성 없으면 `Record<string, never>`) · `isEventName(x): x is EventName` · `CommonProps.is_returning`·`is_in_app_browser` · `COMMON_KEYS`(10개, 순서 = csv `*` 줄) · `track<N extends EventName>(name: N, props: PropsOf<N>): void` · `goalSubmittedProps(f: TargetForm, goal: GoalMatch | null, isEdit: boolean): PropsOf<"goal_submitted">` · `editedTargetFields`가 `"topic"`을 돌려줌

- [ ] **Step 0: 작업 브랜치 확인**

```bash
cd Galpi
git branch --show-current   # feat/amplitude
git log --oneline -1        # 0202ca8 docs: note where the taxonomy dev round resumes (또는 이 계획을 더한 커밋)
git status --short          # 아무것도 없어야 한다
```

- [ ] **Step 1: 기존 테스트를 새 이름으로 — 공통 속성·`site_visited`**

이름만 바뀌는 테스트(아래 diff는 지금 파일 기준). `common.test.ts`는 줄 수가 그대로다(327줄 — 300줄 규칙 이전부터 넘음, 늘리지 않는다). 테스트 제목의 "returning=false" 같은 글자는 그대로 둔다.

`web/src/lib/track/schema.test.ts` (공통 키 이름 + 새 명세 테스트 — `COMMON_KEYS`, 25개 이름, own key, `only`, 컴파일 단계 타입 검사):

```diff
--- a/web/src/lib/track/schema.test.ts
+++ b/web/src/lib/track/schema.test.ts
@@ -1,24 +1,53 @@
 import { describe, expect, it } from "vitest";
-import { cutText, EVENT_NAMES, isEventName, parseCommon } from "./schema";
+import { COMMON_KEYS, cutText, EVENT_NAMES, EVENT_SPEC, isEventName, parseCommon, type PropsOf } from "./schema";
 
 describe("event schema", () => {
-  it("lists the 24 PRD events in order (E-04 removed)", () => {
-    expect(EVENT_NAMES).toHaveLength(24);
-    expect(EVENT_NAMES[0]).toBe("visit");
-    expect(EVENT_NAMES[23]).toBe("unsure_hold_cancelled");
+  it("lists the 25 taxonomy events in PRD order (E-04 removed, E-26 last)", () => {
+    expect(EVENT_NAMES).toHaveLength(25);
+    expect(EVENT_NAMES[0]).toBe("site_visited");
+    expect(EVENT_NAMES[24]).toBe("goal_submitted");
+    expect(EVENT_NAMES).not.toContain("visit");
   });
 
-  it("accepts only known names", () => {
+  it("accepts only known names, never inherited object keys", () => {
     expect(isEventName("bookmark_reacted")).toBe(true);
     expect(isEventName("drop_table")).toBe(false);
+    expect(isEventName("constructor")).toBe(false);
+    expect(isEventName("__proto__")).toBe(false);
     expect(isEventName(42)).toBe(false);
   });
+
+  it("marks goal_text Supabase only and prompt_version Amplitude only (taxonomy 2-7)", () => {
+    expect(EVENT_SPEC.free_goal_written.goal_text).toMatchObject({ only: "supabase", max: 30 });
+    expect(EVENT_SPEC.site_visited.prompt_version).toMatchObject({ only: "amplitude" });
+  });
+
+  it("types the props of each event from the spec (checked by tsc)", () => {
+    const shown: PropsOf<"bookmark_shown"> = {
+      book_id: "9788998441012", position: 1, one_liner_style: "summary", pick_type: "random", art: { animal: "fox" },
+    };
+    const goal: PropsOf<"free_goal_written"> = { goal_text: "SQL", topic: "데이터 분석", keywords: ["SQL"], is_matched: true, method: "word" };
+    const visit: PropsOf<"site_visited"> = {};
+    // @ts-expect-error — `kind` is the old name of pick_type (taxonomy 4-4)
+    const old: PropsOf<"bookmark_reacted"> = { book_id: "1", position: 1, reaction: "pass", pick_type: "random", one_liner_style: "summary", kind: "random" };
+    // @ts-expect-error — entry_selected has no props of its own (props.entry was removed)
+    const entry: PropsOf<"entry_selected"> = { entry: "leaf" };
+    // @ts-expect-error — side is an enum: left, right or null
+    const side: PropsOf<"balance_answered"> = { question_no: 1, choice: "A", side: "middle", elapsed_ms: 1, is_edit: false };
+    expect([shown, goal, visit, old, entry, side]).toHaveLength(6);
+  });
 });
 
 const good = { anon_id: "a", user_id: null, session_id: "s", round: 1, entry: null, screen_version: "v1",
-  referrer: "", returning: false, device: "phone", in_app_browser: false };
+  referrer: "", is_returning: false, device: "phone", is_in_app_browser: false };
 
 describe("parseCommon", () => {
+  it("returns exactly the COMMON_KEYS (taxonomy 3-1: Boolean names start with is_)", () => {
+    expect(Object.keys(parseCommon(good) ?? {}).sort()).toEqual([...COMMON_KEYS].sort());
+    expect(COMMON_KEYS).toContain("is_returning");
+    expect(COMMON_KEYS).toContain("is_in_app_browser");
+  });
+
   it("accepts a complete common block and returns only the known keys", () => {
     expect(parseCommon(good)).toEqual(good);
     expect(parseCommon({ ...good, entry: "leaf", user_id: "u1", round: 1000, device: "desktop" })).toMatchObject({ entry: "leaf", user_id: "u1" });
@@ -51,8 +80,8 @@ describe("parseCommon", () => {
     ["entry unknown", { entry: "shelf" }],
     ["entry undefined", { entry: undefined }],
     ["device tablet", { device: "tablet" }],
-    ["returning string", { returning: "false" }],
-    ["in_app_browser 0", { in_app_browser: 0 }],
+    ["is_returning string", { is_returning: "false" }],
+    ["is_in_app_browser 0", { is_in_app_browser: 0 }],
   ])("rejects %s", (_, patch) => expect(parseCommon({ ...good, ...patch })).toBeNull());
 
   it("cuts a referrer over 500 characters instead of rejecting it (ids stay strict)", () => {
```

`web/src/lib/track/common.test.ts`:

```diff
--- a/web/src/lib/track/common.test.ts
+++ b/web/src/lib/track/common.test.ts
@@ -4,11 +4,11 @@ import { commonProps, detectDevice, nextRound, setEntry } from "./common";
 describe("detectDevice", () => {
   it("detects a phone inside the KakaoTalk in-app browser", () => {
     const ua = "Mozilla/5.0 (Linux; Android 14; Pixel 7) AppleWebKit/537.36 Mobile Safari/537.36 KAKAOTALK 10.8.0";
-    expect(detectDevice(ua)).toEqual({ device: "phone", in_app_browser: true });
+    expect(detectDevice(ua)).toEqual({ device: "phone", is_in_app_browser: true });
   });
   it("detects a desktop browser", () => {
     const ua = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/140.0 Safari/537.36";
-    expect(detectDevice(ua)).toEqual({ device: "desktop", in_app_browser: false });
+    expect(detectDevice(ua)).toEqual({ device: "desktop", is_in_app_browser: false });
   });
 });
 
@@ -22,12 +22,12 @@ describe("commonProps", () => {
   it("keeps the same anonymous id within a page load", () => {
     const first = commonProps();
     expect(first.anon_id).toMatch(/^[0-9a-f-]{36}$/);
-    expect(first.returning).toBe(false);
+    expect(first.is_returning).toBe(false);
     sessionStorage.clear();
     const second = commonProps();
     expect(second.anon_id).toBe(first.anon_id);
     expect(second.session_id).toBe(first.session_id);
-    expect(second.returning).toBe(false);
+    expect(second.is_returning).toBe(false);
   });
 
   it("cuts a very long document.referrer to 500 characters", () => {
@@ -80,8 +80,8 @@ describe("commonProps", () => {
 
       expect(first.anon_id).toBe(second.anon_id);
       expect(first.session_id).toBe(second.session_id);
-      expect(first.returning).toBe(false);
-      expect(second.returning).toBe(false);
+      expect(first.is_returning).toBe(false);
+      expect(second.is_returning).toBe(false);
     } finally {
       if (originalLocal) {
         Object.defineProperty(window, "localStorage", originalLocal);
@@ -123,8 +123,8 @@ describe("commonProps", () => {
 
       expect(first.anon_id).toBe(second.anon_id);
       expect(first.session_id).toBe(second.session_id);
-      expect(first.returning).toBe(false);
-      expect(second.returning).toBe(false);
+      expect(first.is_returning).toBe(false);
+      expect(second.is_returning).toBe(false);
     } finally {
       if (originalLocal) {
         Object.defineProperty(window, "localStorage", originalLocal);
@@ -174,7 +174,7 @@ describe("commonProps", () => {
     // First page load: create anon_id and store in localStorage
     const firstPageLoad = commonProps();
     const storedAnonId = firstPageLoad.anon_id;
-    expect(firstPageLoad.returning).toBe(false);
+    expect(firstPageLoad.is_returning).toBe(false);
 
     // New page load: localStorage persists, sessionStorage cleared, memory empty
     vi.resetModules();
@@ -187,7 +187,7 @@ describe("commonProps", () => {
     const secondPageLoad = freshCommonProps();
 
     expect(secondPageLoad.anon_id).toBe(storedAnonId);
-    expect(secondPageLoad.returning).toBe(true);
+    expect(secondPageLoad.is_returning).toBe(true);
   });
 });
 
@@ -204,8 +204,8 @@ describe("commonProps returning is fixed per session", () => {
     const { commonProps: fresh } = await import("./common");
     const first = fresh();
     const second = fresh();
-    expect(first.returning).toBe(true);
-    expect(second.returning).toBe(true);
+    expect(first.is_returning).toBe(true);
+    expect(second.is_returning).toBe(true);
     expect(second.session_id).toBe(first.session_id);
   });
 
@@ -213,16 +213,16 @@ describe("commonProps returning is fixed per session", () => {
     localStorage.setItem("galpi.anon", "11111111-1111-4111-8111-111111111111");
     localStorage.setItem("galpi.seen", "1");
     const a = await import("./common");
-    expect(a.commonProps().returning).toBe(true);
+    expect(a.commonProps().is_returning).toBe(true);
     vi.resetModules();
     const b = await import("./common");
-    expect(b.commonProps().returning).toBe(true);
+    expect(b.commonProps().is_returning).toBe(true);
   });
 
   it("stays false on every call of a first-ever visit", async () => {
     const { commonProps: fresh } = await import("./common");
-    expect(fresh().returning).toBe(false);
-    expect(fresh().returning).toBe(false);
+    expect(fresh().is_returning).toBe(false);
+    expect(fresh().is_returning).toBe(false);
   });
 });
 
```

`web/src/lib/track/amplitude.test.ts`:

```diff
--- a/web/src/lib/track/amplitude.test.ts
+++ b/web/src/lib/track/amplitude.test.ts
@@ -16,7 +16,7 @@ const FAKE_KEY = "test-key-not-real";
 
 const common: CommonProps = {
   anon_id: "11111111-1111-4111-8111-111111111111", user_id: null, session_id: "s1", round: 2, entry: "leaf",
-  screen_version: "v1", referrer: "https://x.example/", returning: true, device: "phone", in_app_browser: false,
+  screen_version: "v1", referrer: "https://x.example/", is_returning: true, device: "phone", is_in_app_browser: false,
 };
 
 const load = () => import("./amplitude");
@@ -48,7 +48,7 @@ describe("without a key", () => {
     const { startAmplitude, sendToAmplitude } = await load();
     startAmplitude();
     startAmplitude();
-    sendToAmplitude("visit", {}, common);
+    sendToAmplitude("site_visited", {}, common);
     await pause();
     expect(sdk.loaded).toBe(0);
     expect(sdk.initAll).not.toHaveBeenCalled();
@@ -131,12 +131,12 @@ describe("with a key", () => {
     vi.stubGlobal("requestIdleCallback", idle);
     const { startAmplitude, sendToAmplitude } = await load();
     startAmplitude();
-    sendToAmplitude("visit", {}, common);
+    sendToAmplitude("site_visited", {}, common);
     sendToAmplitude("entry_selected", { entry: "target" }, common);
     expect(sdk.track).not.toHaveBeenCalled();
     idle.mock.calls[0][0]();
     await vi.waitFor(() => expect(sdk.track).toHaveBeenCalledTimes(2));
-    expect(sdk.track.mock.calls.map((c) => c[0])).toEqual(["visit", "entry_selected"]);
+    expect(sdk.track.mock.calls.map((c) => c[0])).toEqual(["site_visited", "entry_selected"]);
     expect(sdk.track.mock.calls[0][1].prompt_version).toBe("BA400.4");
     // later events go straight through
     sendToAmplitude("book_opened", {}, common);
@@ -162,7 +162,7 @@ describe("with a key", () => {
     expect(() => startAmplitude()).not.toThrow();
     await ready();
     await pause();
-    sendToAmplitude("visit", {}, common);
+    sendToAmplitude("site_visited", {}, common);
     startAmplitude();
     await pause();
     expect(sdk.track).not.toHaveBeenCalled();
@@ -179,7 +179,7 @@ describe("with a key", () => {
     startAmplitude();
     await pause();
     expect(sdk.initAll).toHaveBeenCalledTimes(1);
-    sendToAmplitude("visit", {}, common);
+    sendToAmplitude("site_visited", {}, common);
     expect(sdk.track).not.toHaveBeenCalled();
   });
 
@@ -189,7 +189,7 @@ describe("with a key", () => {
     const { startAmplitude, sendToAmplitude } = await load();
     expect(() => startAmplitude()).not.toThrow();
     await pause();
-    expect(() => sendToAmplitude("visit", {}, common)).not.toThrow();
+    expect(() => sendToAmplitude("site_visited", {}, common)).not.toThrow();
     vi.doMock("@amplitude/unified", fakeSdk);
   });
 });
@@ -216,11 +216,11 @@ describe("sendToAmplitude", () => {
 
   it("sends the same event name and props plus the analysis-relevant common props", async () => {
     const send = await started();
-    send("chip_selected", { question: "topic", value: "history", edit: false }, common);
+    send("chip_selected", { chip_type: "topic", chip_value: "데이터 분석", is_edit: false }, common);
     expect(sdk.track).toHaveBeenCalledTimes(1);
     expect(sdk.track).toHaveBeenCalledWith("chip_selected", {
-      entry: "leaf", round: 2, screen_version: "v1", device: "phone", in_app_browser: false, returning: true,
-      question: "topic", value: "history", edit: false,
+      entry: "leaf", round: 2, screen_version: "v1", device: "phone", is_in_app_browser: false, is_returning: true,
+      chip_type: "topic", chip_value: "데이터 분석", is_edit: false,
     });
   });
 
@@ -232,13 +232,13 @@ describe("sendToAmplitude", () => {
 
   it("leaves out entry when the visitor has not chosen one yet", async () => {
     const send = await started();
-    send("visit", {}, { ...common, entry: null });
+    send("site_visited", {}, { ...common, entry: null });
     expect(sdk.track.mock.calls[0][1]).not.toHaveProperty("entry");
   });
 
-  it("adds prompt_version only to visit", async () => {
+  it("adds prompt_version only to site_visited", async () => {
     const send = await started();
-    send("visit", {}, common);
+    send("site_visited", {}, common);
     send("book_opened", {}, common);
     expect(sdk.track.mock.calls[0][1].prompt_version).toBe("BA400.4");
     expect(sdk.track.mock.calls[1][1]).not.toHaveProperty("prompt_version");
@@ -253,6 +253,6 @@ describe("sendToAmplitude", () => {
   it("never throws when Amplitude's track throws", async () => {
     const send = await started();
     sdk.track.mockImplementation(() => { throw new Error("sdk broke"); });
-    expect(() => send("visit", {}, common)).not.toThrow();
+    expect(() => send("site_visited", {}, common)).not.toThrow();
   });
 });
```

`web/src/app/api/track/route.test.ts`·`web/src/lib/track/store.test.ts`·`web/e2e/guard.spec.ts`:

```diff
--- a/web/src/app/api/track/route.test.ts
+++ b/web/src/app/api/track/route.test.ts
@@ -6,7 +6,7 @@ import { saveEvent } from "@/lib/track/store";
 import { POST } from "./route";
 
 const common = { anon_id: "a", user_id: null, session_id: "s", round: 1, entry: null, screen_version: "v1",
-  referrer: "", returning: false, device: "phone", in_app_browser: false };
+  referrer: "", is_returning: false, device: "phone", is_in_app_browser: false };
 const ORIGIN = "http://x";
 const from = (ip: string) => ({ origin: ORIGIN, "x-forwarded-for": ip });
 const req = (body: unknown, headers: Record<string, string> = from("9.9.9.9")) =>
@@ -16,9 +16,9 @@ describe("POST /api/track", () => {
   afterEach(() => vi.clearAllMocks());
 
   it("accepts a known event", async () => {
-    const res = await POST(req({ name: "visit", props: {}, common }));
+    const res = await POST(req({ name: "site_visited", props: {}, common }));
     expect(res.status).toBe(202);
-    expect(saveEvent).toHaveBeenCalledWith({ name: "visit", props: {}, common });
+    expect(saveEvent).toHaveBeenCalledWith({ name: "site_visited", props: {}, common });
   });
 
   it("rejects an unknown event name", async () => {
@@ -28,51 +28,51 @@ describe("POST /api/track", () => {
   });
 
   it("rejects bodies that are too large with 413", async () => {
-    const res = await POST(req({ name: "visit", props: { big: "x".repeat(9000) }, common }));
+    const res = await POST(req({ name: "site_visited", props: { big: "x".repeat(9000) }, common }));
     expect(res.status).toBe(413);
   });
 
   it("measures the size limit in bytes, not characters", async () => {
-    const res = await POST(req({ name: "visit", props: { big: "가".repeat(3000) }, common }));
+    const res = await POST(req({ name: "site_visited", props: { big: "가".repeat(3000) }, common }));
     expect(res.status).toBe(413);
     expect(saveEvent).not.toHaveBeenCalled();
   });
 
   it("refuses another origin with 403 and stores nothing", async () => {
-    const res = await POST(req({ name: "visit", props: {}, common }, { origin: "https://evil.example", "x-forwarded-for": "9.9.9.9" }));
+    const res = await POST(req({ name: "site_visited", props: {}, common }, { origin: "https://evil.example", "x-forwarded-for": "9.9.9.9" }));
     expect(res.status).toBe(403);
     expect(await res.json()).toEqual({ error: "forbidden" });
     expect(saveEvent).not.toHaveBeenCalled();
   });
 
   it("refuses a request with neither Origin nor Referer", async () => {
-    expect((await POST(req({ name: "visit", props: {}, common }, {}))).status).toBe(403);
+    expect((await POST(req({ name: "site_visited", props: {}, common }, {}))).status).toBe(403);
     expect(saveEvent).not.toHaveBeenCalled();
   });
 
   it("accepts a same-site Referer when there is no Origin", async () => {
-    expect((await POST(req({ name: "visit", props: {}, common }, { referer: "http://x/privacy" }))).status).toBe(202);
+    expect((await POST(req({ name: "site_visited", props: {}, common }, { referer: "http://x/privacy" }))).status).toBe(202);
   });
 
   it("answers 429 with Retry-After after 120 events a minute from one address", async () => {
-    for (let i = 0; i < 120; i++) expect((await POST(req({ name: "visit", props: {}, common }, from("7.7.7.7")))).status).toBe(202);
-    const res = await POST(req({ name: "visit", props: {}, common }, from("7.7.7.7")));
+    for (let i = 0; i < 120; i++) expect((await POST(req({ name: "site_visited", props: {}, common }, from("7.7.7.7")))).status).toBe(202);
+    const res = await POST(req({ name: "site_visited", props: {}, common }, from("7.7.7.7")));
     expect(res.status).toBe(429);
     expect(Number(res.headers.get("Retry-After"))).toBeGreaterThan(0);
     // another address is not affected
-    expect((await POST(req({ name: "visit", props: {}, common }, from("7.7.7.8")))).status).toBe(202);
+    expect((await POST(req({ name: "site_visited", props: {}, common }, from("7.7.7.8")))).status).toBe(202);
   });
 
   it("rejects non-object bodies", async () => {
-    for (const body of [null, 1, "visit", [1]]) {
+    for (const body of [null, 1, "site_visited", [1]]) {
       const res = await POST(req(body));
       expect(res.status).toBe(400);
     }
   });
 
   it("rejects a missing or array common", async () => {
-    expect((await POST(req({ name: "visit", props: {} }))).status).toBe(400);
-    expect((await POST(req({ name: "visit", props: {}, common: [] }))).status).toBe(400);
+    expect((await POST(req({ name: "site_visited", props: {} }))).status).toBe(400);
+    expect((await POST(req({ name: "site_visited", props: {}, common: [] }))).status).toBe(400);
     expect(saveEvent).not.toHaveBeenCalled();
   });
 
@@ -80,20 +80,20 @@ describe("POST /api/track", () => {
     const missing: Record<string, unknown> = { ...common };
     delete missing.anon_id;
     for (const bad of [missing, { ...common, round: "1" }, { ...common, device: "tablet" }, { ...common, anon_id: "x".repeat(201) }]) {
-      expect((await POST(req({ name: "visit", props: {}, common: bad }))).status).toBe(400);
+      expect((await POST(req({ name: "site_visited", props: {}, common: bad }))).status).toBe(400);
     }
     expect(saveEvent).not.toHaveBeenCalled();
   });
 
   it("keeps the event when the referrer is longer than 500 characters, storing it cut", async () => {
-    const res = await POST(req({ name: "visit", props: {}, common: { ...common, referrer: "https://s.example/?q=" + "x".repeat(900) } }));
+    const res = await POST(req({ name: "site_visited", props: {}, common: { ...common, referrer: "https://s.example/?q=" + "x".repeat(900) } }));
     expect(res.status).toBe(202);
     const stored = vi.mocked(saveEvent).mock.calls[0][0];
     expect(stored.common.referrer).toHaveLength(500);
   });
 
   it("keeps the event when the referrer cut falls inside an emoji, and stores no lone surrogate", async () => {
-    const res = await POST(req({ name: "visit", props: {}, common: { ...common, referrer: "x".repeat(499) + "😀" } }));
+    const res = await POST(req({ name: "site_visited", props: {}, common: { ...common, referrer: "x".repeat(499) + "😀" } }));
     expect(res.status).toBe(202);
     const referrer = vi.mocked(saveEvent).mock.calls[0][0].common.referrer as string;
     expect(referrer).toBe("x".repeat(499));
@@ -103,7 +103,7 @@ describe("POST /api/track", () => {
   it("answers 400, not 500, for absurdly deep nesting that fits in the size cap", async () => {
     const deep = (n: number) => "[".repeat(n) + "]".repeat(n);
     const withProps = (n: number) => new Request("http://x/api/track", { method: "POST", headers: from("9.9.9.9"),
-      body: `{"name":"visit","props":{"a":${deep(n)}},"common":${JSON.stringify(common)}}` });
+      body: `{"name":"site_visited","props":{"a":${deep(n)}},"common":${JSON.stringify(common)}}` });
     expect((await POST(withProps(3300))).status).toBe(400);
     expect((await POST(new Request("http://x/api/track", { method: "POST", headers: from("9.9.9.9"), body: deep(3300) }))).status).toBe(400);
     expect((await POST(withProps(10))).status).toBe(202);      // ordinary nesting is fine
@@ -112,10 +112,10 @@ describe("POST /api/track", () => {
 
   it("keeps the event and strips NUL and lone surrogates that Postgres jsonb would refuse", async () => {
     const dirty = { ...common, referrer: "a\u0000b\ud800c" };
-    const res = await POST(req({ name: "visit", props: { goal: "책\u0000 \udc00읽기", "\u0000k": 1, nested: [{ t: "x\ud83d" }], ok: "😀" }, common: dirty }));
+    const res = await POST(req({ name: "site_visited", props: { goal: "책\u0000 \udc00읽기", "\u0000k": 1, nested: [{ t: "x\ud83d" }], ok: "😀" }, common: dirty }));
     expect(res.status).toBe(202);
     expect(saveEvent).toHaveBeenCalledWith({
-      name: "visit",
+      name: "site_visited",
       props: { goal: "책 \ufffd읽기", k: 1, nested: [{ t: "x\ufffd" }], ok: "😀" },
       common: { ...common, referrer: "ab\ufffdc" },
     });
@@ -123,7 +123,7 @@ describe("POST /api/track", () => {
 
   it("does not let a __proto__ key in props change the stored object's prototype", async () => {
     const res = await POST(new Request("http://x/api/track", { method: "POST", headers: from("9.9.9.9"),
-      body: '{"name":"visit","props":{"__proto__":{"polluted":true}},"common":' + JSON.stringify(common) + "}" }));
+      body: '{"name":"site_visited","props":{"__proto__":{"polluted":true}},"common":' + JSON.stringify(common) + "}" }));
     expect(res.status).toBe(202);
     const props = vi.mocked(saveEvent).mock.calls[0][0].props;
     expect(Object.getPrototypeOf(props)).toBe(Object.prototype);
@@ -140,28 +140,28 @@ describe("POST /api/track", () => {
   });
 
   it("drops keys that are not in the common schema", async () => {
-    const res = await POST(req({ name: "visit", props: {}, common: { ...common, evil: "x".repeat(100), admin: true } }));
+    const res = await POST(req({ name: "site_visited", props: {}, common: { ...common, evil: "x".repeat(100), admin: true } }));
     expect(res.status).toBe(202);
-    expect(saveEvent).toHaveBeenCalledWith({ name: "visit", props: {}, common });
+    expect(saveEvent).toHaveBeenCalledWith({ name: "site_visited", props: {}, common });
   });
 
   it("rejects props that are not an object", async () => {
     for (const props of [[1], "x", 1, null]) {
-      expect((await POST(req({ name: "visit", props, common }))).status).toBe(400);
+      expect((await POST(req({ name: "site_visited", props, common }))).status).toBe(400);
     }
     expect(saveEvent).not.toHaveBeenCalled();
   });
 
   it("treats missing props as empty", async () => {
-    const res = await POST(req({ name: "visit", common }));
+    const res = await POST(req({ name: "site_visited", common }));
     expect(res.status).toBe(202);
-    expect(saveEvent).toHaveBeenCalledWith({ name: "visit", props: {}, common });
+    expect(saveEvent).toHaveBeenCalledWith({ name: "site_visited", props: {}, common });
   });
 
   it("answers 500 when the store fails", async () => {
     vi.mocked(saveEvent).mockRejectedValueOnce(new Error("boom"));
     vi.spyOn(console, "error").mockImplementation(() => {});
-    const res = await POST(req({ name: "visit", props: {}, common }));
+    const res = await POST(req({ name: "site_visited", props: {}, common }));
     expect(res.status).toBe(500);
     expect(await res.json()).toEqual({ error: "store failed" });
   });
```

```diff
--- a/web/src/lib/track/store.test.ts
+++ b/web/src/lib/track/store.test.ts
@@ -8,7 +8,7 @@ const createClient = vi.fn(() => ({ from }));
 vi.mock("server-only", () => ({}));
 vi.mock("@supabase/supabase-js", () => ({ createClient }));
 
-const event = { name: "visit", props: {}, common: {} };
+const event = { name: "site_visited", props: {}, common: {} };
 
 async function loadStore() {
   vi.resetModules();
```

```diff
--- a/web/e2e/guard.spec.ts
+++ b/web/e2e/guard.spec.ts
@@ -2,8 +2,8 @@ import { expect } from "@playwright/test";
 import { test } from "./helpers";
 
 const common = { anon_id: "e2e", user_id: null, session_id: "e2e", round: 1, entry: null, screen_version: "v1",
-  referrer: "", returning: false, device: "desktop", in_app_browser: false };
-const event = { name: "visit", props: {}, common };
+  referrer: "", is_returning: false, device: "desktop", is_in_app_browser: false };
+const event = { name: "site_visited", props: {}, common };
 
 // The production build behind `next start`, hit without a browser page: same-origin must be enforced there too.
 test("track refuses a request from another origin, or with no origin at all", async ({ request, baseURL }) => {
```

- [ ] **Step 2: 실패하는 테스트 — 새 속성·E-26·타입 검사**

`web/src/lib/track/client.test.ts` — 새 이름·속성으로, 마지막에 **컴파일 단계 검사**(`@ts-expect-error`가 실제 오류가 아니면 `tsc`가 "Unused '@ts-expect-error' directive"로 실패한다):

```diff
--- a/web/src/lib/track/client.test.ts
+++ b/web/src/lib/track/client.test.ts
@@ -18,21 +18,21 @@ describe("track", () => {
   it("posts the event with common props to /api/track", async () => {
     const send = vi.fn().mockReturnValue(true);
     Object.defineProperty(navigator, "sendBeacon", { value: send, configurable: true });
-    track("entry_selected", { entry: "leaf" });
+    track("first_page_edited", { changed_items: ["len"] });
     expect(send).toHaveBeenCalledTimes(1);
     const [url, blob] = send.mock.calls[0];
     expect(url).toBe("/api/track");
     expect(blob).toBeInstanceOf(Blob);
     const text = await blob.text();
     const data = JSON.parse(text);
-    expect(data.name).toBe("entry_selected");
-    expect(data.props.entry).toBe("leaf");
+    expect(data.name).toBe("first_page_edited");
+    expect(data.props).toEqual({ changed_items: ["len"] });
     expect(data.common.anon_id).toBeDefined();
   });
 
   it("never throws when sending fails", () => {
     Object.defineProperty(navigator, "sendBeacon", { value: () => { throw new Error("offline"); }, configurable: true });
-    expect(() => track("visit")).not.toThrow();
+    expect(() => track("site_visited", {})).not.toThrow();
   });
 
   it("falls back to fetch when sendBeacon returns false", () => {
@@ -40,7 +40,7 @@ describe("track", () => {
     const fetchMock = vi.fn().mockResolvedValue({ ok: true });
     Object.defineProperty(navigator, "sendBeacon", { value: send, configurable: true });
     vi.stubGlobal("fetch", fetchMock);
-    track("visit");
+    track("site_visited", {});
     expect(send).toHaveBeenCalledTimes(1);
     expect(fetchMock).toHaveBeenCalledTimes(1);
     const [url, opts] = fetchMock.mock.calls[0];
@@ -50,11 +50,11 @@ describe("track", () => {
 
   it("also hands the same event to Amplitude with the common props", () => {
     Object.defineProperty(navigator, "sendBeacon", { value: vi.fn().mockReturnValue(true), configurable: true });
-    track("chip_selected", { question: "len", value: "short" });
+    track("chip_selected", { chip_type: "len", chip_value: "thin", is_edit: false });
     expect(sendToAmplitude).toHaveBeenCalledTimes(1);
     const [name, props, common] = vi.mocked(sendToAmplitude).mock.calls[0];
     expect(name).toBe("chip_selected");
-    expect(props).toEqual({ question: "len", value: "short" });
+    expect(props).toEqual({ chip_type: "len", chip_value: "thin", is_edit: false });
     expect(common?.anon_id).toMatch(/^[0-9a-f-]{36}$/);
   });
 
@@ -62,13 +62,26 @@ describe("track", () => {
     const send = vi.fn().mockReturnValue(true);
     Object.defineProperty(navigator, "sendBeacon", { value: send, configurable: true });
     vi.mocked(sendToAmplitude).mockImplementation(() => { throw new Error("amplitude down"); });
-    expect(() => track("visit")).not.toThrow();
+    expect(() => track("site_visited", {})).not.toThrow();
     expect(send).toHaveBeenCalledTimes(1);
   });
 
   it("still sends to Amplitude when the Supabase path fails", () => {
     Object.defineProperty(navigator, "sendBeacon", { value: () => { throw new Error("offline"); }, configurable: true });
-    track("visit");
+    track("site_visited", {});
     expect(sendToAmplitude).toHaveBeenCalledTimes(1);
   });
+
+  it("only compiles with the props the spec defines (taxonomy 7-3 ①)", () => {
+    Object.defineProperty(navigator, "sendBeacon", { value: vi.fn().mockReturnValue(true), configurable: true });
+    // @ts-expect-error — old event name (taxonomy 4-4)
+    track("visit", {});
+    // @ts-expect-error — entry_selected lost its duplicate `entry` prop
+    track("entry_selected", { entry: "leaf" });
+    // @ts-expect-error — home_clicked needs source (first_page | end)
+    track("home_clicked", { curious_count: 0 });
+    // @ts-expect-error — prompt_version is Amplitude only: the Amplitude path adds it, callers never do
+    track("site_visited", { prompt_version: "BA400.4" });
+    expect(sendToAmplitude).toHaveBeenCalledTimes(4);
+  });
 });
```

`web/src/lib/flow/target.test.ts`·`summary.test.ts`:

```diff
--- a/web/src/lib/flow/target.test.ts
+++ b/web/src/lib/flow/target.test.ts
@@ -1,5 +1,5 @@
 import { describe, expect, it } from "vitest";
-import { EMPTY_FORM, WAY_CHIPS, formReady, targetAnswersFrom } from "./target";
+import { EMPTY_FORM, WAY_CHIPS, formReady, goalSubmittedProps, targetAnswersFrom } from "./target";
 
 describe("🎯 form", () => {
   it("needs a topic or a non-empty written goal", () => {
@@ -20,6 +20,14 @@ describe("🎯 form", () => {
     expect(targetAnswersFrom({ ...EMPTY_FORM, free: "SQL" }, goal)).toEqual({ topic: "데이터 분석", way: null, len: 0, keywords: ["SQL"] });
   });
 
+  it("builds E-26 goal_submitted props: chosen topic, or the topic the written goal matched", () => {
+    expect(goalSubmittedProps({ topic: "통계", free: null, len: "thin", way: "실습" }, null, false))
+      .toEqual({ topic: "통계", is_free_text: false, len: "thin", way: "실습", is_edit: false });
+    const goal = { text: "SQL", topic: "데이터 분석" as const, keywords: ["SQL"], matched: true, method: "word" as const };
+    expect(goalSubmittedProps({ ...EMPTY_FORM, free: "SQL" }, goal, true))
+      .toEqual({ topic: "데이터 분석", is_free_text: true, len: null, way: null, is_edit: true });
+  });
+
   it("labels 읽는 방식 chips as target-chips.md does", () => {
     expect(WAY_CHIPS.map((c) => c.label)).toEqual(["개념부터 쉽게", "따라 하며 실습 (바로 써먹기)", "사례로 술술"]);
   });
```

```diff
--- a/web/src/lib/flow/summary.test.ts
+++ b/web/src/lib/flow/summary.test.ts
@@ -90,7 +90,7 @@ describe("edit tracking and coverage buckets", () => {
   it("lists changed 🎯 fields", () => {
     const before = { topic: null, free: "SQL", len: null, way: null } as const;
     expect(editedTargetFields(before, { ...before, len: "thin" })).toEqual(["len"]);
-    expect(editedTargetFields(before, { ...before, free: null, topic: "통계", way: "개념" })).toEqual(["what", "way"]);
+    expect(editedTargetFields(before, { ...before, free: null, topic: "통계", way: "개념" })).toEqual(["topic", "way"]);
     expect(editedTargetFields(before, { ...before })).toEqual([]);
   });
 
```

`web/src/components/flow/TargetInput.test.tsx`·`BalanceGame.test.tsx`:

```diff
--- a/web/src/components/flow/TargetInput.test.tsx
+++ b/web/src/components/flow/TargetInput.test.tsx
@@ -28,9 +28,9 @@ describe("TargetInput (S-02 🎯)", () => {
     submit();
     expect(onSubmit).toHaveBeenCalledWith({ topic: "AI 활용", free: null, len: "thin", way: "사례" });
     expect(vi.mocked(track).mock.calls).toEqual([
-      ["chip_selected", { question: "topic", value: "AI 활용", edit: false }],
-      ["chip_selected", { question: "len", value: "thin", edit: false }],
-      ["chip_selected", { question: "way", value: "사례", edit: false }],
+      ["chip_selected", { chip_type: "topic", chip_value: "AI 활용", is_edit: false }],
+      ["chip_selected", { chip_type: "len", chip_value: "thin", is_edit: false }],
+      ["chip_selected", { chip_type: "way", chip_value: "사례", is_edit: false }],
     ]);
   });
 
@@ -40,7 +40,7 @@ describe("TargetInput (S-02 🎯)", () => {
     fireEvent.click(thin);
     fireEvent.click(thin);
     expect(thin).toHaveAttribute("aria-pressed", "false");
-    expect(track).toHaveBeenLastCalledWith("chip_selected", { question: "len", value: null, edit: false });
+    expect(track).toHaveBeenLastCalledWith("chip_selected", { chip_type: "len", chip_value: null, is_edit: false });
   });
 
   it("takes a written goal instead of a topic, trimmed", () => {
@@ -53,6 +53,7 @@ describe("TargetInput (S-02 🎯)", () => {
     fireEvent.change(box, { target: { value: "  SQL 공부  " } });
     submit();
     expect(onSubmit).toHaveBeenCalledWith({ topic: null, free: "SQL 공부", len: null, way: null });
+    expect(track).toHaveBeenCalledWith("chip_selected", { chip_type: "topic", chip_value: "free", is_edit: false });
   });
 
   it("counts an empty written goal as missing", () => {
@@ -85,6 +86,6 @@ describe("TargetInput (S-02 🎯)", () => {
     expect(screen.getByRole("button", { name: "통계" })).toHaveAttribute("aria-pressed", "true");
     expect(screen.getByRole("button", { name: "두꺼워도 좋아요" })).toHaveAttribute("aria-pressed", "true");
     fireEvent.click(screen.getByRole("button", { name: "보통" }));
-    expect(track).toHaveBeenCalledWith("chip_selected", { question: "len", value: "normal", edit: true });
+    expect(track).toHaveBeenCalledWith("chip_selected", { chip_type: "len", chip_value: "normal", is_edit: true });
   });
 });
```

```diff
--- a/web/src/components/flow/BalanceGame.test.tsx
+++ b/web/src/components/flow/BalanceGame.test.tsx
@@ -23,7 +23,7 @@ describe("BalanceGame", () => {
     expect(screen.getByText("1 / 9")).toBeInTheDocument();
     fireEvent.click(screen.getByRole("button", { name: "몽글몽글 따뜻함" }));
     expect(onAnswer).toHaveBeenCalledWith("A");
-    expect(track).toHaveBeenCalledWith("balance_answered", expect.objectContaining({ question: 1, choice: "A", side: "left", edit: false }));
+    expect(track).toHaveBeenCalledWith("balance_answered", { question_no: 1, choice: "A", side: "left", elapsed_ms: expect.any(Number), is_edit: false });
   });
 
   it("puts A on the right from question 5", () => {
@@ -33,7 +33,7 @@ describe("BalanceGame", () => {
     expect(container.querySelector('[data-side="left"]')).toHaveTextContent("빗소리처럼 쓸쓸한 책");
     fireEvent.click(screen.getByRole("button", { name: "빗소리처럼 쓸쓸한 책" }));
     expect(onAnswer).toHaveBeenCalledWith("B");
-    expect(track).toHaveBeenCalledWith("balance_answered", expect.objectContaining({ question: 5, choice: "B", side: "left", edit: true }));
+    expect(track).toHaveBeenCalledWith("balance_answered", expect.objectContaining({ question_no: 5, choice: "B", side: "left", is_edit: true }));
   });
 
   it("answers 못 잡겠어요 after the hold and logs a cancelled hold before it", () => {
@@ -43,11 +43,11 @@ describe("BalanceGame", () => {
     fireEvent.pointerDown(hold);
     act(() => { vi.advanceTimersByTime(200); });
     fireEvent.pointerUp(hold);
-    expect(track).toHaveBeenCalledWith("unsure_hold_cancelled", expect.objectContaining({ question: 2, held_ms: expect.any(Number) }));
+    expect(track).toHaveBeenCalledWith("unsure_hold_cancelled", { question_no: 2, held_ms: expect.any(Number), is_edit: false });
     fireEvent.pointerDown(hold);
     act(() => { vi.advanceTimersByTime(800); });
     expect(onAnswer).toHaveBeenCalledWith("unsure");
-    expect(track).toHaveBeenCalledWith("balance_answered", expect.objectContaining({ question: 2, choice: "unsure", side: null }));
+    expect(track).toHaveBeenCalledWith("balance_answered", expect.objectContaining({ question_no: 2, choice: "unsure", side: null }));
   });
 
   it("draws each choice as a bookmark with the words in its window and no animal", () => {
@@ -90,6 +90,6 @@ describe("BalanceGame", () => {
     fireEvent.click(card());
     expect(onAnswer).toHaveBeenCalledTimes(2);
     expect(onAnswer).toHaveBeenLastCalledWith("A");
-    expect(track).toHaveBeenLastCalledWith("balance_answered", expect.objectContaining({ question: 2, choice: "A" }));
+    expect(track).toHaveBeenLastCalledWith("balance_answered", expect.objectContaining({ question_no: 2, choice: "A" }));
   });
 });
```

E2E 단언(`flow-leaf`·`flow-target`·`visit`):

```diff
--- a/web/e2e/flow-leaf.spec.ts
+++ b/web/e2e/flow-leaf.spec.ts
@@ -44,12 +44,12 @@ test("🍃 nine answers (one held 못 잡겠어요) → book → five bookmarks"
   await expect.poll(() => named(events, "bookmark_reacted").length).toBe(5);
   const answers = named(events, "balance_answered");
   expect(answers).toHaveLength(9);
-  expect(answers[0].props).toMatchObject({ question: 1, choice: "unsure", side: null, edit: false });
-  expect(answers[4].props).toMatchObject({ question: 5, choice: "B", side: "left" });
-  expect(answers.every((e) => typeof e.props.ms === "number")).toBe(true);
+  expect(answers[0].props).toMatchObject({ question_no: 1, choice: "unsure", side: null, is_edit: false });
+  expect(answers[4].props).toMatchObject({ question_no: 5, choice: "B", side: "left" });
+  expect(answers.every((e) => typeof e.props.elapsed_ms === "number")).toBe(true);
   const cancelled = named(events, "unsure_hold_cancelled");
   expect(cancelled).toHaveLength(1);
-  expect(cancelled[0].props.question).toBe(1);
+  expect(cancelled[0].props.question_no).toBe(1);
   expect(cancelled[0].props.held_ms as number).toBeGreaterThan(200);
   const shown = named(events, "bookmark_shown");
   expect(shown).toHaveLength(5);
@@ -74,8 +74,8 @@ test("🍃 a reload keeps the page and the entry/round of later events", async (
   await page.reload();
   await expect(page.getByText("2 / 5")).toBeVisible();
   await expect(page.getByRole("article")).toHaveAttribute("aria-label", label ?? "");
-  await expect.poll(() => named(events, "visit").length).toBe(2);
-  expect(named(events, "visit")[1].common).toMatchObject({ entry: "leaf", round: 1 });
+  await expect.poll(() => named(events, "site_visited").length).toBe(2);
+  expect(named(events, "site_visited")[1].common).toMatchObject({ entry: "leaf", round: 1 });
   expect(named(events, "bookmark_shown")).toHaveLength(2);              // a reload is not a new showing
 });
 
@@ -100,7 +100,7 @@ test("🍃 a draw that keeps failing still lets the person go back to the start"
   await page.getByRole("button", { name: "처음으로" }).click();
   await expect(page.getByRole("button", { name: /그냥 한 권 만나고 싶어요/ })).toBeVisible();
   await expect.poll(() => named(events, "home_clicked").length).toBe(1);
-  expect(named(events, "home_clicked")[0].props).toEqual({ curious: 0 });
+  expect(named(events, "home_clicked")[0].props).toEqual({ curious_count: 0, source: "first_page" });
 });
 
 test("🍃 one failed draw, then 다시 시도 brings the book", async ({ page }) => {
```

```diff
--- a/web/e2e/flow-target.spec.ts
+++ b/web/e2e/flow-target.spec.ts
@@ -39,18 +39,23 @@ test("🎯 chips → book → first page → five bookmarks → curious list", a
   await expect(page.getByRole("button", { name: /그냥 한 권 만나고 싶어요/ })).toBeVisible();
 
   await expect.poll(() => named(events, "home_clicked").length).toBe(1);
-  expect(named(events, "visit")).toHaveLength(1);
-  expect(named(events, "entry_selected").map((e) => e.props)).toEqual([{ entry: "target" }]);
-  expect(named(events, "chip_selected").map((e) => [e.props.question, e.props.value])).toEqual([["topic", "데이터 분석"], ["len", "thin"], ["way", "실습"]]);
+  expect(named(events, "site_visited")).toHaveLength(1);
+  expect(named(events, "entry_selected").map((e) => [e.props, e.common.entry])).toEqual([[{}, "target"]]);
+  expect(named(events, "chip_selected").map((e) => [e.props.chip_type, e.props.chip_value])).toEqual([["topic", "데이터 분석"], ["len", "thin"], ["way", "실습"]]);
+  expect(named(events, "goal_submitted").map((e) => e.props)).toEqual([
+    { topic: "데이터 분석", is_free_text: false, len: "thin", way: "실습", is_edit: false },
+  ]);
   expect(named(events, "book_opened")).toHaveLength(1);
   const shown = named(events, "bookmark_shown");
   expect(shown).toHaveLength(5);
   expect(new Set(shown.map((e) => e.props.book_id)).size).toBe(5);
-  expect(shown.filter((e) => e.props.kind === "random")).toHaveLength(1);
+  expect(shown.filter((e) => e.props.pick_type === "random")).toHaveLength(1);
   expect(shown.every((e) => e.common.entry === "target" && e.common.round === 1 && e.props.one_liner_style === "summary")).toBe(true);
-  expect(shown.map((e) => e.props.index)).toEqual([1, 2, 3, 4, 5]);
-  expect(named(events, "bookmark_reacted").map((e) => e.props.reaction)).toEqual(["curious", "pass", "curious", "pass", "curious"]);
-  expect(named(events, "home_clicked")[0]).toMatchObject({ props: { curious: 3 }, common: { entry: "target" } });
+  expect(shown.map((e) => e.props.position)).toEqual([1, 2, 3, 4, 5]);
+  const reacted = named(events, "bookmark_reacted");
+  expect(reacted.map((e) => e.props.reaction)).toEqual(["curious", "pass", "curious", "pass", "curious"]);
+  expect(reacted.every((e) => e.props.one_liner_style === "summary")).toBe(true);
+  expect(named(events, "home_clicked")[0]).toMatchObject({ props: { curious_count: 3, source: "end" }, common: { entry: "target" } });
   await expect.poll(() => statuses.length).toBe(events.length);
   expect(statuses.every((s) => s === 202)).toBe(true);
 });
@@ -83,13 +88,17 @@ test("🎯 written goal → honest count → one edit → five bookmarks", async
   await expect(page.getByRole("button", { name: "처음으로" })).toBeVisible();
 
   await expect.poll(() => named(events, "bookmark_reacted").length).toBe(5);
-  expect(named(events, "goal_free_written").map((e) => e.props)).toEqual([
-    { text: "SQL 공부", topic: "데이터 분석", keywords: ["SQL"], matched: true, method: "word" },
-    { text: "SQL 공부", topic: "데이터 분석", keywords: ["SQL"], matched: true, method: "word" },
+  expect(named(events, "free_goal_written").map((e) => e.props)).toEqual([
+    { goal_text: "SQL 공부", topic: "데이터 분석", keywords: ["SQL"], is_matched: true, method: "word" },
+    { goal_text: "SQL 공부", topic: "데이터 분석", keywords: ["SQL"], is_matched: true, method: "word" },
+  ]);
+  expect(named(events, "goal_submitted").map((e) => e.props)).toEqual([
+    { topic: "데이터 분석", is_free_text: true, len: null, way: null, is_edit: false },
+    { topic: "데이터 분석", is_free_text: true, len: "thin", way: null, is_edit: true },
   ]);
-  expect(named(events, "goal_coverage")[0].props).toEqual({ bucket: "1-3", found: 2 });
-  expect(named(events, "first_page_edited").map((e) => e.props)).toEqual([{ entry: "target", items: ["len"] }]);
-  expect(named(events, "chip_selected").map((e) => [e.props.value, e.props.edit])).toEqual([["direct", false], ["thin", true]]);
+  expect(named(events, "goal_coverage_checked")[0].props).toEqual({ coverage_bucket: "1-3", found_count: 2 });
+  expect(named(events, "first_page_edited").map((e) => e.props)).toEqual([{ changed_items: ["len"] }]);
+  expect(named(events, "chip_selected").map((e) => [e.props.chip_value, e.props.is_edit])).toEqual([["free", false], ["thin", true]]);
 });
 
 test("🎯 a 30-character goal with no spaces wraps inside the first page", async ({ page }) => {
```

```diff
--- a/web/e2e/visit.spec.ts
+++ b/web/e2e/visit.spec.ts
@@ -1,7 +1,7 @@
 import { expect } from "@playwright/test";
 import { test } from "./helpers";
 
-test("sends exactly one visit event and the server accepts it", async ({ page }) => {
+test("sends exactly one site_visited event and the server accepts it", async ({ page }) => {
   const bodies: string[] = [];
   const statuses: number[] = [];
   const payloads: unknown[] = [];
@@ -18,7 +18,7 @@ test("sends exactly one visit event and the server accepts it", async ({ page })
   await page.waitForTimeout(500);
   expect(bodies).toHaveLength(1);
   const sent = JSON.parse(bodies[0]);
-  expect(sent.name).toBe("visit");
+  expect(sent.name).toBe("site_visited");
   expect(sent.common.screen_version).toBe("v1");
   expect(sent.common.anon_id).toMatch(/^[0-9a-f-]{36}$/);
   expect(statuses[0]).toBe(202);
```

- [ ] **Step 3: 실패 확인**

Run: `cd web && npm run typecheck; npx vitest run src/lib src/components src/app/api`
Expected: `tsc` 오류 — `COMMON_KEYS`·`EVENT_SPEC`·`PropsOf`·`goalSubmittedProps`가 export되지 않음, `CommonProps`에 `is_returning` 없음 / Vitest FAIL — `schema.test`(25개·`site_visited`·COMMON_KEYS), `parseCommon`의 새 키, `TargetInput`(chip_type·"free"), `BalanceGame`(question_no·elapsed_ms·is_edit), `target`(goalSubmittedProps), `summary`("topic"), `route.test`(`site_visited`가 모르는 이름이라 400)

- [ ] **Step 4: `schema.ts` 전체 교체 — `EVENT_SPEC`과 `PropsOf`**

`web/src/lib/track/schema.ts`:

```ts
/**
 * Event names and props — the code copy of docs/taxonomy.md (the source) and docs/taxonomy.csv (its machine copy).
 * Change all three in one commit (taxonomy 7-1); src/lib/track/taxonomy.test.ts fails when they drift.
 */

/** "string" | "number" | "boolean" | "object", or the allowed values of an enum (null in the list = nullable). */
export type PropType = "string" | "number" | "boolean" | "object" | readonly (string | null)[];

export interface PropSpec {
  readonly type: PropType;
  /** csv Array = TRUE: a list of `type` values. */
  readonly array?: true;
  /** A non-enum value that may be null (csv Value Example lists `null`). */
  readonly nullable?: true;
  /** csv Note "Supabase only" / "Amplitude only" (taxonomy 2-7): sent to that destination alone. */
  readonly only?: "supabase" | "amplitude";
  /** Longest string the server keeps (UTF-16 units). */
  readonly max?: number;
}

const BOOK_ID = { type: "string" } as const;
const POSITION = { type: "number" } as const;
const IS_EDIT = { type: "boolean" } as const;
const QUESTION_NO = { type: "number" } as const;
const PICK_TYPE = { type: ["recommended", "random"] } as const;
const ONE_LINER_STYLE = { type: ["summary", "question"] } as const;
const CURIOUS_COUNT = { type: "number" } as const;
const PROVIDER = { type: ["kakao", "google"] } as const;

/** Every live and planned event (taxonomy 4-1), in PRD order. Props are the event's own; common props are separate. */
export const EVENT_SPEC = {
  site_visited: { prompt_version: { type: "string", only: "amplitude" } },
  entry_selected: {},
  chip_selected: {
    chip_type: { type: ["topic", "len", "way"] },
    chip_value: { type: "string", nullable: true },
    is_edit: IS_EDIT,
  },
  book_opened: {},
  first_page_edited: { changed_items: { type: "string", array: true } },
  bookmark_shown: { book_id: BOOK_ID, position: POSITION, one_liner_style: ONE_LINER_STYLE, pick_type: PICK_TYPE, art: { type: "object" } },
  bookmark_reacted: {
    book_id: BOOK_ID, position: POSITION, reaction: { type: ["pass", "curious"] }, pick_type: PICK_TYPE, one_liner_style: ONE_LINER_STYLE,
  },
  result_viewed: { curious_count: CURIOUS_COUNT },
  result_book_viewed: { book_id: BOOK_ID, position: POSITION, pick_type: PICK_TYPE },
  save_clicked: { book_id: BOOK_ID, is_logged_in: { type: "boolean" } },
  login_prompt_shown: { source: { type: ["save", "header"] } },
  login_started: { provider: PROVIDER },
  login_completed: { provider: PROVIDER, is_first_login: { type: "boolean" } },
  book_saved: { book_id: BOOK_ID, is_auto_save: { type: "boolean" } },
  book_unsaved: { book_id: BOOK_ID },
  library_viewed: { saved_count: { type: "number" } },
  yes24_link_clicked: { book_id: BOOK_ID, source: { type: ["result", "library"] }, pick_type: { type: [null, "recommended", "random"] } },
  redraw_clicked: { curious_count: CURIOUS_COUNT },
  home_clicked: { curious_count: CURIOUS_COUNT, source: { type: ["first_page", "end"] } },
  free_goal_written: {
    goal_text: { type: "string", only: "supabase", max: 30 },
    topic: { type: "string" },
    keywords: { type: "string", array: true },
    is_matched: { type: "boolean" },
    method: { type: ["word", "llm"] },
  },
  goal_coverage_checked: { coverage_bucket: { type: ["0", "1-3", "4+"] }, found_count: { type: "number" } },
  description_expanded: { book_id: BOOK_ID, pick_type: PICK_TYPE },
  balance_answered: {
    question_no: QUESTION_NO,
    choice: { type: ["A", "B", "unsure"] },
    side: { type: [null, "left", "right"] },
    elapsed_ms: { type: "number" },
    is_edit: IS_EDIT,
  },
  unsure_hold_cancelled: { question_no: QUESTION_NO, held_ms: { type: "number" }, is_edit: IS_EDIT },
  goal_submitted: {
    topic: { type: "string" },
    is_free_text: { type: "boolean" },
    len: { type: [null, "thin", "normal", "thick"] },
    way: { type: [null, "개념", "실습", "사례"] },
    is_edit: IS_EDIT,
  },
} as const satisfies Record<string, Readonly<Record<string, PropSpec>>>;

type Spec = typeof EVENT_SPEC;
export type EventName = keyof Spec;
export const EVENT_NAMES = Object.keys(EVENT_SPEC) as EventName[];

type BaseOf<T> = T extends "string" ? string
  : T extends "number" ? number
  : T extends "boolean" ? boolean
  : T extends "object" ? object
  : T extends readonly (infer V)[] ? V
  : never;
type ValueOf<P> = P extends { type: infer T }
  ? P extends { array: true } ? BaseOf<T>[] : BaseOf<T> | (P extends { nullable: true } ? null : never)
  : never;
type Sent<N extends EventName> = { [K in keyof Spec[N] as Spec[N][K] extends { only: "amplitude" } ? never : K]: ValueOf<Spec[N][K]> };

/** What a screen passes to track(name, props). Amplitude-only props are added by the Amplitude path, never by callers. */
export type PropsOf<N extends EventName> = keyof Sent<N> extends never ? Record<string, never> : Sent<N>;

/** Own keys only: "constructor" or "__proto__" are not event names. */
export function isEventName(x: unknown): x is EventName {
  return typeof x === "string" && Object.prototype.hasOwnProperty.call(EVENT_SPEC, x);
}

export interface CommonProps {
  anon_id: string;
  user_id: string | null;
  session_id: string;
  round: number;
  entry: "leaf" | "target" | null;
  screen_version: string;
  referrer: string;
  is_returning: boolean;
  device: "phone" | "desktop";
  is_in_app_browser: boolean;
}

/** taxonomy.md 3-1 — the csv `*` rows. parseCommon returns exactly these keys. */
export const COMMON_KEYS = [
  "anon_id", "user_id", "session_id", "round", "entry", "screen_version", "referrer", "is_returning", "device", "is_in_app_browser",
] as const satisfies readonly (keyof CommonProps)[];

export const SCREEN_VERSION = "v1";

const MAX_ID = 200;
const MAX_REFERRER = 500;
const MAX_ROUND = 1000;

/** Cuts to at most `max` UTF-16 units without leaving half of an emoji (a trailing high surrogate is dropped). */
export function cutText(s: string, max: number): string {
  const cut = s.slice(0, max);
  return /[\uD800-\uDBFF]$/.test(cut) ? cut.slice(0, -1) : cut;
}

const text = (x: unknown, max: number, min = 0): x is string => typeof x === "string" && x.length >= min && x.length <= max;

/** Strict check of the common block sent with every event. Returns a fresh object with the known keys only. */
export function parseCommon(x: unknown): CommonProps | null {
  if (typeof x !== "object" || x === null || Array.isArray(x)) return null;
  const c = x as Record<string, unknown>;
  const { anon_id, user_id, session_id, round, entry, screen_version, referrer, is_returning, device, is_in_app_browser } = c;
  if (!text(anon_id, MAX_ID, 1) || !text(session_id, MAX_ID, 1) || !text(screen_version, MAX_ID, 1)) return null;
  if (user_id !== null && !text(user_id, MAX_ID)) return null;
  if (typeof referrer !== "string") return null;
  if (typeof round !== "number" || !Number.isInteger(round) || round < 0 || round > MAX_ROUND) return null;
  if (entry !== null && entry !== "leaf" && entry !== "target") return null;
  if (device !== "phone" && device !== "desktop") return null;
  if (typeof is_returning !== "boolean" || typeof is_in_app_browser !== "boolean") return null;
  // referrer comes from the visitor's browser and may be a long URL: keep the event, cut the value.
  return {
    anon_id, user_id, session_id, round, entry, screen_version, referrer: cutText(referrer, MAX_REFERRER), is_returning, device, is_in_app_browser,
  };
}
```

명세 값 읽는 법(taxonomy 7-3 ①): `type`이 문자열 넷 중 하나면 그 타입, 배열이면 **열거형 — 가능한 값 전부**(null이 있으면 null 허용). `array: true` = csv Array TRUE, `nullable: true` = 열거형이 아닌데 null 허용(csv Value Example에 `null`), `only` = csv Note의 `Supabase only`/`Amplitude only`, `max` = 서버가 자르는 길이. `topic`·`chip_value`처럼 키 목록이 긴 값은 `"string"`(7-3 ② 규칙).

- [ ] **Step 5: 공통 속성·`track()`·Amplitude 사본**

`web/src/lib/track/common.ts`:

```diff
--- a/web/src/lib/track/common.ts
+++ b/web/src/lib/track/common.ts
@@ -80,10 +80,10 @@ function currentRound(): number {
   return Number.isInteger(n) && n >= 1 ? n : 1;
 }
 
-export function detectDevice(ua: string): { device: "phone" | "desktop"; in_app_browser: boolean } {
+export function detectDevice(ua: string): { device: "phone" | "desktop"; is_in_app_browser: boolean } {
   const phone = /Mobi|Android|iPhone|iPod/i.test(ua);
   const inApp = /KAKAOTALK|Instagram|FBAN|FBAV|NAVER\(inapp|Line\//i.test(ua);
-  return { device: phone ? "phone" : "desktop", in_app_browser: inApp };
+  return { device: phone ? "phone" : "desktop", is_in_app_browser: inApp };
 }
 
 /** Read-only: the id this browser already has, or null. Never creates or stores one (privacy page). */
@@ -112,7 +112,7 @@ export function commonProps(): CommonProps {
     memory[RETURNING] = flag;
     write(session, RETURNING, flag);
   }
-  const returning = (read(session, RETURNING) ?? memory[RETURNING]) === "1";
+  const isReturning = (read(session, RETURNING) ?? memory[RETURNING]) === "1";
 
   memory[SEEN] = "1";
   write(local, SEEN, "1");
@@ -125,7 +125,7 @@ export function commonProps(): CommonProps {
     entry: currentEntry(),
     screen_version: SCREEN_VERSION,
     referrer: typeof document === "undefined" ? "" : cutText(document.referrer, MAX_REFERRER),
-    returning,
+    is_returning: isReturning,
     ...detectDevice(typeof navigator === "undefined" ? "" : navigator.userAgent),
   };
 }
```

`web/src/lib/track/client.ts` 전체:

```ts
import { sendToAmplitude } from "./amplitude";
import { commonProps } from "./common";
import type { CommonProps, EventName, PropsOf } from "./schema";

/** Supabase path (via /api/track). Unchanged; returns the common props it used so Amplitude gets the same ones. */
function sendToSupabase(name: EventName, props: Record<string, unknown>): CommonProps | null {
  try {
    const common = commonProps();
    const body = JSON.stringify({ name, props, common });
    const blob = new Blob([body], { type: "application/json" });
    if (!navigator.sendBeacon?.("/api/track", blob)) {
      void fetch("/api/track", { method: "POST", body, headers: { "Content-Type": "application/json" }, keepalive: true }).catch(() => {});
    }
    return common;
  } catch {
    return null; // tracking must never break the page
  }
}

/** One call per event (taxonomy 2-7 SDK). `props` must match EVENT_SPEC[name]: tsc checks every call site. */
export function track<N extends EventName>(name: N, props: PropsOf<N>): void {
  const own = props as Record<string, unknown>;
  const common = sendToSupabase(name, own);
  try {
    sendToAmplitude(name, own, common);
  } catch {
    // second destination: its failure never reaches the page or the first one
  }
}
```

`web/src/lib/track/amplitude.ts` (공통 속성 이름, `prompt_version`은 `site_visited`에):

```diff
--- a/web/src/lib/track/amplitude.ts
+++ b/web/src/lib/track/amplitude.ts
@@ -5,7 +5,7 @@ type Sdk = typeof import("@amplitude/unified");
 type Waiting = readonly [EventName, Record<string, unknown>];
 
 const KEY_MISSING = "Amplitude API key missing — analytics disabled";
-/** Instructor's install check (wizard step 6): the load event carries this. We reuse `visit` instead of a new event name. */
+/** Instructor's install check (wizard step 6): `site_visited` carries this (EVENT_SPEC: prompt_version, Amplitude only). */
 const PROMPT_VERSION = "BA400.4";
 const REPLAY_SAMPLE_RATE = 0.2;
 /** The SDK is ~120 KB gzip: load it when the browser is idle, and no later than this after the page asked for it. */
@@ -85,10 +85,10 @@ export function sendToAmplitude(name: EventName, props: Record<string, unknown>,
       round: common.round,
       screen_version: common.screen_version,
       device: common.device,
-      in_app_browser: common.in_app_browser,
-      returning: common.returning,
+      is_in_app_browser: common.is_in_app_browser,
+      is_returning: common.is_returning,
     };
-    const event: Waiting = [name, { ...shared, ...props, ...(name === "visit" ? { prompt_version: PROMPT_VERSION } : {}) }];
+    const event: Waiting = [name, { ...shared, ...props, ...(name === "site_visited" ? { prompt_version: PROMPT_VERSION } : {}) }];
     if (sdk) give(sdk, event);
     else if (waiting.length < MAX_WAITING) waiting.push(event);
   } catch {
```

- [ ] **Step 6: 호출 15곳과 E-26**

`web/src/lib/flow/target.ts` 끝에 E-26 속성 함수, `summary.ts`는 `"topic"`:

```diff
--- a/web/src/lib/flow/target.ts
+++ b/web/src/lib/flow/target.ts
@@ -1,6 +1,7 @@
 import { WAY_LABEL, type Tag, type TargetAnswers, type Way } from "@/lib/recommend";
 import { TOPIC_CHIPS, type Topic } from "@/lib/books/taxonomy";
 import type { GoalMatch } from "@/lib/goal/match";
+import type { PropsOf } from "@/lib/track/schema";
 
 export type LenChoice = "thin" | "normal" | "thick";
 
@@ -34,3 +35,8 @@ export function targetAnswersFrom(f: TargetForm, goal: GoalMatch | null): Target
     keywords: goal?.keywords ?? [],
   };
 }
+
+/** E-26 goal_submitted: the 🎯 form passed its check. topic = the chosen key, or the one the written goal matched. */
+export function goalSubmittedProps(f: TargetForm, goal: GoalMatch | null, isEdit: boolean): PropsOf<"goal_submitted"> {
+  return { topic: targetAnswersFrom(f, goal).topic, is_free_text: f.free !== null, len: f.len, way: f.way, is_edit: isEdit };
+}
```

```diff
--- a/web/src/lib/flow/summary.ts
+++ b/web/src/lib/flow/summary.ts
@@ -71,12 +71,12 @@ export function editedQuestions(before: readonly BalanceChoice[], after: readonl
   return after.flatMap((c, i) => (c !== before[i] ? [`q${i + 1}`] : []));
 }
 
-/** E-06 items for 🎯: "what" (topic or written goal), "len", "way". */
+/** E-06 changed_items for 🎯: "topic" (chosen topic or written goal — the E-03 chip_type name), "len", "way". */
 export function editedTargetFields(before: TargetForm, after: TargetForm): string[] {
   const what = before.topic !== after.topic || (before.free === null) !== (after.free === null)
     || (before.free ?? "").trim() !== (after.free ?? "").trim();
   return [
-    ...(what ? ["what"] : []),
+    ...(what ? ["topic"] : []),
     ...(before.len !== after.len ? ["len"] : []),
     ...(before.way !== after.way ? ["way"] : []),
   ];
```

`web/src/components/TrackVisit.tsx`·`BalanceGame.tsx`·`TargetInput.tsx`:

```diff
--- a/web/src/components/TrackVisit.tsx
+++ b/web/src/components/TrackVisit.tsx
@@ -3,6 +3,6 @@ import { useEffect } from "react";
 import { track } from "@/lib/track/client";
 
 export function TrackVisit() {
-  useEffect(() => { track("visit"); }, []);
+  useEffect(() => { track("site_visited", {}); }, []);
   return null;
 }
```

```diff
--- a/web/src/components/flow/BalanceGame.tsx
+++ b/web/src/components/flow/BalanceGame.tsx
@@ -47,14 +47,14 @@ export function BalanceGame({ choices, edit, onAnswer }: Props) {
 
   const choose = (s: Side) => {
     if (elapsed() < TAP_GUARD_MS) return;
-    track("balance_answered", { question: q.n, choice: s.choice, side: s.side, ms: elapsed(), edit });
+    track("balance_answered", { question_no: q.n, choice: s.choice, side: s.side, elapsed_ms: elapsed(), is_edit: edit });
     onAnswer(s.choice);
   };
   const unsure = () => {
-    track("balance_answered", { question: q.n, choice: "unsure", side: null, ms: elapsed(), edit });
+    track("balance_answered", { question_no: q.n, choice: "unsure", side: null, elapsed_ms: elapsed(), is_edit: edit });
     onAnswer("unsure");
   };
-  const cancelled = (heldMs: number) => track("unsure_hold_cancelled", { question: q.n, held_ms: heldMs, edit });
+  const cancelled = (heldMs: number) => track("unsure_hold_cancelled", { question_no: q.n, held_ms: heldMs, is_edit: edit });
 
   return (
     <section className={styles.game} aria-labelledby="balance-question">
```

```diff
--- a/web/src/components/flow/TargetInput.tsx
+++ b/web/src/components/flow/TargetInput.tsx
@@ -30,14 +30,14 @@ export function TargetInput({ initial, edit, onSubmit }: Props) {
   const [missing, setMissing] = useState(false);
   const freeInput = useRef<HTMLInputElement>(null);
 
-  const change = (patch: Partial<TargetForm>, question: "topic" | "len" | "way", value: string | null) => {
+  const change = (patch: Partial<TargetForm>, chipType: "topic" | "len" | "way", chipValue: string | null) => {
     setForm((f) => ({ ...f, ...patch }));
     setMissing(false);
-    track("chip_selected", { question, value, edit });
+    track("chip_selected", { chip_type: chipType, chip_value: chipValue, is_edit: edit });
   };
   const pickTopic = (topic: Topic) => change({ topic, free: null }, "topic", topic);
   const pickFree = () => {
-    change({ topic: null, free: form.free ?? "" }, "topic", "direct");
+    change({ topic: null, free: form.free ?? "" }, "topic", "free");
     setTimeout(() => freeInput.current?.focus(), 0);
   };
   const toggleLen = (len: LenChoice) => {
```

`web/src/components/flow/Flow.tsx` — E-26은 🎯 폼이 검사를 통과해 `onSubmit`이 불릴 때(무엇을 칸이 비면 `TargetInput`이 멈춰 남지 않음), 같은 순간의 `free_goal_written`·`first_page_edited`보다 먼저. [처음으로]는 첫 장(S-04 막다른 길)이면 `first_page`, 궁금해요 목록이면 `end`:

```diff
--- a/web/src/components/flow/Flow.tsx
+++ b/web/src/components/flow/Flow.tsx
@@ -9,7 +9,7 @@ import { drawBody, requestDraw, toDrawView } from "@/lib/flow/api";
 import { flowReducer, type FlowAction, type FlowState, type Reaction } from "@/lib/flow/state";
 import { loadFlow, saveFlow } from "@/lib/flow/storage";
 import { coverageBucket, editedQuestions, editedTargetFields } from "@/lib/flow/summary";
-import type { TargetForm } from "@/lib/flow/target";
+import { goalSubmittedProps, type TargetForm } from "@/lib/flow/target";
 import { matchGoal } from "@/lib/goal/match";
 import { setEntry } from "@/lib/track/common";
 import { track } from "@/lib/track/client";
@@ -33,7 +33,7 @@ export function Flow() {
       const res = await requestDraw(drawBody(s));
       if (s.entry === "target" && s.goal) {
         const found = s.goal.matched ? (res.found ?? 0) : 0;
-        track("goal_coverage", { bucket: coverageBucket(found), found });
+        track("goal_coverage_checked", { coverage_bucket: coverageBucket(found), found_count: found });
       }
       dispatch({ type: "drawn", id: s.drawId, draw: toDrawView(res, newArtSeed()) });
     } catch {
@@ -53,34 +53,37 @@ export function Flow() {
     const pick = s.draw?.picks[s.index];
     if (!pick) return;
     track("bookmark_shown", {
-      book_id: pick.card.id, index: s.index + 1, one_liner_style: pick.card.oneLinerStyle, kind: pick.kind, art: pick.art,
+      book_id: pick.card.id, position: s.index + 1, one_liner_style: pick.card.oneLinerStyle, pick_type: pick.kind, art: pick.art,
     });
   };
 
   const start = (entry: Entry) => {
     setEntry(entry);
-    track("entry_selected", { entry });
+    track("entry_selected", {});    // the entry itself is the common `entry`, set just above
     act({ type: "start", entry });
   };
 
   const answer = (choice: BalanceChoice) => {
     const next = act({ type: "answer", choice });
     if (next.drawId !== state.drawId && state.prevChoices) {
-      track("first_page_edited", { entry: "leaf", items: editedQuestions(state.prevChoices, next.choices) });
+      track("first_page_edited", { changed_items: editedQuestions(state.prevChoices, next.choices) });
     }
   };
 
   const submitTarget = (form: TargetForm) => {
     const goal = form.free !== null ? matchGoal(form.free, VOCAB) : null;
+    track("goal_submitted", goalSubmittedProps(form, goal, state.edited));
     if (goal) {
-      track("goal_free_written", { text: goal.text, topic: goal.topic, keywords: goal.keywords, matched: goal.matched, method: goal.method });
+      track("free_goal_written", {
+        goal_text: goal.text, topic: goal.topic, keywords: goal.keywords, is_matched: goal.matched, method: goal.method,
+      });
     }
-    if (state.prevForm) track("first_page_edited", { entry: "target", items: editedTargetFields(state.prevForm, form) });
+    if (state.prevForm) track("first_page_edited", { changed_items: editedTargetFields(state.prevForm, form) });
     act({ type: "submitTarget", form, goal });
   };
 
   const open = () => {
-    track("book_opened");
+    track("book_opened", {});
     act({ type: "open" });
   };
 
@@ -92,13 +95,16 @@ export function Flow() {
   const react = (reaction: Reaction) => {
     const pick = state.draw?.picks[state.index];
     if (state.step !== "bookmarks" || !pick) return;
-    track("bookmark_reacted", { book_id: pick.card.id, index: state.index + 1, reaction, kind: pick.kind });
+    track("bookmark_reacted", {
+      book_id: pick.card.id, position: state.index + 1, reaction, pick_type: pick.kind, one_liner_style: pick.card.oneLinerStyle,
+    });
     const next = act({ type: "react", reaction });
     if (next.step === "bookmarks") trackShown(next);
   };
 
-  const home = () => {
-    track("home_clicked", { curious: state.reactions.filter((r) => r === "curious").length });
+  /** [처음으로] — source: first_page = S-04 dead end (draw failed / no books), end = after the bookmarks (taxonomy E-20). */
+  const home = (source: "first_page" | "end") => {
+    track("home_clicked", { curious_count: state.reactions.filter((r) => r === "curious").length, source });
     setEntry(null);
     act({ type: "home" });
   };
@@ -118,10 +124,10 @@ export function Flow() {
           onNext={nextPage}
           onRetry={() => act({ type: "retry" })}
           onReact={react}
-          onHome={home}
+          onHome={() => home("first_page")}
         />
       )}
-      {state.step === "end" && <EndList picks={state.draw?.picks ?? []} reactions={state.reactions} onHome={home} />}
+      {state.step === "end" && <EndList picks={state.draw?.picks ?? []} reactions={state.reactions} onHome={() => home("end")} />}
     </MotionConfig>
   );
 }
```

- [ ] **Step 7: 통과 확인**

Run: `cd web && npm run typecheck && npm run lint && npx vitest run`
Expected: 오류 0 / Vitest **50파일 402개** PASS (397 + schema 3 + client 1 + target 1). `client.test.ts`의 `@ts-expect-error` 네 줄이 실제로 오류라서 `tsc`가 통과한다

Run: `cd web && npx playwright test e2e/flow-leaf.spec.ts e2e/flow-target.spec.ts e2e/visit.spec.ts e2e/guard.spec.ts`
Expected: **20 passed** — `entry_selected`의 props는 `{}`이고 입구는 `common.entry`, `goal_submitted`는 칩 흐름 1번·직접 쓰기 흐름 2번(두 번째는 `is_edit: true`, `len: "thin"`), `home_clicked`는 `{ curious_count, source }`

- [ ] **Step 8: Commit**

```bash
cd Galpi
git add web/src web/e2e
git commit -m "feat(analytics): rename events and props to taxonomy v0.2 with a typed EVENT_SPEC

site_visited, free_goal_written, goal_coverage_checked; is_returning,
is_in_app_browser; question_no, elapsed_ms, is_edit, chip_type/chip_value
(\"free\"), changed_items (\"topic\"), position, pick_type, curious_count;
the duplicate entry props are gone. New: goal_submitted (E-26),
bookmark_reacted.one_liner_style, home_clicked.source. track() takes
PropsOf<name>, so tsc checks every call site.

- [x] events: taxonomy.md · taxonomy.csv · schema.ts changed together (or no event change) — csv statuses follow in the sync-check commit

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 2: 회차(`round`) 규칙 — E-20·E-19를 보낸 직후 +1 (3-1a)

**Files:**
- Modify: `web/src/lib/track/schema.ts`, `web/src/lib/track/client.ts`
- Test: `web/src/lib/track/client.test.ts`, `web/e2e/flow-target.spec.ts`

**Interfaces:**
- Consumes: `track()`·`PropsOf`·`EventName`(Task 1), `nextRound()`(`common.ts`, 이미 있음 — sessionStorage `galpi.round`, 새로고침해도 유지)
- Produces: `ROUND_ENDING_EVENTS = ["redraw_clicked", "home_clicked"] as const` (`schema.ts`). **P4가 쓸 고리**: [다시 뽑기]는 `track("redraw_clicked", { curious_count })`만 부르면 같은 규칙을 탄다 — 화면 코드는 `nextRound()`를 부르지 않는다

- [ ] **Step 1: 실패하는 테스트**

`web/src/lib/track/client.test.ts` — 같은 모듈의 메모리가 테스트 사이에 남으므로 값이 아니라 **앞뒤 차이**로 본다:

```diff
--- a/web/src/lib/track/client.test.ts
+++ b/web/src/lib/track/client.test.ts
@@ -1,6 +1,7 @@
 import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
 import { sendToAmplitude } from "./amplitude";
 import { track } from "./client";
+import { ROUND_ENDING_EVENTS } from "./schema";
 
 vi.mock("./amplitude", () => ({ sendToAmplitude: vi.fn(), startAmplitude: vi.fn() }));
 
@@ -72,6 +73,41 @@ describe("track", () => {
     expect(sendToAmplitude).toHaveBeenCalledTimes(1);
   });
 
+  /** Rounds of the events posted so far, read back from the beacon bodies. */
+  async function postedRounds(send: ReturnType<typeof vi.fn>): Promise<number[]> {
+    return Promise.all(send.mock.calls.map(async ([, blob]) => JSON.parse(await (blob as Blob).text()).common.round as number));
+  }
+
+  it("ends the round after home_clicked: it carries the old round, the next event the new one (taxonomy 3-1a)", async () => {
+    const send = vi.fn().mockReturnValue(true);
+    Object.defineProperty(navigator, "sendBeacon", { value: send, configurable: true });
+    track("book_opened", {});
+    track("home_clicked", { curious_count: 2, source: "end" });
+    track("entry_selected", {});
+    const [before, ending, after] = await postedRounds(send);
+    expect(ending).toBe(before);
+    expect(after).toBe(before + 1);
+  });
+
+  it("ends the round after redraw_clicked too — P4 only has to send E-19", async () => {
+    expect(ROUND_ENDING_EVENTS).toEqual(["redraw_clicked", "home_clicked"]);
+    const send = vi.fn().mockReturnValue(true);
+    Object.defineProperty(navigator, "sendBeacon", { value: send, configurable: true });
+    track("redraw_clicked", { curious_count: 0 });
+    track("bookmark_shown", { book_id: "9788998441012", position: 1, one_liner_style: "question", pick_type: "recommended", art: {} });
+    const [ending, next] = await postedRounds(send);
+    expect(next).toBe(ending + 1);
+  });
+
+  it("keeps the round for every other event — an edit and its new draw stay in the same round", async () => {
+    const send = vi.fn().mockReturnValue(true);
+    Object.defineProperty(navigator, "sendBeacon", { value: send, configurable: true });
+    track("goal_submitted", { topic: "통계", is_free_text: false, len: null, way: null, is_edit: true });
+    track("first_page_edited", { changed_items: ["len"] });
+    track("bookmark_reacted", { book_id: "1", position: 1, reaction: "pass", pick_type: "random", one_liner_style: "summary" });
+    expect(new Set(await postedRounds(send)).size).toBe(1);
+  });
+
   it("only compiles with the props the spec defines (taxonomy 7-3 ①)", () => {
     Object.defineProperty(navigator, "sendBeacon", { value: vi.fn().mockReturnValue(true), configurable: true });
     // @ts-expect-error — old event name (taxonomy 4-4)
```

`web/e2e/flow-target.spec.ts` — [처음으로] 뒤 같은 탭에서 🍃로 다시 시작:

```diff
--- a/web/e2e/flow-target.spec.ts
+++ b/web/e2e/flow-target.spec.ts
@@ -36,11 +36,14 @@ test("🎯 chips → book → first page → five bookmarks → curious list", a
   await expect(page.getByRole("listitem")).toHaveCount(3);
   if (testInfo.project.name === "laptop") expect((await page.locator(".column").boundingBox())?.width).toBe(430);  // back in the column
   await page.getByRole("button", { name: "처음으로" }).click();
-  await expect(page.getByRole("button", { name: /그냥 한 권 만나고 싶어요/ })).toBeVisible();
+  await page.getByRole("button", { name: /그냥 한 권 만나고 싶어요/ }).click();   // a new round in the same tab
+  await expect(page.getByRole("heading", { name: "책을 덮은 뒤, 남았으면 하는 건?" })).toBeVisible();
 
-  await expect.poll(() => named(events, "home_clicked").length).toBe(1);
+  await expect.poll(() => named(events, "entry_selected").length).toBe(2);
   expect(named(events, "site_visited")).toHaveLength(1);
-  expect(named(events, "entry_selected").map((e) => [e.props, e.common.entry])).toEqual([[{}, "target"]]);
+  // taxonomy 3-1a: home_clicked carries the round it ends, the restart is round 2
+  expect(named(events, "entry_selected").map((e) => [e.props, e.common.entry, e.common.round])).toEqual([[{}, "target", 1], [{}, "leaf", 2]]);
+  expect(named(events, "home_clicked")[0].common.round).toBe(1);
   expect(named(events, "chip_selected").map((e) => [e.props.chip_type, e.props.chip_value])).toEqual([["topic", "데이터 분석"], ["len", "thin"], ["way", "실습"]]);
   expect(named(events, "goal_submitted").map((e) => e.props)).toEqual([
     { topic: "데이터 분석", is_free_text: false, len: "thin", way: "실습", is_edit: false },
```

- [ ] **Step 2: 실패 확인**

Run: `cd web && npx vitest run src/lib/track/client.test.ts`
Expected: FAIL 2 — "ends the round after home_clicked"(`after`가 `before`와 같음), "ends the round after redraw_clicked too"(`ROUND_ENDING_EVENTS`가 없음). "keeps the round for every other event"는 이미 통과(회귀 방지용)

- [ ] **Step 3: 구현**

```diff
--- a/web/src/lib/track/schema.ts
+++ b/web/src/lib/track/schema.ts
@@ -98,6 +98,12 @@ type Sent<N extends EventName> = { [K in keyof Spec[N] as Spec[N][K] extends { o
 /** What a screen passes to track(name, props). Amplitude-only props are added by the Amplitude path, never by callers. */
 export type PropsOf<N extends EventName> = keyof Sent<N> extends never ? Record<string, never> : Sent<N>;
 
+/**
+ * taxonomy 3-1a: sending one of these ends the round (판) — the event itself carries the old round, the next event round + 1.
+ * home_clicked is live; redraw_clicked gets its [다시 뽑기] button in P4 and needs nothing more than its track() call.
+ */
+export const ROUND_ENDING_EVENTS = ["redraw_clicked", "home_clicked"] as const satisfies readonly EventName[];
+
 /** Own keys only: "constructor" or "__proto__" are not event names. */
 export function isEventName(x: unknown): x is EventName {
   return typeof x === "string" && Object.prototype.hasOwnProperty.call(EVENT_SPEC, x);
```

```diff
--- a/web/src/lib/track/client.ts
+++ b/web/src/lib/track/client.ts
@@ -1,6 +1,8 @@
 import { sendToAmplitude } from "./amplitude";
-import { commonProps } from "./common";
-import type { CommonProps, EventName, PropsOf } from "./schema";
+import { commonProps, nextRound } from "./common";
+import { ROUND_ENDING_EVENTS, type CommonProps, type EventName, type PropsOf } from "./schema";
+
+const ENDS_ROUND: ReadonlySet<EventName> = new Set(ROUND_ENDING_EVENTS);
 
 /** Supabase path (via /api/track). Unchanged; returns the common props it used so Amplitude gets the same ones. */
 function sendToSupabase(name: EventName, props: Record<string, unknown>): CommonProps | null {
@@ -17,7 +19,10 @@ function sendToSupabase(name: EventName, props: Record<string, unknown>): Common
   }
 }
 
-/** One call per event (taxonomy 2-7 SDK). `props` must match EVENT_SPEC[name]: tsc checks every call site. */
+/**
+ * One call per event (taxonomy 2-7 SDK). `props` must match EVENT_SPEC[name]: tsc checks every call site.
+ * After [다시 뽑기] / [처음으로] the round moves on, once both copies have the old one (taxonomy 3-1a).
+ */
 export function track<N extends EventName>(name: N, props: PropsOf<N>): void {
   const own = props as Record<string, unknown>;
   const common = sendToSupabase(name, own);
@@ -26,4 +31,5 @@ export function track<N extends EventName>(name: N, props: PropsOf<N>): void {
   } catch {
     // second destination: its failure never reaches the page or the first one
   }
+  if (ENDS_ROUND.has(name)) nextRound();
 }
```

- [ ] **Step 4: 통과 확인**

Run: `cd web && npm run typecheck && npm run lint && npx vitest run src/lib/track && npx playwright test e2e/flow-target.spec.ts e2e/flow-leaf.spec.ts`
Expected: 오류 0 / Vitest PASS(전체 **50파일 405개**) / E2E 14 passed — `entry_selected`가 `[{}, "target", 1]`, `[{}, "leaf", 2]`, `home_clicked.common.round`가 1, 🍃 새로고침 뒤 `site_visited`는 그대로 round 1

- [ ] **Step 5: Commit**

```bash
git add web/src/lib/track web/e2e/flow-target.spec.ts
git commit -m "feat(analytics): start a new round after home_clicked and redraw_clicked

The ending event carries the old round; track() moves the round on right
after both copies are sent (taxonomy 3-1a). Edits and reloads keep it.
P4's [다시 뽑기] only has to send redraw_clicked.

- [x] events: taxonomy.md · taxonomy.csv · schema.ts changed together (or no event change) — csv statuses follow in the sync-check commit

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 3: `/api/track`이 같은 명세로 props를 검사

**Files:**
- Create: `web/src/lib/track/props.ts`, `web/src/lib/track/props.test.ts`
- Modify: `web/src/app/api/track/route.ts`(전체 교체)
- Test: `web/src/app/api/track/route.test.ts`

**Interfaces:**
- Consumes: `EVENT_SPEC`·`PropSpec`·`EventName`·`cutText`(Task 1)
- Produces: `interface ParsedProps { props: Record<string, unknown>; dropped: string[] }` · `parseProps(name: EventName, raw: Record<string, unknown>): ParsedProps` — 명세 키(own key)만, `only: "amplitude"`는 버림, 타입·열거형·null·배열(20개 이하, null 원소 없음)·유한수 검사, 문자열은 `max`(없으면 200)로 자름. 라우트 동작: **모르는 이벤트 이름은 지금처럼 400**, props가 객체가 아니면 400, 그 밖에는 **이벤트를 저장**하고 맞지 않는 키만 버림 + `console.warn("track: dropped props", JSON.stringify({ name, keys }))`(키 이름 최대 10개·40자, 값은 쓰지 않음). 기존 순서(같은 출처 → 한도 → 크기 → 정리·깊이 → common)는 그대로

- [ ] **Step 1: 실패하는 테스트 — `parseProps`**

`web/src/lib/track/props.test.ts`:

```ts
// @vitest-environment node
import { describe, expect, it } from "vitest";
import { parseProps } from "./props";

const reacted = { book_id: "9788998441012", position: 2, reaction: "curious", pick_type: "random", one_liner_style: "question" };

describe("parseProps (server check against EVENT_SPEC)", () => {
  it("keeps every prop the spec defines, unchanged", () => {
    expect(parseProps("bookmark_reacted", reacted)).toEqual({ props: reacted, dropped: [] });
    expect(parseProps("entry_selected", {})).toEqual({ props: {}, dropped: [] });
    const chip = { chip_type: "len", chip_value: "thin", is_edit: true };
    expect(parseProps("chip_selected", chip)).toEqual({ props: chip, dropped: [] });
  });

  it("drops unknown keys, old names and inherited object keys, and lists them", () => {
    const raw = JSON.parse('{"kind":"random","index":2,"constructor":1,"__proto__":{"polluted":true},"toString":"x"}');
    const { props, dropped } = parseProps("bookmark_reacted", { ...reacted, ...raw });
    expect(props).toEqual(reacted);
    expect(Object.getPrototypeOf(props)).toBe(Object.prototype);
    expect(dropped.sort()).toEqual(["__proto__", "constructor", "index", "kind", "toString"]);
  });

  it("drops an Amplitude-only prop: prompt_version never reaches Supabase", () => {
    expect(parseProps("site_visited", { prompt_version: "BA400.4" })).toEqual({ props: {}, dropped: ["prompt_version"] });
  });

  it.each([
    ["a value outside the enum", "bookmark_reacted", { reaction: "love" }],
    ["a number sent as a string", "bookmark_reacted", { position: "2" }],
    ["a non-finite number", "balance_answered", { elapsed_ms: Number.POSITIVE_INFINITY }],
    ["a boolean sent as a string", "chip_selected", { is_edit: "false" }],
    ["null where the spec has no null", "goal_submitted", { topic: null }],
    ["a string that is not an enum value", "goal_submitted", { len: 1 }],
    ["an array for an object", "bookmark_shown", { art: ["fox"] }],
    ["null for an object", "bookmark_shown", { art: null }],
    ["a string for a list", "first_page_edited", { changed_items: "len" }],
    ["a list with a number in it", "free_goal_written", { keywords: ["SQL", 1] }],
    ["a list with null in it", "first_page_edited", { changed_items: ["len", null] }],
    ["a list longer than 20", "free_goal_written", { keywords: Array.from({ length: 21 }, () => "SQL") }],
  ])("drops %s", (_, name, raw) => {
    const { props, dropped } = parseProps(name as Parameters<typeof parseProps>[0], raw);
    expect(props).toEqual({});
    expect(dropped).toEqual(Object.keys(raw));
  });

  it("accepts null where the spec allows it: enum with null, nullable string", () => {
    expect(parseProps("balance_answered", { side: null }).props).toEqual({ side: null });
    expect(parseProps("chip_selected", { chip_value: null }).props).toEqual({ chip_value: null });
    expect(parseProps("yes24_link_clicked", { pick_type: null }).props).toEqual({ pick_type: null });
  });

  it("cuts goal_text to its 30 characters and other free strings to 200", () => {
    const { props } = parseProps("free_goal_written", { goal_text: "가".repeat(40), topic: "x".repeat(300), keywords: ["y".repeat(300)] });
    expect(props).toEqual({ goal_text: "가".repeat(30), topic: "x".repeat(200), keywords: ["y".repeat(200)] });
  });

  it("keeps an object prop as sent (art is a fixed small shape, the body is already size-capped)", () => {
    const art = { animal: "fox", bg: "peach", sky: "moon", ground: "grass", rare: false };
    expect(parseProps("bookmark_shown", { art }).props).toEqual({ art });
  });
});
```

- [ ] **Step 2: 실패하는 테스트 — 라우트**

`web/src/app/api/track/route.test.ts` (기존 정리 테스트는 명세에 있는 `free_goal_written`으로 옮겨 같은 것을 확인, `__proto__`는 이제 버려짐):

```diff
--- a/web/src/app/api/track/route.test.ts
+++ b/web/src/app/api/track/route.test.ts
@@ -8,6 +8,8 @@ import { POST } from "./route";
 const common = { anon_id: "a", user_id: null, session_id: "s", round: 1, entry: null, screen_version: "v1",
   referrer: "", is_returning: false, device: "phone", is_in_app_browser: false };
 const ORIGIN = "http://x";
+/** The route flags dropped props on the server log; keep the test output quiet and read the calls instead. */
+const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
 const from = (ip: string) => ({ origin: ORIGIN, "x-forwarded-for": ip });
 const req = (body: unknown, headers: Record<string, string> = from("9.9.9.9")) =>
   new Request("http://x/api/track", { method: "POST", body: JSON.stringify(body), headers });
@@ -112,22 +114,52 @@ describe("POST /api/track", () => {
 
   it("keeps the event and strips NUL and lone surrogates that Postgres jsonb would refuse", async () => {
     const dirty = { ...common, referrer: "a\u0000b\ud800c" };
-    const res = await POST(req({ name: "site_visited", props: { goal: "책\u0000 \udc00읽기", "\u0000k": 1, nested: [{ t: "x\ud83d" }], ok: "😀" }, common: dirty }));
+    const props = { goal_text: "책\u0000 \udc00읽기", topic: "😀", keywords: ["x\ud83d"], is_matched: true, method: "word", "\u0000k": 1 };
+    const res = await POST(req({ name: "free_goal_written", props, common: dirty }));
     expect(res.status).toBe(202);
     expect(saveEvent).toHaveBeenCalledWith({
-      name: "site_visited",
-      props: { goal: "책 \ufffd읽기", k: 1, nested: [{ t: "x\ufffd" }], ok: "😀" },
+      name: "free_goal_written",
+      props: { goal_text: "책 \ufffd읽기", topic: "😀", keywords: ["x\ufffd"], is_matched: true, method: "word" },
       common: { ...common, referrer: "ab\ufffdc" },
     });
   });
 
+  it("stores only the props EVENT_SPEC defines and flags the dropped ones by name, never by value", async () => {
+    const props = { book_id: "9788998441012", index: 2, position: "2", reaction: "curious", kind: "random", pick_type: "random",
+      one_liner_style: "question", secret: "개인 정보" };
+    expect((await POST(req({ name: "bookmark_reacted", props, common }))).status).toBe(202);
+    expect(saveEvent).toHaveBeenCalledWith({
+      name: "bookmark_reacted",
+      props: { book_id: "9788998441012", reaction: "curious", pick_type: "random", one_liner_style: "question" },
+      common,
+    });
+    expect(warn).toHaveBeenCalledTimes(1);
+    expect(warn.mock.calls[0]).toEqual(["track: dropped props", JSON.stringify({ name: "bookmark_reacted", keys: ["index", "position", "kind", "secret"] })]);
+    expect(JSON.stringify(warn.mock.calls)).not.toContain("개인 정보");
+  });
+
+  it("keeps the goal text to 30 characters and logs nothing when every prop matches", async () => {
+    const props = { goal_text: "가".repeat(45), topic: "데이터 분석", keywords: [], is_matched: false, method: "word" };
+    expect((await POST(req({ name: "free_goal_written", props, common }))).status).toBe(202);
+    expect(vi.mocked(saveEvent).mock.calls[0][0].props.goal_text).toBe("가".repeat(30));
+    expect(warn).not.toHaveBeenCalled();
+  });
+
+  it("flags at most 10 dropped keys, each cut to 40 characters", async () => {
+    const props = Object.fromEntries(Array.from({ length: 15 }, (_, i) => [`${i}`.padEnd(60, "k"), 1]));
+    expect((await POST(req({ name: "book_opened", props, common }))).status).toBe(202);
+    const logged = JSON.parse(warn.mock.calls[0][1] as string) as { keys: string[] };
+    expect(logged.keys).toHaveLength(10);
+    expect(logged.keys.every((k) => k.length === 40)).toBe(true);
+  });
+
   it("does not let a __proto__ key in props change the stored object's prototype", async () => {
     const res = await POST(new Request("http://x/api/track", { method: "POST", headers: from("9.9.9.9"),
       body: '{"name":"site_visited","props":{"__proto__":{"polluted":true}},"common":' + JSON.stringify(common) + "}" }));
     expect(res.status).toBe(202);
     const props = vi.mocked(saveEvent).mock.calls[0][0].props;
     expect(Object.getPrototypeOf(props)).toBe(Object.prototype);
-    expect(Object.keys(props)).toEqual(["__proto__"]);
+    expect(Object.keys(props)).toEqual([]);              // not in the spec: dropped
   });
 
   it("answers 400, not 500, when the client aborts mid-body", async () => {
```

- [ ] **Step 3: 실패 확인**

Run: `cd web && npx vitest run src/lib/track/props.test.ts src/app/api/track`
Expected: FAIL — `./props` 모듈 없음 / 라우트 5개(정리·버린 키 로그·30자·10개 상한·`__proto__`)

- [ ] **Step 4: 구현**

`web/src/lib/track/props.ts`:

```ts
import { cutText, EVENT_SPEC, type EventName, type PropSpec } from "./schema";

/** Longest free string kept when the spec sets no `max` (book ids, topic and keyword keys are far shorter). */
const MAX_TEXT = 200;
/** Longest list kept (keywords are at most 5, changed_items at most 9). */
const MAX_ITEMS = 20;
const INVALID = Symbol("invalid");

/** Own keys only, so "constructor" or "__proto__" never match a spec entry. */
function specOf(name: EventName, key: string): PropSpec | null {
  const props: Readonly<Record<string, PropSpec>> = EVENT_SPEC[name];
  return Object.prototype.hasOwnProperty.call(props, key) ? props[key] : null;
}

function acceptsNull(spec: PropSpec): boolean {
  return typeof spec.type === "string" ? spec.nullable === true : spec.type.includes(null);
}

function cleanOne(spec: PropSpec, v: unknown): unknown {
  if (v === null) return acceptsNull(spec) ? null : INVALID;
  const t = spec.type;
  if (typeof t !== "string") return typeof v === "string" && t.includes(v) ? v : INVALID;
  if (t === "string") return typeof v === "string" ? cutText(v, spec.max ?? MAX_TEXT) : INVALID;
  if (t === "number") return typeof v === "number" && Number.isFinite(v) ? v : INVALID;
  if (t === "boolean") return typeof v === "boolean" ? v : INVALID;
  return typeof v === "object" && !Array.isArray(v) ? v : INVALID;   // "object" (art)
}

function clean(spec: PropSpec, v: unknown): unknown {
  if (!spec.array) return cleanOne(spec, v);
  if (!Array.isArray(v) || v.length > MAX_ITEMS) return INVALID;
  const items = v.map((item) => (item === null ? INVALID : cleanOne(spec, item)));
  return items.includes(INVALID) ? INVALID : items;
}

export interface ParsedProps {
  props: Record<string, unknown>;
  /** Keys that were not stored: unknown to the spec, Amplitude only, or the wrong type / value. */
  dropped: string[];
}

/**
 * Server check of an event's own props against EVENT_SPEC (taxonomy 7-3 ①: "모르는 속성 버리기").
 * The event is kept; only the keys that do not match are dropped and listed so the route can flag them.
 */
export function parseProps(name: EventName, raw: Record<string, unknown>): ParsedProps {
  const kept: [string, unknown][] = [];
  const dropped: string[] = [];
  for (const [key, value] of Object.entries(raw)) {
    const spec = specOf(name, key);
    const cleaned = spec && spec.only !== "amplitude" ? clean(spec, value) : INVALID;
    if (cleaned === INVALID) dropped.push(key);
    else kept.push([key, cleaned]);
  }
  return { props: Object.fromEntries(kept), dropped };
}
```

`web/src/app/api/track/route.ts` 전체:

```ts
import { guardJson } from "@/lib/server/guard";
import { cleanJson, TooDeepError } from "@/lib/server/sanitize";
import { parseProps } from "@/lib/track/props";
import { cutText, isEventName, parseCommon } from "@/lib/track/schema";
import { saveEvent } from "@/lib/track/store";

const MAX_BYTES = 8_000;
const PER_MINUTE = 120;
/** A flagged event names at most this many dropped keys, each cut short: the log line stays small whatever the body held. */
const MAX_LOGGED_KEYS = 10;
const MAX_LOGGED_KEY = 40;

export async function POST(request: Request): Promise<Response> {
  const guarded = await guardJson(request, { route: "track", limit: PER_MINUTE, maxBytes: MAX_BYTES });
  if (!guarded.ok) return guarded.response;
  let body: unknown;
  try {
    body = cleanJson(guarded.body);
  } catch (err) {
    if (err instanceof TooDeepError) return Response.json({ error: "invalid event" }, { status: 400 });
    throw err;
  }
  if (typeof body !== "object" || body === null || Array.isArray(body)) {
    return Response.json({ error: "invalid event" }, { status: 400 });
  }
  const b = body as { name?: unknown; props?: unknown; common?: unknown };
  const common = parseCommon(b.common);
  if (!isEventName(b.name) || !common) return Response.json({ error: "invalid event" }, { status: 400 });
  if (b.props !== undefined && (typeof b.props !== "object" || b.props === null || Array.isArray(b.props))) {
    return Response.json({ error: "invalid event" }, { status: 400 });
  }
  // taxonomy 7-3 ①: keep the event, store only the props EVENT_SPEC defines, flag the rest by name (never by value).
  const { props, dropped } = parseProps(b.name, (b.props ?? {}) as Record<string, unknown>);
  if (dropped.length > 0) {
    const keys = dropped.slice(0, MAX_LOGGED_KEYS).map((k) => cutText(k, MAX_LOGGED_KEY));
    console.warn("track: dropped props", JSON.stringify({ name: b.name, keys }));
  }
  try {
    const stored = await saveEvent({ name: b.name, props, common: { ...common } });
    return Response.json({ stored }, { status: 202 });
  } catch (err) {
    console.error("track failed", (err as Error).message);
    return Response.json({ error: "store failed" }, { status: 500 });
  }
}
```

- [ ] **Step 5: 통과 확인**

Run: `cd web && npm run typecheck && npm run lint && npx vitest run --coverage --coverage.include=src/lib/track/props.ts src/lib/track src/app/api/track`
Expected: 오류 0 / PASS, `props.ts` **100%**(문장·분기·함수·줄). 전체 Vitest **51파일 426개**

- [ ] **Step 6: Commit**

```bash
git add web/src/lib/track/props.ts web/src/lib/track/props.test.ts web/src/app/api/track
git commit -m "feat(api): check event props against EVENT_SPEC in /api/track

Unknown, Amplitude-only or ill-typed props are dropped and the event is
kept; the dropped key names (never values) go to the server log. Free
strings are capped (goal_text at 30).

- [x] events: taxonomy.md · taxonomy.csv · schema.ts changed together (or no event change) — no event change

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 4: `goal_text`는 Supabase에만 — Amplitude 사본·화면 녹화·`/privacy` (2-7, 6-2, 6-3)

**Files:**
- Modify: `web/src/lib/track/props.ts`, `web/src/lib/track/amplitude.ts`, `web/src/components/flow/FirstPage.tsx`, `web/src/app/privacy/page.tsx`, `web/src/lib/privacy.ts`
- Create: `web/src/components/flow/FirstPage.test.tsx`
- Test: `web/src/lib/track/props.test.ts`, `web/src/lib/track/amplitude.test.ts`, `web/src/app/privacy/page.test.tsx`

**Interfaces:**
- Consumes: `specOf`(`props.ts` 안), `EVENT_SPEC.free_goal_written.goal_text.only === "supabase"`(Task 1)
- Produces: `forAmplitude(name: EventName, props: Record<string, unknown>): Record<string, unknown>` — 새 객체, Supabase 사본은 그대로. **속성 단위 규칙은 명세에서만 온다** — `amplitude.ts`에 `goal_text`라는 글자가 없다. `FirstPage`의 뿌리 `div`에 `data-amp-mask`(직접 쓴 글이 있을 때만 — Session Replay의 `getMaskTextSelectors`가 `[data-amp-mask]`를 가림, 설치된 `@amplitude/session-replay-dom-privacy`에서 확인). `UPDATED = "2026-10-01"`

- [ ] **Step 1: 실패하는 테스트**

```diff
--- a/web/src/lib/track/props.test.ts
+++ b/web/src/lib/track/props.test.ts
@@ -1,6 +1,6 @@
 // @vitest-environment node
 import { describe, expect, it } from "vitest";
-import { parseProps } from "./props";
+import { forAmplitude, parseProps } from "./props";
 
 const reacted = { book_id: "9788998441012", position: 2, reaction: "curious", pick_type: "random", one_liner_style: "question" };
 
@@ -59,3 +59,16 @@ describe("parseProps (server check against EVENT_SPEC)", () => {
     expect(parseProps("bookmark_shown", { art }).props).toEqual({ art });
   });
 });
+
+describe("forAmplitude (taxonomy 2-7: Supabase-only props stay out of the Amplitude copy)", () => {
+  it("leaves out goal_text and keeps topic, keywords, is_matched and method", () => {
+    const written = { goal_text: "SQL 공부", topic: "데이터 분석", keywords: ["SQL"], is_matched: true, method: "word" };
+    expect(forAmplitude("free_goal_written", written)).toEqual({ topic: "데이터 분석", keywords: ["SQL"], is_matched: true, method: "word" });
+    expect(written.goal_text).toBe("SQL 공부");   // the Supabase copy is a different object, untouched
+  });
+
+  it("passes every other event's props through", () => {
+    expect(forAmplitude("bookmark_reacted", reacted)).toEqual(reacted);
+    expect(forAmplitude("site_visited", {})).toEqual({});
+  });
+});
```

```diff
--- a/web/src/lib/track/amplitude.test.ts
+++ b/web/src/lib/track/amplitude.test.ts
@@ -224,6 +224,15 @@ describe("sendToAmplitude", () => {
     });
   });
 
+  it("sends free_goal_written without goal_text — the written words stay in Supabase (taxonomy 2-7, 6-2)", async () => {
+    const send = await started();
+    const written = { goal_text: "SQL 공부", topic: "데이터 분석", keywords: ["SQL"], is_matched: true, method: "word" };
+    send("free_goal_written", written, common);
+    expect(sdk.track.mock.calls[0][1]).not.toHaveProperty("goal_text");
+    expect(sdk.track.mock.calls[0][1]).toMatchObject({ topic: "데이터 분석", keywords: ["SQL"], is_matched: true, method: "word" });
+    expect(JSON.stringify(sdk.track.mock.calls)).not.toContain("SQL 공부");
+  });
+
   it("keeps the event's own props when a name collides with a common prop", async () => {
     const send = await started();
     send("entry_selected", { entry: "target" }, { ...common, entry: null });
```

`web/src/components/flow/FirstPage.test.tsx`:

```tsx
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { EMPTY_FORM } from "@/lib/flow/target";
import { FirstPage } from "./FirstPage";

const goal = { text: "SQL 공부", topic: "데이터 분석" as const, keywords: ["SQL"], matched: true, method: "word" as const };

describe("FirstPage (S-04) and Session Replay", () => {
  it("masks the page in replays when it shows a written goal (taxonomy 6-2: goal_text never reaches Amplitude)", () => {
    const { container } = render(<FirstPage entry="target" choices={[]} form={{ ...EMPTY_FORM, free: "SQL 공부" }} goal={goal} notices={[]} />);
    expect(screen.getByText("“SQL 공부”")).toBeInTheDocument();
    expect(container.firstElementChild).toHaveAttribute("data-amp-mask");
  });

  it("leaves chosen chips visible in replays (they are our own words)", () => {
    const { container } = render(<FirstPage entry="target" choices={[]} form={{ ...EMPTY_FORM, topic: "통계" }} goal={null} notices={[]} />);
    expect(container.firstElementChild).not.toHaveAttribute("data-amp-mask");
  });
});
```

`web/src/app/privacy/page.test.tsx` — 6-3 표의 문장 그대로:

```diff
--- a/web/src/app/privacy/page.test.tsx
+++ b/web/src/app/privacy/page.test.tsx
@@ -10,7 +10,7 @@ describe("/privacy (S-10)", () => {
   it("shows the title, the date and the six collected items", () => {
     render(<PrivacyPage />);
     expect(screen.getByRole("heading", { level: 1, name: "개인정보 처리방침" })).toBeInTheDocument();
-    expect(screen.getByText(/2026-09-30/)).toBeInTheDocument();
+    expect(screen.getByText(/2026-10-01/)).toBeInTheDocument();
     expect(screen.getByText("갈피는 이름·이메일·전화번호를 받지 않아요.")).toBeInTheDocument();
     const rows = within(screen.getByRole("table")).getAllByRole("row");
     expect(rows).toHaveLength(7); // header + 6
@@ -18,7 +18,8 @@ describe("/privacy (S-10)", () => {
     expect(screen.getByRole("columnheader", { name: "왜" })).toBeInTheDocument();
     expect(screen.getByText("누른 버튼과 누른 시각, 고른 입구(🎯/🍃), 본 책갈피, 궁금해요/패스, 밸런스 게임 답과 답하는 데 걸린 시간, 고친 답, 몇 번째 뽑기인지")).toBeInTheDocument();
     expect(screen.getByText("기기 종류(휴대폰/컴퓨터), 앱 안 브라우저 여부, 들어온 곳(이전 페이지 주소), 화면 버전")).toBeInTheDocument();
-    expect(screen.getByText(/\(최대 30자\) — 그 글에서 찾은 주제·키워드도 함께/)).toBeInTheDocument();
+    expect(screen.getByRole("cell", { name: /직접 쓰기/ }))
+      .toHaveTextContent("🎯 \"직접 쓰기\"에 적은 글 (최대 30자, 갈피의 데이터베이스에만 저장) — 그 글에서 찾은 주제·키워드는 Amplitude에도 함께 보내요");
     expect(screen.getByText("같은 사람이 다시 왔는지 세기 위해")).toBeInTheDocument();
     expect(screen.getByText("추천이 잘 맞는지 분석하기 위해")).toBeInTheDocument();
     expect(screen.getByText("화면이 잘 동작하는지 확인하기 위해")).toBeInTheDocument();
@@ -50,6 +51,14 @@ describe("/privacy (S-10)", () => {
     expect(screen.getByText(/새로 전달하는 곳이 생기면 이 페이지에 먼저 적어요/)).toBeInTheDocument();
   });
 
+  it("says the written goal stays in Galpi's database and is not sent to Amplitude (taxonomy 6-3)", () => {
+    render(<PrivacyPage />);
+    const onlyHere = screen.getByText("다만 🎯 \"직접 쓰기\"에 적은 글은 Amplitude에 보내지 않고, 갈피의 데이터베이스(Supabase)에만 저장해요.");
+    expect(onlyHere.tagName).toBe("STRONG");
+    expect(onlyHere.closest("section")).toHaveTextContent(/위 기록은 분석 서비스 Amplitude\(서버는 미국에 있어요\)에도 보내요\. 다만/);
+    expect(screen.getByText("갈피의 데이터베이스에만 저장").tagName).toBe("STRONG");
+  });
+
   it("says Amplitude records are deleted together with the rest on request", () => {
     render(<PrivacyPage />);
     expect(screen.getByText(/그 번호의 기록을 모두 지워요. Amplitude에 전달된 기록도 함께 지워요/)).toBeInTheDocument();
```

- [ ] **Step 2: 실패 확인**

Run: `cd web && npx vitest run src/lib/track src/components/flow/FirstPage.test.tsx src/app/privacy`
Expected: FAIL — `forAmplitude` export 없음(2), Amplitude 사본에 `goal_text`가 있음(1), 첫 장에 `data-amp-mask` 없음(1), `/privacy` 갱신일·두 문장(2)

- [ ] **Step 3: 구현**

`props.ts` 끝에 `forAmplitude`, `amplitude.ts`가 그것을 씀:

```diff
--- a/web/src/lib/track/props.ts
+++ b/web/src/lib/track/props.ts
@@ -54,3 +54,8 @@ export function parseProps(name: EventName, raw: Record<string, unknown>): Parse
   }
   return { props: Object.fromEntries(kept), dropped };
 }
+
+/** The Amplitude copy of an event's own props: without the Supabase-only ones (taxonomy 2-7 — goal_text). A new object. */
+export function forAmplitude(name: EventName, props: Record<string, unknown>): Record<string, unknown> {
+  return Object.fromEntries(Object.entries(props).filter(([key]) => specOf(name, key)?.only !== "supabase"));
+}
```

```diff
--- a/web/src/lib/track/amplitude.ts
+++ b/web/src/lib/track/amplitude.ts
@@ -1,4 +1,5 @@
 import { ensureAnonId } from "./common";
+import { forAmplitude } from "./props";
 import type { CommonProps, EventName } from "./schema";
 
 type Sdk = typeof import("@amplitude/unified");
@@ -76,7 +77,7 @@ export function startAmplitude(): void {
   whenIdle(() => void load(key));
 }
 
-/** Same event name and props as the Supabase path, plus the common props the analysis needs. Never throws. */
+/** Same event name and props as the Supabase path minus Supabase-only ones, plus the common props the analysis needs. Never throws. */
 export function sendToAmplitude(name: EventName, props: Record<string, unknown>, common: CommonProps | null): void {
   if (!started || failed) return;
   try {
@@ -88,7 +89,7 @@ export function sendToAmplitude(name: EventName, props: Record<string, unknown>,
       is_in_app_browser: common.is_in_app_browser,
       is_returning: common.is_returning,
     };
-    const event: Waiting = [name, { ...shared, ...props, ...(name === "site_visited" ? { prompt_version: PROMPT_VERSION } : {}) }];
+    const event: Waiting = [name, { ...shared, ...forAmplitude(name, props), ...(name === "site_visited" ? { prompt_version: PROMPT_VERSION } : {}) }];
     if (sdk) give(sdk, event);
     else if (waiting.length < MAX_WAITING) waiting.push(event);
   } catch {
```

`FirstPage.tsx`:

```diff
--- a/web/src/components/flow/FirstPage.tsx
+++ b/web/src/components/flow/FirstPage.tsx
@@ -26,10 +26,13 @@ export function FirstPageTitle({ entry }: { entry: Entry }) {
   );
 }
 
-/** S-04 right page (C-10) + honest notes (C-14). 🍃 shows the taste from the raw answers — never a type name. */
+/**
+ * S-04 right page (C-10) + honest notes (C-14). 🍃 shows the taste from the raw answers — never a type name.
+ * A written goal (and a notice quoting it) is masked in Session Replay: the words stay in Supabase only (taxonomy 6-2).
+ */
 export function FirstPage({ entry, choices, form, goal, notices }: Props) {
   return (
-    <div className={styles.page}>
+    <div className={styles.page} data-amp-mask={goal ? true : undefined}>
       {entry === "leaf" ? (
         <ul className={styles.rows}>
           {tasteLines(choices).map((line) => (
```

`/privacy` — 6-3 #1(필수)·#2(권장) 두 문장 그대로, 새 문장은 `<strong>`(굵게 표시된 부분):

```diff
--- a/web/src/app/privacy/page.tsx
+++ b/web/src/app/privacy/page.tsx
@@ -44,7 +44,7 @@ export default function PrivacyPage() {
             <td>화면이 잘 동작하는지 확인하기 위해</td>
           </tr>
           <tr>
-            <td>🎯 {"\"직접 쓰기\""}에 적은 글 (최대 30자) — 그 글에서 찾은 주제·키워드도 함께</td>
+            <td>🎯 {"\"직접 쓰기\""}에 적은 글 (최대 30자, <strong>갈피의 데이터베이스에만 저장</strong>) — 그 글에서 찾은 주제·키워드는 Amplitude에도 함께 보내요</td>
             <td>사람들이 찾는 주제를 알고 책을 늘리기 위해 — <strong>이름·연락처는 적지 마세요</strong></td>
           </tr>
           <tr>
@@ -72,7 +72,9 @@ export default function PrivacyPage() {
       <section className={styles.section}>
         <h2 className={styles.h2}>기록을 전달하는 곳</h2>
         <p>
-          위 기록은 분석 서비스 Amplitude(서버는 미국에 있어요)에도 보내요. Amplitude는 브라우저의 쿠키와 저장 공간에 식별 값을 남겨요.
+          위 기록은 분석 서비스 Amplitude(서버는 미국에 있어요)에도 보내요.{" "}
+          <strong>다만 🎯 {"\"직접 쓰기\""}에 적은 글은 Amplitude에 보내지 않고, 갈피의 데이터베이스(Supabase)에만 저장해요.</strong>{" "}
+          Amplitude는 브라우저의 쿠키와 저장 공간에 식별 값을 남겨요.
           이 밖의 곳에는 주지 않아요. 새로 전달하는 곳이 생기면 이 페이지에 먼저 적어요.
         </p>
       </section>
```

```diff
--- a/web/src/lib/privacy.ts
+++ b/web/src/lib/privacy.ts
@@ -1,3 +1,3 @@
 /** Shared constants for the privacy page (S-10 v0). Kept out of the route file, which exports only page conventions. */
-export const UPDATED = "2026-09-30";
+export const UPDATED = "2026-10-01";
 export const CONTACT_PENDING = "문의 이메일은 곧 적어 둘게요";
```

- [ ] **Step 4: 통과 확인**

Run: `cd web && npm run typecheck && npm run lint && npx vitest run && npx playwright test e2e/privacy.spec.ts`
Expected: 오류 0 / Vitest **52파일 432개** PASS / E2E privacy 8 passed(표는 여전히 7줄)

- [ ] **Step 5: Commit**

```bash
git add web/src
git commit -m "feat(privacy): keep the written goal in Supabase only

The Amplitude copy drops props marked only: \"supabase\" in EVENT_SPEC
(goal_text), the first page that shows a written goal is masked in Session
Replay, and /privacy says so (taxonomy 6-3, updated 2026-10-01).

- [x] events: taxonomy.md · taxonomy.csv · schema.ts changed together (or no event change) — no event change

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 5: Amplitude 대기열 — 시작 전 이벤트도 받고, 원래 시각으로 (2-7 a·b)

**Files:**
- Modify: `web/src/lib/track/amplitude.ts`, `web/src/components/AmplitudeInit.tsx`(주석)
- Test: `web/src/lib/track/amplitude.test.ts`

**Interfaces:**
- Consumes: `forAmplitude`(Task 4), SDK `track(eventInput, eventProperties?, eventOptions?: EventOptions)` — `EventOptions.time?: number`(ms)
- Produces: `sendToAmplitude`는 **키가 있으면** `startAmplitude` 전에도 대기열(최대 50)에 넣는다 — 키가 없으면 아무것도 쌓지 않는다. 대기열 항목은 `[name, props, { time }]`이고 `time`은 `sendToAmplitude`가 불린 순간의 `Date.now()`, SDK가 오면 `sdk.track(name, props, { time })`. 실패(`failed`) 뒤에는 버림(그대로). Supabase 경로는 영향 없음

- [ ] **Step 1: 실패하는 테스트**

`amplitude.test.ts` — "/privacy처럼 시작 전이면 버린다" 테스트를 "시작 전이면 받아 두었다가 넘긴다"로 바꾸고, `time` 테스트와 "키 없으면 남지 않는다" 테스트를 `sendToAmplitude` describe 안에 둔다(앞쪽 describe에서 SDK 목을 먼저 부르면 "한가할 때까지 SDK를 안 부른다" 테스트의 `sdk.loaded`가 어긋난다). 기존 두 단언에 세 번째 인자 `{ time }`:

```diff
--- a/web/src/lib/track/amplitude.test.ts
+++ b/web/src/lib/track/amplitude.test.ts
@@ -207,13 +207,41 @@ describe("sendToAmplitude", () => {
     return m.sendToAmplitude;
   }
 
-  it("drops events while Amplitude has not been started (for example on /privacy)", async () => {
-    const { sendToAmplitude } = await load();
-    sendToAmplitude("entry_selected", { entry: "leaf" }, common);
+  it("queues events sent before startAmplitude (AmplitudeInit mounted late) and delivers them once it starts (taxonomy 2-7 a)", async () => {
+    const { startAmplitude, sendToAmplitude } = await load();
+    sendToAmplitude("site_visited", {}, common);
+    sendToAmplitude("entry_selected", {}, common);
+    await pause();
+    expect(sdk.loaded).toBe(0);
+    startAmplitude();
+    await vi.waitFor(() => expect(sdk.track).toHaveBeenCalledTimes(2));
+    expect(sdk.track.mock.calls.map((c) => c[0])).toEqual(["site_visited", "entry_selected"]);
+  });
+
+  it("keeps nothing waiting without a key: those events are never delivered", async () => {
+    vi.stubEnv(KEY_NAME, "");
+    vi.spyOn(console, "warn").mockImplementation(() => {});
+    const { startAmplitude, sendToAmplitude } = await load();
+    sendToAmplitude("site_visited", {}, common);
+    vi.stubEnv(KEY_NAME, FAKE_KEY);   // only to look inside the queue — a real page never gains a key after its build
+    startAmplitude();
+    await ready();
     await pause();
     expect(sdk.track).not.toHaveBeenCalled();
   });
 
+  it("gives a queued event the time it happened, not the time it left the queue (taxonomy 2-7 b)", async () => {
+    const now = vi.spyOn(Date, "now").mockReturnValue(1_000);
+    const { startAmplitude, sendToAmplitude } = await load();
+    sendToAmplitude("site_visited", {}, common);
+    now.mockReturnValue(5_000);
+    startAmplitude();
+    await vi.waitFor(() => expect(sdk.track).toHaveBeenCalledTimes(1));
+    expect(sdk.track.mock.calls[0][2]).toEqual({ time: 1_000 });
+    sendToAmplitude("book_opened", {}, common);
+    expect(sdk.track.mock.calls[1][2]).toEqual({ time: 5_000 });
+  });
+
   it("sends the same event name and props plus the analysis-relevant common props", async () => {
     const send = await started();
     send("chip_selected", { chip_type: "topic", chip_value: "데이터 분석", is_edit: false }, common);
@@ -221,7 +249,7 @@ describe("sendToAmplitude", () => {
     expect(sdk.track).toHaveBeenCalledWith("chip_selected", {
       entry: "leaf", round: 2, screen_version: "v1", device: "phone", is_in_app_browser: false, is_returning: true,
       chip_type: "topic", chip_value: "데이터 분석", is_edit: false,
-    });
+    }, { time: expect.any(Number) });
   });
 
   it("sends free_goal_written without goal_text — the written words stay in Supabase (taxonomy 2-7, 6-2)", async () => {
@@ -256,7 +284,7 @@ describe("sendToAmplitude", () => {
   it("sends props alone when common props are unavailable", async () => {
     const send = await started();
     send("book_opened", { a: 1 }, null);
-    expect(sdk.track).toHaveBeenCalledWith("book_opened", { a: 1 });
+    expect(sdk.track).toHaveBeenCalledWith("book_opened", { a: 1 }, { time: expect.any(Number) });
   });
 
   it("never throws when Amplitude's track throws", async () => {
```

- [ ] **Step 2: 실패 확인**

Run: `cd web && npx vitest run src/lib/track/amplitude.test.ts`
Expected: FAIL 4 — 시작 전 대기열(전달 0번), `time`(세 번째 인자 없음), 세 번째 인자 단언 2개. "키 없이 보낸 이벤트는 넘기지 않는다"는 지금도 통과(새 대기열이 키 없이 쌓지 않게 지키는 테스트)

- [ ] **Step 3: 구현**

```diff
--- a/web/src/lib/track/amplitude.ts
+++ b/web/src/lib/track/amplitude.ts
@@ -3,7 +3,8 @@ import { forAmplitude } from "./props";
 import type { CommonProps, EventName } from "./schema";
 
 type Sdk = typeof import("@amplitude/unified");
-type Waiting = readonly [EventName, Record<string, unknown>];
+/** Name, props, and when it happened (ms) — a queued event keeps its own time (taxonomy 2-7 b). */
+type Waiting = readonly [EventName, Record<string, unknown>, { time: number }];
 
 const KEY_MISSING = "Amplitude API key missing — analytics disabled";
 /** Instructor's install check (wizard step 6): `site_visited` carries this (EVENT_SPEC: prompt_version, Amplitude only). */
@@ -12,7 +13,10 @@ const REPLAY_SAMPLE_RATE = 0.2;
 /** The SDK is ~120 KB gzip: load it when the browser is idle, and no later than this after the page asked for it. */
 const IDLE_TIMEOUT_MS = 2000;
 const NO_IDLE_API_DELAY_MS = 2000; // Safari has no requestIdleCallback
-/** Events that happen before the SDK has arrived wait here (bounded; the Supabase copy is never affected). */
+/**
+ * Events that happen before the SDK has arrived — even before startAmplitude ran (taxonomy 2-7 a) — wait here.
+ * Bounded; only when a key exists; the Supabase copy is never affected.
+ */
 const MAX_WAITING = 50;
 
 let started = false;   // the load was scheduled: happens once per page load, never undone (no second initAll after a failure)
@@ -26,9 +30,11 @@ function whenIdle(run: () => void): void {
   else setTimeout(run, NO_IDLE_API_DELAY_MS);
 }
 
-function give(loaded: Sdk, [name, props]: Waiting): void {
+const apiKey = (): string => (process.env.NEXT_PUBLIC_AMPLITUDE_API_KEY ?? "").trim();
+
+function give(loaded: Sdk, [name, props, options]: Waiting): void {
   try {
-    loaded.track(name, props);
+    loaded.track(name, props, options);
   } catch {
     // Amplitude failing must not touch the Supabase path or the screen
   }
@@ -65,7 +71,7 @@ async function load(key: string): Promise<void> {
  */
 export function startAmplitude(): void {
   if (started) return;
-  const key = (process.env.NEXT_PUBLIC_AMPLITUDE_API_KEY ?? "").trim();
+  const key = apiKey();
   if (!key) {
     if (!warned) {
       warned = true;
@@ -79,7 +85,7 @@ export function startAmplitude(): void {
 
 /** Same event name and props as the Supabase path minus Supabase-only ones, plus the common props the analysis needs. Never throws. */
 export function sendToAmplitude(name: EventName, props: Record<string, unknown>, common: CommonProps | null): void {
-  if (!started || failed) return;
+  if (failed || !apiKey()) return;   // no key: Amplitude is off and nothing is kept
   try {
     const shared = common === null ? {} : {
       ...(common.entry === null ? {} : { entry: common.entry }),
@@ -89,7 +95,8 @@ export function sendToAmplitude(name: EventName, props: Record<string, unknown>,
       is_in_app_browser: common.is_in_app_browser,
       is_returning: common.is_returning,
     };
-    const event: Waiting = [name, { ...shared, ...forAmplitude(name, props), ...(name === "site_visited" ? { prompt_version: PROMPT_VERSION } : {}) }];
+    const own = { ...forAmplitude(name, props), ...(name === "site_visited" ? { prompt_version: PROMPT_VERSION } : {}) };
+    const event: Waiting = [name, { ...shared, ...own }, { time: Date.now() }];
     if (sdk) give(sdk, event);
     else if (waiting.length < MAX_WAITING) waiting.push(event);
   } catch {
```

```diff
--- a/web/src/components/AmplitudeInit.tsx
+++ b/web/src/components/AmplitudeInit.tsx
@@ -5,8 +5,8 @@ import { startAmplitude } from "@/lib/track/amplitude";
 
 /**
  * Asks for Amplitude once (the module guards repeats; the SDK itself loads later, when the browser is idle).
- * Placed before the page in the root layout so its effect runs first: a `visit` fired by a page below it is then
- * kept in the waiting queue instead of being dropped as "not started".
+ * Events sent before this effect runs (a `site_visited` from the page below it) wait in the queue with the time they
+ * happened (taxonomy 2-7 a·b), so nothing depends on the order of effects.
  * A visit that begins on /privacy does not start it (that page only reads the anonymous id and creates none);
  * moving on to another page does.
  */
```

- [ ] **Step 4: 통과 확인**

Run: `cd web && npm run typecheck && npm run lint && npx vitest run src/lib/track src/components && npx playwright test e2e/amplitude.spec.ts`
Expected: 오류 0 / PASS(전체 **52파일 434개**), `amplitude.ts` 줄 100%(분기는 시작과 같은 `?? ""` 하나만 남음) / E2E amplitude 2 passed — 키가 없으니 amplitude.com 요청 0, SDK 코드 내려받지 않음, 경고 1번(대기열이 키 없을 때 아무것도 하지 않음)

- [ ] **Step 5: Commit**

```bash
git add web/src/lib/track/amplitude.ts web/src/lib/track/amplitude.test.ts web/src/components/AmplitudeInit.tsx
git commit -m "fix(analytics): queue events before Amplitude starts and keep their time

With a key, events sent before startAmplitude wait in the bounded queue;
each keeps the moment it happened and is handed over with track(name,
props, { time }). Without a key nothing is kept (taxonomy 2-7 a, b).

- [x] events: taxonomy.md · taxonomy.csv · schema.ts changed together (or no event change) — no event change

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 6: 자동 검사 — `taxonomy.test.ts`(csv ↔ 명세 ↔ md ↔ 호출), E2E 키 검사, csv 상태 (7-3)

**Files:**
- Modify: `web/package.json`, `web/package-lock.json`(`npm install`), `docs/taxonomy.csv`(일회성 스크립트), `web/e2e/helpers.ts`, `web/e2e/flow-leaf.spec.ts`, `web/e2e/flow-target.spec.ts`
- Create: `web/src/lib/track/taxonomy.test.ts`, `web/e2e/spec-check.spec.ts`

**Interfaces:**
- Consumes: `EVENT_SPEC`·`PropSpec`·`EventName`·`COMMON_KEYS`·`parseCommon`·`isEventName`(Task 1), `recordEvents`·`Sent`(`e2e/helpers.ts`)
- Produces: `specMismatches(events: Sent[]): string[]`(`e2e/helpers.ts`, `[]` = 모두 맞음). 검사 목록(7-3 ② 표 #1~#9 + #10):
  - #1 csv 머리글 13열(그리고 csv-parse가 모든 줄의 열 수를 검사) · #2 이벤트 이름 snake_case + 끝 단어가 md 2-2 허용 동사(표에서 읽음) · #3 속성 이름·Boolean `is_/has_`·Data Type·Array·Trigger·Status(md 2-8 표에서 읽음) · #4 ID ↔ 이름 1:1, 한 이벤트의 줄은 Trigger·분류·설명·**Status**가 같음 · #5 한 속성 이름 = 한 타입·배열 여부 · #6 live·planned 이벤트 = `EVENT_SPEC` 키 · #7 이벤트마다 속성·타입·배열·열거값(Value Example의 따옴표 값)·null 허용·`Supabase only`/`Amplitude only` = 명세 · #8 `*` 줄 = `COMMON_KEYS` = `parseCommon`의 키 · #9 md `#### E-xx \`name\`` 제목 = csv 쌍 · **#10 live 이벤트 = 앱 소스(`web/src`, 테스트 제외)의 `track("…"` 이름**

- [ ] **Step 1: csv-parse 설치**

```bash
cd web
npm install -D csv-parse@^7.0.3
git diff package.json   # devDependencies에 "csv-parse": "^7.0.3" 한 줄
```

- [ ] **Step 2: 실패하는 테스트**

`web/src/lib/track/taxonomy.test.ts`:

```ts
// @vitest-environment node
/**
 * taxonomy 7-3 ②: docs/taxonomy.md (source) ↔ docs/taxonomy.csv (machine copy) ↔ EVENT_SPEC (code) ↔ track() calls.
 * When this fails, find out which side is wrong (taxonomy 7-3 ④) — never edit an expectation just to make it pass.
 */
import { readdirSync, readFileSync } from "node:fs";
import { parse } from "csv-parse/sync";
import { describe, expect, it } from "vitest";
import { COMMON_KEYS, EVENT_SPEC, parseCommon, type EventName, type PropSpec } from "./schema";

const DOCS = new URL("../../../../docs/", import.meta.url);
const SRC = new URL("../../", import.meta.url);
const md = readFileSync(new URL("taxonomy.md", DOCS), "utf8");
const table: string[][] = parse(readFileSync(new URL("taxonomy.csv", DOCS), "utf8"), { bom: true, skip_empty_lines: true });

const HEADER = ["Trigger", "Event Category", "Integration", "Event Name", "Event Description", "Event Properties",
  "Value Description", "Array", "Data Type", "Value Example", "Note", "Event ID", "Status"] as const;
type Row = Record<(typeof HEADER)[number], string>;
const rows: Row[] = table.slice(1).map((cells) => Object.fromEntries(HEADER.map((h, i) => [h, cells[i] ?? ""])) as Row);
const eventRows = rows.filter((r) => r["Event Name"] !== "*");
const commonRows = rows.filter((r) => r["Event Name"] === "*");
const byEvent = Map.groupBy(eventRows, (r) => r["Event Name"]);

/** First-column backticked words of the markdown table under `heading` (up to the next heading). */
function tableWords(heading: string): string[] {
  const start = md.indexOf(heading);
  const body = md.slice(start + heading.length, md.indexOf("\n#", start + heading.length));
  return [...body.matchAll(/^\| ([^|]+)\|/gm)].flatMap((m) => [...m[1].matchAll(/`([^`]+)`/g)].map((w) => w[1]));
}
const VERBS = new Set(tableWords("### 2-2. 허용 동사"));
const STATUSES = new Set(tableWords("### 2-8. 상태"));
const IN_CODE = ["live", "planned-P4", "planned-P5", "planned-taxonomy"];
const TYPES: Record<string, string> = { String: "string", Number: "number", Boolean: "boolean", Object: "object" };

const quoted = (example: string) => [...example.matchAll(/"([^"]*)"/g)].map((m) => m[1]);
const listsNull = (example: string) => /(^|,\s*)null(\s*,|$)/.test(example.trim());
const acceptsNull = (s: PropSpec) => (typeof s.type === "string" ? s.nullable === true : s.type.includes(null));
const specOf = (name: string): Readonly<Record<string, PropSpec>> => EVENT_SPEC[name as EventName];

/** Every `track("name"` in the app's source (tests excluded) — the events the code really sends. */
function trackedNames(): Set<string> {
  const files = readdirSync(SRC, { recursive: true, encoding: "utf8" })
    .filter((f) => /\.tsx?$/.test(f) && !/\.test\.tsx?$/.test(f));
  const text = files.map((f) => readFileSync(new URL(f.replaceAll("\\", "/"), SRC), "utf8")).join("\n");
  return new Set([...text.matchAll(/\btrack\(\s*"([a-z0-9_]+)"/g)].map((m) => m[1]));
}

describe("taxonomy.csv format and naming (taxonomy 2절)", () => {
  it("#1 has exactly the 13 columns", () => {
    expect(table[0]).toEqual([...HEADER]);
    expect(table.every((cells) => cells.length === HEADER.length)).toBe(true);
  });

  it("reads the verb and status lists from taxonomy.md", () => {
    expect(VERBS.size).toBeGreaterThanOrEqual(15);
    expect([...STATUSES]).toEqual(expect.arrayContaining(["live", "planned-P4", "planned-P5", "planned-taxonomy", "proposed", "removed"]));
  });

  it.each([...byEvent.keys()])("#2 %s is snake_case and ends in an allowed verb (2-1, 2-2)", (name) => {
    expect(name).toMatch(/^[a-z][a-z0-9]*(_[a-z0-9]+)+$/);
    expect(VERBS, name).toContain(name.split("_").at(-1));
  });

  it("#3 property names, types, arrays, triggers and statuses follow 2-3 · 2-6 · 2-8", () => {
    for (const r of rows) {
      const where = `${r["Event ID"]} ${r["Event Properties"]}`;
      expect(["view", "click", "submit", "system", "-"], where).toContain(r.Trigger);
      expect(STATUSES, where).toContain(r.Status);
      if (r["Event Properties"] === "") continue;   // an event with common props only
      expect(r["Event Properties"], where).toMatch(/^[a-z][a-z0-9]*(_[a-z0-9]+)*$/);
      expect(Object.keys(TYPES), where).toContain(r["Data Type"]);
      expect(["TRUE", "FALSE"], where).toContain(r.Array);
      if (r["Data Type"] === "Boolean") expect(r["Event Properties"], where).toMatch(/^(is|has)_/);
    }
  });

  it("#4 one Event ID per name, and an event's rows share trigger, category, description and status", () => {
    for (const [name, list] of byEvent) {
      for (const col of ["Event ID", "Trigger", "Event Category", "Event Description", "Status"] as const) {
        expect(new Set(list.map((r) => r[col])).size, `${name} ${col}`).toBe(1);
      }
    }
    const ids = [...byEvent.values()].map((list) => list[0]["Event ID"]);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("#5 one property name = one data type and one array flag in every event (2-3)", () => {
    const seen = new Map<string, string>();
    for (const r of rows.filter((x) => x["Event Properties"] !== "")) {
      const shape = `${r["Data Type"]}/${r.Array}`;
      expect(seen.get(r["Event Properties"]) ?? shape, r["Event Properties"]).toBe(shape);
      seen.set(r["Event Properties"], shape);
    }
  });
});

describe("taxonomy.csv ↔ EVENT_SPEC ↔ code (taxonomy 7-3)", () => {
  const inCode = [...byEvent].filter(([, list]) => IN_CODE.includes(list[0].Status));

  it("#6 the live and planned events are exactly EVENT_SPEC's", () => {
    expect(inCode.map(([name]) => name).sort()).toEqual(Object.keys(EVENT_SPEC).sort());
  });

  it.each(inCode)("#7 %s has the csv properties, types, values and destinations", (name, list) => {
    const spec = specOf(name);
    const props = list.filter((r) => r["Event Properties"] !== "" && IN_CODE.includes(r.Status));
    expect(Object.keys(spec).sort()).toEqual(props.map((r) => r["Event Properties"]).sort());
    for (const r of props) {
      const s = spec[r["Event Properties"]];
      const where = `${name}.${r["Event Properties"]}`;
      expect(typeof s.type === "string" ? s.type : "string", where).toBe(TYPES[r["Data Type"]]);
      expect(s.array === true, where).toBe(r.Array === "TRUE");
      expect(acceptsNull(s), `${where} null`).toBe(listsNull(r["Value Example"]));
      if (typeof s.type !== "string") {
        expect(s.type.filter((v) => v !== null).sort(), `${where} values`).toEqual(quoted(r["Value Example"]).sort());
      }
      expect(s.only === "supabase", `${where} Supabase only`).toBe(r.Note.includes("Supabase only"));
      expect(s.only === "amplitude", `${where} Amplitude only`).toBe(r.Note.includes("Amplitude only"));
    }
  });

  it("#8 the `*` rows are COMMON_KEYS, and parseCommon returns exactly them", () => {
    expect(commonRows.map((r) => r["Event Properties"])).toEqual([...COMMON_KEYS]);
    const sample = { anon_id: "a", user_id: null, session_id: "s", round: 1, entry: null, screen_version: "v1",
      referrer: "", is_returning: false, device: "phone", is_in_app_browser: false };
    expect(Object.keys(parseCommon(sample) ?? {})).toEqual([...COMMON_KEYS]);
  });

  it("#9 the `#### E-xx \\`name\\`` headings of taxonomy.md match the csv (ID, name) pairs", () => {
    const headings = [...md.matchAll(/^#### (E-\d+) `([a-z0-9_]+)`/gm)].map((m) => `${m[1]} ${m[2]}`);
    const csv = [...byEvent].map(([name, list]) => `${list[0]["Event ID"]} ${name}`);
    expect(headings.sort()).toEqual(csv.sort());
  });

  it("#10 the live events are exactly the ones the app calls track() with", () => {
    const live = [...byEvent].filter(([, list]) => list[0].Status === "live").map(([name]) => name);
    expect([...trackedNames()].sort()).toEqual(live.sort());
  });
});
```

`web/e2e/helpers.ts` (명세는 `../src/lib/track/schema` — 그 파일은 import가 없어 Playwright가 그대로 읽는다):

```diff
--- a/web/e2e/helpers.ts
+++ b/web/e2e/helpers.ts
@@ -1,4 +1,5 @@
 import { expect, test as base, type Page } from "@playwright/test";
+import { COMMON_KEYS, EVENT_SPEC, isEventName, type PropSpec } from "../src/lib/track/schema";
 
 /** A stable pseudo address per test (from its id), so the API's per-address rate limit sees one visitor per test, as in production. */
 function clientIp(testId: string): string {
@@ -36,6 +37,25 @@ export async function recordEvents(page: Page): Promise<{ events: Sent[]; status
 
 export const named = (events: Sent[], name: string) => events.filter((e) => e.name === name);
 
+/**
+ * taxonomy 7-3 ③ — the P6 full check, on every run: each event posted to /api/track is in EVENT_SPEC, carries exactly
+ * its spec props (Amplitude-only ones are added later, by the Amplitude path) and exactly COMMON_KEYS. [] = all match.
+ */
+export function specMismatches(events: Sent[]): string[] {
+  const common = [...COMMON_KEYS].sort().join(",");
+  return events.flatMap((e) => {
+    if (!isEventName(e.name)) return [`${e.name}: not in EVENT_SPEC`];
+    const spec: Readonly<Record<string, PropSpec>> = EVENT_SPEC[e.name];
+    const want = Object.keys(spec).filter((k) => spec[k].only !== "amplitude").sort().join(",");
+    const got = Object.keys(e.props).sort().join(",");
+    const gotCommon = Object.keys(e.common).sort().join(",");
+    return [
+      ...(got === want ? [] : [`${e.name}: props [${got}], spec [${want}]`]),
+      ...(gotCommon === common ? [] : [`${e.name}: common [${gotCommon}]`]),
+    ];
+  });
+}
+
 /** Reacts to bookmarks in order; each click waits until the bookmark has finished rising (buttons re-enable). */
 export async function reactToBookmarks(page: Page, reactions: readonly ("궁금해요" | "패스")[], total = reactions.length) {
   for (let i = 0; i < reactions.length; i++) {
```

`web/e2e/spec-check.spec.ts` (페이지 없이 — 검사가 실제로 실패할 수 있음을 보인다):

```ts
import { expect } from "@playwright/test";
import { specMismatches, test } from "./helpers";

const common = { anon_id: "a", user_id: null, session_id: "s", round: 1, entry: null, screen_version: "v1",
  referrer: "", is_returning: false, device: "phone", is_in_app_browser: false };

// No page: proves the check the flow specs rely on can fail.
test("the posted-event check catches old names, wrong prop keys and old common keys", () => {
  expect(specMismatches([{ name: "book_opened", props: {}, common }, { name: "site_visited", props: {}, common }])).toEqual([]);
  expect(specMismatches([{ name: "visit", props: {}, common }])).toEqual(["visit: not in EVENT_SPEC"]);
  expect(specMismatches([{ name: "home_clicked", props: { curious: 0 }, common }]))
    .toEqual(["home_clicked: props [curious], spec [curious_count,source]"]);
  const { is_returning, ...rest } = common;
  expect(specMismatches([{ name: "book_opened", props: {}, common: { ...rest, returning: is_returning } }]))
    .toEqual(["book_opened: common [anon_id,device,entry,is_in_app_browser,referrer,returning,round,screen_version,session_id,user_id]"]);
});
```

흐름 E2E 끝에 한 줄씩(🍃 9문항·실패 뒤 [처음으로], 🎯 칩·직접 쓰기+고치기 — 넷이 지금 live 이벤트 13개를 모두 지난다):

```diff
--- a/web/e2e/flow-leaf.spec.ts
+++ b/web/e2e/flow-leaf.spec.ts
@@ -1,5 +1,5 @@
 import { expect, type Page } from "@playwright/test";
-import { named, reactToBookmarks, recordEvents, test } from "./helpers";
+import { named, reactToBookmarks, recordEvents, specMismatches, test } from "./helpers";
 
 test.use({ reducedMotion: "reduce" });
 
@@ -57,6 +57,7 @@ test("🍃 nine answers (one held 못 잡겠어요) → book → five bookmarks"
   expect(shown.every((e) => typeof (e.props.art as { animal?: string }).animal === "string")).toBe(true);
   await expect.poll(() => statuses.length).toBe(events.length);
   expect(statuses.every((s) => s === 202)).toBe(true);
+  expect(specMismatches(events)).toEqual([]);
 });
 
 test("🍃 a reload keeps the page and the entry/round of later events", async ({ page }) => {
@@ -101,6 +102,7 @@ test("🍃 a draw that keeps failing still lets the person go back to the start"
   await expect(page.getByRole("button", { name: /그냥 한 권 만나고 싶어요/ })).toBeVisible();
   await expect.poll(() => named(events, "home_clicked").length).toBe(1);
   expect(named(events, "home_clicked")[0].props).toEqual({ curious_count: 0, source: "first_page" });
+  expect(specMismatches(events)).toEqual([]);
 });
 
 test("🍃 one failed draw, then 다시 시도 brings the book", async ({ page }) => {
```

```diff
--- a/web/e2e/flow-target.spec.ts
+++ b/web/e2e/flow-target.spec.ts
@@ -1,5 +1,5 @@
 import { expect } from "@playwright/test";
-import { named, reactToBookmarks, recordEvents, test } from "./helpers";
+import { named, reactToBookmarks, recordEvents, specMismatches, test } from "./helpers";
 
 // Motion and CSS shorten to fades under reduced motion — same flow, faster run. Books: BOOKS_SOURCE=sample.
 test.use({ reducedMotion: "reduce" });
@@ -61,6 +61,7 @@ test("🎯 chips → book → first page → five bookmarks → curious list", a
   expect(named(events, "home_clicked")[0]).toMatchObject({ props: { curious_count: 3, source: "end" }, common: { entry: "target" } });
   await expect.poll(() => statuses.length).toBe(events.length);
   expect(statuses.every((s) => s === 202)).toBe(true);
+  expect(specMismatches(events)).toEqual([]);
 });
 
 test("🎯 written goal → honest count → one edit → five bookmarks", async ({ page }) => {
@@ -102,6 +103,7 @@ test("🎯 written goal → honest count → one edit → five bookmarks", async
   expect(named(events, "goal_coverage_checked")[0].props).toEqual({ coverage_bucket: "1-3", found_count: 2 });
   expect(named(events, "first_page_edited").map((e) => e.props)).toEqual([{ changed_items: ["len"] }]);
   expect(named(events, "chip_selected").map((e) => [e.props.chip_value, e.props.is_edit])).toEqual([["free", false], ["thin", true]]);
+  expect(specMismatches(events)).toEqual([]);
 });
 
 test("🎯 a 30-character goal with no spaces wraps inside the first page", async ({ page }) => {
```

- [ ] **Step 3: 실패 확인**

Run: `cd web && npx vitest run src/lib/track/taxonomy.test.ts`
Expected: FAIL 3 —
- #4: `bookmark_reacted`·`home_clicked`의 줄 Status가 `live`와 `planned-taxonomy`로 섞임
- #7 `site_visited`: `prompt_version`의 Note에 `Amplitude only`가 없음(2-7은 그렇게 적으라 함)
- #10: `goal_submitted`를 부르는데 csv는 `planned-taxonomy`

(나머지 56개는 통과 — 명세가 csv와 맞는다는 뜻)

- [ ] **Step 4: csv 상태·Note 맞추기 (일회성 스크립트, 커밋하지 않음)**

아래를 저장소 밖(예: 스크래치 폴더)에 `csv-v03.mjs`로 저장하고 `Galpi/`에서 실행한다. Status·Note 칸만 바뀌고 BOM·13열·줄바꿈은 그대로. 새 Note 문구에는 쉼표·따옴표가 없다(따옴표 없는 칸이 있어서 — 스크립트가 검사).

```js
// One-off edit of docs/taxonomy.csv for the v0.3 dev round (run from Galpi/, not committed).
// Keeps the UTF-8 BOM, the 13 columns and the line endings; only Status and Note cells change.
// New note text has no comma or quote: some Note cells are unquoted.
import { readFileSync, writeFileSync } from "node:fs";

const PATH = "docs/taxonomy.csv";
const raw = readFileSync(PATH, "utf8");
const eol = raw.includes("\r\n") ? "\r\n" : "\n";
const lines = raw.split(eol);

/** Rows still planned for "the dev round": implemented ones go live, P4 events keep waiting for P4. */
const STATUS = [
  ["E-26", null, "live"],               // all five goal_submitted rows
  ["E-08", "one_liner_style", "live"],
  ["E-20", "source", "live"],
  ["E-10", "pick_type", "planned-P4"],
  ["E-18", "pick_type", "planned-P4"],
];
for (const [id, prop, status] of STATUS) {
  const hits = lines.flatMap((line, i) =>
    line.endsWith(`,${id},planned-taxonomy`) && (prop === null || line.includes(`,${prop},`)) ? [i] : []);
  if (hits.length === 0) throw new Error(`no planned-taxonomy row for ${id} ${prop ?? "*"}`);
  for (const i of hits) lines[i] = lines[i].replace(/,planned-taxonomy$/, `,${status}`);
}

/** The two P4 rows get their own note before the general wording change. */
for (const id of ["E-10", "E-18"]) {
  const i = lines.findIndex((line) => line.endsWith(`,${id},planned-P4`) && line.includes(",pick_type,"));
  lines[i] = lines[i].replace("accepted—dev round · ", "v0.3 명세 반영(EVENT_SPEC) · 심는 것은 P4 · ");
}

const NOTES = [
  ["accepted—dev round · ", "v0.3 반영 · "],
  ["현재 props.entry를 보냄 → 삭제", "props.entry 삭제"],
  ["현재 보내는 props.entry는 삭제", "props.entry 삭제"],
  ["현재 속성 이름: ", "이전 속성 이름: "],
  ["현재 이름: ", "이전 이름: "],
  ["현재 직접 쓰기 값은 ", "이전 직접 쓰기 값 "],
  ["현재 🎯 ", "이전 🎯 "],
  ["Amplitude로만 보냄 (Supabase props에는 없음)", "Amplitude only — Supabase props에는 없음"],
  ["/privacy 문장 수정 필요(taxonomy.md 6-3)", "/privacy 문장 반영(taxonomy.md 6-3)"],
  ["지금은 늘 1 — 개발 라운드(P7 전)에서 [다시 뽑기]·[처음으로]에 심음",
    "v0.3: track()이 E-20·E-19를 보낸 직후 +1 — [처음으로]는 지금 · [다시 뽑기]는 P4에서 E-19만 보내면 같은 규칙"],
];
let text = lines.join(eol);
for (const [from, to] of NOTES) {
  if (!text.includes(from)) throw new Error(`note not found: ${from}`);
  text = text.replaceAll(from, to);
}
if (text.includes("accepted—dev round") || text.includes("planned-taxonomy")) throw new Error("dev-round marks left");
for (const to of NOTES.map(([, t]) => t)) if (/[,"]/.test(to)) throw new Error(`comma or quote in a note: ${to}`);
writeFileSync(PATH, text);
console.log("taxonomy.csv: v0.3 statuses and notes written");
```

```bash
cd Galpi
node <저장한 경로>/csv-v03.mjs     # taxonomy.csv: v0.3 statuses and notes written
git diff --stat docs/taxonomy.csv  # 1 file changed, 37 insertions(+), 37 deletions(-)
head -c 3 docs/taxonomy.csv | od -c | head -1   # 357 273 277 (BOM 그대로)
grep -c "planned-taxonomy\|accepted—dev round" docs/taxonomy.csv   # 0
```

결과: 구현된 줄(E-26 다섯 줄, E-08 `one_liner_style`, E-20 `source`)은 `live` → csv 상태 live 13·planned-P4 5·planned-P5 7. E-10·E-18 `pick_type`은 `planned-P4`(명세에는 있고 심는 것은 P4). Note의 "accepted—dev round · 현재 이름: X"는 "v0.3 반영 · 이전 이름: X", E-01 `prompt_version`은 "Amplitude only — Supabase props에는 없음", `round` 줄은 구현 위치.

- [ ] **Step 5: 통과 확인**

Run: `cd web && npm run typecheck && npm run lint && npx vitest run && npx playwright test`
Expected: 오류 0 / Vitest **53파일 493개** PASS(taxonomy 59) / Playwright **74개 → 66 passed · 8 skipped**(시작 72 + `spec-check` × 2)

거꾸로도 확인(되돌리기): `EVENT_SPEC.home_clicked`에서 `source`를 지우면 `tsc`(Flow.tsx 초과 속성)와 taxonomy #7이 실패하고, csv에서 아무 칸에 쉼표를 넣으면 #1(csv-parse "Invalid Record Length")이 실패한다 — 확인 뒤 되돌린다.

- [ ] **Step 6: Commit**

```bash
cd Galpi
git add web/package.json web/package-lock.json web/src/lib/track/taxonomy.test.ts web/e2e docs/taxonomy.csv
git commit -m "test(analytics): check taxonomy.csv, taxonomy.md, EVENT_SPEC and track() calls stay in sync

taxonomy.test.ts parses the csv with csv-parse (13 columns, BOM) and checks
naming, csv <-> EVENT_SPEC (types, enums, null, Supabase/Amplitude only),
common keys, md headings and live events <-> track() call sites. The flow
E2E checks every posted event's keys against the spec. csv: implemented
rows are live, E-10/E-18 pick_type wait for P4, E-01 notes Amplitude only.

- [x] events: taxonomy.md · taxonomy.csv · schema.ts changed together (or no event change)

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 7: 문서 — taxonomy v0.3, CLAUDE.md 규칙, PRD·추적표, 결정 기록

**Files:**
- Modify: `docs/taxonomy.md`, `docs/PRD.md`, `docs/README.md`, `docs/target-chips.md`, `docs/deploy.md`, `docs/DESIGN.md`, `Galpi/CLAUDE.md`, `docs/context.md`, `docs/process.md`, `docs/tasks.md`

**Interfaces:**
- Consumes: Task 1~6의 결과(이름·파일·검사 번호)
- Produces: taxonomy.md v0.3(머리 표, 3-1a 구현 줄, 4-1 상태 집계 live 13, E-26 live, 4-4 "구현 완료" + Supabase 옛 기록은 옮기지 않음, 5-1·5-2, 6-2·6-3 반영, 7-3 표 #10, 8절 v0.3 행) · CLAUDE.md 원칙 3-1 + 커밋 체크리스트(7-2 제안 문구 그대로) · PRD 4절 새 이름 + taxonomy가 원본이라는 한 줄 + F-16 한 줄 · README 추적표 S-02 🎯에 E-26 · 앞으로 쓰일 문서(target-chips 5절, deploy 체크리스트, DESIGN 75행)의 옛 이름. 지난 기록(context·process·tasks의 옛 줄, PHASES P0 완료 기준, proposal)은 그대로 둔다

- [ ] **Step 1: 문서 스크립트 (일회성, 커밋하지 않음)**

모든 바꿀 곳은 "정확히 한 번 나오는 문장 → 새 문장"이고, 하나라도 맞지 않으면 멈춘다. 저장소 밖에 `docs-v03.mjs`로 저장하고 `Galpi/`에서 실행:

```js
// One-off doc edits for the taxonomy dev round v0.3 (run from Galpi/, not committed).
// Every anchor must occur exactly once; the script stops at the first one that does not.
import { readFileSync, writeFileSync } from "node:fs";

function edit(path, pairs) {
  const raw = readFileSync(path, "utf8");
  const eol = raw.includes("\r\n") ? "\r\n" : "\n";
  let text = raw.replaceAll("\r\n", "\n");
  for (const [from, to] of pairs) {
    const count = text.split(from).length - 1;
    if (count !== 1) throw new Error(`${path}: anchor found ${count} times: ${from.slice(0, 60)}`);
    text = text.replace(from, () => to);
  }
  writeFileSync(path, eol === "\n" ? text : text.replaceAll("\n", eol));
  console.log(`${path}: ${pairs.length} edits`);
}

const PLAN = "plans/2026-10-01-taxonomy-dev.md";

edit("docs/taxonomy.md", [
  ["| **사용자 결정 반영 — 개발 라운드 대기** |",
    "| 사용자 결정 반영 |\n| taxonomy v0.3 | 2026-10-01 | 개발 라운드 `" + PLAN + "` | **구현 완료 — 코드가 이 문서를 따른다** (8절) |"],
  ["> - 이름·속성은 **제안 이름(목표)** 으로 적는다. 지금 코드의 이름과 다르면 \"현재 → 제안\"으로 표시하고, 바꾸는 작업은 4-4절 마이그레이션에서 **한 번의 개발 라운드로** 한다(P7 실데이터 시작 전, Vercel에 Amplitude 키를 넣기 전 — 그때까지는 문서만).",
    "> - 이름·속성은 v0.3(2026-10-01)부터 **코드와 같다**. 4절의 \"현재 → 제안\" 열은 그 개발 라운드(4-4)의 마이그레이션 기록으로 남긴다."],
  ["개발 라운드에서 taxonomy 테스트가 csv Note의 `Supabase only`와 그 목록을 대조한다.",
    "v0.3부터 `EVENT_SPEC`의 `only: \"supabase\"`가 그 목록이고(`props.ts`의 `forAmplitude`가 뺀다), taxonomy 테스트 #7이 csv Note의 `Supabase only`·`Amplitude only`와 대조한다."],
  ["**Amplitude 경로 — 개발 라운드 항목** (Amplitude 검토, 2026-09-30. 4-4의 한 라운드에 함께 한다)",
    "**Amplitude 경로 — 개발 라운드 항목** (Amplitude 검토, 2026-09-30 — **v0.3에서 구현**: `amplitude.ts`의 대기열·`time`)"],
  ["**택소노미 개발 라운드**(4-4, P7 전)에서 심음 — 새 이벤트, 기존 이벤트의 속성 추가 |",
    "**택소노미 개발 라운드**(4-4, P7 전)에서 심음 — 새 이벤트, 기존 이벤트의 속성 추가. **v0.3에서 모두 처리 — 지금 이 상태의 줄은 없다** |"],
  ["- 이 규칙이 없으면 [처음으로] 뒤 재시작이 앞 판과 `(session_id, round)`가 같아져 두 판이 한 판으로 섞인다(5-1).",
    "- 이 규칙이 없으면 [처음으로] 뒤 재시작이 앞 판과 `(session_id, round)`가 같아져 두 판이 한 판으로 섞인다(5-1).\n- **구현 (v0.3)**: `track()`이 `ROUND_ENDING_EVENTS`(`schema.ts` — E-19·E-20)를 두 곳에 보낸 **직후** `nextRound()`를 부른다. 화면 코드는 round를 만지지 않는다 — P4의 [다시 뽑기]는 E-19를 보내기만 하면 된다."],
  ["상태: live 12 · planned-P4 5 · planned-P5 7 · planned-taxonomy 1 (+ 기존 이벤트에 속성 추가 4건 — 모두 accepted, 개발 라운드). 이름·속성 변경도 모두 accepted — dev round (4-4)",
    "상태 (v0.3): live 13 · planned-P4 5 · planned-P5 7 · planned-taxonomy 0. 4-4의 이름·속성 변경과 속성 추가 4건은 v0.3에서 코드에 반영 (P4 이벤트 E-10·E-18의 `pick_type`은 `EVENT_SPEC`에만 — 심는 것은 P4)"],
  ["| E-26 | `goal_submitted` | (없음) | 목표입력 | submit | **planned-taxonomy** |",
    "| E-26 | `goal_submitted` | (없음) | 목표입력 | submit | live |"],
  ["이름은 아직 쓰지 않은 planned 이벤트도 `schema.ts`의 `EVENT_NAMES`에 이미 들어 있다(24개). 개발 라운드에서 E-26이 더해져 25개가 된다.",
    "아직 심지 않은 planned 이벤트도 `schema.ts`의 `EVENT_SPEC`에 속성까지 들어 있다(25개 — `EVENT_NAMES`는 그 키)."],
  ["| 목표입력 | submit | planned-taxonomy | (없음) → 신규 (accepted 2026-09-30, dev round) |",
    "| 목표입력 | submit | live | (없음) → 신규 (accepted 2026-09-30, v0.3 구현) |"],
  ["| `one_liner_style` | **추가 — accepted (dev round)** |", "| `one_liner_style` | 추가 — v0.3 구현 |"],
  ["| `pick_type` | **추가 — accepted (dev round)** | String | \"recommended\", \"random\" |",
    "| `pick_type` | 추가 — v0.3 명세 반영, 심는 것은 P4 | String | \"recommended\", \"random\" |"],
  ["| `pick_type` | **추가 — accepted (dev round)** | String | null, \"recommended\", \"random\" |",
    "| `pick_type` | 추가 — v0.3 명세 반영, 심는 것은 P4 | String | null, \"recommended\", \"random\" |"],
  ["| `source` | **추가 — accepted (dev round)** |", "| `source` | 추가 — v0.3 구현 |"],
  ["**상태: 아래 이름 변경·속성 변경·추가는 모두 `accepted — dev round` (2026-09-30 사용자 승인).**",
    "**상태: 아래 이름 변경·속성 변경·추가는 모두 `accepted — dev round` (2026-09-30 사용자 승인) → v0.3(2026-10-01)에서 모두 구현 (`" + PLAN + "`).** Supabase `events`에 이미 쌓인 테스트 기록은 옛 이름 그대로 두고 옮기지 않는다 — P7에서 지운다."],
  ["`lib/track/common.ts`의 `nextRound()` 호출을 `Flow.tsx`의 [다시 뽑기]·[처음으로]에 연결(3-1a)",
    "`lib/track/common.ts`의 `nextRound()` 호출을 [다시 뽑기]·[처음으로]에 연결(3-1a — v0.3에서는 `Flow.tsx`가 아니라 `track()`이 부른다)"],
  ["지금은 `round`가 늘 1이다(`nextRound()`를 부르는 곳이 없음) — 개발 라운드(4-4)에서 두 곳에 심는다. **그 전 데이터는 판을 세는 데 쓰지 않는다** (어차피 P7에서 지움).",
    "v0.3부터 `track()`이 E-20(지금)·E-19(P4)를 보낸 직후 +1 한다. **그 전 데이터(round가 늘 1)는 판을 세는 데 쓰지 않는다** (어차피 P7에서 지움)."],
  ["FN-2의 셋째 단계(`goal_submitted`)는 E-26이 코드에 들어가는 개발 라운드부터 생긴다(승인됨, 4-4).",
    "FN-2의 셋째 단계(`goal_submitted`)는 v0.3(2026-10-01)부터 쌓인다."],
  ["처리방침에 저장 명시(현재), **Amplitude로는 안 간다는 문장은 개발 라운드에서 추가(6-3)**.",
    "처리방침에 저장 명시, **Amplitude로는 안 간다는 문장은 v0.3에서 추가(6-3)**."],
  ["확인할 것: 첫 장(S-04)이 이 글을 화면에 보이면 Session Replay(20%)가 화면 글자를 담을 수 있다 — 개발 라운드에서 그 요소도 리플레이에서 가리는지 확인한다 |",
    "첫 장(S-04)이 이 글을 화면에 보이면 Session Replay(20%)가 화면 글자를 담을 수 있다 — v0.3: 직접 쓴 글이 있는 첫 장에 `data-amp-mask`(`FirstPage.tsx`)를 달아 리플레이에서 가린다 |"],
  ["### 6-3. 처리방침(`/privacy`) 변경 — 개발 라운드에 함께 (페이지는 이번에 고치지 않는다)",
    "### 6-3. 처리방침(`/privacy`) 변경 — v0.3에서 반영 (갱신일 2026-10-01)"],
  ["(v0, 갱신일 2026-09-30)는 지금 **직접 쓴 글을 포함한 모든 기록이 Amplitude로도 간다고** 읽힌다.",
    "(v0, 갱신일 2026-09-30)는 **직접 쓴 글을 포함한 모든 기록이 Amplitude로도 간다고** 읽혔다. v0.3에서 아래 두 문장을 그대로 넣었다."],
  ["### 7-3. 자동 검사 (다음 개발 라운드에서 구현)",
    "### 7-3. 자동 검사 (v0.3 구현 — `web/src/lib/track/taxonomy.test.ts`, `web/e2e/helpers.ts`의 `specMismatches`)"],
  ["- 같은 명세를 `/api/track`의 `props` 검사에 쓸 수 있다(모르는 속성 버리기) — 이번 검사와는 별도, 선택",
    "- v0.3: `/api/track`이 같은 명세로 `props`를 검사한다(`props.ts`의 `parseProps`) — 모르는 속성·Amplitude 전용 속성·타입이 틀린 값은 버리고 이벤트는 저장, 버린 키 이름만 서버 로그에 남긴다(값은 남기지 않음)"],
  ["| 9 | `docs/taxonomy.md`의 `#### E-xx \\`name\\`` 제목에서 뽑은 (ID, 이름) 쌍 = csv의 쌍 (`*` 제외) | md와 csv가 어긋남 |",
    "| 9 | `docs/taxonomy.md`의 `#### E-xx \\`name\\`` 제목에서 뽑은 (ID, 이름) 쌍 = csv의 쌍 (`*` 제외) | md와 csv가 어긋남 |\n| 10 | Status가 `live`인 이벤트 이름 집합 = 앱 소스(`web/src`, 테스트 제외)의 `track(\"…\"` 호출 이름 집합. 한 이벤트의 줄은 모두 같은 Status(#4) | 심었는데 문서가 planned, 또는 문서는 live인데 호출이 없음 |"],
  ["**③ E2E 한 줄** — `e2e/helpers.ts`가 가로채는 `/api/track` 본문마다 `props`의 키가 `EVENT_SPEC[name]`의 키 안에 있는지 확인 (P6 전수 점검을 매번 자동으로)",
    "**③ E2E 한 줄** — `e2e/helpers.ts`가 가로채는 `/api/track` 본문마다 `props`의 키가 `EVENT_SPEC[name]`의 키(Amplitude 전용 제외)와 **같은지**, `common`의 키가 `COMMON_KEYS`와 같은지 확인 (P6 전수 점검을 매번 자동으로 — 🍃·🎯 흐름 E2E가 `specMismatches(events)`를 부름)"],
  ["상태 집계 `proposed` 1 → 0, `planned-taxonomy` 1 |",
    "상태 집계 `proposed` 1 → 0, `planned-taxonomy` 1 |\n| v0.3 | 2026-10-01 | Claude (개발 라운드) | **구현 완료** (`" + PLAN + "`). 4-4 마이그레이션 전부 코드에 반영 — 이벤트 이름 4건(E-18은 명세만), 속성·값 19건, 중복 `entry` 삭제 2건, 속성 추가 4건(E-08 `one_liner_style`·E-20 `source` 구현, E-10·E-18 `pick_type`은 명세만 — P4), E-26 `goal_submitted` 구현. `round` +1은 `track()`이 E-20·E-19를 보낸 직후(3-1a). `goal_text`는 Amplitude 사본과 Session Replay에서 빠지고 `/privacy`에 6-3 문장 2개(갱신일 10-01). `schema.ts`의 `EVENT_SPEC`·`PropsOf`로 `track()` 호출을 tsc가 검사, `/api/track`도 같은 명세로 props 검사. 자동 검사: `taxonomy.test.ts`(7-3 #1~#10), E2E `specMismatches`. Amplitude 대기열: 시작 전 이벤트도 받기(키 있을 때만)·원래 `time`. csv: 구현된 줄 `live`, E-10·E-18 `pick_type`은 `planned-P4`, E-01 Note에 `Amplitude only`, Note의 \"현재 이름\" → \"이전 이름\". Supabase의 테스트 기록은 옛 이름 그대로(P7에서 지움 — 옮기지 않음) |"],
]);

edit("docs/PRD.md", [
  ["## 4. 이벤트\n", "## 4. 이벤트\n\n이벤트 이름·속성·값·보내는 곳의 원본은 `taxonomy.md`(v0.3부터 코드와 같음). 이 절은 ID·이름·한 줄 설명만 둔다.\n"],
  ["| E-01 | `visit` | — | F-01 |", "| E-01 | `site_visited` | — | F-01 |"],
  ["| E-02 | `entry_selected` | 🎯 / 🍃 | F-01 |", "| E-02 | `entry_selected` | — (🎯 / 🍃는 공통 속성 입구) | F-01 |"],
  ["| E-18 | `yes24_clicked` |", "| E-18 | `yes24_link_clicked` |"],
  ["| E-21 | `goal_free_written` |", "| E-21 | `free_goal_written` |"],
  ["| E-22 | `goal_coverage` |", "| E-22 | `goal_coverage_checked` |"],
  ["삭제 요청 시 Amplitude 기록도 함께 지움 |",
    "삭제 요청 시 Amplitude 기록도 함께 지움. **10-01 택소노미 개발 라운드**: 🎯 직접 쓴 글은 갈피 데이터베이스(Supabase)에만 저장하고 Amplitude로는 보내지 않는다고 적음(갱신일 2026-10-01) |"],
]);

edit("docs/README.md", [
  ["| S-02 🎯 입력 | F-02 | E-03·21·22 |", "| S-02 🎯 입력 | F-02 | E-03·26·21·22 |"],
]);

// Forward-looking mentions of the old names (history in context/process/tasks/PHASES/proposal stays as written).
edit("docs/target-chips.md", [
  ["| `goal_free_written` | 적은 내용(30자),", "| `free_goal_written` | 적은 내용(30자, Supabase에만 — taxonomy 6-2),"],
  ["| `goal_coverage` | 찾은 책 수(0 / 1~3 / 4+) |", "| `goal_coverage_checked` | 찾은 책 수(0 / 1~3 / 4+) |"],
]);
edit("docs/deploy.md", [
  ["Amplitude Live/User Lookup에 `visit`(`prompt_version` = `BA400.4`)이 뜨고",
    "Amplitude Live/User Lookup에 `site_visited`(`prompt_version` = `BA400.4`)가 뜨고"],
]);
edit("docs/DESIGN.md", [
  ["기록(`visit` 공통 속성의 기기 종류)", "기록(`site_visited` 공통 속성의 기기 종류)"],
]);

edit("CLAUDE.md", [
  ["3. **이벤트는 화면과 함께 심는다** — 화면 Phase의 완료 기준에 그 화면의 이벤트가 들어간다\n",
    "3. **이벤트는 화면과 함께 심는다** — 화면 Phase의 완료 기준에 그 화면의 이벤트가 들어간다\n   - 3-1. **이벤트의 원본은 `docs/taxonomy.md`** — 이벤트를 추가·변경·삭제할 때는 taxonomy.md → taxonomy.csv → `schema.ts` → 테스트 → `track()` 호출 순으로 같은 커밋에서 고친다. 모으는 정보가 바뀌면 `/privacy`를 먼저. taxonomy 테스트가 실패하면 문서와 코드 중 어느 쪽이 틀렸는지 확인하고, 테스트를 고쳐 통과시키지 않는다.\n   - 커밋 체크리스트 한 줄 (코드 리뷰·커밋 메시지 본문): `- [ ] events: taxonomy.md · taxonomy.csv · schema.ts changed together (or no event change)`\n"],
]);

edit("docs/context.md", [
  ["Last Updated: 2026-09-30 — 택소노미 v0.2 결정", "Last Updated: 2026-10-01 — 택소노미 개발 라운드(v0.3) 구현"],
  ["코드는 아직 안 바꿨다(문서만) |\n",
    "코드는 아직 안 바꿨다(문서만) |\n| 10-01 | 택소노미 개발 라운드 v0.3 구현(`" + PLAN + "`): 4-4 이름·속성 변경 전부, E-26 `goal_submitted`, E-08 `one_liner_style`·E-20 `source`. 코드 명세 `EVENT_SPEC`(`schema.ts`)에서 `track()` 타입(`PropsOf`)·`/api/track` props 검사·Amplitude 사본(`goal_text` 뺌)이 모두 나온다. ① `round` +1은 화면이 아니라 **`track()`이 E-20·E-19를 보낸 직후** ② `/api/track`은 명세 밖 props를 **버리고 이벤트는 저장**(거절하지 않음), 버린 키 이름만 서버 로그 ③ 직접 쓴 글이 보이는 첫 장은 Session Replay에서 가림(`data-amp-mask`) ④ CSV 검사는 `csv-parse`(taxonomy 7-3 지정) + live ↔ `track()` 호출 대조(#10) ⑤ Amplitude 대기열은 키가 있을 때만, 시작 전 이벤트도 원래 시각으로 ⑥ Supabase 테스트 기록은 옛 이름 그대로 — P7에서 지우므로 옮기지 않음 | ① 끝나는 판의 이벤트가 옛 round를 싣는 순서를 한 곳에서 보장하고 P4 [다시 뽑기]가 E-19만 보내면 되게 ② 배포가 겹치는 순간의 옛 클라이언트나 오타 하나로 행동 기록 전체를 잃지 않게, 그러나 원본 표에는 명세 밖 값이 남지 않게 ③ 처리방침의 \"Amplitude에 보내지 않아요\"가 화면 녹화로 깨지지 않게(6-2 확인 항목) ④ 따옴표 안 쉼표가 있는 csv라 직접 split하지 않음 — 검사가 Note 쉼표 하나도 잡았다 ⑤ 2-7 a·b ⑥ 4-4 \"P7 전이라 백필·별칭 불필요\" |\n"],
]);

edit("docs/process.md", [
  ["Last Updated: 2026-09-30", "Last Updated: 2026-10-01"],
  ["- 그 뒤: P4 → P5 → P7(5명 반응) → P8·P9 (전체 목록은 대화 09-30 \"남은 단계\")",
    "- 그 뒤: P4 → P5 → P7(5명 반응) → P8·P9 (전체 목록은 대화 09-30 \"남은 단계\")\n\n### 10-01 — 택소노미 개발 라운드 v0.3 (`docs/" + PLAN + "`, 브랜치 `feat/amplitude`)\n- 이름 변경(이벤트 3 + 공통 속성 2 + 속성·값 19), E-26 `goal_submitted`, E-08 `one_liner_style`·E-20 `source` → `taxonomy.md`·`taxonomy.csv`와 코드가 같아짐(csv 상태 live 13)\n- `EVENT_SPEC` 하나에서: `track()` 타입 검사(tsc가 호출 15곳 검사), `/api/track` props 검사(명세 밖은 버리고 키 이름만 로그), Amplitude 사본에서 `goal_text` 뺌\n- 회차: [처음으로] 뒤 같은 탭 재시작 = round 2 (E2E로 확인). 직접 쓴 글은 Supabase에만 + 첫 장 리플레이 가림, `/privacy` 6-3 문장 2개(갱신일 10-01)\n- Amplitude 대기열: init 전 이벤트도 받고(키 있을 때만, 50개) 원래 시각으로 넘김\n- 자동 검사: `taxonomy.test.ts`(csv 13열·명명·csv ↔ `EVENT_SPEC` ↔ md 제목 ↔ `track()` 호출), E2E가 보낸 이벤트마다 props·common 키를 명세와 대조\n- **다음에 이어서 할 일**: ③ main 병합·배포(사용자 허락) → ④ 사용자가 Vercel Production에 `NEXT_PUBLIC_AMPLITUDE_API_KEY` + Amplitude 대시보드 Session Replay 20%·입력 가림 → ⑤ Amplitude 커넥터로 카탈로그 등록(csv Description·Category)·대시보드 → P7 전 Supabase 테스트 기록 지우기"],
]);

edit("docs/tasks.md", [
  ["Last Updated: 2026-09-30", "Last Updated: 2026-10-01"],
  ["(`docs/plans/2026-09-30-design-pass.md`) (9/30)\n",
    "(`docs/plans/2026-09-30-design-pass.md`) (9/30)\n- [x] 이벤트 택소노미 v0.2(문서) + 개발 라운드 v0.3 — 이름 변경, E-26, 회차 규칙, 직접 쓴 글은 Supabase만, `EVENT_SPEC` 타입 검사·서버 검사, CSV ↔ 코드 자동 검사, Amplitude 대기열 (`docs/taxonomy.md`, `docs/" + PLAN + "`) (10/1)\n- [ ] `feat/amplitude` main 병합·배포 → Vercel Production에 Amplitude 키(사용자) → 카탈로그·대시보드\n"],
]);
```

```bash
cd Galpi
node <저장한 경로>/docs-v03.mjs
# docs/taxonomy.md: 27 edits · docs/PRD.md: 7 · docs/README.md: 1 · docs/target-chips.md: 2 · docs/deploy.md: 1
# docs/DESIGN.md: 1 · CLAUDE.md: 1 · docs/context.md: 2 · docs/process.md: 2 · docs/tasks.md: 2
git diff --stat   # 10 files changed, 56 insertions(+), 37 deletions(-)
```

- [ ] **Step 2: 읽어 보기**

`git diff docs/taxonomy.md CLAUDE.md docs/PRD.md`를 읽고 확인: 8절 v0.3 행, 4-1 "live 13 · planned-P4 5 · planned-P5 7 · planned-taxonomy 0", 6-3 제목 "v0.3에서 반영", CLAUDE.md 원칙 3 아래 3-1과 체크리스트 줄, PRD E-01 `site_visited`·E-18 `yes24_link_clicked`·E-21 `free_goal_written`·E-22 `goal_coverage_checked`. 옛 이름이 남은 곳:

```bash
grep -rn '`visit`\|`goal_free_written`\|`goal_coverage`\|`yes24_clicked`' docs/*.md
```

남는 것은 지난 기록(context 09-30 행, process·tasks의 P0 줄, PHASES P0 완료 기준, proposal 4-4)과 taxonomy의 "현재 → 제안" 기록뿐

- [ ] **Step 3: 최종 검증**

Run: `cd web && npm run typecheck && npm run lint && npm run test:cov && npm run build && npm run e2e`
Expected: 오류 0 / `test:cov` **53파일 493개 PASS**, 종료 코드 0(`src/lib/recommend` 100% 문턱) / build 경로 목록 그대로(`/`, `/_not-found`, `/api/books/draw`, `/api/track`, `/design`, `/icon.svg`, `/privacy`, `/robots.txt`) / Playwright 66 passed · 8 skipped. taxonomy 테스트는 md 제목(#9)을 다시 읽으므로 문서 수정 뒤에도 59개 통과

- [ ] **Step 4: Commit**

```bash
cd Galpi
git add CLAUDE.md docs/taxonomy.md docs/PRD.md docs/README.md docs/target-chips.md docs/deploy.md docs/DESIGN.md docs/context.md docs/process.md docs/tasks.md
git commit -m "docs: taxonomy v0.3 — the dev round is implemented

taxonomy.md records what the code now does (statuses, round hook in
track(), goal_text Supabase-only with replay masking, /privacy, automated
checks #1-#10); CLAUDE.md gets rule 3-1 and the commit checklist line;
PRD section 4 and the forward-looking docs use the new event names.
Supabase test rows keep their old names until P7 deletes them.

- [x] events: taxonomy.md · taxonomy.csv · schema.ts changed together (or no event change)

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

병합·배포는 **사용자 확인 후**(`feat/amplitude` → `main`). 그 뒤 Vercel Production에 `NEXT_PUBLIC_AMPLITUDE_API_KEY`를 넣는 것도 사용자가 한다(process.md 재개 지점 ④).

---

## 완료 기준 (요구 → 태스크)

- [ ] ① 4-4 마이그레이션 전부: 이벤트 이름 3(+E-18 명세)·공통 2·속성/값·`entry` 중복 삭제(Task 1), 속성 추가 E-08 `one_liner_style`·E-20 `source`(Task 1), E-10·E-18 `pick_type`은 명세에만(Task 1, csv `planned-P4` Task 6), E-26 `goal_submitted`(Task 1, E2E 두 흐름)
- [ ] ② `round` 3-1a: [처음으로] 뒤 +1, 그 이벤트는 옛 round, 고치기·새로고침은 그대로(Task 2 단위·E2E), [다시 뽑기]는 `ROUND_ENDING_EVENTS`에 이미 — UI 없음(P4)
- [ ] ③ `goal_text` Supabase만: 명세 `only: "supabase"` → `forAmplitude`(Task 4), 서버는 30자(Task 3), 리플레이 가림(Task 4), `/privacy` 6-3 두 문장·갱신일(Task 4)
- [ ] ④ `EVENT_SPEC` ↔ csv, `track<N>(name, props: PropsOf<N>)`로 호출 15곳 tsc 검사(Task 1), `/api/track` 같은 명세로 검사 — 모르는 이벤트 400(그대로), 모르는 속성은 버리고 이름만 로그(Task 3)
- [ ] ⑤ 7-3 자동 검사: `taxonomy.test.ts` #1~#10 + E2E `specMismatches`(Task 6), csv Status(Task 6)
- [ ] ⑥ Amplitude 대기열: 시작 전 받기(키 있을 때만, 50개)·원래 `time`(Task 5)
- [ ] ⑦ CLAUDE.md 3-1·체크리스트, context·process·tasks, taxonomy 8절 v0.3(Task 7)
- [ ] ⑧ Supabase 옛 테스트 기록은 옮기지 않음 — Global Constraints·taxonomy 4-4·context(Task 7)
- [ ] 화면·동작 그대로(모든 태스크의 E2E), 키 없음(E2E amplitude), 파일 300줄 이하(아래)

새·바뀐 파일 줄 수(최종): `schema.ts` 160 · `props.ts` 61 · `client.ts` 35 · `amplitude.ts` 105 · `route.ts` 45 · `taxonomy.test.ts` 139 · `props.test.ts` 74 · `client.test.ts` 123 · `schema.test.ts` 104 · `amplitude.test.ts` 295 · `route.test.ts` 205 · `common.test.ts` 327(이미 넘음 — 줄 수 그대로)

---

## 이 계획이 스펙과 다르게 정한 것 (검토용)

| 스펙 | 이 계획 | 이유 |
|---|---|---|
| 4-4 "코드에서 함께 바꿀 곳": `nextRound()` 호출을 `Flow.tsx`의 [다시 뽑기]·[처음으로]에 연결 (3-1a) | `track()`이 `ROUND_ENDING_EVENTS`를 보낸 **직후** 부름. Flow는 round를 만지지 않음 | 3-1a "이벤트는 끝나는 판의 round, 보낸 직후 +1"을 한 곳에서 보장. P4는 E-19를 보내기만 하면 됨("typed hook"). 결과(어느 이벤트가 몇 회차인지)는 같다 |
| 7-1 "1~6은 같은 커밋" | 태스크별 커밋 6개 + 문서 1개. csv Status는 검사가 켜지는 Task 6에서, md는 Task 7에서 | 이 라운드는 이미 승인된 마이그레이션(문서가 먼저 있음)이라 리뷰 단위로 나눔. 체크리스트 줄에 "csv statuses follow in the sync-check commit"을 적어 남김. 다음 이벤트 변경부터는 7-1 그대로 |
| 7-3 ② 검사 #6~#7: "live·planned 이벤트 = EVENT_SPEC" | 그대로 + **#10 live 이벤트 = 앱 소스의 `track("…"` 호출**, #4에 "한 이벤트의 줄은 같은 Status" | 요구 "events live in code == csv rows with live status". 명세에 있는 속성은 `PropsOf`가 호출에서 강제하므로 live 이벤트에 planned 속성 줄이 남을 수 없다 → 같은 Status |
| 2-8 `planned-taxonomy` = 개발 라운드에서 심음 | E-10·E-18 `pick_type` 줄은 `planned-P4`로 | 이벤트 자체가 P4. 명세(`EVENT_SPEC`)에는 지금 넣고(#7이 대조), 심는 것은 P4 — `planned-taxonomy`로 두면 "이번 라운드에 심음"이 거짓이 됨 |
| 2-7 "csv Note에 `Amplitude only`로 적는다" ↔ csv E-01 Note "Amplitude로만 보냄" | csv Note를 "Amplitude only — Supabase props에는 없음"으로 | 문서 둘이 어긋남 — 2-7이 규칙, #7이 그 글자를 대조 |
| 7-3 ③ "props의 키가 EVENT_SPEC 키 **안에** 있는지" | 키 집합이 **같은지**(Amplitude 전용 제외) + common 키 = `COMMON_KEYS` | 요구 "property keys … match EVENT_SPEC". 빠진 속성도 잡는다 |
| 7-3 ① "같은 명세를 /api/track 검사에 쓸 수 있다(모르는 속성 버리기) — 선택" | 씀. 모르는 이벤트 400(그대로), 속성은 버리고 **이벤트는 저장**, 버린 키 이름만 `console.warn` | 배포가 겹치는 순간의 옛 클라이언트·오타 하나로 행동 기록을 잃지 않게. 원본 표에는 명세 밖 값이 남지 않음. 값은 로그에 쓰지 않음(개인정보) |
| 6-2 "확인할 것: 첫 장이 직접 쓴 글을 보이면 리플레이가 담을 수 있다" | 직접 쓴 글이 있는 첫 장에 `data-amp-mask` | 처리방침의 "Amplitude에 보내지 않아요"가 화면 녹화로 깨지지 않게. UI 변화 없음 |
| 6-3 바꿀 문장의 굵은 글씨(`**…**`) | 새 문장·구절을 `<strong>`으로 | 표의 굵게를 그대로 옮김(페이지의 다른 강조와 같은 방식) |
| 4-2 E-02 "속성 없음", PRD E-02 "🎯 / 🍃" | PRD를 "— (🎯 / 🍃는 공통 속성 입구)"로 | 4-4 E-02 `entry` 삭제와 맞춤 |
| taxonomy가 이름 바꿀 문서로 PRD 4절만 적음 | target-chips 5절·deploy 체크리스트·DESIGN 75행의 옛 이름도 | 앞으로 쓰일 문서(배포 체크리스트는 Amplitude 키 넣은 뒤 그대로 따라 한다). 지난 기록은 그대로 |
| 4-1 "`EVENT_NAMES`에 24개 + E-26 = 25개" | `EVENT_NAMES = Object.keys(EVENT_SPEC)` (25개, PRD 순서 + E-26 끝) | 명세 하나에서 이름이 나오게 |
