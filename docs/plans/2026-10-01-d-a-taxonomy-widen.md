# D-A 분류 넓히기 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 🎯 주제를 6 → 12개(분야 3 → 6, 키워드 초안 33개), 🍃 장르를 9 → 12개로 문서와 앱에 넣는다. 새 주제·장르는 **아직 0권**이므로 앱은 지금과 똑같이 돌아야 한다 — 🎯 주제는 `books.json`에 **10권 이상**일 때만 "켜져서" 직접 쓰기 분류(Claude 목록·enum, 단어 매칭)와 칩에 들어가고, 🍃 장르는 0권이면 그냥 뽑히지 않는다. 파이프라인(D-B)이 10권째를 넣으면 다음 배포부터 저절로 켜진다.

**Architecture:** 켜짐은 저장하지 않고 **계산한다** — 순수 함수 `lib/books/active.ts`(`activeTopics(books)` → 10권 이상인 주제, `activeVocab(vocab, topics)` → 그 주제만 남긴 vocab, `topicsIn(vocab)`)를 `lib/books/catalog.ts`가 실제 `books.json`에 적용해 `ACTIVE_VOCAB`을 만든다(서버, 빌드 때). `lib/goal/classify.ts`·`match.ts`는 `TOPICS` 대신 **받은 vocab의 주제**(`topicsIn`)만 쓰므로, `/api/goal/classify`가 `ACTIVE_VOCAB`을 넘기면 지시문·enum·단어 매칭이 모두 켜진 주제만 본다. 브라우저의 대체 단어 매칭은 `page.tsx`(서버 컴포넌트)가 `ACTIVE_VOCAB`을 `FlowRoot` → `Flow`에 prop으로 넘긴다 — `books.json`은 브라우저로 가지 않는다(빌드 결과로 확인). 목록 자체(`FIELD_OF_TOPIC`·`TOPICS`·`LEAF_GENRES`)는 12개씩으로 늘리고, 뽑기 요청 검사·책 가져오기 검사는 12개를 모두 받는다(꺼진 주제는 0권이라 바닥 알림뿐). 키워드 원본은 `data/processed/keyword_vocab.json`(새 주제는 `"draft": true`) → `npm run books:import` → `web/src/data/vocab.json`.

**Tech Stack:** Next.js 16.3.6 (App Router — 서버 컴포넌트 `page.tsx`가 클라이언트 컴포넌트에 직렬화 가능한 prop을 넘김, `node_modules/next/dist/docs/01-app/01-getting-started/05-server-and-client-components.md`) · React 19.2.8 · TypeScript 5 · Vitest 5.0.2 · Playwright 1.63 · Python 3(문서·JSON 편집만). 새 dependency 없음.

**Spec:** `docs/plans/2026-10-01-d-stage-design.md` 0·1절 · `docs/expansion-candidates.md` 2절(🎯)·3절(🍃)·4절(축 어림)·6절(경계 규칙) · `docs/context.md` 10-01 행들(확장 결정, B안, 10권 켜기) · `docs/target-chips.md` 2~4절 · `docs/book-pool.md` 1·4절 · `docs/DESIGN.md` T-02 · `docs/taxonomy.md` 2-5·4-2(E-03·E-21·E-26 `topic`) · `Galpi/CLAUDE.md` 원칙 1·2·3-1, `web/AGENTS.md`

**계획 속 코드 검증 (10-01):** `git worktree add ../galpi-da-scratch -b scratch/da 065335b`, 그 `web/`에서 **자체 `npm ci`**(junction 없음), 태스크 순서대로 이 계획의 코드를 넣고 태스크마다 커밋하며 확인했다. 이 계획의 코드 블록은 그 커밋들에서 그대로 뽑았다(`diff`는 `git show`의 hunk, 새 파일은 전체). 확인 뒤 worktree와 브랜치는 지웠다.
- 시작(`main` = `065335b`): Vitest **61파일 591개**, Playwright **90개**(목록), `tsc`·`eslint` 0. `npm run books:import`를 그대로 돌리면 `books.json`·`vocab.json` 모두 바뀌지 않음(가져오기가 깨끗하게 되풀이됨)
- 태스크별 Vitest: Task 1 → **62파일 604개** · Task 2 → 62파일 606개 · Task 3 → 62파일 623개 · Task 4 → 62파일 623개. 태스크마다 `tsc`·`eslint` 오류·경고 0
- 빨간 단계 확인: Task 1 새 테스트 → `active.test.ts` 가져오기 실패, 나머지 7개 실패 / Task 2 → 3개 실패 / Task 3 → 18개 실패(주식 라우트 테스트 하나는 이미 통과 — 넓힌 뒤에도 그대로인지 지키는 테스트)
- 최종: `test:cov` **62파일 623개**, 종료 코드 0(`src/lib/recommend` 100% 문턱 유지, 전체 lines 99.76%, `classify.ts`·`match.ts`·`catalog.ts` lines 100%) · Playwright **90개 → 82 통과 · 8 skip**(시작과 같은 휴대폰/데스크톱 전용 skip) · `next build` 통과(Playwright webServer)
- **분류 지시문이 그대로**: `classifySystemPrompt`·`classifySchema`의 sha256 앞 16자 — 시작(`vocab.json` 6주제) `prompt b056bfcc729908ed · schema 62ea7d140ab1a75c`, 끝(`ACTIVE_VOCAB`, 12주제 중 켜진 6개) **같은 값**. 그래서 `npm run goal:grade`(30개)는 다시 잴 필요가 없다 — 새 주제가 켜질 때(D-C) 새 예시를 더해 잰다
- 브라우저 코드: 빌드 결과 `.next/static`에 `books.json`의 한 줄(예: "쌍둥이로 태어나") 0건, 꺼진 주제의 패턴(예: "재테크") `.next/static`·`index.html`·`index.rsc` 0건. 켜진 vocab은 `index.html`의 RSC 데이터로만 간다
- `docs/stitch/DESIGN.md`: `npx --offline -p @google/design.md designmd lint` 오류 0·경고 0(캐시된 도구, Task 2·3 뒤 각각)
- Amplitude 추적 계획(`galpi` 870203, 읽기만): `topic`·`chip_value`·`keywords` 모두 `string`, **허용값(enum) 목록 없음** → 새 주제 값이 와도 Amplitude 쪽 고칠 것 없음

## 사용자가 정할 것 (구현 전)

1. **이름표 색 6개** (DESIGN T-02, 모두 흰 글자 WCAG AA 이상 — 시안: 구현 뒤 `/design` 색 표에 새 6칸이 함께 나온다)

   | 칸 | 값 | 흰 글자 | 고른 이유 |
   |---|---|---|---|
   | 🍃 역사 | `#8E3A3A` 적갈색 | 7.5 : 1 | 기존 장르에 없는 빨강 계열(옛 책 표지) |
   | 🍃 사회·시사 | `#5E6A2B` 올리브 | 5.9 : 1 | 노랑-초록 계열이 비어 있음(신문지) |
   | 🍃 호러·괴담 | `#6B2F5B` 짙은 자두 | 9.6 : 1 | 어둡고 서늘한 쪽, 추리(`#3E474C` 회청)와 구별 |
   | 🎯 돈·경제 | `#3D7350` 초록 | 5.6 : 1 | 분야 셋(파랑·보라·갈색)과 다른 색 |
   | 🎯 마음·관계 | `#A04F6E` 장밋빛 | 5.5 : 1 | 따뜻한 쪽 |
   | 🎯 일·커리어 | `#2D6F73` 청록 | 5.8 : 1 | 차분한 쪽 |

   🍃 색은 🍃끼리, 🎯 색은 🎯끼리만 한 판에 섞이므로(뽑기는 입구별) 장르 색과 분야 색이 비슷한 것(돈·경제 ↔ 에세이, 일·커리어 ↔ 과학 교양)은 겹치지 않는다. 바꾸면 `tokens.css` 한 줄·DESIGN T-02·`stitch/DESIGN.md` 값만
2. **🍃 처음 채우기 목표 350권** — 모든 장르 25권이면(300) "딴 세상"이 약 16%라 SF·판타지 60·호러·괴담 40으로 올렸다(어림 26%, `book-pool.md` 1-2절). SF·판타지 60은 공급이 빠듯할 수 있다. 대안: 에세이를 25보다 덜 채우기(현실 쪽 몰림)
3. **"마음·회복" 처리** — 이 계획: **마음 돌보기가 켜질 때까지 습관·집중에 둔다**(아래 "스펙끼리 부딪힌 곳" 5행). 지금 빼면 "번아웃"·"불안할 때 읽을 책"(채점 30개 중 2개)이 갈 곳을 잃는다. 마음 돌보기가 켜졌는데 남아 있으면 데이터 검사가 실패해서 D-C 검수 때 5권 다시 태그를 잊을 수 없다. 대안: 지금 5권에서 지우기(분류 결과가 바뀌므로 `goal:grade` 다시)
4. **키워드 단어 규칙(정규식) 초안** — `expansion-candidates`의 제목 규칙을 키워드 이름(설계 1-1절)에 맞춰 고쳤다. 확신이 낮은 것: ① `연금·노후`의 `FIRE`(영어 단어 경계로만) ② `감정 다루기`의 맨 `감정`(넓음 — 책을 모은 뒤 60% 규칙에 걸릴 수 있음) ③ `트렌드`(트렌드 코리아류가 대부분일 것) ④ `일기·편지`(맨 단어) ⑤ `업무 글`의 `보고서`("보고서를 AI로 빨리"는 지금 업무 자동화로 채점 — 글쓰기가 켜지면 단어 매칭은 글쓰기로 간다, 경계 규칙 한 줄 추가함) ⑥ `직장 생활`이라는 키워드 이름의 "생활"이 단어 매칭의 주제 말이 됨("자취 생활" → 취업·커리어, 켜진 뒤에만). 모두 D-C에서 실제 책으로 5권·60%를 다시 잰다

## 스펙끼리 부딪힌 곳과 이 계획의 선택

| 스펙 A | 스펙 B | 선택 | 이유 |
|---|---|---|---|
| 설계 1-2 "활성 주제만 … 보기 칩의 대상" | 같은 절 "D-D 전까지는 **기존 6개 칩을 그대로**" | `TOPIC_CHIPS`는 6개 그대로, 화면 코드 변경 없음. 대신 데이터 검사 "칩의 주제는 모두 켜져 있다" | 지금 6개는 모두 16~17권이라 걸러도 같다. 화면에 거르는 코드를 넣으면 prop만 늘고 D-D에서 지운다 |
| 지시문 "키워드를 `web/src/data/vocab.json`에" | `vocab.json`은 `npm run books:import`가 `data/processed/keyword_vocab.json`에서 만드는 파일 | 원본 `keyword_vocab.json`에 새 6주제(`"draft": true`, `books: 0`, `n: 0`)를 넣고 가져오기로 `vocab.json`을 만든다 | `vocab.json`만 고치면 다음 가져오기가 지우거나(`normalizeVocab`이 12주제를 요구) 실패한다 |
| 설계 1-2 "`normalize.ts`·`request.ts`·`draw.ts`(목록 검사)" | 10권 켜기 | 책 가져오기·뽑기 요청은 **12개 모두** 받는다. 켜짐은 분류(서버 라우트·브라우저 대체)에만 | 파이프라인이 넣는 새 주제 책이 가져오기를 통과해야 하고, 꺼진 주제로 뽑기를 요청할 길(분류·칩)이 없다. 와도 0권 → 바닥 알림 |
| 10권은 `books.json`에서 센다 | E2E는 `BOOKS_SOURCE=sample`(주제마다 2~5권) | 켜짐은 **항상 실제 `books.json`**으로 센다 | 테스트용 30권으로 세면 켜진 주제가 0개가 되어 E2E 분류가 깨진다. vocab도 지금 실제 것을 쓴다 — "운영과 같은 주제 목록" |
| 설계 1-1 "마음·회복은 마음 돌보기로 옮긴다" | 지시문 "지금은 같은 6주제 → `goal:grade` 그대로" | 마음 돌보기가 **켜질 때까지** 습관·집중에 둔다 + 그때 실패하는 데이터 검사 | 사용자 결정 3 |
| `book-pool.md` "첫 채우기 🍃 약 300" (설계 1-1) | "딴 세상 25%" (같은 줄) | 🍃 350 (SF·판타지 60, 호러 40) | 300으로는 어림 16%. 사용자 결정 2 |
| 설계 1-2 "새 주제가 들어간 지시문으로 `goal:grade` 다시" | 같은 결정 "활성 주제만 지시문에" | 지금은 다시 재지 않는다 — 지시문 해시가 같음을 보인다(Task 3 Step 6) | 켜진 주제가 같으면 지시문·enum이 바이트 단위로 같다. 새 주제가 켜지는 D-C에서 새 예시와 함께 |

## Global Constraints

- 브랜치: `main`(지금 `3701a0a` + 이 계획 커밋)에서 **`feat/d-a-taxonomy`**. 검증은 `065335b`에서 했고, 그 뒤 `main`의 `3701a0a`(S-06 보관 시안 — `DESIGN.md`·`PRD.md`·`context.md` 문서만)에 네 태스크 커밋이 충돌 없이 얹히는 것을 확인했다(diff의 줄 번호는 조금 밀릴 수 있다). 시작 전 `git status --short`가 비어 있어야 한다. 구현 전에 `web/AGENTS.md`를 읽는다
- **이벤트 변경 없음**: `topic`·`chip_value`·`keywords`는 명세(`schema.ts`)에서 `"string"`이고 taxonomy.md·csv도 값 목록을 열거하지 않는다(예시 값만, E-03 설명 "주제 보기 6개"는 칩이 6개 그대로라 사실). Amplitude에도 허용값 목록이 없다. 그래서 원칙 3-1의 순서(taxonomy.md → csv → schema → 테스트 → track)는 **해당 없음**. 커밋 본문마다 `- [x] events: taxonomy.md · taxonomy.csv · schema.ts changed together (or no event change)`. 모으는 정보도 같다 → `/privacy` 변경 없음
- **추천 규칙 변경 없음**: `lib/recommend/*`는 건드리지 않는다(점수·뽑기·시뮬레이션 일치 그대로)
- 새 주제·장르의 **책은 넣지 않는다**(D-C). `books.json`은 이 계획에서 바뀌지 않아야 한다(`git diff --exit-code web/src/data/books.json`)
- 키 값을 출력하지 않는다. `web/.env.local`·`Galpi/.env`를 열지 않는다. 바깥 API 호출 없음(Amplitude 확인은 계획 단계에서 끝남)
- 문구: 새 이용자 문구 없음(꺼진 주제는 기존 "아직 이 주제 책이 없어요…" 그대로)
- 파일 하나 300줄 이하(바뀐 코드 파일 최대 `Flow.tsx` 174)
- 커밋: 영어 conventional commits, 끝 줄 `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`. 명령은 `web/`에서(`npm run …`, `npx …`), 문서·Python은 `Galpi/`에서. Windows Git Bash. Python은 `PYTHONIOENCODING=utf-8`, 파일은 `newline=""`로 써서 줄 끝을 바꾸지 않는다(`.gitattributes` `* text=auto eol=lf`)
- 실패한 검사를 "관계없는 오류"로 넘기지 않는다. 태스크 끝마다 typecheck·lint·Vitest 전체가 통과해야 커밋한다

---

## File Structure

| 파일 | 책임 | 태스크 |
|---|---|---|
| `web/src/lib/books/active.ts` (새) | `MIN_ACTIVE_TOPIC_BOOKS`, `activeTopics`, `activeVocab`, `topicsIn` — 순수, 브라우저에서도 안전(JSON import 없음) | 1 |
| `web/src/lib/books/catalog.ts` | `ACTIVE_VOCAB` — 실제 `books.json` + `vocab.json`(서버 코드만 import) | 1 |
| `web/src/lib/goal/classify.ts`·`match.ts` | `TOPICS` 대신 `topicsIn(vocab)` — 받은 vocab의 주제만 | 1 |
| `web/src/app/api/goal/classify/route.ts` | Claude·단어 매칭에 `ACTIVE_VOCAB` | 1 |
| `web/src/app/page.tsx`, `components/flow/FlowRoot.tsx`·`Flow.tsx` | `vocab` prop(브라우저 대체 단어 매칭), `vocab.json` 직접 import 제거 | 1 |
| `web/src/lib/books/taxonomy.ts` | `LEAF_GENRES` 12·`GENRE_TONE` / `FIELD_OF_TOPIC` 12·`TOPICS` = 그 키·`FIELD_TONE` 6. `TOPIC_CHIPS` 6 그대로 | 2·3 |
| `web/src/styles/tokens.css`, `web/src/app/design/page.tsx` | 새 색 6개 / `/design` 색 표에 새 장르·분야 | 2·3 |
| `data/processed/keyword_vocab.json` → `web/src/data/vocab.json` | 새 6주제 키워드 초안 33개 | 3 |
| 테스트: `active.test.ts`(새), `classify.test.ts`, `match.test.ts`, `classify/route.test.ts`, `data.test.ts`, `taxonomy.test.ts`, `normalize.test.ts` | 각 태스크 | 1~3 |
| `docs/target-chips.md`, `PRD.md` | 켜는 규칙 / 2-1절 v2 목록·정의·경계, D-02 | 1·3 |
| `docs/book-pool.md`, `DESIGN.md`, `stitch/DESIGN.md`, `PRD.md` | 🍃 목표·경계·색 / 🎯 목표·색, 4절 | 2·3 |
| `docs/PHASES.md`, `context.md`, `tasks.md` | D 단계 행, 결정 기록 | 4 |

### 인터페이스 한눈에

```ts
// lib/books/active.ts (Task 1) — pure
export const MIN_ACTIVE_TOPIC_BOOKS = 10;
export function activeTopics(books: readonly Pick<CatalogBook, "entry" | "topic">[], min?: number): Topic[]; // TOPICS order
export function activeVocab(vocab: Vocab, topics: readonly Topic[]): Vocab;                                  // TOPICS order
export function topicsIn(vocab: Vocab): Topic[];                                                               // TOPICS order
// lib/books/catalog.ts (Task 1) — server code only (imports books.json)
export const ACTIVE_VOCAB: Vocab;
// components (Task 1)
export function FlowRoot(props: { vocab: Vocab }): JSX.Element;
export function Flow(props: { vocab: Vocab }): JSX.Element;
// lib/goal — signatures unchanged; every topic list now comes from topicsIn(vocab)
classifySystemPrompt(vocab) · classifySchema(vocab) · parseClassification(raw, input, vocab) · matchGoal(input, vocab)
// lib/books/taxonomy.ts (Task 2·3)
export const LEAF_GENRES: readonly [...9, "역사", "사회·시사", "호러·괴담"];
export const FIELD_OF_TOPIC: { …6, "돈 관리·투자": "돈·경제", "경제 상식": "돈·경제", "마음 돌보기": "마음·관계",
  "대화·관계": "마음·관계", "취업·커리어": "일·커리어", 글쓰기: "일·커리어" };
export const TOPICS: readonly Topic[];          // Object.keys(FIELD_OF_TOPIC) — 12 (was TOPIC_CHIPS.map — 6)
export const TOPIC_CHIPS;                       // unchanged: the first six, until D-D
```

**🍃 장르에 켜는 규칙이 필요 없는 근거(코드 확인)**: `LEAF_GENRES`를 쓰는 곳은 `normalize.ts`(가져오기 검사)뿐이다. `lib/books/draw.ts`의 `drawLeaf`는 🍃 책 전체를 점수로 뽑고, `lib/recommend/draw.ts`의 장르 상한은 뽑힌 책의 장르를 셀 뿐 장르 목록을 돌지 않는다. `/design`은 색 토큰만 보여 준다. Python `src/simulate_real.py`는 실제 책에서 장르를 읽고(목록 없음), `src/simulate_draws.py`의 `LEAF_GENRES`는 가상 태그를 만드는 모형이라 실제 앱과 무관하다.

---

### Task 1: 켜진 주제만 분류한다 — `lib/books/active.ts` + 분류·단어 매칭이 받은 vocab의 주제만

목록은 아직 6개 그대로다. 이 태스크는 동작이 바뀌지 않는다(6개 모두 16~17권) — 다음 태스크들이 주제를 늘려도 꺼진 주제가 새지 않게 하는 이음매다.

**Files:**
- Create: `web/src/lib/books/active.ts`, `web/src/lib/books/active.test.ts`
- Modify: `web/src/lib/goal/classify.ts`, `web/src/lib/goal/match.ts`, `web/src/lib/books/catalog.ts`, `web/src/app/api/goal/classify/route.ts`, `web/src/app/page.tsx`, `web/src/components/flow/FlowRoot.tsx`, `web/src/components/flow/Flow.tsx`, `docs/target-chips.md`, `docs/PRD.md`
- Test: `web/src/lib/goal/classify.test.ts`, `web/src/lib/goal/match.test.ts`, `web/src/app/api/goal/classify/route.test.ts`, `web/src/lib/books/data.test.ts`

**Interfaces:**
- Consumes: `TOPICS`·`Topic`(`taxonomy.ts`), `CatalogBook`·`Vocab`(`types.ts`), `books.json`·`vocab.json`
- Produces: `MIN_ACTIVE_TOPIC_BOOKS`, `activeTopics`, `activeVocab`, `topicsIn`, `ACTIVE_VOCAB`, `FlowRoot`·`Flow`의 `vocab` prop

- [ ] **Step 0: 브랜치**

```bash
cd Galpi
git switch main && git pull --ff-only
git status --short                         # 비어 있어야 한다
git switch -c feat/d-a-taxonomy
cd web                                     # 명령은 web/에서, git add·문서·Python은 Galpi/에서
```

- [ ] **Step 1: 실패하는 테스트** — `web/src/lib/books/active.test.ts`

```ts
import { describe, expect, it } from "vitest";
import { MIN_ACTIVE_TOPIC_BOOKS, activeTopics, activeVocab, topicsIn } from "./active";
import type { Vocab } from "./types";

const target = (topic: string) => ({ entry: "target" as const, topic });
const leaf = { entry: "leaf" as const, topic: null };
const books = (topic: string, n: number) => Array.from({ length: n }, () => target(topic));

const VOCAB: Vocab = {
  통계: { keywords: { 확률: "확률" }, terms: [] },
  "데이터 분석": { keywords: { SQL: "SQL" }, terms: ["엑셀"] },
  "습관·집중": { keywords: { 습관: "습관|루틴" }, terms: [] },
};

describe("activeTopics", () => {
  it("turns a topic on at ten books (the 10-01 rule)", () => {
    expect(MIN_ACTIVE_TOPIC_BOOKS).toBe(10);
    expect(activeTopics([...books("통계", 10), ...books("습관·집중", 9)])).toEqual(["통계"]);
  });

  it("counts only 🎯 books and keeps our topic order", () => {
    const all = [...books("습관·집중", 12), ...books("데이터 분석", 10), leaf, target("요리"), ...books("요리", 20)];
    expect(activeTopics(all)).toEqual(["데이터 분석", "습관·집중"]);
  });

  it("takes another threshold and gives nothing for an empty catalogue", () => {
    expect(activeTopics(books("통계", 3), 3)).toEqual(["통계"]);
    expect(activeTopics([])).toEqual([]);
  });
});

describe("activeVocab and topicsIn", () => {
  it("cuts the vocabulary to the active topics, in our topic order", () => {
    const cut = activeVocab(VOCAB, ["습관·집중", "데이터 분석", "AI 활용"]);
    expect(Object.keys(cut)).toEqual(["데이터 분석", "습관·집중"]);
    expect(cut["데이터 분석"]).toBe(VOCAB["데이터 분석"]);
    expect(activeVocab(VOCAB, [])).toEqual({});
  });

  it("lists the topics a vocabulary covers, in our order, ignoring names that are not topics", () => {
    expect(topicsIn(VOCAB)).toEqual(["데이터 분석", "통계", "습관·집중"]);
    expect(topicsIn({ 요리: { keywords: {}, terms: [] } })).toEqual([]);
  });
});
```

- [ ] **Step 2: 실패 확인**

Run: `npx vitest run src/lib/books/active.test.ts`
Expected: FAIL — `Failed to resolve import "./active"`

- [ ] **Step 3: 구현** — `web/src/lib/books/active.ts`

```ts
import { TOPICS, type Topic } from "./taxonomy";
import type { CatalogBook, Vocab } from "./types";

/**
 * D-A (context 10-01): a 🎯 topic is active — offered to 직접 쓰기 sorting (the Claude list and enum, word matching) and
 * shown as a chip — only once the catalogue holds this many of its books. Until then a note about it lands on the nearest
 * active topic with matched=false, like any note outside our list. Counted from books.json, so the daily pipeline turns a
 * topic on with the deploy that carries its tenth book.
 */
export const MIN_ACTIVE_TOPIC_BOOKS = 10;

/** Topics with at least `min` 🎯 books, in TOPICS order. */
export function activeTopics(books: readonly Pick<CatalogBook, "entry" | "topic">[], min = MIN_ACTIVE_TOPIC_BOOKS): Topic[] {
  const count = new Map<string, number>();
  for (const b of books) if (b.entry === "target" && b.topic) count.set(b.topic, (count.get(b.topic) ?? 0) + 1);
  return TOPICS.filter((t) => (count.get(t) ?? 0) >= min);
}

/** The vocabulary cut to these topics (TOPICS order) — what sorting and word matching may answer with. */
export function activeVocab(vocab: Vocab, topics: readonly Topic[]): Vocab {
  return Object.fromEntries(TOPICS.filter((t) => topics.includes(t) && Object.hasOwn(vocab, t)).map((t) => [t, vocab[t]]));
}

/** Our topics that a vocabulary covers, in TOPICS order. */
export function topicsIn(vocab: Vocab): Topic[] {
  return TOPICS.filter((t) => Object.hasOwn(vocab, t));
}
```

Run: `npx vitest run src/lib/books/active.test.ts` → PASS (5)

- [ ] **Step 4: 분류가 켜진 주제만 보는지 묻는 테스트** — 네 파일

```diff
--- a/web/src/lib/goal/classify.test.ts
+++ b/web/src/lib/goal/classify.test.ts
@@ -1,5 +1,6 @@
 import { describe, expect, it } from "vitest";
 import vocab from "@/data/vocab.json";
+import { activeTopics, activeVocab } from "@/lib/books/active";
 import { TOPICS } from "@/lib/books/taxonomy";
 import type { Vocab } from "@/lib/books/types";
 import { CLASSIFY_MODEL, classifySchema, classifySystemPrompt, keywordAliases, parseClassification } from "./classify";
@@ -39,6 +40,29 @@ describe("classify prompt and schema", () => {
   });
 });
 
+describe("only active topics reach the model (D-A, 10 books)", () => {
+  // 시간·생산성 has 9 books here: it must not be offered, named in the schema, or accepted back.
+  const books = TOPICS.flatMap((topic) => Array.from({ length: topic === "시간·생산성" ? 9 : 10 }, () => ({ entry: "target" as const, topic })));
+  const ACTIVE = activeVocab(VOCAB, activeTopics(books));
+
+  it("leaves an inactive topic and its keywords out of the prompt", () => {
+    const prompt = classifySystemPrompt(ACTIVE);
+    expect(prompt).not.toContain("시간·생산성");
+    expect(prompt).not.toContain("일하는 법");
+    expect(prompt).toContain("- 습관·집중: keywords [");
+  });
+
+  it("leaves an inactive topic and its keywords out of the schema enums", () => {
+    const schema = classifySchema(ACTIVE) as { properties: Record<string, { enum?: string[]; items?: { enum: string[] } }> };
+    expect(schema.properties.topic.enum).toEqual(TOPICS.filter((t) => t !== "시간·생산성"));
+    expect(schema.properties.keywords.items?.enum).not.toContain("일하는 법");
+  });
+
+  it("voids an answer that names an inactive topic", () => {
+    expect(parseClassification(answer({ topic: "시간·생산성", keywords: [], matched: true }), "시간 관리", ACTIVE)).toBeNull();
+  });
+});
+
 describe("parseClassification", () => {
   it("keeps a topic's lone keyword only when the note's words match it", () => {
     const sql = answer({ topic: "데이터 분석", keywords: ["SQL"], matched: true });
```

`matchGoal`은 지금 꺼진 주제의 **이름**("습관·집중" → "집중")으로도 글을 연결한다 — 그 길도 막혔는지 본다.

```diff
--- a/web/src/lib/goal/match.test.ts
+++ b/web/src/lib/goal/match.test.ts
@@ -59,6 +59,20 @@ describe("matchGoal", () => {
     expect(matchGoal("   ", VOCAB)).toMatchObject({ matched: false, text: "" });
   });
 
+  it("searches only the topics of the vocabulary it is given (the active ones)", () => {
+    const rest: Vocab = Object.fromEntries(Object.entries(VOCAB).filter(([topic]) => topic !== "습관·집중"));
+    expect(matchGoal("번아웃", VOCAB)).toMatchObject({ topic: "습관·집중", matched: true });
+    expect(matchGoal("번아웃", rest)).toMatchObject({ matched: false });
+    // the topic's own name is not a way in either while it is off
+    expect(matchGoal("집중이 안 돼요", VOCAB)).toMatchObject({ topic: "습관·집중", matched: true });
+    expect(matchGoal("집중이 안 돼요", rest)).toMatchObject({ topic: "데이터 분석", matched: false });
+  });
+
+  it("still answers (unmatched, first topic) when no topic is active", () => {
+    expect(matchGoal("집중이 안 돼요", {})).toMatchObject({ topic: "데이터 분석", keywords: [], matched: false });
+    expect(matchGoal("", {})).toMatchObject({ topic: "데이터 분석", matched: false });
+  });
+
   it("keeps at most 30 characters", () => {
     expect(matchGoal(`  ${"가".repeat(40)}  `, VOCAB).text).toHaveLength(GOAL_MAX);
   });
```

라우트 테스트는 주소마다 분당 10회 한도가 있어 새 테스트는 자기 주소(`8.8.4.4`)를 쓴다.

```diff
--- a/web/src/app/api/goal/classify/route.test.ts
+++ b/web/src/app/api/goal/classify/route.test.ts
@@ -1,5 +1,6 @@
 // @vitest-environment node
 import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
+import { ACTIVE_VOCAB } from "@/lib/books/catalog";
 import type { GoalMatch } from "@/lib/goal/match";
 import { resetDailyBudgets } from "@/lib/server/guard";
 import { classifyWithClaude } from "@/lib/server/llm";
@@ -40,6 +41,13 @@ describe("POST /api/goal/classify", () => {
     expect(vi.mocked(classifyWithClaude).mock.calls[0][2]).toEqual({ apiKey: "test-key-not-real" });
   });
 
+  it("gives Claude the active topics only (D-A: 10 books or more)", async () => {
+    vi.stubEnv("ANTHROPIC_API_KEY", "test-key-not-real");
+    vi.mocked(classifyWithClaude).mockResolvedValue({ ok: true, goal: LLM_GOAL });
+    await post({ text: "번아웃" }, { origin: ORIGIN, "x-forwarded-for": "8.8.4.4" });
+    expect(vi.mocked(classifyWithClaude).mock.calls[0][1]).toBe(ACTIVE_VOCAB);
+  });
+
   it("falls back to word matching on a timeout and logs only the reason, never the note", async () => {
     vi.stubEnv("ANTHROPIC_API_KEY", "test-key-not-real");
     vi.mocked(classifyWithClaude).mockResolvedValue({ ok: false, reason: "timeout" });
```

실제 데이터 검사 — "켜진 주제 = 10권 이상인 주제 = 지시문·enum의 주제", "칩의 주제는 모두 켜져 있다"(설계 1-2의 칩 규칙을 D-D 전까지 이 검사로 지킨다). 오늘 6개라는 숫자는 박지 않는다(파이프라인이 주제를 켜면 깨지므로).

```diff
--- a/web/src/lib/books/data.test.ts
+++ b/web/src/lib/books/data.test.ts
@@ -2,8 +2,11 @@ import { describe, expect, it } from "vitest";
 import real from "@/data/books.json";
 import sample from "@/data/books.sample.json";
 import vocab from "@/data/vocab.json";
+import { classifySchema, classifySystemPrompt } from "@/lib/goal/classify";
+import { MIN_ACTIVE_TOPIC_BOOKS, activeTopics } from "./active";
+import { ACTIVE_VOCAB } from "./catalog";
 import { normalizeCatalog } from "./normalize";
-import { TOPICS } from "./taxonomy";
+import { TOPIC_CHIPS, TOPICS } from "./taxonomy";
 import type { CatalogBook } from "./types";
 
 const asRows = (books: CatalogBook[]) => books.map((b) => ({ ...b, slot: b.entry === "leaf" ? b.genre : b.topic }));
@@ -24,6 +27,25 @@ describe("app book data", () => {
     expect(target.filter((b) => b.keywords.includes("SQL"))).toHaveLength(2);
   });
 
+  it("activates exactly the topics with 10+ books in books.json — the classifier sees only those", () => {
+    const books = real as unknown as CatalogBook[];
+    const count = (t: string) => books.filter((b) => b.entry === "target" && b.topic === t).length;
+    const active = activeTopics(books);
+    expect(Object.keys(ACTIVE_VOCAB)).toEqual(active);
+    const enumTopics = (classifySchema(ACTIVE_VOCAB) as { properties: { topic: { enum: string[] } } }).properties.topic.enum;
+    expect(enumTopics).toEqual(active);
+    const prompt = classifySystemPrompt(ACTIVE_VOCAB);
+    for (const t of TOPICS) {
+      expect(count(t) >= MIN_ACTIVE_TOPIC_BOOKS).toBe(active.includes(t));
+      expect(prompt.includes(`- ${t}`)).toBe(active.includes(t));
+    }
+  });
+
+  it("shows a chip only for an active topic (S-02 keeps its six until D-D)", () => {
+    const active = activeTopics(real as unknown as CatalogBook[]);
+    expect(TOPIC_CHIPS.map((c) => c.topic).filter((t) => !active.includes(t))).toEqual([]);
+  });
+
   it("vocab.json covers all six topics with the 20 keywords of v1.1", () => {
     expect(Object.keys(vocab)).toEqual([...TOPICS]);
     const count = Object.values(vocab).reduce((n, t) => n + Object.keys(t.keywords).length, 0);
```

- [ ] **Step 5: 실패 확인**

Run: `npx vitest run src/lib/goal src/app/api/goal src/lib/books/data.test.ts`
Expected: FAIL 7개 — "gives Claude the active topics only", "leaves an inactive topic … out of the prompt", "… out of the schema enums", "voids an answer that names an inactive topic", "activates exactly the topics with 10+ books …"(`ACTIVE_VOCAB`이 아직 없음), match의 "searches only the topics …"·"still answers … when no topic is active"(지금은 주제 이름 "집중"으로 습관·집중에 연결됨)

- [ ] **Step 6: 구현** — 분류·단어 매칭은 `topicsIn(vocab)`, 서버는 `ACTIVE_VOCAB`, 처음 화면은 prop

```diff
--- a/web/src/lib/goal/classify.ts
+++ b/web/src/lib/goal/classify.ts
@@ -1,4 +1,5 @@
-import { MAX_KEYWORDS, TOPIC_CHIPS, TOPICS, type Topic } from "@/lib/books/taxonomy";
+import { topicsIn } from "@/lib/books/active";
+import { MAX_KEYWORDS, TOPIC_CHIPS, type Topic } from "@/lib/books/taxonomy";
 import type { Vocab } from "@/lib/books/types";
 import { GOAL_MAX, type GoalMatch } from "./match";
 
@@ -42,9 +43,12 @@ const keywordText = (vocab: Vocab, topic: Topic): string =>
     })
     .join(", ");
 
-/** The closed list, written out for the model: topic (chip label) → keywords, plus words that fold into the topic. */
+/**
+ * The closed list, written out for the model: topic (chip label) → keywords, plus words that fold into the topic.
+ * Only the topics in `vocab` — callers pass the active ones (lib/books/active.ts), so a topic with too few books is not offered.
+ */
 export function classifySystemPrompt(vocab: Vocab): string {
-  const lines = TOPICS.map((topic) => {
+  const lines = topicsIn(vocab).map((topic) => {
     const label = TOPIC_CHIPS.find((c) => c.topic === topic)?.label ?? topic;
     const also = vocab[topic]?.terms ?? [];
     const named = label === topic ? topic : `${topic} (${label})`;
@@ -64,13 +68,14 @@ export function classifySystemPrompt(vocab: Vocab): string {
   ].join("\n");
 }
 
-/** Structured-output schema: the model can only name our topics and keywords (enums). */
+/** Structured-output schema: the model can only name the topics and keywords in `vocab` (enums). */
 export function classifySchema(vocab: Vocab): Record<string, unknown> {
-  const all = [...new Set(TOPICS.flatMap((t) => keywordNames(vocab, t)))];
+  const topics = topicsIn(vocab);
+  const all = [...new Set(topics.flatMap((t) => keywordNames(vocab, t)))];
   return {
     type: "object",
     properties: {
-      topic: { type: "string", enum: [...TOPICS] },
+      topic: { type: "string", enum: topics },
       keywords: { type: "array", items: { type: "string", enum: all } },
       matched: { type: "boolean" },
     },
@@ -80,8 +85,8 @@ export function classifySchema(vocab: Vocab): Record<string, unknown> {
 }
 
 /**
- * The model's JSON → GoalMatch (method "llm"), or null when it is not usable. Anything outside our list is dropped:
- * an unknown topic voids the answer, keywords of another topic are discarded, at most MAX_KEYWORDS remain.
+ * The model's JSON → GoalMatch (method "llm"), or null when it is not usable. Anything outside `vocab` is dropped:
+ * an unknown (or inactive) topic voids the answer, keywords of another topic are discarded, at most MAX_KEYWORDS remain.
  */
 export function parseClassification(raw: string, input: string, vocab: Vocab): GoalMatch | null {
   let answer: unknown;
@@ -92,7 +97,7 @@ export function parseClassification(raw: string, input: string, vocab: Vocab): G
   }
   if (typeof answer !== "object" || answer === null) return null;
   const { topic, keywords, matched } = answer as Record<string, unknown>;
-  if (typeof topic !== "string" || !(TOPICS as readonly string[]).includes(topic) || typeof matched !== "boolean") return null;
+  if (typeof topic !== "string" || !(topicsIn(vocab) as string[]).includes(topic) || typeof matched !== "boolean") return null;
   if (!Array.isArray(keywords)) return null;
   const known = keywordNames(vocab, topic as Topic);
   const picked = matched ? [...new Set(keywords.filter((k): k is string => typeof k === "string" && known.includes(k)))] : [];
```

```diff
--- a/web/src/lib/goal/match.ts
+++ b/web/src/lib/goal/match.ts
@@ -1,3 +1,4 @@
+import { topicsIn } from "@/lib/books/active";
 import { MAX_KEYWORDS, TOPIC_CHIPS, TOPICS, type Topic } from "@/lib/books/taxonomy";
 import type { Vocab } from "@/lib/books/types";
 
@@ -27,23 +28,27 @@ function topicWords(topic: Topic, vocab: Vocab): string[] {
   return [...new Set(words.flatMap((w) => w.split(/[·\s]+/)).map(squash).filter((w) => w.length >= 2))];
 }
 
-/** Highest score wins; chip order breaks ties; all zero keeps the first chip. */
-function rank(score: (topic: Topic) => number): { topic: Topic; score: number } {
-  return TOPICS.reduce<{ topic: Topic; score: number }>((best, topic) => {
+/** Highest score wins; topic order breaks ties; all zero keeps the first topic. */
+function rank(topics: readonly Topic[], score: (topic: Topic) => number): { topic: Topic; score: number } {
+  return topics.reduce<{ topic: Topic; score: number }>((best, topic) => {
     const s = score(topic);
     return s > best.score ? { topic, score: s } : best;
-  }, { topic: TOPICS[0], score: 0 });
+  }, { topic: topics[0] ?? TOPICS[0], score: 0 });
 }
 
-/** Word matching for 직접 쓰기 — only inside our topics and keywords. The fallback behind the LLM (P4) and offline. */
+/**
+ * Word matching for 직접 쓰기 — only inside the topics and keywords of `vocab` (callers pass the active ones,
+ * lib/books/active.ts). The fallback behind the LLM (P4) and offline.
+ */
 export function matchGoal(input: string, vocab: Vocab): GoalMatch {
   const text = input.trim().slice(0, GOAL_MAX);
   const flat = squash(text);
+  const topics = topicsIn(vocab);
   const base = { text, keywords: [] as string[], method: "word" as const };
-  if (!flat) return { ...base, topic: TOPICS[0], matched: false };
+  if (!flat) return { ...base, topic: topics[0] ?? TOPICS[0], matched: false };
 
   let top: { topic: Topic; keywords: string[] } | null = null;
-  for (const topic of TOPICS) {
+  for (const topic of topics) {
     const hits = Object.entries(vocab[topic]?.keywords ?? {})
       .filter(([, pattern]) => new RegExp(pattern, "i").test(text))
       .map(([name]) => name);
@@ -52,10 +57,10 @@ export function matchGoal(input: string, vocab: Vocab): GoalMatch {
   // The server takes at most MAX_KEYWORDS: keep the first ones in vocab order.
   if (top) return { ...base, topic: top.topic, keywords: top.keywords.slice(0, MAX_KEYWORDS), matched: true };
 
-  const byWords = rank((topic) => topicWords(topic, vocab).filter((w) => flat.includes(w)).length);
+  const byWords = rank(topics, (topic) => topicWords(topic, vocab).filter((w) => flat.includes(w)).length);
   if (byWords.score > 0) return { ...base, topic: byWords.topic, matched: true };
 
   const grams = bigrams(flat);
-  const nearest = rank((topic) => topicWords(topic, vocab).reduce((n, w) => n + [...bigrams(w)].filter((g) => grams.has(g)).length, 0));
+  const nearest = rank(topics, (topic) => topicWords(topic, vocab).reduce((n, w) => n + [...bigrams(w)].filter((g) => grams.has(g)).length, 0));
   return { ...base, topic: nearest.topic, matched: false };
 }
```

```diff
--- a/web/src/lib/books/catalog.ts
+++ b/web/src/lib/books/catalog.ts
@@ -1,13 +1,22 @@
 import real from "@/data/books.json";
 import sample from "@/data/books.sample.json";
+import vocab from "@/data/vocab.json";
 import type { Book } from "@/lib/recommend";
-import type { BookCard, CatalogBook } from "./types";
+import { activeTopics, activeVocab } from "./active";
+import type { BookCard, CatalogBook, Vocab } from "./types";
 
 /** BOOKS_SOURCE=sample (E2E, tests) draws from the 30-book fixture; otherwise the imported catalogue. Read on every call. */
 export function catalog(): CatalogBook[] {
   return (process.env.BOOKS_SOURCE === "sample" ? sample : real) as unknown as CatalogBook[];
 }
 
+/**
+ * vocab.json cut to the 🎯 topics the published catalogue (books.json) can fill — what 직접 쓰기 sorting and word matching
+ * may answer with (lib/books/active.ts). Always the real books: BOOKS_SOURCE=sample only changes which books are drawn,
+ * so E2E sorts notes into the same topics as production. Server code only — it carries the whole catalogue.
+ */
+export const ACTIVE_VOCAB: Vocab = activeVocab(vocab as Vocab, activeTopics(real as unknown as CatalogBook[]));
+
 export function toBook(b: CatalogBook): Book {
   if (b.entry === "leaf") return { id: b.isbn, entry: "leaf", genre: b.genre, pages: b.pages, axes: b.axes };
   return { id: b.isbn, entry: "target", field: b.field, topic: b.topic, genre: b.genre, pages: b.pages, way: b.way, keywords: b.keywords };
```

```diff
--- a/web/src/app/api/goal/classify/route.ts
+++ b/web/src/app/api/goal/classify/route.ts
@@ -1,5 +1,4 @@
-import vocab from "@/data/vocab.json";
-import type { Vocab } from "@/lib/books/types";
+import { ACTIVE_VOCAB } from "@/lib/books/catalog";
 import { GOAL_MAX, matchGoal } from "@/lib/goal/match";
 import { guardJson, takeDailyBudget } from "@/lib/server/guard";
 import { classifyWithClaude } from "@/lib/server/llm";
@@ -9,7 +8,7 @@ const PER_MINUTE = 10;            // one per [책 펼치기]; the one edit makes
 const LLM_CALLS_PER_DAY = 300;    // per instance, UTC day; ~US$0.0018 a call → about US$0.55 a day at most per instance
 
 /**
- * POST /api/goal/classify { text } → GoalMatch (target-chips 3절). Claude Haiku sorts the note into our list when
+ * POST /api/goal/classify { text } → GoalMatch (target-chips 3절). Claude Haiku sorts the note into our active topics when
  * ANTHROPIC_API_KEY is set; no key, a failure, 3 seconds or a used-up daily budget → the same word matching the browser used
  * in P3 (method "word").
  * The note itself is never logged.
@@ -24,12 +23,12 @@ export async function POST(request: Request): Promise<Response> {
   const apiKey = process.env.ANTHROPIC_API_KEY?.trim();
   if (apiKey) {
     if (takeDailyBudget("classify-llm", LLM_CALLS_PER_DAY)) {
-      const result = await classifyWithClaude(text, vocab as Vocab, { apiKey });
+      const result = await classifyWithClaude(text, ACTIVE_VOCAB, { apiKey });
       if (result.ok) return Response.json(result.goal);
       console.warn("classify: fell back to word matching", result.reason);
     } else {
       console.warn("classify: fell back to word matching", "budget");
     }
   }
-  return Response.json(matchGoal(text, vocab as Vocab));
+  return Response.json(matchGoal(text, ACTIVE_VOCAB));
 }
```

`page.tsx`는 서버 컴포넌트라 `catalog.ts`(→ `books.json`)를 import해도 브라우저로 가지 않는다. 넘기는 것은 켜진 주제의 vocab(약 2KB)뿐 — 지금 `Flow.tsx`가 브라우저 코드에 넣는 `vocab.json`과 같은 크기이고, 꺼진 주제가 늘어도 커지지 않는다.

```diff
--- a/web/src/app/page.tsx
+++ b/web/src/app/page.tsx
@@ -1,11 +1,12 @@
 import { TrackVisit } from "@/components/TrackVisit";
 import { FlowRoot } from "@/components/flow/FlowRoot";
+import { ACTIVE_VOCAB } from "@/lib/books/catalog";
 
 export default function Page() {
   return (
     <>
       <TrackVisit />
-      <FlowRoot />
+      <FlowRoot vocab={ACTIVE_VOCAB} />
     </>
   );
 }
```

```diff
--- a/web/src/components/flow/FlowRoot.tsx
+++ b/web/src/components/flow/FlowRoot.tsx
@@ -1,13 +1,17 @@
 "use client";
 import { useSyncExternalStore } from "react";
+import type { Vocab } from "@/lib/books/types";
 import { Flow } from "./Flow";
 import { Home } from "./Home";
 
 const subscribe = () => () => {};
 const noop = () => {};
 
-/** Server HTML (and the hydration pass) is S-01; the browser then resumes the saved flow without a mismatch. */
-export function FlowRoot() {
+/**
+ * Server HTML (and the hydration pass) is S-01; the browser then resumes the saved flow without a mismatch.
+ * vocab: the active 🎯 topics' part of vocab.json, worked out on the server (page.tsx) so books.json never ships.
+ */
+export function FlowRoot({ vocab }: { vocab: Vocab }) {
   const inBrowser = useSyncExternalStore(subscribe, () => true, () => false);
-  return inBrowser ? <Flow /> : <Home onStart={noop} />;
+  return inBrowser ? <Flow vocab={vocab} /> : <Home onStart={noop} />;
 }
```

```diff
--- a/web/src/components/flow/Flow.tsx
+++ b/web/src/components/flow/Flow.tsx
@@ -1,7 +1,6 @@
 "use client";
 import { useEffect, useReducer, useState } from "react";
 import { MotionConfig } from "motion/react";
-import vocab from "@/data/vocab.json";
 import type { BalanceChoice, Entry } from "@/lib/recommend";
 import { newArtSeed } from "@/lib/art/combine";
 import { loadDetail } from "@/lib/books/detailClient";
@@ -21,10 +20,11 @@ import { Home } from "./Home";
 import { ResultBook } from "./ResultBook";
 import { TargetInput } from "./TargetInput";
 
-const VOCAB = vocab as Vocab;
-
-/** S-01 → S-05 → S-06 → S-08. Cross-screen events are sent here, in the handlers (never from effects). */
-export function Flow() {
+/**
+ * S-01 → S-05 → S-06 → S-08. Cross-screen events are sent here, in the handlers (never from effects).
+ * vocab: the active 🎯 topics only (FlowRoot) — the word matching used when /api/goal/classify cannot answer.
+ */
+export function Flow({ vocab }: { vocab: Vocab }) {
   const [state, dispatch] = useReducer(flowReducer, undefined, loadFlow);
   const [classifying, setClassifying] = useState(false);
 
@@ -93,7 +93,7 @@ export function Flow() {
     let goal: GoalMatch | null = null;
     if (form.free !== null) {
       setClassifying(true);
-      goal = await classifyGoal(form.free, VOCAB);
+      goal = await classifyGoal(form.free, vocab);
       setClassifying(false);
     }
     track("goal_submitted", goalSubmittedProps(form, goal, state.edited));
```

- [ ] **Step 7: 통과 확인**

```bash
npm run typecheck && npm run lint
npx vitest run                          # 62파일 604개
```

- [ ] **Step 8: 문서** — 켜는 규칙

```diff
--- a/docs/target-chips.md
+++ b/docs/target-chips.md
@@ -61,6 +61,8 @@ D2 체크에서 사용자가 "조금 알아요"를 한 번도 고르지 않았
 
 > **구현 (P4, 10-01)**: `POST /api/goal/classify` — `claude-haiku-4-5-20251001`, 구조화 출력(JSON 스키마의 enum = 우리 주제 6개·키워드 목록), 재시도 없음, 3초에서 끊음. 목록 밖 주제면 답을 버리고, 다른 주제의 키워드는 지운다. 키가 없거나 실패·시간 초과면 같은 라우트가 단어 매칭(`lib/goal/match.ts`)으로 답하고, 라우트까지 실패하면 브라우저가 단어 매칭. E-21 `method`가 `llm` / `word`. 보내는 것은 적은 글뿐(처리방침 "기록을 전달하는 곳"). 6절의 30개 채점은 `npm run goal:grade` → `docs/goal-grading.md`
 
+> **켜는 규칙 (D-A, 10-01)**: 주제는 `books.json`에 그 주제 책이 **10권 이상**일 때만 켜진다(`MIN_ACTIVE_TOPIC_BOOKS`, `web/src/lib/books/active.ts`). 켜진 주제만 Claude 목록·enum, 단어 매칭, 보기 칩에 들어간다. 꺼진 주제의 말(예: "주식")은 지금처럼 가장 가까운 켜진 주제 + `matched=false` — 첫 장 "아직 이 주제 책이 없어요", 못 찾은 요청으로 기록. 새 안내 문구는 없다. 계산은 서버가 `books.json`에서 하므로(빌드 때) 파이프라인이 10권째를 넣으면 **다음 배포부터 저절로 켜진다**. 테스트용 30권(`BOOKS_SOURCE=sample`)으로 뽑을 때도 켜짐은 실제 `books.json` 기준
+
 | 찾은 책 | 첫 장 안내 | 책갈피 채우기 |
 |---|---|---|
 | 4권 이상 | (안내 없음) | 평소대로 |
```

```diff
--- a/docs/PRD.md
+++ b/docs/PRD.md
@@ -58,7 +58,7 @@
 | ID | 기능 | 화면 | 완료 기준 |
 |---|---|---|---|
 | F-01 | 입구 선택 🎯/🍃 | S-01 | 로그인 없이 바로 시작. 두 입구 중 하나를 누르면 S-02. 설명 문구 — 🎯 "배우고 싶은 주제로, 아직 모르는 책 만나기" · 🍃 "밸런스 게임으로 내 취향에 맞는 한 권 만나기" (용도에서 나온 문구) |
-| F-02 | 🎯 입력 화면 — **10-01 결정 B(구현은 D 단계): 큰 직접 쓰기 칸 + 예시 칩 6개 고정**(누르면 칸에 그 말이 채워짐). 주제가 12개·20개로 늘어도 화면 칩은 6개 — 늘어난 주제는 직접 쓰기 분류가 받는다. 어떤 6개를 보일지는 데이터(많이 쓰인·궁금해요 많은 주제)로 바꾼다. 아래는 지금(P3) 모양 — **무엇을(필수: 보기 6개 또는 직접 쓰기)** · 분량 · 읽는 방식(선택) — **수준 질문·상황 한 줄 없음**(09-29 삭제: 수준은 D2·D2b에서 애매하고 책이 한쪽에 몰림, 상황 한 줄은 추천·내 책갈피 어디에도 쓰이지 않음) | S-02 | 한 화면. 보기에 없어도 직접 써서 진행할 수 있다. 직접 쓴 말은 LLM이 **우리 주제·세부 키워드 목록 안에서만** 분류(3초 넘으면 단어 매칭). 찾은 책이 적거나 없으면 첫 장에서 솔직하게 알린다. 상세 `target-chips.md` v0.2 |
+| F-02 | 🎯 입력 화면 — **10-01 결정 B(구현은 D 단계): 큰 직접 쓰기 칸 + 예시 칩 6개 고정**(누르면 칸에 그 말이 채워짐). 주제가 12개·20개로 늘어도 화면 칩은 6개 — 늘어난 주제는 직접 쓰기 분류가 받는다. 어떤 6개를 보일지는 데이터(많이 쓰인·궁금해요 많은 주제)로 바꾼다. 아래는 지금(P3) 모양 — **무엇을(필수: 보기 6개 또는 직접 쓰기)** · 분량 · 읽는 방식(선택) — **수준 질문·상황 한 줄 없음**(09-29 삭제: 수준은 D2·D2b에서 애매하고 책이 한쪽에 몰림, 상황 한 줄은 추천·내 책갈피 어디에도 쓰이지 않음) | S-02 | 한 화면. 보기에 없어도 직접 써서 진행할 수 있다. 직접 쓴 말은 LLM이 **우리 주제·세부 키워드 목록 안에서만** 분류(3초 넘으면 단어 매칭). 찾은 책이 적거나 없으면 첫 장에서 솔직하게 알린다. **주제는 그 주제 책이 10권 이상일 때만 켜진다**(분류 목록·단어 매칭·칩 — 10-01, `target-chips.md` 3절) — 덜 모인 주제의 말은 가장 가까운 켜진 주제 + "못 찾음". 상세 `target-chips.md` v0.2 |
 | F-03 | 🍃 취향 밸런스 게임 | S-02 | 2지선다 **9문항**(축 4개 × 2문항 + 분량 1), 누르면 바로 다음(약 30초). 두 번째 질문은 좌우를 바꾸고, 두 답이 같으면 "확실히", 갈리면 "둘 다 좋아요". 선택지 아래 **"갈피를 못 잡겠어요"(0.8초 꾹 눌러야 넘어감, 0점)** — 누르는 동안 버튼 글씨가 흐린 안내 "끌리는 쪽을 고를수록 더 잘 맞아요"로 바뀐다(09-30). 선택지 카드는 **책갈피 모양**(아치 창 자리에 선택지 글씨, 동물 그림 없음, 09-30). 문항·점수·검증은 `balance-game.md` |
 | F-04 | ~~상황 한 줄~~ | — | **삭제 (09-29)** — 추천에도 내 책갈피에도 쓰이지 않음. 추천에 반영할 말은 F-02 직접 쓰기로. 서재에 "그때의 한 줄"을 남기는 쓰임은 나중 후보(F-22) |
 | F-05 | 추천 5권 뽑기 | — | 칩·밸런스 답 → 점수 → **최고 점수 2점 안쪽에서 가중 추첨**(🍃 τ=1.0, 🎯 τ=0.5), 같은 장르 최대 2권으로 4권 + **무작위 1권**(검증용). 🎯에서 맞는 책이 떨어지면 "조건에 딱 맞는 책은 여기까지예요"(`book-pool.md` 2절). 무작위 책은 **화면에서 다른 책과 똑같이** 보이고 자리도 매번 무작위. 같은 세션에서 이미 보여준 책은 제외. 맞는 책이 부족하면 조건을 한 단계 넓혀 채운다 |
```

- [ ] **Step 9: 커밋**

```bash
cd ..                                      # Galpi/
git add web/src/lib/books/active.ts web/src/lib/books/active.test.ts web/src/lib/books/catalog.ts web/src/lib/books/data.test.ts \
  web/src/lib/goal web/src/app/api/goal/classify web/src/app/page.tsx web/src/components/flow/FlowRoot.tsx \
  web/src/components/flow/Flow.tsx docs/target-chips.md docs/PRD.md
git commit -m "feat(goal): sort 직접 쓰기 into active topics only (10+ books in books.json)" \
  -m "- [x] events: taxonomy.md · taxonomy.csv · schema.ts changed together (or no event change)" \
  -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
cd web
```

---

### Task 2: 🍃 장르 셋 — 역사 · 사회·시사 · 호러·괴담 (0권)

**Files:**
- Modify: `web/src/lib/books/taxonomy.ts`, `web/src/styles/tokens.css`, `web/src/app/design/page.tsx`, `docs/book-pool.md`, `docs/PRD.md`, `docs/DESIGN.md`, `docs/stitch/DESIGN.md`
- Test: `web/src/lib/books/taxonomy.test.ts`, `web/src/lib/books/normalize.test.ts`

**Interfaces:**
- Consumes: `toneOf`(`taxonomy.ts`), `normalizeBook`
- Produces: `LEAF_GENRES`(12), 토큰 `--genre-history`·`--genre-society`·`--genre-horror`

- [ ] **Step 1: 실패하는 테스트** — 장르 12개, 모든 장르의 이름표 색이 `tokens.css`에 있는지(빠지면 회색 `--ink-muted`로 떨어지는 것을 막음), 새 장르 책이 가져오기를 통과하는지

```diff
--- a/web/src/lib/books/taxonomy.test.ts
+++ b/web/src/lib/books/taxonomy.test.ts
@@ -1,3 +1,4 @@
+import { readFileSync } from "node:fs";
 import { describe, expect, it } from "vitest";
 import { FIELD_OF_TOPIC, LEAF_GENRES, TOPIC_CHIPS, TOPICS, toneOf } from "./taxonomy";
 
@@ -12,8 +13,19 @@ describe("taxonomy", () => {
     expect(FIELD_OF_TOPIC["업무 자동화"]).toBe("AI·IT 활용");
   });
 
-  it("has the nine 🍃 genres", () => {
-    expect(LEAF_GENRES).toHaveLength(9);
+  it("has the twelve 🍃 genres, the D-A three last", () => {
+    expect(LEAF_GENRES).toHaveLength(12);
+    expect(LEAF_GENRES.slice(9)).toEqual(["역사", "사회·시사", "호러·괴담"]);
+  });
+
+  it("gives every genre a name-tag colour that tokens.css defines (DESIGN T-02)", () => {
+    const tokens = readFileSync("src/styles/tokens.css", "utf8");
+    for (const genre of LEAF_GENRES) {
+      const tone = toneOf({ entry: "leaf", genre, field: null });
+      expect(tone.bg, genre).not.toBe("var(--ink-muted)");
+      expect(tokens, genre).toContain(`${tone.bg.slice(4, -1)}:`);
+    }
+    expect(toneOf({ entry: "leaf", genre: "호러·괴담", field: null })).toEqual({ bg: "var(--genre-horror)", fg: "#FFFFFF" });
   });
 
   it("colours name tags by genre, by field for 🎯, ink text only on 예술·여행", () => {
```

```diff
--- a/web/src/lib/books/normalize.test.ts
+++ b/web/src/lib/books/normalize.test.ts
@@ -30,6 +30,10 @@ describe("normalizeBook", () => {
     });
   });
 
+  it("accepts the D-A genres (no books yet — the pipeline adds them)", () => {
+    expect(normalizeBook({ ...leafRow, slot: "호러·괴담" }, BIB)).toMatchObject({ entry: "leaf", genre: "호러·괴담" });
+  });
+
   it("accepts Korean one-liner style names", () => {
     expect(normalizeBook({ ...targetRow, one_liner_style: "요약형" }, BIB).one_liner_style).toBe("summary");
   });
```

- [ ] **Step 2: 실패 확인**

Run: `npx vitest run src/lib/books/taxonomy.test.ts src/lib/books/normalize.test.ts`
Expected: FAIL 3개 — "has the twelve 🍃 genres …", "gives every genre a name-tag colour …", "accepts the D-A genres …"(`unknown leaf genre 호러·괴담`)

- [ ] **Step 3: 구현**

```diff
--- a/web/src/lib/books/taxonomy.ts
+++ b/web/src/lib/books/taxonomy.ts
@@ -23,8 +23,11 @@ export const TOPIC_CHIPS: readonly { topic: Topic; label: string }[] = [
 ];
 export const TOPICS: readonly Topic[] = TOPIC_CHIPS.map((c) => c.topic);
 
-/** docs/book-pool.md 1절 */
-export const LEAF_GENRES = ["한국 소설", "외국 소설", "SF·판타지", "추리·스릴러", "에세이", "시", "인문", "과학 교양", "예술·여행"] as const;
+/** docs/book-pool.md 1절. The last three came with D-A (10-01) and have no books until the pipeline adds them — a genre with
+ * no books is simply never drawn (draws score every 🍃 book; nothing loops over this list). */
+export const LEAF_GENRES = [
+  "한국 소설", "외국 소설", "SF·판타지", "추리·스릴러", "에세이", "시", "인문", "과학 교양", "예술·여행", "역사", "사회·시사", "호러·괴담",
+] as const;
 export type LeafGenre = (typeof LEAF_GENRES)[number];
 
 /** Most keywords one 🎯 draw carries — the server rejects more, so the matcher must never produce more. */
@@ -35,7 +38,8 @@ export const WAYS: readonly Way[] = ["개념", "실습", "사례"];
 const GENRE_TONE: Record<LeafGenre, string> = {
   "한국 소설": "--genre-korean-fiction", "외국 소설": "--genre-world-fiction", "SF·판타지": "--genre-sf-fantasy",
   "추리·스릴러": "--genre-mystery", 에세이: "--genre-essay", 시: "--genre-poetry", 인문: "--genre-humanities",
-  "과학 교양": "--genre-science", "예술·여행": "--genre-art-travel",
+  "과학 교양": "--genre-science", "예술·여행": "--genre-art-travel", 역사: "--genre-history", "사회·시사": "--genre-society",
+  "호러·괴담": "--genre-horror",
 };
 const FIELD_TONE: Record<Field, string> = { "데이터·통계": "--field-data", "AI·IT 활용": "--field-ai", "습관·자기계발": "--field-habit" };
 
```

```diff
--- a/web/src/styles/tokens.css
+++ b/web/src/styles/tokens.css
@@ -8,6 +8,7 @@
   --genre-korean-fiction: #A94C60; --genre-world-fiction: #7E5595; --genre-sf-fantasy: #44548F;
   --genre-mystery: #3E474C; --genre-essay: #4A7456; --genre-poetry: #A0593F; --genre-humanities: #7D6337;
   --genre-science: #2B7178; --genre-art-travel: #B8912F;
+  --genre-history: #8E3A3A; --genre-society: #5E6A2B; --genre-horror: #6B2F5B;
   --field-data: #3A6684; --field-ai: #5E55A0; --field-habit: #9E6232;
   --space-1: 4px; --space-2: 8px; --space-3: 12px; --space-4: 16px; --space-5: 24px; --space-6: 32px;
   --radius-card: 12px; --radius-pill: 9999px; --radius-book: 2px 10px 10px 2px; --radius-bookmark: 10px 10px 0 0;
```

```diff
--- a/web/src/app/design/page.tsx
+++ b/web/src/app/design/page.tsx
@@ -10,7 +10,10 @@ const DEMO: BookCard[] = [
 ];
 
 const COLORS = ["paper", "paper-deep", "paper-line", "cloth", "ink", "ink-soft", "ink-muted"];
-const GENRES = ["korean-fiction", "world-fiction", "sf-fantasy", "mystery", "essay", "poetry", "humanities", "science", "art-travel"];
+const GENRES = [
+  "korean-fiction", "world-fiction", "sf-fantasy", "mystery", "essay", "poetry", "humanities", "science", "art-travel",
+  "history", "society", "horror",
+];
 
 /** Token/component sheet for development. Not part of the product: a 404 on the public production site. */
 export default function DesignPage() {
```

- [ ] **Step 4: 통과 확인**

```bash
npm run typecheck && npm run lint
npx vitest run                          # 62파일 606개
```

- [ ] **Step 5: 문서** — `book-pool.md` 1-2절(🍃 목표 표·딴 세상 어림)·1-3절(장르 경계), PRD D-01, DESIGN T-02, Stitch 파생본

```diff
--- a/docs/book-pool.md
+++ b/docs/book-pool.md
@@ -2,6 +2,7 @@
 
 PRD F-05 · F-10 · D-01. 목표: **장르는 최대한 다양하게, 200권으로 충분히 돌아가게, 다시 뽑기가 적당히 새롭게.**
 근거: 가상 이용자 시뮬레이션 `../src/simulate_draws.py` → `../data/processed/simulate_draws.json`
+v0.2 (2026-10-01, D-A): 🍃 장르 9 → 12개, 처음 채우기 목표(1-2절), 장르 경계(1-3절) — `expansion-candidates.md`, `context.md` 10-01
 
 ## 1. 책 구성 (첫 배포 200권)
 
@@ -27,6 +28,37 @@ PRD F-05 · F-10 · D-01. 목표: **장르는 최대한 다양하게, 200권으
 ### 책을 고르는 조건
 YES24 책소개·목차·평점이 있을 것 / 한 저자는 2권까지 / 🍃 장르마다 출간 10년 이내와 스테디셀러를 섞기 / 베스트셀러만 고르지 않기(크레마AI에서 관찰한 "늘 같은 책" 문제).
 
+### 1-2. 처음 채우기 목표 — 🍃 장르 12개 (D-C, 10-01)
+
+새 장르 셋(D-A): **역사 · 사회·시사**는 "알게 됨"이, **호러·괴담**은 "딴 세상"이 모자라서 넣는다(`expansion-candidates.md` 1-2·3절). 기준은 장르마다 **25권 이상**, 축마다 양쪽 **25% 이상**(`balance-game.md` 4절). 아직 0권인 장르는 뽑기에 그냥 안 나온다 — 🍃는 모든 책을 점수로 뽑으므로 켜는 규칙이 없다.
+
+| 장르 | 지금 | 목표 | 딴 세상(−1) 비율 — 지금 실제 / *새 장르는 가정* | 주로 채우는 쪽 |
+|---|---|---|---|---|
+| 한국 소설 | 12 | 25 | 17% | 현실 · 마음 |
+| 외국 소설 | 12 | 25 | 8% | 현실/딴 세상 · 마음 |
+| **SF·판타지** | 14 | **60** | 100% | **딴 세상** · 몰입 |
+| 추리·스릴러 | 14 | 25 | 14% | 여운 · 몰입 |
+| 에세이 | 18 | 25 | 6% | 따뜻함 · 문장 · 현실 |
+| 시 | 5 | 25 | 0% | 문장 · 마음 · 얇게 |
+| 인문 | 10 | 25 | 0% | 알게 됨(30%) · 마음 |
+| 과학 교양 | 10 | 25 | 0% | 알게 됨(90%) · 몰입 |
+| 예술·여행 | 5 | 25 | 0% | 따뜻함 · 현실 |
+| **역사** (새) | 0 | 25 | *0%* | **알게 됨**(*80%*) · 현실 · 몰입 |
+| **사회·시사** (새) | 0 | 25 | *0%* | **알게 됨**(*80%*) · 현실 · 여운 |
+| **호러·괴담** (새) | 0 | **40** | *50%* | **딴 세상** · 여운 · 몰입 |
+| 합계 | 100 | **350** | | |
+
+- **딴 세상 어림**: 지금 장르는 실제 비율, 새 장르는 가정(기울임)으로 350권이면 딴 세상 ≈ 91권 = **26%**, 알게 됨 ≈ 88권 = **25%**. 둘 다 겨우 넘는다 — 그래서 SF·판타지(60)·호러(40)만 25권보다 많다. 모든 장르 25권이면(300권) 딴 세상은 약 16%로 모자란다(`expansion-candidates.md` 4절과 같은 결론)
+- **확인**: D-C가 끝나면 실제 태그로 `src/simulate_real.py`(🍃 첫 뽑기 채움 95%+, 장르 수 3.5+)와 축 비율을 다시 잰다. 모자라면 이 표를 고친다 — 이 숫자는 목표지 결과가 아니다
+- SF·판타지 60권은 공급이 빠듯할 수 있다(판타지만 따로 봐도 예상 가용 약 111권, 해리 포터 권별 등 과대). 모자라면 호러를 늘린다
+
+### 1-3. 🍃 장르 경계 (태그를 붙일 때)
+
+| 경계 | 규칙 |
+|---|---|
+| 호러·괴담 ↔ 추리·스릴러 | 초자연·괴이가 중심이면 호러·괴담, 범인·사건 풀이가 중심이면 추리·스릴러 |
+| 역사 ↔ 사회·시사 ↔ 인문 | 지난 사실·사건이 뼈대면 역사, 지금 사회의 문제면 사회·시사, 생각·삶의 태도(철학)면 인문 |
+
 ## 2. 뽑기 규칙
 
 | 단계 | 규칙 | 이유 |
```

```diff
--- a/docs/PRD.md
+++ b/docs/PRD.md
@@ -151,7 +151,7 @@
 
 | ID | 항목 | 내용 |
 |---|---|---|
-| D-01 | 책 목록 | ISBN, 입구(🎯/🍃), 분야. **첫 배포 200권** — 🎯 100(데이터·통계 / AI·IT 활용 / 습관·자기계발 각 33 안팎, 읽는 방식 고르게) + 🍃 100(**장르 9개**: 한국 소설 12 · 외국 소설 12 · SF·판타지 14 · 추리·스릴러 14 · 에세이 18 · 시 5 · 인문 10 · 과학 교양 10 · 예술·여행 5, 밸런스 축 양쪽 각 25% 이상 — `book-pool.md`). 출처: YES24 베스트·스테디 + 정보나루 인기 대출, YES24 책소개·목차·평점이 있는 책만. **이후 계속 늘린다** |
+| D-01 | 책 목록 | ISBN, 입구(🎯/🍃), 분야. **첫 배포 200권** — 🎯 100(데이터·통계 / AI·IT 활용 / 습관·자기계발 각 33 안팎, 읽는 방식 고르게) + 🍃 100(**장르 9개**: 한국 소설 12 · 외국 소설 12 · SF·판타지 14 · 추리·스릴러 14 · 에세이 18 · 시 5 · 인문 10 · 과학 교양 10 · 예술·여행 5, 밸런스 축 양쪽 각 25% 이상 — `book-pool.md`). 출처: YES24 베스트·스테디 + 정보나루 인기 대출, YES24 책소개·목차·평점이 있는 책만. **이후 계속 늘린다**. **D 단계(10-01)**: 🍃 장르 12개(+역사 · 사회·시사 · 호러·괴담), 처음 채우기 목표 🍃 350권 — `book-pool.md` 1-2절 |
 | D-07 | 책 추가 파이프라인 | ISBN 목록을 넣으면 태그 초안 → 한 줄 초안 → 규칙 검사 → 사람 검수 대기열까지 한 번에. 책을 늘릴 때마다 같은 절차 반복 |
 | D-02 | 태그 | 🎯 분야(3) → 주제(6) → **세부 키워드(닫힌 목록, 책마다 2~5개, 키워드당 책 5권 이상)** + 읽는 방식. 🍃 밸런스 축 4개. 재료는 YES24 제목·책소개·목차. 키워드는 **규칙이 먼저**, AI는 규칙이 놓친 것만 제안 |
 | D-03 | 첫인상 한 줄 | 🎯 책은 요약형, 🍃 책은 질문형(좋은 질문이 안 나오면 요약형) — 책 한 권에 한 줄. 규칙 검사 통과 후 사람 검수 (`src/check_one_liners.py`) |
```

```diff
--- a/docs/DESIGN.md
+++ b/docs/DESIGN.md
@@ -45,6 +45,9 @@
 | 인문 | `#7D6337` | 흰색 5.7 : 1 | | | |
 | 과학 교양 | `#2B7178` | 흰색 5.6 : 1 | | | |
 | 예술·여행 | `#B8912F` | **ink** 5.0 : 1 | | | |
+| 역사 (D-A) | `#8E3A3A` | 흰색 7.5 : 1 | | | |
+| 사회·시사 (D-A) | `#5E6A2B` | 흰색 5.9 : 1 | | | |
+| 호러·괴담 (D-A) | `#6B2F5B` | 흰색 9.6 : 1 | | | |
 
 🎯 이름표에는 분야 색 + **주제 이름**(예: 데이터 분석)을 쓴다. 대비는 모두 WCAG AA(4.5 : 1) 이상으로 계산해 확인했다.
 
```

```diff
--- a/docs/stitch/DESIGN.md
+++ b/docs/stitch/DESIGN.md
@@ -25,6 +25,9 @@ colors:
   genre-humanities: "#7D6337"
   genre-science: "#2B7178"
   genre-art-travel: "#B8912F"
+  genre-history: "#8E3A3A"
+  genre-society: "#5E6A2B"
+  genre-horror: "#6B2F5B"
   field-data: "#3A6684"
   field-ai: "#5E55A0"
   field-habit: "#9E6232"
@@ -179,6 +182,15 @@ components:
   chip-genre-art-travel:
     backgroundColor: "{colors.genre-art-travel}"
     textColor: "{colors.primary}"
+  chip-genre-history:
+    backgroundColor: "{colors.genre-history}"
+    textColor: "{colors.white}"
+  chip-genre-society:
+    backgroundColor: "{colors.genre-society}"
+    textColor: "{colors.white}"
+  chip-genre-horror:
+    backgroundColor: "{colors.genre-horror}"
+    textColor: "{colors.white}"
   chip-field-data:
     backgroundColor: "{colors.field-data}"
     textColor: "{colors.white}"
@@ -208,7 +220,7 @@ Audience: Korean readers in their 20s on mobile phones, often opening the link f
 - **Cloth brown (#7A4A2E)** — the cloth cover of the old book. Used only for the book itself.
 - **Cream paper (#FAF5EA)** — every background. Pages have faint ruled lines in outline beige (#DDD0B4).
 - **Frost (#F4F1EA, or 60% white with a 3px backdrop blur)** — the translucent film of every bookmark. Text on frost is always ink.
-- **Genre colors** — twelve muted colors (nine reading genres, three study fields) used only for the small genre name tag, the bookmark string and the dashed stitch line on a bookmark. Never as large fills.
+- **Genre colors** — fifteen muted colors (twelve reading genres, three study fields) used only for the small genre name tag, the bookmark string and the dashed stitch line on a bookmark. Never as large fills.
 - No dark mode. No gradients except the animal window sky.
 
 ## Typography
```

Run: `npx -p @google/design.md designmd lint ../docs/stitch/DESIGN.md` → `"errors": 0`, `"warnings": 0`

- [ ] **Step 6: 커밋**

```bash
cd ..                                      # Galpi/
git add web/src/lib/books/taxonomy.ts web/src/lib/books/taxonomy.test.ts web/src/lib/books/normalize.test.ts \
  web/src/styles/tokens.css web/src/app/design/page.tsx docs/book-pool.md docs/PRD.md docs/DESIGN.md docs/stitch/DESIGN.md
git commit -m "feat(books): three new 🍃 genres — 역사, 사회·시사, 호러·괴담 (no books yet)" \
  -m "- [x] events: taxonomy.md · taxonomy.csv · schema.ts changed together (or no event change)" \
  -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
cd web
```

---

### Task 3: 🎯 주제 여섯 — 분야 셋, 키워드 초안 33개 (10권까지 꺼짐)

**Files:**
- Modify: `data/processed/keyword_vocab.json`, `web/src/data/vocab.json`(가져오기로), `web/src/lib/books/taxonomy.ts`, `web/src/styles/tokens.css`, `web/src/app/design/page.tsx`, `docs/target-chips.md`, `docs/PRD.md`, `docs/book-pool.md`, `docs/DESIGN.md`, `docs/stitch/DESIGN.md`
- Test: `web/src/lib/books/taxonomy.test.ts`, `web/src/lib/books/normalize.test.ts`, `web/src/lib/books/data.test.ts`, `web/src/app/api/goal/classify/route.test.ts`

**Interfaces:**
- Consumes: Task 1 `activeTopics`·`ACTIVE_VOCAB`, `matchGoal`, `normalizeVocab`(가져오기 — `TOPICS` 전부를 요구)
- Produces: `FIELD_OF_TOPIC`·`TOPICS`(12), `Field`(6), 토큰 `--field-money`·`--field-mind`·`--field-career`, `vocab.json` 53개 키워드

- [ ] **Step 1: 실패하는 테스트**

`taxonomy.test.ts` — 주제 12개(새 6개는 뒤), 칩은 앞 6개 그대로, 분야 6개 × 2주제, 분야 색이 `tokens.css`에 있는지:

```diff
--- a/web/src/lib/books/taxonomy.test.ts
+++ b/web/src/lib/books/taxonomy.test.ts
@@ -3,14 +3,21 @@ import { describe, expect, it } from "vitest";
 import { FIELD_OF_TOPIC, LEAF_GENRES, TOPIC_CHIPS, TOPICS, toneOf } from "./taxonomy";
 
 describe("taxonomy", () => {
-  it("keeps the six topics in chip order with the verbatim chip labels", () => {
-    expect(TOPICS).toEqual(["데이터 분석", "통계", "AI 활용", "업무 자동화", "습관·집중", "시간·생산성"]);
+  it("has twelve topics, the D-A six last, and still the first six as S-02 chips with their verbatim labels", () => {
+    expect(TOPICS).toEqual([
+      "데이터 분석", "통계", "AI 활용", "업무 자동화", "습관·집중", "시간·생산성",
+      "돈 관리·투자", "경제 상식", "마음 돌보기", "대화·관계", "취업·커리어", "글쓰기",
+    ]);
+    expect(TOPIC_CHIPS.map((c) => c.topic)).toEqual(TOPICS.slice(0, 6));
     expect(TOPIC_CHIPS.map((c) => c.label)).toEqual(["데이터 분석", "통계", "AI 똑똑하게 쓰기", "업무 자동화", "습관·집중", "시간·생산성"]);
   });
 
-  it("maps topics to the three fields", () => {
-    expect(new Set(Object.values(FIELD_OF_TOPIC))).toEqual(new Set(["데이터·통계", "AI·IT 활용", "습관·자기계발"]));
+  it("maps topics to six fields, two topics each", () => {
+    const fields = Object.values(FIELD_OF_TOPIC);
+    expect(new Set(fields)).toEqual(new Set(["데이터·통계", "AI·IT 활용", "습관·자기계발", "돈·경제", "마음·관계", "일·커리어"]));
+    for (const f of new Set(fields)) expect(fields.filter((x) => x === f)).toHaveLength(2);
     expect(FIELD_OF_TOPIC["업무 자동화"]).toBe("AI·IT 활용");
+    expect(FIELD_OF_TOPIC["글쓰기"]).toBe("일·커리어");
   });
 
   it("has the twelve 🍃 genres, the D-A three last", () => {
@@ -28,6 +35,16 @@ describe("taxonomy", () => {
     expect(toneOf({ entry: "leaf", genre: "호러·괴담", field: null })).toEqual({ bg: "var(--genre-horror)", fg: "#FFFFFF" });
   });
 
+  it("gives every field a name-tag colour that tokens.css defines", () => {
+    const tokens = readFileSync("src/styles/tokens.css", "utf8");
+    for (const topic of TOPICS) {
+      const tone = toneOf({ entry: "target", genre: topic, field: FIELD_OF_TOPIC[topic] });
+      expect(tone.bg, topic).not.toBe("var(--ink-muted)");
+      expect(tokens, topic).toContain(`${tone.bg.slice(4, -1)}:`);
+    }
+    expect(toneOf({ entry: "target", genre: "글쓰기", field: "일·커리어" })).toEqual({ bg: "var(--field-career)", fg: "#FFFFFF" });
+  });
+
   it("colours name tags by genre, by field for 🎯, ink text only on 예술·여행", () => {
     expect(toneOf({ entry: "leaf", genre: "에세이", field: null })).toEqual({ bg: "var(--genre-essay)", fg: "#FFFFFF" });
     expect(toneOf({ entry: "leaf", genre: "예술·여행", field: null })).toEqual({ bg: "var(--genre-art-travel)", fg: "var(--ink)" });
```

`normalize.test.ts` — 새 주제 책의 분야를 끌어내는지. `normalizeVocab` fixture는 이제 12주제를 다 갖춰야 한다(`TOPICS`로 만든다):

```diff
--- a/web/src/lib/books/normalize.test.ts
+++ b/web/src/lib/books/normalize.test.ts
@@ -1,5 +1,6 @@
 import { describe, expect, it } from "vitest";
 import { bibFromCsv, cleanAuthor, normalizeBook, normalizeCatalog, normalizeVocab, parseCsv } from "./normalize";
+import { TOPICS } from "./taxonomy";
 
 const BIB = new Map([
   ["9791111111111", { title: "모순", author: "양귀자" }],
@@ -34,6 +35,12 @@ describe("normalizeBook", () => {
     expect(normalizeBook({ ...leafRow, slot: "호러·괴담" }, BIB)).toMatchObject({ entry: "leaf", genre: "호러·괴담" });
   });
 
+  it("derives the new fields of the D-A topics", () => {
+    expect(normalizeBook({ ...targetRow, slot: "돈 관리·투자", keywords: ["주식"] }, BIB)).toMatchObject({
+      topic: "돈 관리·투자", genre: "돈 관리·투자", field: "돈·경제", keywords: ["주식"],
+    });
+  });
+
   it("accepts Korean one-liner style names", () => {
     expect(normalizeBook({ ...targetRow, one_liner_style: "요약형" }, BIB).one_liner_style).toBe("summary");
   });
@@ -108,8 +115,7 @@ describe("cleanAuthor", () => {
 describe("normalizeVocab", () => {
   const topic = (kept: Record<string, { pattern: string }>) => ({ kept, folded: { 파이썬: 4 }, too_common: { 시각화: 11 } });
   const raw: Record<string, ReturnType<typeof topic>> = {
-    "데이터 분석": topic({ SQL: { pattern: "SQL|쿼리" } }), 통계: topic({}), "AI 활용": topic({}),
-    "업무 자동화": topic({}), "습관·집중": topic({}), "시간·생산성": topic({}),
+    ...Object.fromEntries(TOPICS.map((t) => [t, topic({})])), "데이터 분석": topic({ SQL: { pattern: "SQL|쿼리" } }),
   };
 
   it("keeps kept patterns as keywords and folded / too-common names as topic words", () => {
```

`data.test.ts` — vocab 12주제·키워드 20 + 33, 초안 규칙이 이름값을 하는지(주제가 켜졌다고 치고 전체 vocab으로 — 실제 화면은 켜진 것만), "마음·회복" 지킴이:

```diff
--- a/web/src/lib/books/data.test.ts
+++ b/web/src/lib/books/data.test.ts
@@ -3,11 +3,12 @@ import real from "@/data/books.json";
 import sample from "@/data/books.sample.json";
 import vocab from "@/data/vocab.json";
 import { classifySchema, classifySystemPrompt } from "@/lib/goal/classify";
+import { matchGoal } from "@/lib/goal/match";
 import { MIN_ACTIVE_TOPIC_BOOKS, activeTopics } from "./active";
 import { ACTIVE_VOCAB } from "./catalog";
 import { normalizeCatalog } from "./normalize";
 import { TOPIC_CHIPS, TOPICS } from "./taxonomy";
-import type { CatalogBook } from "./types";
+import type { CatalogBook, Vocab } from "./types";
 
 const asRows = (books: CatalogBook[]) => books.map((b) => ({ ...b, slot: b.entry === "leaf" ? b.genre : b.topic }));
 
@@ -46,9 +47,29 @@ describe("app book data", () => {
     expect(TOPIC_CHIPS.map((c) => c.topic).filter((t) => !active.includes(t))).toEqual([]);
   });
 
-  it("vocab.json covers all six topics with the 20 keywords of v1.1", () => {
+  it("vocab.json covers all twelve topics: the 20 keywords of v1.1 and the 33 D-A drafts (target-chips 2-1)", () => {
     expect(Object.keys(vocab)).toEqual([...TOPICS]);
-    const count = Object.values(vocab).reduce((n, t) => n + Object.keys(t.keywords).length, 0);
-    expect(count).toBe(20);
+    const count = (topics: readonly string[]) =>
+      topics.reduce((n, t) => n + Object.keys((vocab as Vocab)[t].keywords).length, 0);
+    expect(count(TOPICS.slice(0, 6))).toBe(20);
+    expect(count(TOPICS.slice(6))).toBe(33);
+    expect(Object.keys(vocab["돈 관리·투자"].keywords)).toEqual(["재테크 기초", "주식", "ETF·펀드", "부동산·청약", "연금·노후", "돈의 심리"]);
+  });
+
+  it.each([
+    ["주식 공부", "돈 관리·투자", ["주식"]], ["ETF 적립식", "돈 관리·투자", ["ETF·펀드"]], ["청약 당첨", "돈 관리·투자", ["부동산·청약"]],
+    ["환율이 왜 오르나", "경제 상식", ["금리·환율"]], ["넛지", "경제 상식", ["행동경제학"]],
+    ["자존감 높이기", "마음 돌보기", ["자존감"]], ["우울할 때", "마음 돌보기", ["우울"]],
+    ["말투 고치기", "대화·관계", ["말투·대화법"]], ["협상 잘하는 법", "대화·관계", ["설득·협상"]],
+    ["면접 준비", "취업·커리어", ["자소서·면접"]], ["퇴사 고민", "취업·커리어", ["이직·퇴사"]],
+    ["문해력 키우기", "글쓰기", ["문해력·어휘"]], ["카피라이팅", "글쓰기", ["카피라이팅"]],
+  ])("a D-A draft pattern catches %s → %s %j (once its topic is on)", (note, topic, keywords) => {
+    expect(matchGoal(note, vocab as Vocab)).toMatchObject({ topic, keywords, matched: true });
+  });
+
+  it("keeps 마음·회복 in 습관·집중 only until 마음 돌보기 turns on (its 5 books are re-tagged in D-C)", () => {
+    const active = activeTopics(real as unknown as CatalogBook[]);
+    const stillThere = Object.hasOwn(vocab["습관·집중"].keywords, "마음·회복");
+    expect(active.includes("마음 돌보기") && stillThere).toBe(false);
   });
 });
```

라우트 — 넓힌 뒤에도 "주식"은 꺼진 돈 관리·투자로 가지 않는다(지금은 이미 통과 — 넓힌 뒤 그대로인지 지키는 테스트):

```diff
--- a/web/src/app/api/goal/classify/route.test.ts
+++ b/web/src/app/api/goal/classify/route.test.ts
@@ -41,6 +41,14 @@ describe("POST /api/goal/classify", () => {
     expect(vi.mocked(classifyWithClaude).mock.calls[0][2]).toEqual({ apiKey: "test-key-not-real" });
   });
 
+  it("does not sort into a topic that has too few books yet (주식 → nearest active topic, matched false)", async () => {
+    vi.stubEnv("ANTHROPIC_API_KEY", "");
+    const goal = (await (await post({ text: "주식 투자 입문" }, { origin: ORIGIN, "x-forwarded-for": "8.8.4.5" })).json()) as GoalMatch;
+    expect(goal).toMatchObject({ matched: false, keywords: [], method: "word" });
+    expect(Object.keys(ACTIVE_VOCAB)).toContain(goal.topic);
+    expect(Object.keys(ACTIVE_VOCAB)).not.toContain("돈 관리·투자");
+  });
+
   it("gives Claude the active topics only (D-A: 10 books or more)", async () => {
     vi.stubEnv("ANTHROPIC_API_KEY", "test-key-not-real");
     vi.mocked(classifyWithClaude).mockResolvedValue({ ok: true, goal: LLM_GOAL });
```

- [ ] **Step 2: 실패 확인**

Run: `npx vitest run src/lib/books src/app/api/goal`
Expected: FAIL 18개 — taxonomy 3(주제 12·분야 6·분야 색), normalize 1(`unknown topic 돈 관리·투자`), data 14(`expected +0 to be 33`, 초안 규칙 13개 `keywords: []`). "주식" 라우트 테스트와 마음·회복 지킴이는 통과

- [ ] **Step 3: 키워드 초안을 원본에** — `data/processed/keyword_vocab.json` 끝에 6주제를 덧붙인다(기존 6주제는 그대로, 파일 끝 줄바꿈 없음 유지). 규칙은 `src/research_expansion.py`의 `TOPICS[...]["kw"]`를 설계 1-1절 이름에 맞춰 고친 것: 주식·ETF를 둘로, 경제 기초는 경제 상식으로(돈 관리·투자에서 뺌), "사회 초년생"은 직장 생활에만, "돈 공부"는 재테크 기초로, 말하기·인간관계를 대화·관계 하나로(거리 두기는 `거리 ?두기|손절|선 ?긋` — 맨 "경계"는 너무 넓어 뺌), "글쓰기 기초"는 84%에 걸려 키워드가 아니라 주제 자체(`expansion-candidates` 2절).

```bash
cd ..                                      # Galpi/
PYTHONIOENCODING=utf-8 python - <<'EOF'
import json, re
from pathlib import Path

PATH = Path("data/processed/keyword_vocab.json")
# D-A drafts (target-chips.md 2-1): kept only after D-C counts books (5+ and at most 60% of the topic).
DRAFT = {
    "돈 관리·투자": {
        "재테크 기초": r"재테크|저축|가계부|월급|통장|목돈|종잣돈|돈 ?(?:공부|관리|모으)",
        "주식": r"주식|배당|증권|코스피|나스닥|가치 ?투자",
        "ETF·펀드": r"ETF|펀드|인덱스|지수 ?투자",
        "부동산·청약": r"부동산|청약|내 ?집 ?마련|아파트|전세|월세",
        "연금·노후": r"연금|노후|은퇴|파이어족|(?<![A-Za-z])FIRE(?![A-Za-z])",
        "돈의 심리": r"돈의 ?심리|부의 ?(?:마인드|본능|감각)|부자 ?(?:마인드|의 ?사고)|돈 ?그릇",
    },
    "경제 상식": {
        "금리·환율": r"금리|환율|인플레이션|물가|연준",
        "경제 뉴스 읽기": r"경제 ?(?:뉴스|기사|신문)|경제 ?(?:상식|교양|공부|흐름)",
        "행동경제학": r"행동 ?경제|넛지",
        "경제사·자본주의": r"경제사|자본주의|화폐|(?:부|돈)의 ?역사",
        "트렌드": r"트렌드|미래 ?전망|소비 ?문화",
    },
    "마음 돌보기": {
        "불안·걱정": r"불안|걱정|공황",
        "자존감": r"자존감|자신감|자기 ?(?:긍정|수용|비하)",
        "감정 다루기": r"감정|분노|화 ?(?:다스리|조절)",
        "번아웃·스트레스": r"번아웃|스트레스|소진|지친|회복 ?탄력성",
        "우울": r"우울",
        "명상·마음챙김": r"명상|마음 ?챙김|마인드풀",
    },
    "대화·관계": {
        "말투·대화법": r"대화|말투|화법|말하기|말 ?(?:습관|그릇|잘하)",
        "발표": r"발표|프레젠테이션|스피치|(?<![A-Za-z])PT(?![A-Za-z])",
        "설득·협상": r"설득|협상|영향력",
        "거리 두기": r"거리 ?두기|손절|선 ?긋",
        "갈등·무례 대처": r"갈등|무례|싸움|진상|빌런",
        "호감·사회생활": r"호감|사회 ?생활|인간관계|인맥|첫인상",
    },
    "취업·커리어": {
        "자소서·면접": r"자기소개서|자소서|면접|취업 ?준비|취준",
        "이직·퇴사": r"이직|퇴사|전직|회사를 ?그만",
        "커리어 설계": r"커리어|경력|진로|직무",
        "퍼스널 브랜딩": r"퍼스널 ?브랜딩|셀프 ?브랜딩|나를 ?브랜딩",
        "직장 생활": r"직장 ?(?:생활|인)|회사 ?생활|사회 ?초년생|신입 ?사원|팀장|상사",
    },
    "글쓰기": {
        "에세이·책 쓰기": r"에세이 ?쓰기|책 ?쓰기|출간|투고|작가 ?(?:되|데뷔)",
        "업무 글": r"보고서|기획서|이메일|비즈니스 ?(?:글|라이팅)|업무 ?글",
        "문해력·어휘": r"문해력|어휘|맞춤법",
        "카피라이팅": r"카피|광고 ?(?:문구|글)",
        "일기·편지": r"일기|편지",
    },
}
raw = PATH.read_text(encoding="utf-8")
vocab = json.loads(raw)
assert not set(DRAFT) & set(vocab), "already added"
for topic, keywords in DRAFT.items():
    for pattern in keywords.values():
        re.compile(pattern)
    vocab[topic] = {"books": 0, "draft": True,
                    "kept": {name: {"pattern": p, "n": 0} for name, p in keywords.items()},
                    "folded": {}, "too_common": {}, "untagged": 0}
out = json.dumps(vocab, ensure_ascii=False, indent=1) + ("\n" if raw.endswith("\n") else "")
with PATH.open("w", encoding="utf-8", newline="") as f:
    f.write(out)
print(sum(len(k) for k in DRAFT.values()), "draft keywords added")
EOF
cd web && npm run books:import
git diff --exit-code src/data/books.json && echo "books.json unchanged"
```

Expected: `vocab.json: 53 keywords` · `books.json: 200 books (leaf 100, target 100) from books_v1.json` · `books.json unchanged`

- [ ] **Step 4: 구현** — 주제 12개, `TOPICS`는 칩이 아니라 `FIELD_OF_TOPIC`의 키에서

```diff
--- a/web/src/lib/books/taxonomy.ts
+++ b/web/src/lib/books/taxonomy.ts
@@ -1,6 +1,9 @@
 import type { Entry, Way } from "../recommend/types";
 
-/** docs/plans/2026-09-30-d3-tags.md — topic → field. For 🎯 books genre === topic. */
+/**
+ * docs/plans/2026-09-30-d3-tags.md — topic → field, in topic order. For 🎯 books genre === topic. The last six came with D-A
+ * (10-01, docs/target-chips.md 2절); a topic is offered to readers only once it has enough books (lib/books/active.ts).
+ */
 export const FIELD_OF_TOPIC = {
   "데이터 분석": "데이터·통계",
   통계: "데이터·통계",
@@ -8,11 +11,21 @@ export const FIELD_OF_TOPIC = {
   "업무 자동화": "AI·IT 활용",
   "습관·집중": "습관·자기계발",
   "시간·생산성": "습관·자기계발",
+  "돈 관리·투자": "돈·경제",
+  "경제 상식": "돈·경제",
+  "마음 돌보기": "마음·관계",
+  "대화·관계": "마음·관계",
+  "취업·커리어": "일·커리어",
+  글쓰기: "일·커리어",
 } as const;
 export type Topic = keyof typeof FIELD_OF_TOPIC;
 export type Field = (typeof FIELD_OF_TOPIC)[Topic];
+export const TOPICS = Object.keys(FIELD_OF_TOPIC) as readonly Topic[];
 
-/** docs/target-chips.md 1절 — chip order and labels. Only "AI 활용" is shown with another label. */
+/**
+ * docs/target-chips.md 1절 — S-02 chip order and labels. Only "AI 활용" is shown with another label. Still the first six
+ * topics until the D-D input (example chips) replaces this row.
+ */
 export const TOPIC_CHIPS: readonly { topic: Topic; label: string }[] = [
   { topic: "데이터 분석", label: "데이터 분석" },
   { topic: "통계", label: "통계" },
@@ -21,7 +34,6 @@ export const TOPIC_CHIPS: readonly { topic: Topic; label: string }[] = [
   { topic: "습관·집중", label: "습관·집중" },
   { topic: "시간·생산성", label: "시간·생산성" },
 ];
-export const TOPICS: readonly Topic[] = TOPIC_CHIPS.map((c) => c.topic);
 
 /** docs/book-pool.md 1절. The last three came with D-A (10-01) and have no books until the pipeline adds them — a genre with
  * no books is simply never drawn (draws score every 🍃 book; nothing loops over this list). */
@@ -41,7 +53,10 @@ const GENRE_TONE: Record<LeafGenre, string> = {
   "과학 교양": "--genre-science", "예술·여행": "--genre-art-travel", 역사: "--genre-history", "사회·시사": "--genre-society",
   "호러·괴담": "--genre-horror",
 };
-const FIELD_TONE: Record<Field, string> = { "데이터·통계": "--field-data", "AI·IT 활용": "--field-ai", "습관·자기계발": "--field-habit" };
+const FIELD_TONE: Record<Field, string> = {
+  "데이터·통계": "--field-data", "AI·IT 활용": "--field-ai", "습관·자기계발": "--field-habit",
+  "돈·경제": "--field-money", "마음·관계": "--field-mind", "일·커리어": "--field-career",
+};
 
 /** DESIGN T-02 — name-tag colours. White text everywhere except 예술·여행 (ink, 5.0 : 1). */
 export function toneOf(card: { entry: Entry; genre: string; field: string | null }): { bg: string; fg: string } {
```

```diff
--- a/web/src/styles/tokens.css
+++ b/web/src/styles/tokens.css
@@ -10,6 +10,7 @@
   --genre-science: #2B7178; --genre-art-travel: #B8912F;
   --genre-history: #8E3A3A; --genre-society: #5E6A2B; --genre-horror: #6B2F5B;
   --field-data: #3A6684; --field-ai: #5E55A0; --field-habit: #9E6232;
+  --field-money: #3D7350; --field-mind: #A04F6E; --field-career: #2D6F73;
   --space-1: 4px; --space-2: 8px; --space-3: 12px; --space-4: 16px; --space-5: 24px; --space-6: 32px;
   --radius-card: 12px; --radius-pill: 9999px; --radius-book: 2px 10px 10px 2px; --radius-bookmark: 10px 10px 0 0;
   --touch: 44px; --column: 430px; --header-h: 52px;
```

```diff
--- a/web/src/app/design/page.tsx
+++ b/web/src/app/design/page.tsx
@@ -14,6 +14,7 @@ const GENRES = [
   "korean-fiction", "world-fiction", "sf-fantasy", "mystery", "essay", "poetry", "humanities", "science", "art-travel",
   "history", "society", "horror",
 ];
+const FIELDS = ["data", "ai", "habit", "money", "mind", "career"];
 
 /** Token/component sheet for development. Not part of the product: a 404 on the public production site. */
 export default function DesignPage() {
@@ -23,7 +24,7 @@ export default function DesignPage() {
       <h1>디자인 확인</h1>
       <h2>색</h2>
       <ul style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 8, padding: 0, listStyle: "none" }}>
-        {[...COLORS.map((c) => `--${c}`), ...GENRES.map((g) => `--genre-${g}`)].map((v) => (
+        {[...COLORS.map((c) => `--${c}`), ...GENRES.map((g) => `--genre-${g}`), ...FIELDS.map((f) => `--field-${f}`)].map((v) => (
           <li key={v} data-token={v} style={{ fontSize: 12 }}>
             <div style={{ height: 40, borderRadius: 8, background: `var(${v})`, border: "1px solid var(--paper-line)" }} />
             {v}
```

- [ ] **Step 5: 통과 확인**

```bash
npm run typecheck && npm run lint
npx vitest run                          # 62파일 623개
```

- [ ] **Step 6: 분류 지시문이 그대로인지** (커밋하지 않는 일회용 스크립트 — Task 1 전 `main`에서도 같은 값)

```bash
mkdir -p scripts/tmp && cat > scripts/tmp/prompt-hash.ts <<'EOF'
import { createHash } from "node:crypto";
import { ACTIVE_VOCAB } from "../../src/lib/books/catalog";
import { classifySchema, classifySystemPrompt } from "../../src/lib/goal/classify";
const sha = (s: string) => createHash("sha256").update(s).digest("hex").slice(0, 16);
console.log(Object.keys(ACTIVE_VOCAB).join(", "));
console.log("prompt", sha(classifySystemPrompt(ACTIVE_VOCAB)), "schema", sha(JSON.stringify(classifySchema(ACTIVE_VOCAB))));
EOF
npx tsx scripts/tmp/prompt-hash.ts; rm -rf scripts/tmp
```

Expected:
```
데이터 분석, 통계, AI 활용, 업무 자동화, 습관·집중, 시간·생산성
prompt b056bfcc729908ed schema 62ea7d140ab1a75c
```
값이 다르면 멈춘다 — 켜진 주제나 기존 6주제의 vocab이 바뀐 것이다(이 계획은 둘 다 바꾸지 않는다).

- [ ] **Step 7: 문서** — `target-chips.md` 2-1절(v2 목록·2단 구조·초안 표시·마음·회복 옮기는 시점·키워드 정의 33개·🎯 경계), 3절 "6개" 표현, PRD D-02, `book-pool.md` 1-2b절(🎯 목표)·4절, DESIGN T-02 분야 색, Stitch

```diff
--- a/docs/target-chips.md
+++ b/docs/target-chips.md
@@ -1,4 +1,4 @@
-# 🎯 입력 화면 설계 — v0.2 (2026-09-29)
+# 🎯 입력 화면 설계 — v0.2 (2026-09-29) · v0.3 (2026-10-01, D-A: 주제 12개·키워드 초안 2-1절, 켜는 규칙 3절)
 
 PRD F-02 · F-05 · D-02. v0.1(질문 3개를 하나씩)은 **보기에 없는 사람이 이탈**하는 문제로 폐기.
 
@@ -32,8 +32,8 @@ D2 체크에서 사용자가 "조금 알아요"를 한 번도 고르지 않았
 
 | 층 | 개수 | 책에 붙이는 방식 | 예 |
 |---|---|---|---|
-| 분야 | 3 | 책마다 1개 | 데이터·통계 |
-| 주제 | 6 | 책마다 1개 | 데이터 분석 |
+| 분야 | 6 (D-A 전 3) | 책마다 1개 | 데이터·통계 |
+| 주제 | 12 (D-A 전 6) — 이용자에게는 켜진 것만(3절) | 책마다 1개 | 데이터 분석 |
 | **세부 키워드** | 정해진 목록 안에서 (예상 40~60개) | 책마다 **2~5개** | SQL · 파이썬 · 엑셀 · 시각화 · 회귀분석 · 프롬프트 · 노션 · 루틴 … |
 
 - 세부 키워드의 재료는 **YES24 제목·책소개·목차** (09-29 변경 — 정보나루 키워드는 대출 기록이 있는 책에만 있어 🎯 후보 약 150권 중 78권이 없었다). 키워드마다 정해진 이름 + 동의어 규칙으로 찾고(`src/build_vocab.py`), 없는 말을 지어내지 않는다
@@ -53,13 +53,82 @@ D2 체크에서 사용자가 "조금 알아요"를 한 번도 고르지 않았
 
 책이 늘어나면(D-07) 5권 기준을 넘는 키워드가 늘어나므로, **세분화는 책 수에 따라 자동으로 깊어진다.**
 
+### 2-1. v2 목록 — 주제 12개 (D-A, 10-01)
+
+**2단 구조**: 주제 = 후보 범위(일치 필수 — 그 주제 책 안에서만 뽑는다), 키워드 = 같은 주제 안에서 겹치는 것 1개당 +3점(4절). 키워드는 주제를 넘나들지 않는다.
+
+| 분야 | 주제 | 세부 키워드 |
+|---|---|---|
+| 데이터·통계 | 데이터 분석 · 통계 | v1.1 그대로 (위) |
+| AI·IT 활용 | AI 활용 · 업무 자동화 | v1.1 그대로 |
+| 습관·자기계발 | 습관·집중 · 시간·생산성 | v1.1 그대로. 습관·집중 = 습관 · 집중력 · 뇌과학 (+ 마음·회복 — 아래 옮기기) |
+| **돈·경제** (새) | 돈 관리·투자 | 재테크 기초 · 주식 · ETF·펀드 · 부동산·청약 · 연금·노후 · 돈의 심리 |
+| | 경제 상식 | 금리·환율 · 경제 뉴스 읽기 · 행동경제학 · 경제사·자본주의 · 트렌드 |
+| **마음·관계** (새) | 마음 돌보기 | 불안·걱정 · 자존감 · 감정 다루기 · 번아웃·스트레스 · 우울 · 명상·마음챙김 |
+| | 대화·관계 | 말투·대화법 · 발표 · 설득·협상 · 거리 두기 · 갈등·무례 대처 · 호감·사회생활 |
+| **일·커리어** (새) | 취업·커리어 | 자소서·면접 · 이직·퇴사 · 커리어 설계 · 퍼스널 브랜딩 · 직장 생활 |
+| | 글쓰기 | 에세이·책 쓰기 · 업무 글 · 문해력·어휘 · 카피라이팅 · 일기·편지 |
+
+- 새 33개는 **초안**이다(`data/processed/keyword_vocab.json`에 `"draft": true`, `books: 0`). 책을 모은 뒤(D-C) 위 기준(5권 이상·60% 이하)으로 확정하고, 모자란 키워드는 주제로 합친다. 단어 규칙(정규식)은 `keyword_vocab.json` → `npm run books:import` → `web/src/data/vocab.json`. 근거와 하한~상한 권수는 `expansion-candidates.md` 2절
+- 화면의 보기 칩은 **지금 6개 그대로**(D-D B안 전까지). 새 주제는 직접 쓰기 분류로만 닿고, 그것도 켜진 뒤부터(3절)
+- **마음·회복 옮기기**: 습관·집중의 "마음·회복"은 마음 돌보기의 "번아웃·스트레스"·"불안·걱정"으로 간다. 그러나 마음 돌보기가 켜지기 전에 빼면 "번아웃"·"불안" 같은 글이 갈 곳을 잃어(지금 채점 30개 중 2개) **마음 돌보기가 켜질 때 함께 뺀다** — 그때 `마음·회복`이 붙은 5권(모두 습관·집중)을 D-C 검수에서 다시 태그한다. 마음 돌보기가 켜졌는데 마음·회복이 남아 있으면 앱 데이터 검사(`data.test.ts`)가 실패한다
+
+새 키워드 정의 (붙이는 책 — 책의 중심이 이것일 때):
+
+| 주제 | 키워드 | 정의 |
+|---|---|---|
+| 돈 관리·투자 | 재테크 기초 | 월급·저축·가계부·통장 나누기 등 돈을 모으고 관리하는 첫걸음 |
+| | 주식 | 개별 주식·배당·가치 투자 |
+| | ETF·펀드 | ETF·인덱스·펀드처럼 묶음으로 사는 투자 |
+| | 부동산·청약 | 집·아파트·청약·전월세 |
+| | 연금·노후 | 연금·은퇴 준비·파이어족 |
+| | 돈의 심리 | 돈을 대하는 생각·습관·부자의 사고방식 |
+| 경제 상식 | 금리·환율 | 금리·환율·물가·인플레이션이 어떻게 움직이나 |
+| | 경제 뉴스 읽기 | 경제 기사·뉴스를 읽는 법, 경제 흐름 교양 |
+| | 행동경제학 | 사람이 경제적으로 비합리적으로 고르는 이유(넛지 등) |
+| | 경제사·자본주의 | 돈·화폐·자본주의의 역사 |
+| | 트렌드 | 올해·앞으로의 소비·사회 트렌드 전망 |
+| 마음 돌보기 | 불안·걱정 | 불안·걱정·공황을 이해하고 다루기 |
+| | 자존감 | 자존감·자기 수용·자신감 |
+| | 감정 다루기 | 화·서운함 등 감정을 알아차리고 조절하기 |
+| | 번아웃·스트레스 | 지침·소진·스트레스에서 회복하기 |
+| | 우울 | 우울을 이해하고 견디기 |
+| | 명상·마음챙김 | 명상·마음챙김 연습 |
+| 대화·관계 | 말투·대화법 | 일상 대화·말투·말하기 |
+| | 발표 | 발표·프레젠테이션·스피치 |
+| | 설득·협상 | 설득·협상·영향력 |
+| | 거리 두기 | 불편한 관계에 선 긋기·거리 두기 |
+| | 갈등·무례 대처 | 갈등·무례한 사람·다툼에 대처하기 |
+| | 호감·사회생활 | 호감·첫인상·인간관계·사회생활 |
+| 취업·커리어 | 자소서·면접 | 자기소개서·면접·취업 준비 (수험서는 뺀다) |
+| | 이직·퇴사 | 이직·퇴사·전직 |
+| | 커리어 설계 | 진로·직무·경력 계획 |
+| | 퍼스널 브랜딩 | 나를 알리는 법·퍼스널 브랜딩 |
+| | 직장 생활 | 회사 생활·신입·팀장·상사와 일하기 |
+| 글쓰기 | 에세이·책 쓰기 | 에세이·책을 써서 내기(출간·투고) |
+| | 업무 글 | 보고서·기획서·이메일 등 일하는 글 |
+| | 문해력·어휘 | 문해력·어휘·맞춤법 |
+| | 카피라이팅 | 광고 문구·카피 |
+| | 일기·편지 | 일기·편지 쓰기 |
+
+경계 (한 책·한 글이 두 주제에 걸릴 때 — `expansion-candidates.md` 6절):
+
+| 경계 | 규칙 |
+|---|---|
+| 돈 관리·투자 ↔ 경제 상식 | 내 돈을 **어떻게 모으고 굴리나**면 돈 관리·투자, 경제가 **어떻게 돌아가나**(금리·환율·트렌드·경제사)면 경제 상식 |
+| 마음 돌보기 ↔ 습관·집중 | 뇌·습관·집중을 **고치는 법**이면 습관·집중, 불안·감정·자존감을 **이해하고 돌보는 법**이면 마음 돌보기 |
+| 마음 돌보기 ↔ 🍃 에세이 | 방법을 알려 주면 🎯 마음 돌보기, 작가의 이야기로 위로하면 🍃 에세이 |
+| 대화·관계 ↔ 마음 돌보기 | 사람과 **주고받는 말·관계**가 중심이면 대화·관계, **내 마음**이 중심이면 마음 돌보기 |
+| 취업·커리어 ↔ AI 활용 | "AI 시대의 커리어"는 일과 진로가 중심이면 취업·커리어 |
+| 글쓰기(업무 글) ↔ 업무 자동화 | 글을 **잘 쓰는 법**이면 글쓰기, 도구로 **빨리 만드는 법**이면 업무 자동화 |
+
 ## 3. 직접 쓰기 → 책 연결
 
-1. 서버가 LLM(Claude Haiku)에게 적은 말을 주고 **우리 주제 6개 + 세부 키워드 목록 중에서만** 고르게 한다 (JSON, 목록 밖 답은 버림). 추천 자체는 여전히 우리 점수 규칙
+1. 서버가 LLM(Claude Haiku)에게 적은 말을 주고 **우리 주제(켜진 것) + 세부 키워드 목록 중에서만** 고르게 한다 (JSON, 목록 밖 답은 버림). 추천 자체는 여전히 우리 점수 규칙
 2. 3초 안에 답이 없거나 실패하면 → 제목·키워드 단어 매칭으로 대체
 3. 연결된 책 수에 따라 첫 장에 **솔직하게** 말한다
 
-> **구현 (P4, 10-01)**: `POST /api/goal/classify` — `claude-haiku-4-5-20251001`, 구조화 출력(JSON 스키마의 enum = 우리 주제 6개·키워드 목록), 재시도 없음, 3초에서 끊음. 목록 밖 주제면 답을 버리고, 다른 주제의 키워드는 지운다. 키가 없거나 실패·시간 초과면 같은 라우트가 단어 매칭(`lib/goal/match.ts`)으로 답하고, 라우트까지 실패하면 브라우저가 단어 매칭. E-21 `method`가 `llm` / `word`. 보내는 것은 적은 글뿐(처리방침 "기록을 전달하는 곳"). 6절의 30개 채점은 `npm run goal:grade` → `docs/goal-grading.md`
+> **구현 (P4, 10-01)**: `POST /api/goal/classify` — `claude-haiku-4-5-20251001`, 구조화 출력(JSON 스키마의 enum = 켜진 주제·그 키워드 목록), 재시도 없음, 3초에서 끊음. 목록 밖 주제면 답을 버리고, 다른 주제의 키워드는 지운다. 키가 없거나 실패·시간 초과면 같은 라우트가 단어 매칭(`lib/goal/match.ts`)으로 답하고, 라우트까지 실패하면 브라우저가 단어 매칭. E-21 `method`가 `llm` / `word`. 보내는 것은 적은 글뿐(처리방침 "기록을 전달하는 곳"). 6절의 30개 채점은 `npm run goal:grade` → `docs/goal-grading.md`
 
 > **켜는 규칙 (D-A, 10-01)**: 주제는 `books.json`에 그 주제 책이 **10권 이상**일 때만 켜진다(`MIN_ACTIVE_TOPIC_BOOKS`, `web/src/lib/books/active.ts`). 켜진 주제만 Claude 목록·enum, 단어 매칭, 보기 칩에 들어간다. 꺼진 주제의 말(예: "주식")은 지금처럼 가장 가까운 켜진 주제 + `matched=false` — 첫 장 "아직 이 주제 책이 없어요", 못 찾은 요청으로 기록. 새 안내 문구는 없다. 계산은 서버가 `books.json`에서 하므로(빌드 때) 파이프라인이 10권째를 넣으면 **다음 배포부터 저절로 켜진다**. 테스트용 30권(`BOOKS_SOURCE=sample`)으로 뽑을 때도 켜짐은 실제 `books.json` 기준
 
```

```diff
--- a/docs/PRD.md
+++ b/docs/PRD.md
@@ -153,7 +153,7 @@
 |---|---|---|
 | D-01 | 책 목록 | ISBN, 입구(🎯/🍃), 분야. **첫 배포 200권** — 🎯 100(데이터·통계 / AI·IT 활용 / 습관·자기계발 각 33 안팎, 읽는 방식 고르게) + 🍃 100(**장르 9개**: 한국 소설 12 · 외국 소설 12 · SF·판타지 14 · 추리·스릴러 14 · 에세이 18 · 시 5 · 인문 10 · 과학 교양 10 · 예술·여행 5, 밸런스 축 양쪽 각 25% 이상 — `book-pool.md`). 출처: YES24 베스트·스테디 + 정보나루 인기 대출, YES24 책소개·목차·평점이 있는 책만. **이후 계속 늘린다**. **D 단계(10-01)**: 🍃 장르 12개(+역사 · 사회·시사 · 호러·괴담), 처음 채우기 목표 🍃 350권 — `book-pool.md` 1-2절 |
 | D-07 | 책 추가 파이프라인 | ISBN 목록을 넣으면 태그 초안 → 한 줄 초안 → 규칙 검사 → 사람 검수 대기열까지 한 번에. 책을 늘릴 때마다 같은 절차 반복 |
-| D-02 | 태그 | 🎯 분야(3) → 주제(6) → **세부 키워드(닫힌 목록, 책마다 2~5개, 키워드당 책 5권 이상)** + 읽는 방식. 🍃 밸런스 축 4개. 재료는 YES24 제목·책소개·목차. 키워드는 **규칙이 먼저**, AI는 규칙이 놓친 것만 제안 |
+| D-02 | 태그 | 🎯 분야(6) → 주제(12 — D-A 10-01, 책 10권부터 켜짐) → **세부 키워드(닫힌 목록, 책마다 2~5개, 키워드당 책 5권 이상)** + 읽는 방식. 🍃 밸런스 축 4개. 재료는 YES24 제목·책소개·목차. 키워드는 **규칙이 먼저**, AI는 규칙이 놓친 것만 제안 |
 | D-03 | 첫인상 한 줄 | 🎯 책은 요약형, 🍃 책은 질문형(좋은 질문이 안 나오면 요약형) — 책 한 권에 한 줄. 규칙 검사 통과 후 사람 검수 (`src/check_one_liners.py`) |
 | D-04 | 이용자 | 로그인 방식, 로그인 고유번호, 가입 시각 — 이름·이메일은 받지 않는다. 직접 쓴 목적(30자)은 저장(Supabase에만 — Amplitude로는 보내지 않음, 09-30), LLM(Anthropic)에 전달 — 처리방침에 명시 |
 | D-05 | 보관 | 이용자 ID, 책 ID, 보관 시각, **책갈피 그림 조합(동물·배경·소품·희귀 여부)** — 내 책갈피에서 그때 그 책갈피를 그대로 다시 그린다 |
```

```diff
--- a/docs/book-pool.md
+++ b/docs/book-pool.md
@@ -2,7 +2,7 @@
 
 PRD F-05 · F-10 · D-01. 목표: **장르는 최대한 다양하게, 200권으로 충분히 돌아가게, 다시 뽑기가 적당히 새롭게.**
 근거: 가상 이용자 시뮬레이션 `../src/simulate_draws.py` → `../data/processed/simulate_draws.json`
-v0.2 (2026-10-01, D-A): 🍃 장르 9 → 12개, 처음 채우기 목표(1-2절), 장르 경계(1-3절) — `expansion-candidates.md`, `context.md` 10-01
+v0.2 (2026-10-01, D-A): 🍃 장르 9 → 12개·🎯 주제 6 → 12개, 처음 채우기 목표(1-2절), 장르 경계(1-3절) — `expansion-candidates.md`, `context.md` 10-01
 
 ## 1. 책 구성 (첫 배포 200권)
 
@@ -52,6 +52,19 @@ YES24 책소개·목차·평점이 있을 것 / 한 저자는 2권까지 / 🍃
 - **확인**: D-C가 끝나면 실제 태그로 `src/simulate_real.py`(🍃 첫 뽑기 채움 95%+, 장르 수 3.5+)와 축 비율을 다시 잰다. 모자라면 이 표를 고친다 — 이 숫자는 목표지 결과가 아니다
 - SF·판타지 60권은 공급이 빠듯할 수 있다(판타지만 따로 봐도 예상 가용 약 111권, 해리 포터 권별 등 과대). 모자라면 호러를 늘린다
 
+### 1-2b. 처음 채우기 목표 — 🎯 주제 12개 (D-C, 10-01)
+
+주제마다 **25권 이상**, 키워드마다 **5권 이상**, 읽는 방식(개념·실습·사례) 각 20% 이상 → 12 × 25 = **300권**(지금 100). 주제는 10권이 되면 이용자에게 켜지고(`target-chips.md` 3절), 25권은 다시 뽑기까지 넉넉하게 돌아가는 목표(3절 시뮬레이션: 주제당 25권이면 좋은 뽑기 1.3 → 2.1회). 주제·키워드와 경계는 `target-chips.md` 2-1절.
+
+| 분야 | 주제 | 지금 | 목표 |
+|---|---|---|---|
+| 데이터·통계 | 데이터 분석 · 통계 | 17 · 17 | 25 · 25 |
+| AI·IT 활용 | AI 활용 · 업무 자동화 | 17 · 17 | 25 · 25 |
+| 습관·자기계발 | 습관·집중 · 시간·생산성 | 16 · 16 | 25 · 25 |
+| 돈·경제 (새) | 돈 관리·투자 · 경제 상식 | 0 · 0 | 25 · 25 |
+| 마음·관계 (새) | 마음 돌보기 · 대화·관계 | 0 · 0 | 25 · 25 |
+| 일·커리어 (새) | 취업·커리어 · 글쓰기 | 0 · 0 | 25 · 25 |
+
 ### 1-3. 🍃 장르 경계 (태그를 붙일 때)
 
 | 경계 | 규칙 |
@@ -106,6 +119,7 @@ YES24 책소개·목차·평점이 있을 것 / 한 저자는 2권까지 / 🍃
 |---|---|---|
 | 첫 배포 | 200 (검수가 빠르면 🎯를 150까지 → 250) | 위 구성 |
 | 배포 후 매주 | +100 | ① 🎯 주제당 25권까지 ② 🎯 직접 쓰기에서 못 찾은 주제 ③ 🍃 답은 많은데 책이 부족한 조합 ④ 궁금해요가 많이 눌린 장르 |
-| 🎯 분야 추가 후보 | — | 돈·경제, 취업·커리어, 글쓰기·말하기 — 못 찾은 요청에 자주 나오는 순서로 |
+| ~~🎯 분야 추가 후보~~ | — | ~~돈·경제, 취업·커리어, 글쓰기·말하기~~ → **D-A(10-01)에서 추가**: 돈·경제 · 마음·관계 · 일·커리어 (말하기는 대화·관계로) |
+| 처음 채우기 (D-C) | 🍃 350 + 🎯 300 = 약 650 | 1-2·1-2b절 표. D-07 파이프라인이 하루 50권, 빈 칸부터(키워드 5권 미만 → 주제 목표 미만 → 🍃 장르·축 부족) — `plans/2026-10-01-d-stage-design.md` 2·3절 |
 
 책을 늘릴 때마다 D-07 파이프라인 → 시뮬레이션 재실행 → 수치 확인.
```

```diff
--- a/docs/DESIGN.md
+++ b/docs/DESIGN.md
@@ -39,9 +39,9 @@
 | 한국 소설 | `#A94C60` | 흰색 5.4 : 1 | 데이터·통계 | `#3A6684` | 흰색 6.2 : 1 |
 | 외국 소설 | `#7E5595` | 흰색 5.8 : 1 | AI·IT 활용 | `#5E55A0` | 흰색 6.4 : 1 |
 | SF·판타지 | `#44548F` | 흰색 7.2 : 1 | 습관·자기계발 | `#9E6232` | 흰색 4.9 : 1 |
-| 추리·스릴러 | `#3E474C` | 흰색 9.5 : 1 | | | |
-| 에세이 | `#4A7456` | 흰색 5.4 : 1 | | | |
-| 시 | `#A0593F` | 흰색 5.3 : 1 | | | |
+| 추리·스릴러 | `#3E474C` | 흰색 9.5 : 1 | 돈·경제 (D-A) | `#3D7350` | 흰색 5.6 : 1 |
+| 에세이 | `#4A7456` | 흰색 5.4 : 1 | 마음·관계 (D-A) | `#A04F6E` | 흰색 5.5 : 1 |
+| 시 | `#A0593F` | 흰색 5.3 : 1 | 일·커리어 (D-A) | `#2D6F73` | 흰색 5.8 : 1 |
 | 인문 | `#7D6337` | 흰색 5.7 : 1 | | | |
 | 과학 교양 | `#2B7178` | 흰색 5.6 : 1 | | | |
 | 예술·여행 | `#B8912F` | **ink** 5.0 : 1 | | | |
```

```diff
--- a/docs/stitch/DESIGN.md
+++ b/docs/stitch/DESIGN.md
@@ -31,6 +31,9 @@ colors:
   field-data: "#3A6684"
   field-ai: "#5E55A0"
   field-habit: "#9E6232"
+  field-money: "#3D7350"
+  field-mind: "#A04F6E"
+  field-career: "#2D6F73"
 typography:
   headline-display:
     fontFamily: Gowun Batang
@@ -200,6 +203,15 @@ components:
   chip-field-habit:
     backgroundColor: "{colors.field-habit}"
     textColor: "{colors.white}"
+  chip-field-money:
+    backgroundColor: "{colors.field-money}"
+    textColor: "{colors.white}"
+  chip-field-mind:
+    backgroundColor: "{colors.field-mind}"
+    textColor: "{colors.white}"
+  chip-field-career:
+    backgroundColor: "{colors.field-career}"
+    textColor: "{colors.white}"
 ---
 
 # Galpi (갈피)
@@ -220,7 +232,7 @@ Audience: Korean readers in their 20s on mobile phones, often opening the link f
 - **Cloth brown (#7A4A2E)** — the cloth cover of the old book. Used only for the book itself.
 - **Cream paper (#FAF5EA)** — every background. Pages have faint ruled lines in outline beige (#DDD0B4).
 - **Frost (#F4F1EA, or 60% white with a 3px backdrop blur)** — the translucent film of every bookmark. Text on frost is always ink.
-- **Genre colors** — fifteen muted colors (twelve reading genres, three study fields) used only for the small genre name tag, the bookmark string and the dashed stitch line on a bookmark. Never as large fills.
+- **Genre colors** — eighteen muted colors (twelve reading genres, six study fields) used only for the small genre name tag, the bookmark string and the dashed stitch line on a bookmark. Never as large fills.
 - No dark mode. No gradients except the animal window sky.
 
 ## Typography
```

Run: `npx -p @google/design.md designmd lint ../docs/stitch/DESIGN.md` → 오류 0 · 경고 0

- [ ] **Step 8: 커밋**

```bash
cd ..                                      # Galpi/
git add data/processed/keyword_vocab.json web/src/data/vocab.json web/src/lib/books web/src/app/api/goal/classify/route.test.ts \
  web/src/styles/tokens.css web/src/app/design/page.tsx docs/target-chips.md docs/PRD.md docs/book-pool.md docs/DESIGN.md docs/stitch/DESIGN.md
git commit -m "feat(topics): six new 🎯 topics in three fields with draft keywords, off until 10 books" \
  -m "- [x] events: taxonomy.md · taxonomy.csv · schema.ts changed together (or no event change)" \
  -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
cd web
```

---

### Task 4: 결정 기록 + 마지막 검증

**Files:**
- Modify: `docs/PHASES.md`, `docs/context.md`, `docs/tasks.md`

- [ ] **Step 1: 문서**

```diff
--- a/docs/PHASES.md
+++ b/docs/PHASES.md
@@ -131,6 +131,16 @@
 | D4 | **전체 검수** — 규칙 검사에 걸린 것부터, 틀린 것만 고치기 (하루 70권 안팎) | **사용자** | 200권 검수 완료 표시 |
 | D-07 | 책 추가 파이프라인 — ISBN 목록 → D3 → 검수 대기열 → 시뮬레이션 재실행 (이후 계속 늘릴 때) | Claude | 새 ISBN 5권으로 한 바퀴 |
 
+**D 단계 (P4 뒤, P5보다 먼저 — 10-01 결정, 설계 `plans/2026-10-01-d-stage-design.md`)**
+
+| 묶음 | 할 일 | 누가 | 완료 기준 |
+|---|---|---|---|
+| D-A | 분류 넓히기 — 🎯 주제 12(분야 6)·키워드 초안 33, 🍃 장르 12, 이름표 색 6, 켜는 규칙(주제 책 10권부터) (`plans/2026-10-01-d-a-taxonomy-widen.md`) | Claude | 새 주제·장르 0권으로 앱이 그대로 돈다(테스트·E2E·빌드), 분류 지시문·enum이 지금과 같다(켜진 주제 6개 — 해시 비교), 이벤트 변경 없음 |
+| D-B | 매일 파이프라인(D-07) — 빈 곳 → 후보 → AI 태그 → 규칙 검사 → PR, 검수 페이지·일치율 | Claude + 사용자(Secrets) | D-07 줄과 같음 + `dry_run` 한 바퀴 |
+| D-C | 처음 채우기 — 하루 50권, 약 650권(`book-pool.md` 1-2·1-2b절) = 시험 운행 | 파이프라인 + **사용자 검수** | 주제·장르 25권+, 키워드 5권+ 확정, `simulate_real` 재실행, 분류 채점 다시(새 주제 예시 포함) |
+| D-D | 🎯 입력 B안 (직접 쓰기 칸 + 예시 칩 6개) | Claude + 사용자(시안) | 시안 승인, 이벤트 정의 먼저 |
+| D-E | 처음 화면 "갈피의 서재 N권 · 오늘 +M권"(F-23) | Claude + 사용자(시안) | D-C 뒤, 시안 승인 |
+
 **배포 후 늘리기** (`book-pool.md` 4절): 매주 +100권 — ① 🎯 주제당 25권까지 ② 못 찾은 요청 주제 ③ 🍃 책이 부족한 답 조합 ④ 궁금해요 많은 장르. 검수가 빠르면 첫 배포부터 🎯 150권.
 
 YES24 약관: 우리 DB에는 ISBN·우리 태그·우리 한 줄만. 책소개·가격·표지는 보여줄 때 불러온다.
```

```diff
--- a/docs/context.md
+++ b/docs/context.md
@@ -1,6 +1,6 @@
 # Context — 갈피 (Galpi)
 
-Last Updated: 2026-10-01 — P4 결과·서버 구현
+Last Updated: 2026-10-01 — D-A 분류 넓히기 구현
 
 ## 상태
 기획서 v3(`proposal.md`) 작성 완료. v1(알라딘 기준)·v2(블라인드 카드)는 `archive/`. 사용자 검토 → 강사 검토 → 확정 후 `plan.md`에 승인본을 옮기고 구현 계획으로 넘어간다.
@@ -109,6 +109,7 @@ Last Updated: 2026-10-01 — P4 결과·서버 구현
 | 10-01 | [다시 뽑기] = 같은 답·같은 직접 쓰기 분류로 새 5권(본 책 제외), **닫힌 책(S-03)부터 다시**, 새 판이라 [한 번 고치기]도 다시 한 번. round +1은 `track()`이 E-19 뒤에. book-pool ⑧의 [조건 하나 풀기]·[같은 분야 다른 주제]는 만들지 않음 | PRD 2절 "→ S-03", taxonomy 3-1a. ⑧ 두 버튼은 PRD F-05에 없고 [한 번 고치기]·[다시 뽑기]가 같은 일을 함 |
 | 10-01 | 🎯 직접 쓰기 분류 = `/api/goal/classify` → Claude Haiku(`claude-haiku-4-5-20251001`, 구조화 출력 enum, 재시도 없음, 3초) → 실패·키 없음이면 단어 매칭. 분류하는 동안 [책 펼치기]는 잠김. 처리방침에 Anthropic(받는 곳·보내는 것·학습 미사용·30일 삭제)을 **기능보다 먼저** | target-chips 3절, taxonomy 6-2·6-3b, PRD D-04. Anthropic 문장은 Commercial Terms B(학습 금지)와 Privacy Center(API 30일 삭제, 2026-07-01 갱신)로 확인한 것만 |
 | 10-01 | 모델 비교(10-01, 채점 예시 30개, 실제 키): 계획 지시문 Haiku 4.5 25/30 · Sonnet 5.5 27/30 → 지시문 수정(주제 말·같은 뜻 말이면 matched, vocab 별칭 표시) 후 Haiku 29/30(보통 1.0초, 최대 1.7초, 호출당 약 $0.0018) · Sonnet 5.5 28/30(보통 1.4초, 3초 초과 1회, 약 2배 비용) → Haiku 유지. 유일한 오답 '엑셀 함수'는 엑셀이 두 주제 terms에 모두 있어 기대값이 애매함. 이 30개는 지시문을 고칠 때 본 예시라 표본 안 수치 — 처음 보는 글에 대한 정확도는 아님(따로 확인). 목록 밖 예시를 test 행과 겹치지 않게 바꾼 뒤(요리·소설·투자 → 여행·연애·운동 팀) 다시 돌린 결과: llm 29/30(1건 3초 초과로 단어 매칭, 답은 맞음) · 기대 주제와 같음 29/30 | 3초 안에 끊어야 하고(target-chips 3절) 정확도는 지시문이 좌우 — 더 큰 모델은 비용·지연만 늘었다. 별칭은 `keywordAliases`가 vocab.json의 매칭 패턴에서 뽑아 보여줌(정규식 문법은 거름) |
+| 10-01 | D-A 분류 넓히기 구현(`plans/2026-10-01-d-a-taxonomy-widen.md`): 🎯 주제 12(분야 6)·키워드 초안 33(`keyword_vocab.json`의 `"draft": true`), 🍃 장르 12, 이름표 색 6(역사 `#8E3A3A`·사회·시사 `#5E6A2B`·호러·괴담 `#6B2F5B`·돈·경제 `#3D7350`·마음·관계 `#A04F6E`·일·커리어 `#2D6F73`, 흰 글자 5.5 : 1 이상). **켜는 규칙** = `activeTopics(books.json)` 10권 이상 → `ACTIVE_VOCAB`(서버에서 계산, 처음 화면에는 page.tsx가 prop으로) — 분류 지시문·enum·단어 매칭이 이것만 쓴다. 뽑기 요청 검사는 12개 전부 허용(꺼진 주제는 0권이라 바닥 알림뿐). "마음·회복"은 **마음 돌보기가 켜질 때까지 습관·집중에 둔다**(데이터 검사가 둘이 함께 있으면 실패). 이벤트·Amplitude 변경 없음(topic은 자유 문자열, Amplitude 허용값 목록 없음 — 10-01 확인) | 0권 주제를 지시문에 넣으면 "주식" 글이 책 없는 주제로 가 빈 첫 장이 된다 → 켜진 주제만. 켜짐을 저장하지 않고 빌드 때 세므로 파이프라인이 따로 고칠 파일이 없다. 테스트용 30권(`BOOKS_SOURCE=sample`)이 아니라 실제 `books.json`으로 세어 E2E와 운영이 같은 주제 목록을 쓴다. 마음·회복을 지금 빼면 "번아웃"·"불안" 글이 갈 곳을 잃는다(채점 30개 중 2개). 지시문 해시가 구현 전과 같음(`b056bfcc…`) → `goal:grade` 다시 잴 필요 없음 — 새 주제가 켜질 때(D-C) 새 예시를 더해 잰다 |
 
 ## 조사 결과 메모 (검증 상태 포함)
 - **확인됨 (9/29 첫인상 한 줄 샘플, `data/processed/one_liners_sample.json`, `src/check_one_liners.py`)**: 10권 × 3말투(요약형·상황형·질문형) = 30줄. 재료 = 정보나루 소개 + YES24 목차. 규칙 검사(길이 12~36자, 과장어, 제목 반복, 재료와 겹치는 단어 2개 이상)로 24줄 통과·6줄 검수 → 사람 검수 결과 5줄 유지(동의어·형식 근거라 코드가 못 잡음), 1줄 수정('편해질까요'→'스트레스가 줄어들까요'). **검수 필요 6줄 중 4줄이 상황형** — 상황형이 재료에서 가장 멀어지는 말투라 검수 부담이 큼. 초안은 이번엔 Claude(대화)가 직접 작성, 100~200권 규모에선 API 스크립트화 필요
```

```diff
--- a/docs/tasks.md
+++ b/docs/tasks.md
@@ -43,6 +43,8 @@ Last Updated: 2026-10-01
   - [x] 키 3개 Vercel·`.env.local`, Anthropic `galpi` 워크스페이스 월 $5 한도 + 그 워크스페이스 키, 배포 뒤 실제 사이트에서 🎯 직접 쓰기 완주 확인(표지·나온 이유·E-21 `method: llm`·다시 뽑기 회차) (10/1)
   - [ ] 사용자: `docs/goal-grading.md` 30행 "채점" 칸에 O/△/X
 - [ ] 📚 D 단계 먼저(10-01 사용자 결정): 책 자동 추가 파이프라인(D-07) — 시험 운행 3~5일 검수 → 일치율 기준 넘으면 자동
+  - [ ] D-A 분류 넓히기 — 🎯 12·🍃 12·키워드 초안·켜는 규칙 (`docs/plans/2026-10-01-d-a-taxonomy-widen.md`)
+  - [ ] D-B 파이프라인 · D-C 처음 채우기 · D-D 🎯 입력 B안 · D-E 서재 숫자
 - [ ] P5 로그인·보관·내 책갈피·처리방침
 - [ ] P6 Amplitude 전달, 이벤트 전수 점검, 대시보드
 - [x] 배포 전 준비(P7에서 당김) — 처리방침 v0 `/privacy`·1년 자동 삭제, 같은 출처·요청 한도·크기 상한·보안 헤더, `/design` 숨김, `deploy.md` (9/30)
```

- [ ] **Step 2: 마지막 검증** (`web/`에서)

```bash
npm run typecheck && npm run lint
npm run test:cov                      # 62파일 623개, 종료 코드 0 (recommend 100% 문턱)
npx playwright test                   # 90개 → 82 통과 · 8 skip (build 포함)
grep -rl "쌍둥이로 태어나" .next/static || echo "no catalogue in browser code"
grep -rl "재테크" .next/static .next/server/app/index.html .next/server/app/index.rsc || echo "no inactive topic in the page"
git diff --exit-code main -- src/data/books.json src/lib/recommend && echo "books and draw rules untouched"
```

Expected: 위 숫자 그대로, 마지막 세 줄은 `no catalogue in browser code` · `no inactive topic in the page` · `books and draw rules untouched`

- [ ] **Step 3: 커밋 → 사용자에게 넘김**

```bash
cd ..                                      # Galpi/
git add docs/PHASES.md docs/context.md docs/tasks.md
git commit -m "docs: D-A decisions, D stage rows in PHASES" \
  -m "- [x] events: taxonomy.md · taxonomy.csv · schema.ts changed together (or no event change)" \
  -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

사용자에게 줄 일: ① `npm run dev` → `/design`에서 새 색 6칸 확인(위 "사용자가 정할 것" 1) ② main 병합·배포 허락 — 배포해도 화면·분류는 지금과 같다(켜진 주제 6개). 새 주제는 D-C에서 책이 10권 쌓이는 배포부터 켜진다.

---

## 완료 기준 (요구 → 태스크)

- [ ] 설계 1-1 목록: 🎯 6주제·3분야·키워드 초안 33개(Task 3), 🍃 3장르(Task 2), 습관·집중 = 습관 · 집중력 · 뇌과학 (+ 마음·회복은 마음 돌보기가 켜질 때까지, Task 3 문서·지킴이)
- [ ] 설계 1-1 경계 한 줄씩: 🍃 `book-pool.md` 1-3절(Task 2), 🎯 `target-chips.md` 2-1절(Task 3)
- [ ] 설계 1-1 🍃 권수: `book-pool.md` 1-2절(딴 세상 25% 어림, Task 2), 🎯 1-2b절(Task 3), 4절(Task 3)
- [ ] 설계 1-2 "책이 0권이어도 앱이 깨지지 않게": Vitest·Playwright·build 시작과 같은 결과(Task 4), `books.json`·`lib/recommend` 변경 없음
- [ ] 10권 켜기(10-01): `activeTopics`·`ACTIVE_VOCAB`(Task 1) — Claude 목록·enum·단어 매칭(서버·브라우저)이 켜진 주제만, 칩은 데이터 검사로, 꺼진 주제의 말은 가장 가까운 켜진 주제 + `matched=false`(라우트 테스트 "주식", Task 3)
- [ ] 분류 다시 재기: 꺼진 주제가 지시문·enum에 없다는 단위 테스트(Task 1), 지시문·스키마 해시가 시작과 같음(Task 3 Step 6) → `goal:grade` 그대로
- [ ] 이벤트·taxonomy: 열거된 topic·genre 값 없음 → 변경 없음(코드 `schema.ts` `"string"`, taxonomy.md·csv 예시 값만, Amplitude 허용값 없음)
- [ ] 문서: PRD F-02·D-01·D-02, target-chips, book-pool, DESIGN(+Stitch), PHASES D 행, context, tasks. `balance-game.md`는 장르 목록이 없어(연구 인용뿐) 고치지 않음

## D-B로 넘기는 것 (이 계획에서 하지 않음)

- **Python 슬롯 목록**: `src/collect_candidates.py` `SLOTS`(🎯 6주제·🍃 9장르의 YES24 분야·검색어·규칙), `src/build_books_v1.py` `FIELD_OF_SLOT`(6주제), `src/build_vocab.py` `VOCAB`(6주제), `src/simulate_draws.py` `LEAF_GENRES`·`TARGET_TOPICS`(가상 모형)는 모두 옛 목록이다. **지금은 아무것도 깨지지 않는다** — 새 주제·장르의 책이 없고, 이 스크립트들은 D1~D4용으로 다시 돌리지 않는다. 새 책을 모으는 슬롯 정의(분야 코드·검색어·포함/제외 규칙)는 D-B `src/pipeline/`의 몫이다. 주의 두 가지를 D-B 계획에 넘긴다: ① `build_books_v1.make_book`을 다시 쓰면 새 주제에서 `FIELD_OF_SLOT` KeyError — 분야는 공통 목록에서 ② `build_vocab.py`를 지금 다시 돌리면 새 6주제가 `books: 0`이라 키워드가 모두 "합침"으로 빠지고(키워드 0개) 기존 키워드도 `d1_candidates.json` 기준으로 다시 계산된다 — 다시 돌리지 않는다. D-B의 태거·빈 곳 계산은 `keyword_vocab.json`(`draft` 포함)을 읽는다
- E2E `design.spec.ts`의 `expect(books).toHaveLength(200)` — 파이프라인이 책을 넣는 첫 PR에서 깨진다. D-B에서 "200권 이상" 또는 실제 길이로
- 새 주제가 켜질 때의 채점: `web/scripts/grade-goals.ts`의 기대값 중 "번아웃"·"불안할 때 읽을 책"(→ 마음 돌보기), "발표 준비"(→ 대화·관계), "주식 투자 입문"(→ 돈 관리·투자), "보고서를 AI로 빨리"(경계 확인)가 바뀐다 — D-C(설계 3절 "분류 30개 재채점")

