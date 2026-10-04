# 갈피 v2 계획 1 — 질문 지도와 갈림길 엔진 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 사람이 쓰는 질문 지도(`docs/question-map.md`)를 앱 데이터로 만들고, 답을 따라 책 범위·기분·모드를 정해 다섯 장을 뽑는 순수 함수 엔진과 길 끝 책 수 보고서를 만든다 — 화면 없이 테스트로 끝까지 검증.

**Architecture:** `web/src/lib/paths/`에 순수 TypeScript 모듈 — `types`(지도·범위·기분) → `parse`(문서 → 지도) → `validate`(지도 ↔ 우리 태그) → `walk`(답 → 범위·기분·지나온 길) → `draw`(기존 `drawBookmarks` 재사용) → `coverage`(모든 길 끝 책 수). 지도 문서는 `scripts/build-question-map.ts`가 `src/data/question-map.json`으로 만든다(`books:import`와 같은 방식, 결과 커밋).

**Tech Stack:** TypeScript, Vitest, tsx (기존 web/ 도구 그대로). 새 의존성 없음.

**Spec:** `docs/plans/2026-10-04-galpi-v2-paths-design.md` (3·4·5절이 이 계획의 범위)

**이 계획 밖 (다음 계획):** 계획 2 — 문서 v2(PRD·taxonomy v1.0·처리방침)·S-01/S-02/S-04 화면·이벤트·🎯 제거. 계획 3 — 매일 책 작업을 모자란 길 끝 채우기로(`src/pipeline/gaps.py`).

## Global Constraints

- 선택지는 늘 둘(A·B) + `unsure`("갈피를 못 잡겠어요"). 셋 이상은 지도에서 두 단계로 나눈다.
- 모든 선택지는 우리 태그 하나로 이어진다: `entry` · `topics` · `keywords` · `genres` · 축(`temp`·`pull`·`gain`·`world`) · `len` · `way` · `mode`.
- 추천 4장 + 운명 1장(`kind: "random"`, 마지막으로 좁힌 범위의 **바로 윗단계**에서). 추천 4장이 안 차면 윗단계로 넓히고 `widened: true`.
- 추천 로직은 화면과 떨어진 순수 함수 + 테스트 100% (CLAUDE.md 기술).
- 기존 `src/lib/recommend/*`의 동작은 바꾸지 않는다(🍃 패리티 테스트 `parity.test.ts`가 지켜 준다). `lengthPoints` 내보내기만 추가.
- 코드·커밋은 영어, 화면 문구는 한국어. 커밋 끝: `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`, 본문에 `- [x] events: no event change`.
- 명령은 `web/`에서. 테스트는 종료 코드로 확인.
- 설계와 다른 점 하나: 설계 5절-6은 길 끝 책 수를 `simulate_draws.py` 확장으로 잰다고 했지만, 엔진이 TS라 같은 엔진으로 진짜 `books.json`을 재는 `scripts/paths-coverage.ts`로 한다(두 구현의 분포 차이가 생길 수 없음). 기존 🍃 시뮬레이션은 그대로 둔다.

## File Structure

| 파일 | 책임 |
|---|---|
| `web/src/lib/paths/types.ts` | 지도·선택지·효과·범위(Scope)·기분(Mood)·답 타입, `ALL_SCOPE`, `inScope` |
| `web/src/lib/paths/parse.ts` | `docs/question-map.md`의 ```` ```node ```` / ```` ```far ```` 블록 → `QuestionMap` |
| `web/src/lib/paths/validate.ts` | 지도가 우리 태그·규칙을 지키는지 → 오류 목록 |
| `web/src/lib/paths/walk.ts` | 답 목록 → 다음 질문 · 범위 · 윗단계 범위 · 기분 · 모드 · 지나온 길 |
| `web/src/lib/paths/draw.ts` | 길 결과 + 책 → 다섯 장 (`drawBookmarks` 재사용) |
| `web/src/lib/paths/coverage.ts` | 지도의 모든 길 끝 열거 + 범위별 책 수 |
| `web/src/lib/paths/index.ts` | 내보내기 모음 |
| `web/src/lib/paths/*.test.ts` | 단위 테스트 (모듈마다) |
| `web/src/lib/paths/__fixtures__/mini-map.md` | 테스트용 작은 지도 |
| `web/scripts/build-question-map.ts` | 문서 → 검증 → `src/data/question-map.json` (`npm run map:build`) |
| `web/scripts/paths-coverage.ts` | 길 끝 책 수 표 (`npm run map:coverage`) |
| `docs/question-map.md` | 사람이 쓰는 질문 지도 (형식 설명 + 내용) |
| `web/src/lib/recommend/score.ts` | `lengthPoints` 내보내기만 추가 |

---

### Task 1: 타입과 범위 판정

**Files:**
- Create: `web/src/lib/paths/types.ts`
- Test: `web/src/lib/paths/types.test.ts`

**Interfaces:**
- Produces: `Choice`, `Effects`, `QNode`, `FarRule`, `QuestionMap`, `Scope`, `ALL_SCOPE`, `Mood`, `NEUTRAL_MOOD`, `Answer`, `inScope(book: Book, scope: Scope): boolean`, `scopeKey(scope: Scope): string`

- [ ] **Step 1: Write the failing test**

```ts
// web/src/lib/paths/types.test.ts
import { describe, expect, it } from "vitest";
import type { LeafBook, TargetBook } from "@/lib/recommend";
import { ALL_SCOPE, inScope, scopeKey } from "./types";

const leaf: LeafBook = { id: "L1", entry: "leaf", genre: "SF·판타지", pages: 300, axes: { temp: 0, pull: 1, gain: 0, world: -1 } };
const target: TargetBook = { id: "T1", entry: "target", field: "데이터·통계", topic: "데이터 분석", genre: "데이터 분석", pages: 200, way: "실습", keywords: ["SQL"] };

describe("inScope", () => {
  it("lets every book in the whole scope", () => {
    expect(inScope(leaf, ALL_SCOPE)).toBe(true);
    expect(inScope(target, ALL_SCOPE)).toBe(true);
  });
  it("narrows by entry, topics, keywords and genres together", () => {
    expect(inScope(target, { ...ALL_SCOPE, entry: "target", topics: ["데이터 분석"], keywords: ["SQL"] })).toBe(true);
    expect(inScope(target, { ...ALL_SCOPE, keywords: ["엑셀"] })).toBe(false);
    expect(inScope(leaf, { ...ALL_SCOPE, topics: ["데이터 분석"] })).toBe(false);          // a 🍃 book has no topic
    expect(inScope(leaf, { ...ALL_SCOPE, genres: ["SF·판타지", "에세이"] })).toBe(true);
    expect(inScope(leaf, { ...ALL_SCOPE, entry: "target" })).toBe(false);
  });
  it("keys a scope the same way whatever the order of its lists", () => {
    expect(scopeKey({ ...ALL_SCOPE, genres: ["시", "에세이"] })).toBe(scopeKey({ ...ALL_SCOPE, genres: ["에세이", "시"] }));
    expect(scopeKey(ALL_SCOPE)).toBe("all");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/paths/types.test.ts`
Expected: FAIL — cannot resolve `./types`.

- [ ] **Step 3: Write minimal implementation**

```ts
// web/src/lib/paths/types.ts
import type { AxisKey, Book, Entry, Tag, Way } from "@/lib/recommend";

/** What one answer sets. Scope fields replace the scope at their level; mood fields set a preference; mode switches routes. */
export interface Effects {
  entry?: Entry;
  topics?: string[];
  keywords?: string[];
  genres?: string[];
  axes?: Partial<Record<AxisKey, Tag>>;
  len?: Tag;
  way?: Way;
  mode?: "normal" | "challenge";
}

/** One side of a question: its words, what it sets, and the next node id ("draw" = the path ends). */
export interface Choice { label: string; effects: Effects; next: string }

export interface QNode {
  id: string;
  kind: "narrow" | "mood";
  question: string;
  a: Choice;
  b: Choice;
  /** "갈피를 못 잡겠어요": sets nothing; narrow → stop narrowing, mood → skip this question. */
  unsureNext: string;
}

/** Challenge route (design 4절): a scope the person's answers point to → the far scope to draw from instead. */
export interface FarRule { from: Partial<Scope>; to: Partial<Scope> }

export interface QuestionMap { start: string; nodes: Record<string, QNode>; far: FarRule[] }

export interface Scope { entry: Entry | null; topics: string[] | null; keywords: string[] | null; genres: string[] | null }
export const ALL_SCOPE: Scope = { entry: null, topics: null, keywords: null, genres: null };

export interface Mood { axes: Record<AxisKey, number>; len: Tag; way: Way | null }
export const NEUTRAL_MOOD: Mood = { axes: { temp: 0, pull: 0, gain: 0, world: 0 }, len: 0, way: null };

export type AnswerChoice = "A" | "B" | "unsure";
export interface Answer { node: string; choice: AnswerChoice }

export function inScope(book: Book, s: Scope): boolean {
  if (s.entry !== null && book.entry !== s.entry) return false;
  if (s.genres !== null && !s.genres.includes(book.genre)) return false;
  if (s.topics !== null && (book.entry !== "target" || !s.topics.includes(book.topic))) return false;
  if (s.keywords !== null && (book.entry !== "target" || !book.keywords.some((k) => s.keywords!.includes(k)))) return false;
  return true;
}

export function scopeKey(s: Scope): string {
  const part = (name: string, v: string[] | null) => (v === null ? [] : [`${name}=${[...v].sort().join(",")}`]);
  const parts = [...(s.entry ? [`entry=${s.entry}`] : []), ...part("topics", s.topics), ...part("keywords", s.keywords), ...part("genres", s.genres)];
  return parts.length ? parts.join(";") : "all";
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/lib/paths/types.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add web/src/lib/paths/types.ts web/src/lib/paths/types.test.ts
git commit -m "feat(paths): question map types and scope check (v2 plan 1)"
```

---

### Task 2: 지도 문서 읽기 (parse)

**Files:**
- Create: `web/src/lib/paths/parse.ts`, `web/src/lib/paths/__fixtures__/mini-map.md`
- Test: `web/src/lib/paths/parse.test.ts`

**Interfaces:**
- Consumes: `QuestionMap`, `QNode`, `Effects`, `FarRule`, `Scope` (Task 1)
- Produces: `parseQuestionMap(markdown: string): QuestionMap` (throws `MapParseError` with the node id and line), `class MapParseError extends Error`

**지도 문서 문법** (설계 3-3 형식을 기계가 읽을 수 있게): 노드마다 ```` ```node ```` 블록, 먼 곳 표는 ```` ```far ```` 블록. 첫 노드가 시작. 효과는 `|`로 이어 쓴다: `entry=leaf` · `topics=데이터 분석,통계` · `keywords=SQL` · `genres=SF·판타지` · `temp=+1`(축은 `+1`/`-1`) · `len=+1` · `way=실습` · `mode=challenge` · `next=<id>` 또는 `next=draw`.

- [ ] **Step 1: Write the fixture and the failing test**

````md
<!-- web/src/lib/paths/__fixtures__/mini-map.md -->
# mini map (tests only)

```node
id: start
kind: narrow
question: 오늘은 어느 쪽으로 갈까요?
A: 평소 끌리는 쪽으로 | mode=normal | next=branch
B: 오늘은 낯선 쪽으로 도전 | mode=challenge | next=branch
unsure: next=branch
```

```node
id: branch
kind: narrow
question: 무엇이 더 끌려요?
A: 이야기에 빠지기 | entry=leaf | next=story-world
B: 뭔가 배우기 | entry=target | next=learn-area
unsure: next=mood-len
```

```node
id: story-world
kind: narrow
question: 어디가 더 끌려요?
A: 지금 여기 | genres=한국 소설,외국 소설,에세이 | next=mood-temp
B: 딴 세상 | genres=SF·판타지 | next=mood-temp
unsure: next=mood-temp
```

```node
id: learn-area
kind: narrow
question: 어떤 걸 더 배우고 싶어요?
A: 데이터를 다루기 | topics=데이터 분석 | next=learn-data
B: 마음을 돌보기 | topics=마음 돌보기 | next=mood-way
unsure: next=mood-way
```

```node
id: learn-data
kind: narrow
question: 어떤 쪽이 더 끌려요?
A: DB에서 꺼내기 | keywords=SQL | next=mood-way
B: 표로 정리하기 | keywords=엑셀 | next=mood-way
unsure: next=mood-way
```

```node
id: mood-temp
kind: mood
question: 어떤 이야기가 좋아요?
A: 따뜻한 이야기 | temp=+1 | next=mood-len
B: 여운이 남는 이야기 | temp=-1 | next=mood-len
unsure: next=mood-len
```

```node
id: mood-way
kind: mood
question: 어떻게 배우고 싶어요?
A: 원리부터 차근차근 | way=개념 | next=mood-len
B: 바로 따라 하기 | way=실습 | next=mood-len
unsure: next=mood-len
```

```node
id: mood-len
kind: mood
question: 얼마나 읽고 싶어요?
A: 가볍게 한 권 | len=+1 | next=draw
B: 깊게 파고들기 | len=-1 | next=draw
unsure: next=draw
```

```far
from: entry=target | topics=데이터 분석
to: entry=leaf | genres=에세이
```
````

```ts
// web/src/lib/paths/parse.test.ts
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { MapParseError, parseQuestionMap } from "./parse";

const MINI = readFileSync(path.join(__dirname, "__fixtures__/mini-map.md"), "utf8");

describe("parseQuestionMap", () => {
  it("reads every node block, the first one is the start, and the far rules", () => {
    const map = parseQuestionMap(MINI);
    expect(map.start).toBe("start");
    expect(Object.keys(map.nodes)).toHaveLength(8);
    expect(map.nodes["learn-data"]).toEqual({
      id: "learn-data", kind: "narrow", question: "어떤 쪽이 더 끌려요?",
      a: { label: "DB에서 꺼내기", effects: { keywords: ["SQL"] }, next: "mood-way" },
      b: { label: "표로 정리하기", effects: { keywords: ["엑셀"] }, next: "mood-way" },
      unsureNext: "mood-way",
    });
    expect(map.nodes["mood-temp"].a.effects).toEqual({ axes: { temp: 1 } });
    expect(map.nodes["mood-len"].b.effects).toEqual({ len: -1 });
    expect(map.nodes.start.b.effects).toEqual({ mode: "challenge" });
    expect(map.far).toEqual([{ from: { entry: "target", topics: ["데이터 분석"] }, to: { entry: "leaf", genres: ["에세이"] } }]);
  });

  it("refuses a node with a missing line, an unknown effect, or a repeated id — naming the node", () => {
    const missing = "```node\nid: x\nkind: mood\nquestion: q\nA: a | next=draw\nunsure: next=draw\n```";
    expect(() => parseQuestionMap(missing)).toThrow(MapParseError);
    expect(() => parseQuestionMap(missing)).toThrow(/x.*B:/);
    const unknown = "```node\nid: y\nkind: mood\nquestion: q\nA: a | color=red | next=draw\nB: b | next=draw\nunsure: next=draw\n```";
    expect(() => parseQuestionMap(unknown)).toThrow(/y.*color/);
    const twice = `${MINI}\n\`\`\`node\nid: start\nkind: mood\nquestion: q\nA: a | next=draw\nB: b | next=draw\nunsure: next=draw\n\`\`\``;
    expect(() => parseQuestionMap(twice)).toThrow(/start.*twice/);
    expect(() => parseQuestionMap("# nothing here")).toThrow(/no node/);
  });

  it("refuses a bad axis value or a choice without next", () => {
    const badAxis = "```node\nid: z\nkind: mood\nquestion: q\nA: a | temp=2 | next=draw\nB: b | next=draw\nunsure: next=draw\n```";
    expect(() => parseQuestionMap(badAxis)).toThrow(/z.*temp/);
    const noNext = "```node\nid: w\nkind: mood\nquestion: q\nA: a | len=+1\nB: b | next=draw\nunsure: next=draw\n```";
    expect(() => parseQuestionMap(noNext)).toThrow(/w.*next/);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/paths/parse.test.ts`
Expected: FAIL — cannot resolve `./parse`.

- [ ] **Step 3: Write minimal implementation**

```ts
// web/src/lib/paths/parse.ts
import { AXES, type AxisKey, type Entry, type Tag, type Way } from "@/lib/recommend";
import type { Choice, Effects, FarRule, QNode, QuestionMap, Scope } from "./types";

export class MapParseError extends Error {}

const BLOCK = /```(node|far)\r?\n([\s\S]*?)```/g;
const WAYS: readonly Way[] = ["개념", "실습", "사례"];
const list = (v: string) => v.split(",").map((s) => s.trim()).filter(Boolean);

function tag(id: string, name: string, v: string): Tag {
  if (v === "+1" || v === "1") return 1;
  if (v === "-1") return -1;
  throw new MapParseError(`node ${id}: ${name} must be +1 or -1, got "${v}"`);
}

/** "label | k=v | k=v" → effects + next. Scope-only parts are allowed in far rules (withNext = false). */
function parts(id: string, text: string, withNext: boolean): { label: string; effects: Effects; next: string | null } {
  const [label, ...rest] = text.split("|").map((s) => s.trim());
  const effects: Effects = {};
  let next: string | null = null;
  for (const p of rest) {
    const eq = p.indexOf("=");
    if (eq < 0) throw new MapParseError(`node ${id}: "${p}" is not key=value`);
    const key = p.slice(0, eq).trim();
    const value = p.slice(eq + 1).trim();
    if (key === "next" && withNext) next = value;
    else if (key === "entry" && (value === "leaf" || value === "target")) effects.entry = value as Entry;
    else if (key === "topics") effects.topics = list(value);
    else if (key === "keywords") effects.keywords = list(value);
    else if (key === "genres") effects.genres = list(value);
    else if ((AXES as readonly string[]).includes(key)) effects.axes = { ...effects.axes, [key as AxisKey]: tag(id, key, value) };
    else if (key === "len") effects.len = tag(id, key, value);
    else if (key === "way" && (WAYS as readonly string[]).includes(value)) effects.way = value as Way;
    else if (key === "mode" && (value === "normal" || value === "challenge")) effects.mode = value;
    else throw new MapParseError(`node ${id}: unknown effect "${key}=${value}"`);
  }
  return { label, effects, next };
}

function field(id: string, lines: Map<string, string>, key: string): string {
  const v = lines.get(key);
  if (v === undefined || v === "") throw new MapParseError(`node ${id}: missing "${key}:" line`);
  return v;
}

function choice(id: string, text: string): Choice {
  const { label, effects, next } = parts(id, text, true);
  if (!label) throw new MapParseError(`node ${id}: a choice has no label`);
  if (!next) throw new MapParseError(`node ${id}: choice "${label}" has no next=`);
  return { label, effects, next };
}

function linesOf(body: string): Map<string, string> {
  const out = new Map<string, string>();
  for (const raw of body.split(/\r?\n/)) {
    const line = raw.trim();
    const colon = line.indexOf(":");
    if (!line || colon < 0) continue;
    out.set(line.slice(0, colon).trim(), line.slice(colon + 1).trim());
  }
  return out;
}

function scopeOf(id: string, text: string): Partial<Scope> {
  const { effects } = parts(id, `rule | ${text}`, false);
  const { entry, topics, keywords, genres } = effects;
  return { ...(entry ? { entry } : {}), ...(topics ? { topics } : {}), ...(keywords ? { keywords } : {}), ...(genres ? { genres } : {}) };
}

export function parseQuestionMap(markdown: string): QuestionMap {
  const nodes: Record<string, QNode> = {};
  const far: FarRule[] = [];
  let start: string | null = null;
  for (const m of markdown.matchAll(BLOCK)) {
    const lines = linesOf(m[2]);
    if (m[1] === "far") {
      far.push({ from: scopeOf("far", field("far", lines, "from")), to: scopeOf("far", field("far", lines, "to")) });
      continue;
    }
    const id = field("?", lines, "id");
    if (nodes[id]) throw new MapParseError(`node ${id}: id used twice`);
    const kind = field(id, lines, "kind");
    if (kind !== "narrow" && kind !== "mood") throw new MapParseError(`node ${id}: kind must be narrow or mood`);
    const unsure = parts(id, `unsure | ${field(id, lines, "unsure")}`, true);
    if (!unsure.next) throw new MapParseError(`node ${id}: unsure has no next=`);
    nodes[id] = {
      id, kind, question: field(id, lines, "question"),
      a: choice(id, field(id, lines, "A")), b: choice(id, field(id, lines, "B")), unsureNext: unsure.next,
    };
    start ??= id;
  }
  if (start === null) throw new MapParseError("no node blocks found");
  return { start, nodes, far };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/lib/paths/parse.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add web/src/lib/paths/parse.ts web/src/lib/paths/parse.test.ts web/src/lib/paths/__fixtures__/mini-map.md
git commit -m "feat(paths): read the question map document (v2 plan 1)"
```

---

### Task 3: 지도 검증 (우리 태그·규칙)

**Files:**
- Create: `web/src/lib/paths/validate.ts`
- Test: `web/src/lib/paths/validate.test.ts`

**Interfaces:**
- Consumes: `QuestionMap` (Task 1), `parseQuestionMap` (Task 2)
- Produces: `interface Vocabulary { topics: Record<string, string[]>; genres: string[] }`, `validateMap(map: QuestionMap, vocab: Vocabulary): string[]` (빈 배열이면 통과)

검사: ① `next`·`unsureNext`가 있는 노드거나 `draw` ② 시작에서 모든 노드에 닿음 ③ 순환 없음 ④ `topics`는 우리 주제, `keywords`는 그 노드까지 정해진 주제(없으면 아무 주제)의 키워드, `genres`는 우리 장르(🍃 장르 + 🎯 주제명 — 책의 `genre` 값) ⑤ 기분 노드는 범위를 바꾸지 않음 ⑥ 좁히기 노드는 기분을 바꾸지 않음(`mode`는 좁히기 노드에서만) ⑦ `far`의 주제·장르도 우리 것.

- [ ] **Step 1: Write the failing test**

```ts
// web/src/lib/paths/validate.test.ts
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { parseQuestionMap } from "./parse";
import { validateMap, type Vocabulary } from "./validate";

const MINI = readFileSync(path.join(__dirname, "__fixtures__/mini-map.md"), "utf8");
const VOCAB: Vocabulary = {
  topics: { "데이터 분석": ["SQL", "엑셀"], "마음 돌보기": ["우울"] },
  genres: ["한국 소설", "외국 소설", "에세이", "SF·판타지", "데이터 분석", "마음 돌보기"],
};
const edit = (from: string, to: string) => parseQuestionMap(MINI.replace(from, to));

describe("validateMap", () => {
  it("passes the mini map", () => {
    expect(validateMap(parseQuestionMap(MINI), VOCAB)).toEqual([]);
  });
  it("names a next that goes nowhere and a node nobody reaches", () => {
    expect(validateMap(edit("next=mood-way\nB: 표로", "next=nowhere\nB: 표로"), VOCAB)).toContain('learn-data: A goes to unknown node "nowhere"');
    const orphan = parseQuestionMap(`${MINI}\n\`\`\`node\nid: lost\nkind: mood\nquestion: q\nA: a | next=draw\nB: b | next=draw\nunsure: next=draw\n\`\`\``);
    expect(validateMap(orphan, VOCAB)).toContain("lost: not reachable from the start");
  });
  it("names a loop", () => {
    expect(validateMap(edit("A: 가볍게 한 권 | len=+1 | next=draw", "A: 가볍게 한 권 | len=+1 | next=start"), VOCAB).join(" ")).toMatch(/loop/);
  });
  it("names tags that are not ours, or a keyword outside the topic chosen on the way", () => {
    expect(validateMap(edit("topics=마음 돌보기", "topics=요리"), VOCAB)).toContain('learn-area: B topic "요리" is not one of ours');
    expect(validateMap(edit("keywords=엑셀", "keywords=우울"), VOCAB)).toContain('learn-data: B keyword "우울" is not in 데이터 분석');
    expect(validateMap(edit("genres=SF·판타지", "genres=무협"), VOCAB)).toContain('story-world: B genre "무협" is not one of ours');
  });
  it("keeps the two kinds apart: mood nodes set no scope, narrow nodes set no mood", () => {
    expect(validateMap(edit("temp=+1", "genres=에세이"), VOCAB)).toContain("mood-temp: A is a mood question but changes the scope");
    expect(validateMap(edit("keywords=SQL", "keywords=SQL | len=+1"), VOCAB)).toContain("learn-data: A is a narrow question but sets a mood");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/paths/validate.test.ts`
Expected: FAIL — cannot resolve `./validate`.

- [ ] **Step 3: Write minimal implementation**

```ts
// web/src/lib/paths/validate.ts
import type { Choice, Effects, QNode, QuestionMap } from "./types";

export interface Vocabulary { topics: Record<string, string[]>; genres: string[] }

const SIDES = [["A", "a"], ["B", "b"]] as const;
const setsScope = (e: Effects) => Boolean(e.entry || e.topics || e.keywords || e.genres);
const setsMood = (e: Effects) => Boolean(e.axes || e.len !== undefined || e.way);

function tagErrors(where: string, e: Effects, vocab: Vocabulary, topicsSoFar: string[] | null): string[] {
  const out: string[] = [];
  for (const t of e.topics ?? []) if (!vocab.topics[t]) out.push(`${where} topic "${t}" is not one of ours`);
  for (const g of e.genres ?? []) if (!vocab.genres.includes(g)) out.push(`${where} genre "${g}" is not one of ours`);
  const topics = e.topics ?? topicsSoFar ?? Object.keys(vocab.topics);
  for (const k of e.keywords ?? []) {
    if (!topics.some((t) => vocab.topics[t]?.includes(k))) out.push(`${where} keyword "${k}" is not in ${topics.join("·")}`);
  }
  return out;
}

export function validateMap(map: QuestionMap, vocab: Vocabulary): string[] {
  const errors: string[] = [];
  const nodes = map.nodes;
  const exists = (id: string) => id === "draw" || Boolean(nodes[id]);

  for (const n of Object.values(nodes)) {
    for (const [name, key] of SIDES) {
      const c: Choice = n[key];
      if (!exists(c.next)) errors.push(`${n.id}: ${name} goes to unknown node "${c.next}"`);
      if (n.kind === "mood" && setsScope(c.effects)) errors.push(`${n.id}: ${name} is a mood question but changes the scope`);
      if (n.kind === "mood" && c.effects.mode) errors.push(`${n.id}: ${name} is a mood question but switches the mode`);
      if (n.kind === "narrow" && setsMood(c.effects)) errors.push(`${n.id}: ${name} is a narrow question but sets a mood`);
    }
    if (!exists(n.unsureNext)) errors.push(`${n.id}: unsure goes to unknown node "${n.unsureNext}"`);
  }

  // walk every route from the start: reachability, loops, and tags checked against the topics chosen on the way
  const reached = new Set<string>();
  const seenState = new Set<string>();
  const walk = (id: string, onPath: string[], topics: string[] | null) => {
    if (id === "draw" || !nodes[id]) return;
    if (onPath.includes(id)) {
      errors.push(`loop: ${[...onPath, id].join(" → ")}`);
      return;
    }
    const state = `${id}|${topics?.join(",") ?? "*"}`;
    if (seenState.has(state)) return;
    seenState.add(state);
    reached.add(id);
    const n: QNode = nodes[id];
    for (const [name, key] of SIDES) {
      const c = n[key];
      errors.push(...tagErrors(`${n.id}: ${name}`, c.effects, vocab, topics));
      walk(c.next, [...onPath, id], c.effects.topics ?? topics);
    }
    walk(n.unsureNext, [...onPath, id], topics);
  };
  walk(map.start, [], null);
  for (const id of Object.keys(nodes)) if (!reached.has(id)) errors.push(`${id}: not reachable from the start`);

  map.far.forEach((r, i) => {
    errors.push(...tagErrors(`far ${i + 1} from:`, r.from, vocab, null), ...tagErrors(`far ${i + 1} to:`, r.to, vocab, null));
  });
  return [...new Set(errors)];
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/lib/paths/validate.test.ts`
Expected: PASS (5 tests).

- [ ] **Step 5: Commit**

```bash
git add web/src/lib/paths/validate.ts web/src/lib/paths/validate.test.ts
git commit -m "feat(paths): validate the question map against our tags (v2 plan 1)"
```

---

### Task 4: 답 따라가기 (walk) — 범위·윗단계·기분·모드·지나온 길·도전

**Files:**
- Create: `web/src/lib/paths/walk.ts`
- Test: `web/src/lib/paths/walk.test.ts`

**Interfaces:**
- Consumes: Task 1 types, `parseQuestionMap` (fixture)
- Produces:
  - `interface Walked { next: string | null; scope: Scope; parentScope: Scope; mood: Mood; mode: "normal" | "challenge"; crumbs: string[]; depth: number; unsure: number }`
  - `walkPath(map: QuestionMap, answers: Answer[]): Walked` — throws `PathError` if an answer is for a node that is not the expected one
  - `applyChallenge(map: QuestionMap, walked: Walked): Walked` — far scope for the draw (design 4절)
  - `class PathError extends Error`
- 규칙: `next === null`이면 길 끝(`draw`). `parentScope`는 **마지막으로 범위를 바꾼 답 바로 전**의 범위. `crumbs`는 범위를 바꾼 선택지의 글자들(지나온 길 표시). 되돌리기는 화면이 `answers`에서 마지막을 빼고 다시 부르면 된다(엔진은 상태가 없다).

- [ ] **Step 1: Write the failing test**

```ts
// web/src/lib/paths/walk.test.ts
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { parseQuestionMap } from "./parse";
import { ALL_SCOPE, type Answer } from "./types";
import { applyChallenge, PathError, walkPath } from "./walk";

const MAP = parseQuestionMap(readFileSync(path.join(__dirname, "__fixtures__/mini-map.md"), "utf8"));
const a = (node: string, choice: Answer["choice"]): Answer => ({ node, choice });
const SQL = [a("start", "A"), a("branch", "B"), a("learn-area", "A"), a("learn-data", "A"), a("mood-way", "B"), a("mood-len", "A")];

describe("walkPath", () => {
  it("starts at the start with the whole scope", () => {
    expect(walkPath(MAP, [])).toMatchObject({ next: "start", scope: ALL_SCOPE, parentScope: ALL_SCOPE, mode: "normal", crumbs: [], depth: 0, unsure: 0 });
  });

  it("follows the SQL path: narrows to the keyword, the parent is the topic, the mood is set, the path ends", () => {
    const w = walkPath(MAP, SQL);
    expect(w.next).toBeNull();
    expect(w.scope).toEqual({ entry: "target", topics: ["데이터 분석"], keywords: ["SQL"], genres: null });
    expect(w.parentScope).toEqual({ entry: "target", topics: ["데이터 분석"], keywords: null, genres: null });
    expect(w.mood).toEqual({ axes: { temp: 0, pull: 0, gain: 0, world: 0 }, len: 1, way: "실습" });
    expect(w.crumbs).toEqual(["뭔가 배우기", "데이터를 다루기", "DB에서 꺼내기"]);
    expect(w.depth).toBe(6);
  });

  it("stops narrowing on 'unsure' and counts it; going back is just one answer fewer", () => {
    const w = walkPath(MAP, [a("start", "A"), a("branch", "B"), a("learn-area", "unsure")]);
    expect(w.next).toBe("mood-way");
    expect(w.scope).toEqual({ ...ALL_SCOPE, entry: "target" });
    expect(w.parentScope).toEqual(ALL_SCOPE);
    expect(w.unsure).toBe(1);
    expect(walkPath(MAP, SQL.slice(0, 3)).next).toBe("learn-data");
  });

  it("refuses an answer for a question that was not asked", () => {
    expect(() => walkPath(MAP, [a("branch", "A")])).toThrow(PathError);
    expect(() => walkPath(MAP, [...SQL, a("mood-len", "A")])).toThrow(/after the end/);
  });

  it("challenge: swaps the scope for the far scope and keeps the mood", () => {
    const w = walkPath(MAP, [a("start", "B"), ...SQL.slice(1)]);
    expect(w.mode).toBe("challenge");
    const far = applyChallenge(MAP, w);
    expect(far.scope).toEqual({ entry: "leaf", topics: null, keywords: null, genres: ["에세이"] });
    expect(far.parentScope).toEqual({ entry: "leaf", topics: null, keywords: null, genres: null });
    expect(far.mood).toEqual(w.mood);
  });

  it("challenge with no far rule for the scope: the other side whole (story ↔ learn)", () => {
    const w = walkPath(MAP, [a("start", "B"), a("branch", "A"), a("story-world", "B"), a("mood-temp", "A"), a("mood-len", "A")]);
    expect(applyChallenge(MAP, w).scope).toEqual({ ...ALL_SCOPE, entry: "target" });
  });

  it("leaves a normal path alone", () => {
    const w = walkPath(MAP, SQL);
    expect(applyChallenge(MAP, w)).toBe(w);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/paths/walk.test.ts`
Expected: FAIL — cannot resolve `./walk`.

- [ ] **Step 3: Write minimal implementation**

```ts
// web/src/lib/paths/walk.ts
import { ALL_SCOPE, NEUTRAL_MOOD, type Answer, type Effects, type FarRule, type Mood, type QuestionMap, type Scope } from "./types";

export class PathError extends Error {}

export interface Walked {
  next: string | null;
  scope: Scope;
  parentScope: Scope;
  mood: Mood;
  mode: "normal" | "challenge";
  crumbs: string[];
  depth: number;
  unsure: number;
}

const withScope = (s: Scope, e: Effects): Scope => ({
  entry: e.entry ?? s.entry,
  topics: e.topics ?? s.topics,
  keywords: e.keywords ?? s.keywords,
  genres: e.genres ?? s.genres,
});
const withMood = (m: Mood, e: Effects): Mood => ({
  axes: { ...m.axes, ...e.axes },
  len: e.len ?? m.len,
  way: e.way ?? m.way,
});
const changesScope = (e: Effects) => Boolean(e.entry || e.topics || e.keywords || e.genres);

export function walkPath(map: QuestionMap, answers: Answer[]): Walked {
  let w: Walked = { next: map.start, scope: ALL_SCOPE, parentScope: ALL_SCOPE, mood: NEUTRAL_MOOD, mode: "normal", crumbs: [], depth: 0, unsure: 0 };
  for (const ans of answers) {
    if (w.next === null) throw new PathError(`answer for "${ans.node}" after the end of the path`);
    if (ans.node !== w.next) throw new PathError(`expected an answer for "${w.next}", got "${ans.node}"`);
    const node = map.nodes[ans.node];
    if (ans.choice === "unsure") {
      w = { ...w, next: node.unsureNext === "draw" ? null : node.unsureNext, depth: w.depth + 1, unsure: w.unsure + 1 };
      continue;
    }
    const c = ans.choice === "A" ? node.a : node.b;
    const narrows = changesScope(c.effects);
    w = {
      next: c.next === "draw" ? null : c.next,
      scope: withScope(w.scope, c.effects),
      parentScope: narrows ? w.scope : w.parentScope,
      mood: withMood(w.mood, c.effects),
      mode: c.effects.mode ?? w.mode,
      crumbs: narrows ? [...w.crumbs, c.label] : w.crumbs,
      depth: w.depth + 1,
      unsure: w.unsure,
    };
  }
  return w;
}

/** A rule matches when every list it names covers the scope's list (and the entry is the same, if named). */
function matches(rule: FarRule, s: Scope): boolean {
  const covers = (want: string[] | undefined, have: string[] | null) => !want || (have !== null && have.every((v) => want.includes(v)));
  return (!rule.from.entry || rule.from.entry === s.entry)
    && covers(rule.from.topics, s.topics) && covers(rule.from.keywords, s.keywords) && covers(rule.from.genres, s.genres);
}

/** Design 4절: the "what" flips (far scope), the "how" (mood) stays. The 운명 1장 comes from the far side's whole entry. */
export function applyChallenge(map: QuestionMap, w: Walked): Walked {
  if (w.mode !== "challenge") return w;
  const rule = map.far.find((r) => matches(r, w.scope));
  const other = w.scope.entry === "leaf" ? "target" : "leaf";
  const scope: Scope = rule ? { ...ALL_SCOPE, ...rule.to } : { ...ALL_SCOPE, entry: other };
  return { ...w, scope, parentScope: { ...ALL_SCOPE, entry: scope.entry } };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/lib/paths/walk.test.ts`
Expected: PASS (7 tests). Note the challenge "no rule" case: the walked scope is `entry=leaf; genres=SF·판타지`, so `other` is `target`.

- [ ] **Step 5: Commit**

```bash
git add web/src/lib/paths/walk.ts web/src/lib/paths/walk.test.ts
git commit -m "feat(paths): walk answers to a scope, mood and mode, with the challenge swap (v2 plan 1)"
```

---

### Task 5: 길 끝에서 다섯 장 뽑기

**Files:**
- Create: `web/src/lib/paths/draw.ts`
- Modify: `web/src/lib/recommend/score.ts` (`lengthPoints` 앞에 `export` 하나 — 동작 변화 없음)
- Test: `web/src/lib/paths/draw.test.ts`

**Interfaces:**
- Consumes: `drawBookmarks`, `leafScore`, `LEAF_PARAMS`, `TARGET_PARAMS`, `RECOMMENDED`(`params.ts`), `mulberry32`, `lengthPoints` (recommend); `Walked`, `applyChallenge` (Task 4); `inScope` (Task 1)
- Produces: `interface PathDraw extends DrawResult { scopeCount: number; widenedScope: boolean }`, `drawForPath(books: Book[], map: QuestionMap, walked: Walked, opts: { seen: ReadonlySet<string>; rng: Rng }): PathDraw`, `moodScore(book: Book, mood: Mood): number`
- 규칙(설계 5절): 범위 안 안 본 책이 4권 미만이면 윗단계 범위로 넓혀 추천(`widenedScope: true`); 운명 1장은 윗단계(넓혔으면 그 윗단계도 같은 윗단계)에서 — `inRandomPool`. 범위가 🍃이거나 섞였으면 `LEAF_PARAMS`(장르 최대 2), 🎯만이면 `TARGET_PARAMS`.

- [ ] **Step 1: Export `lengthPoints` (no behaviour change)**

In `web/src/lib/recommend/score.ts` change `function lengthPoints(` to `export function lengthPoints(`.
Run: `npx vitest run src/lib/recommend` — Expected: PASS (unchanged count).

- [ ] **Step 2: Write the failing test**

```ts
// web/src/lib/paths/draw.test.ts
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { mulberry32, type Book, type LeafBook, type TargetBook } from "@/lib/recommend";
import { drawForPath, moodScore } from "./draw";
import { parseQuestionMap } from "./parse";
import { NEUTRAL_MOOD, type Answer } from "./types";
import { walkPath } from "./walk";

const MAP = parseQuestionMap(readFileSync(path.join(__dirname, "__fixtures__/mini-map.md"), "utf8"));
const a = (node: string, choice: Answer["choice"]): Answer => ({ node, choice });
const SQL = [a("start", "A"), a("branch", "B"), a("learn-area", "A"), a("learn-data", "A"), a("mood-way", "B"), a("mood-len", "A")];

const t = (id: string, keywords: string[], way: TargetBook["way"] = "실습", pages = 200, topic = "데이터 분석"): TargetBook =>
  ({ id, entry: "target", field: "데이터·통계", topic, genre: topic, pages, way, keywords });
const l = (id: string, genre: string): LeafBook => ({ id, entry: "leaf", genre, pages: 250, axes: { temp: 1, pull: 0, gain: 0, world: 0 } });

const BOOKS: Book[] = [
  t("sql1", ["SQL"]), t("sql2", ["SQL"]), t("sql3", ["SQL"], "개념"), t("sql4", ["SQL"], "실습", 450), t("sql5", ["SQL"]),
  t("xl1", ["엑셀"]), t("xl2", ["엑셀"]), t("mind1", ["우울"], "개념", 200, "마음 돌보기"),
  l("e1", "에세이"), l("e2", "에세이"), l("e3", "에세이"), l("e4", "에세이"), l("e5", "에세이"),
];
const opts = (seed = 1, seen: string[] = []) => ({ seen: new Set(seen), rng: mulberry32(seed) });

describe("moodScore", () => {
  it("scores a 🎯 book by way and length, a 🍃 book by the axes and length", () => {
    expect(moodScore(t("x", [], "실습", 200), { ...NEUTRAL_MOOD, way: "실습", len: 1 })).toBe(4);   // way 2 + thin 2
    expect(moodScore(l("y", "에세이"), { ...NEUTRAL_MOOD, axes: { temp: 1, pull: 0, gain: 0, world: 0 }, len: 0 })).toBe(1);
    expect(moodScore(t("z", []), NEUTRAL_MOOD)).toBe(0);
  });
});

describe("drawForPath", () => {
  it("SQL path: four SQL books recommended, the 운명 1장 from 데이터 분석 (one level up)", () => {
    const d = drawForPath(BOOKS, MAP, walkPath(MAP, SQL), opts());
    const rec = d.picks.filter((p) => p.kind === "recommended").map((p) => p.book.id);
    const fate = d.picks.filter((p) => p.kind === "random").map((p) => p.book);
    expect(rec).toHaveLength(4);
    expect(rec.every((id) => id.startsWith("sql"))).toBe(true);
    expect(fate).toHaveLength(1);
    expect(fate[0].entry === "target" && fate[0].topic).toBe("데이터 분석");
    expect(rec).not.toContain(fate[0].id);
    expect(d.scopeCount).toBe(5);
    expect(d.widenedScope).toBe(false);
  });

  it("too few in the scope: widens to the level above and says so", () => {
    const d = drawForPath(BOOKS, MAP, walkPath(MAP, SQL), opts(1, ["sql1", "sql2"]));
    expect(d.widenedScope).toBe(true);
    expect(d.picks.filter((p) => p.kind === "recommended")).toHaveLength(4);
    expect(d.scopeCount).toBe(3);
  });

  it("challenge: a 데이터 분석 answer draws from the far side (에세이), keeping the mood", () => {
    const d = drawForPath(BOOKS, MAP, walkPath(MAP, [a("start", "B"), ...SQL.slice(1)]), opts());
    expect(d.picks.filter((p) => p.kind === "recommended").every((p) => p.book.entry === "leaf" && p.book.genre === "에세이")).toBe(true);
  });

  it("is reproducible with the same seed", () => {
    const one = drawForPath(BOOKS, MAP, walkPath(MAP, SQL), opts(7)).picks.map((p) => p.book.id);
    const two = drawForPath(BOOKS, MAP, walkPath(MAP, SQL), opts(7)).picks.map((p) => p.book.id);
    expect(one).toEqual(two);
  });

  it("refuses to draw before the path ends", () => {
    expect(() => drawForPath(BOOKS, MAP, walkPath(MAP, SQL.slice(0, 2)), opts())).toThrow(/not finished/);
  });
});
```

- [ ] **Step 3: Run test to verify it fails**

Run: `npx vitest run src/lib/paths/draw.test.ts`
Expected: FAIL — cannot resolve `./draw`.

- [ ] **Step 4: Write minimal implementation**

```ts
// web/src/lib/paths/draw.ts
import { drawBookmarks, leafScore, LEAF_PARAMS, TARGET_PARAMS, type Book, type DrawResult, type Rng } from "@/lib/recommend";
import { RECOMMENDED } from "@/lib/recommend/params";
import { lengthPoints } from "@/lib/recommend/score";
import { inScope, type Mood, type QuestionMap } from "./types";
import { applyChallenge, type Walked } from "./walk";

export interface PathDraw extends DrawResult { scopeCount: number; widenedScope: boolean }

/** Design 5절-2: 🍃 by the axes + length (the balance-game rule), 🎯 by way (+2) + length points. */
export function moodScore(book: Book, mood: Mood): number {
  if (book.entry === "leaf") return leafScore(book, { ...mood.axes, len: mood.len });
  return (mood.way && book.way === mood.way ? 2 : 0) + lengthPoints(book.pages, mood.len);
}

const maxPossible = (mood: Mood): number =>
  Object.values(mood.axes).reduce((s, v) => s + Math.abs(v), 0) + (mood.way ? 2 : 0) + (mood.len === 1 ? 2 : mood.len === -1 ? 1 : 0);

export function drawForPath(books: Book[], map: QuestionMap, walked: Walked, opts: { seen: ReadonlySet<string>; rng: Rng }): PathDraw {
  if (walked.next !== null) throw new Error(`path not finished: next question is "${walked.next}"`);
  const w = applyChallenge(map, walked);
  const unseen = books.filter((b) => !opts.seen.has(b.id));
  const scopeCount = unseen.filter((b) => inScope(b, w.scope)).length;
  const widenedScope = scopeCount < RECOMMENDED;
  const pool = widenedScope ? w.parentScope : w.scope;
  const params = pool.entry === "target" ? TARGET_PARAMS : LEAF_PARAMS;
  const result = drawBookmarks(books, {
    score: (b) => (inScope(b, pool) ? moodScore(b, w.mood) : null),
    maxPossible: maxPossible(w.mood),
  }, {
    seen: opts.seen, rng: opts.rng, tau: params.tau, delta: params.delta, maxSameGenre: params.maxSameGenre,
    inRandomPool: (b) => inScope(b, w.parentScope),
  });
  return { ...result, scopeCount, widenedScope };
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `npx vitest run src/lib/paths src/lib/recommend`
Expected: PASS (all; recommend count unchanged, `parity.test.ts` still passes).

- [ ] **Step 6: Commit**

```bash
git add web/src/lib/paths/draw.ts web/src/lib/paths/draw.test.ts web/src/lib/recommend/score.ts
git commit -m "feat(paths): draw five bookmarks at the end of a path, 운명 1장 one level up (v2 plan 1)"
```

---

### Task 6: 모든 길 끝의 책 수 (coverage)

**Files:**
- Create: `web/src/lib/paths/coverage.ts`, `web/src/lib/paths/index.ts`
- Test: `web/src/lib/paths/coverage.test.ts`

**Interfaces:**
- Consumes: `walkPath`, `applyChallenge` (Task 4), `inScope`, `scopeKey` (Task 1)
- Produces: `interface PathEnd { scopeKey: string; crumbs: string[]; mode: "normal" | "challenge"; books: number; example: Answer[] }`, `pathEnds(map: QuestionMap): Omit<PathEnd, "books">[]` (같은 범위·모드는 하나로), `coverage(map: QuestionMap, books: Book[]): PathEnd[]` (책 수 오름차순)
- 기분 질문은 범위를 바꾸지 않으므로 열거할 때 기분 노드는 `unsure`로만 지나간다(조합 폭발 방지).

- [ ] **Step 1: Write the failing test**

```ts
// web/src/lib/paths/coverage.test.ts
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import type { Book, TargetBook } from "@/lib/recommend";
import { coverage, pathEnds } from "./coverage";
import { parseQuestionMap } from "./parse";

const MAP = parseQuestionMap(readFileSync(path.join(__dirname, "__fixtures__/mini-map.md"), "utf8"));
const t = (id: string, k: string): TargetBook => ({ id, entry: "target", field: "f", topic: "데이터 분석", genre: "데이터 분석", pages: 200, way: "실습", keywords: [k] });

describe("pathEnds", () => {
  it("lists each distinct end once per mode, with a way to reach it", () => {
    const ends = pathEnds(MAP);
    const normal = ends.filter((e) => e.mode === "normal").map((e) => e.scopeKey);
    expect(normal).toEqual(expect.arrayContaining([
      "all", "entry=leaf", "entry=target", "entry=target;topics=데이터 분석;keywords=SQL",
      "entry=target;topics=데이터 분석;keywords=엑셀", "entry=leaf;genres=SF·판타지",
    ]));
    expect(new Set(normal).size).toBe(normal.length);
    const sql = ends.find((e) => e.mode === "normal" && e.scopeKey.endsWith("keywords=SQL"))!;
    expect(sql.crumbs).toEqual(["뭔가 배우기", "데이터를 다루기", "DB에서 꺼내기"]);
    expect(sql.example.at(-1)).toEqual({ node: "mood-len", choice: "unsure" });
  });
});

describe("coverage", () => {
  it("counts the books at every end, fewest first", () => {
    const books: Book[] = [t("1", "SQL"), t("2", "SQL"), t("3", "엑셀")];
    const rows = coverage(MAP, books).filter((r) => r.mode === "normal");
    expect(rows[0].books).toBe(0);
    expect(rows.find((r) => r.scopeKey.endsWith("keywords=SQL"))!.books).toBe(2);
    expect(rows.map((r) => r.books)).toEqual([...rows.map((r) => r.books)].sort((x, y) => x - y));
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/paths/coverage.test.ts`
Expected: FAIL — cannot resolve `./coverage`.

- [ ] **Step 3: Write minimal implementation**

```ts
// web/src/lib/paths/coverage.ts
import type { Book } from "@/lib/recommend";
import { inScope, scopeKey, type Answer, type QuestionMap } from "./types";
import { applyChallenge, walkPath } from "./walk";

export interface PathEnd { scopeKey: string; crumbs: string[]; mode: "normal" | "challenge"; books: number; example: Answer[] }

/** Every distinct place a path can end (scope × mode). Mood questions are passed with "unsure": they never move the scope. */
export function pathEnds(map: QuestionMap): Omit<PathEnd, "books">[] {
  const out = new Map<string, Omit<PathEnd, "books">>();
  const visit = (answers: Answer[]) => {
    const w = walkPath(map, answers);
    if (w.next === null) {
      const final = applyChallenge(map, w);
      const key = `${w.mode}|${scopeKey(final.scope)}`;
      if (!out.has(key)) out.set(key, { scopeKey: scopeKey(final.scope), crumbs: w.crumbs, mode: w.mode, example: answers });
      return;
    }
    const node = map.nodes[w.next];
    const choices: Answer["choice"][] = node.kind === "mood" ? ["unsure"] : ["A", "B", "unsure"];
    for (const choice of choices) visit([...answers, { node: node.id, choice }]);
  };
  visit([]);
  return [...out.values()];
}

export function coverage(map: QuestionMap, books: Book[]): PathEnd[] {
  return pathEnds(map)
    .map((end) => {
      const w = applyChallenge(map, walkPath(map, end.example));
      return { ...end, books: books.filter((b) => inScope(b, w.scope)).length };
    })
    .sort((x, y) => x.books - y.books || x.scopeKey.localeCompare(y.scopeKey));
}
```

```ts
// web/src/lib/paths/index.ts
export * from "./types";
export { parseQuestionMap, MapParseError } from "./parse";
export { validateMap, type Vocabulary } from "./validate";
export { walkPath, applyChallenge, PathError, type Walked } from "./walk";
export { drawForPath, moodScore, type PathDraw } from "./draw";
export { coverage, pathEnds, type PathEnd } from "./coverage";
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/lib/paths`
Expected: PASS (all paths tests).

- [ ] **Step 5: Commit**

```bash
git add web/src/lib/paths/coverage.ts web/src/lib/paths/coverage.test.ts web/src/lib/paths/index.ts
git commit -m "feat(paths): list every path end and count its books (v2 plan 1)"
```

---

### Task 7: 지도 문서 → 앱 데이터, 책 수 보고서 (scripts)

**Files:**
- Create: `docs/question-map.md` (형식 설명 + **임시 시작 지도** = mini 지도와 같은 8개 노드, 주석으로 "초안 전 임시"), `web/scripts/build-question-map.ts`, `web/scripts/paths-coverage.ts`, `web/src/data/question-map.json` (생성물, 커밋)
- Modify: `web/package.json` (scripts `map:build`, `map:coverage`)
- Test: `web/src/lib/paths/data.test.ts`

**Interfaces:**
- Consumes: `parseQuestionMap`, `validateMap`, `coverage` (Tasks 2·3·6); `@/data/vocab.json` (`{ [topic]: { keywords: { [name]: pattern }, terms: string[] } }`), `@/data/books.json`
- Produces: `src/data/question-map.json` (= `QuestionMap`), `npm run map:build`(검증 실패면 종료 코드 1, 오류 목록 출력), `npm run map:coverage`(표 출력: 책 수 · 모드 · 지나온 길 · 범위)

- [ ] **Step 1: Write the failing test (the committed data must be the document, valid)**

```ts
// web/src/lib/paths/data.test.ts
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import built from "@/data/question-map.json";
import vocab from "@/data/vocab.json";
import books from "@/data/books.json";
import { parseQuestionMap } from "./parse";
import { validateMap } from "./validate";
import type { QuestionMap } from "./types";

const DOC = readFileSync(path.join(__dirname, "../../../../docs/question-map.md"), "utf8");

describe("src/data/question-map.json", () => {
  it("is docs/question-map.md as built (run npm run map:build after editing the document)", () => {
    expect(built).toEqual(parseQuestionMap(DOC));
  });
  it("passes the checks against our topics, keywords and genres", () => {
    const topics = Object.fromEntries(Object.entries(vocab as Record<string, { keywords: Record<string, string> }>)
      .map(([t, v]) => [t, Object.keys(v.keywords)]));
    const genres = [...new Set((books as { genre: string }[]).map((b) => b.genre))];
    expect(validateMap(built as QuestionMap, { topics, genres })).toEqual([]);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/paths/data.test.ts`
Expected: FAIL — `@/data/question-map.json` not found.

- [ ] **Step 3: Write the document, the scripts and the package scripts**

`docs/question-map.md` — 맨 위에 형식 설명(설계 3-3 + 이 계획 Task 2의 문법: 블록 종류, 효과 목록, `next=draw`, 첫 노드가 시작, 선택지는 늘 둘, 기분 노드는 범위를 바꾸지 않음, `far` 블록), 그 아래 `web/src/lib/paths/__fixtures__/mini-map.md`의 노드 8개와 `far` 1개를 그대로 옮기고 위에 `> 임시 시작 지도 — 계획 1 Task 8에서 사람이 확정한 초안으로 바꾼다`를 적는다.

```ts
// web/scripts/build-question-map.ts
// Run from web/:  npm run map:build   — docs/question-map.md → checks → src/data/question-map.json (commit it)
import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { parseQuestionMap, validateMap } from "../src/lib/paths";

const root = path.resolve(__dirname, "..");
const vocab = JSON.parse(readFileSync(path.join(root, "src/data/vocab.json"), "utf8")) as Record<string, { keywords: Record<string, string> }>;
const books = JSON.parse(readFileSync(path.join(root, "src/data/books.json"), "utf8")) as { genre: string }[];
const map = parseQuestionMap(readFileSync(path.join(root, "../docs/question-map.md"), "utf8"));
const errors = validateMap(map, {
  topics: Object.fromEntries(Object.entries(vocab).map(([t, v]) => [t, Object.keys(v.keywords)])),
  genres: [...new Set(books.map((b) => b.genre))],
});
if (errors.length) {
  console.error(`question map: ${errors.length} problem(s)\n${errors.map((e) => `  - ${e}`).join("\n")}`);
  process.exit(1);
}
writeFileSync(path.join(root, "src/data/question-map.json"), `${JSON.stringify(map, null, 1)}\n`);
console.log(`question-map.json: ${Object.keys(map.nodes).length} questions, ${map.far.length} far rules`);
```

```ts
// web/scripts/paths-coverage.ts
// Run from web/:  npm run map:coverage   — books at every path end of src/data/question-map.json, fewest first
import { readFileSync } from "node:fs";
import path from "node:path";
import type { CatalogBook } from "../src/lib/books/types";
import { coverage, type QuestionMap } from "../src/lib/paths";
import type { Book } from "../src/lib/recommend";

const root = path.resolve(__dirname, "..");
const map = JSON.parse(readFileSync(path.join(root, "src/data/question-map.json"), "utf8")) as QuestionMap;
// same mapping as toBook() in src/lib/books/catalog.ts (not imported: catalog.ts pulls the app's data modules)
const toBook = (b: CatalogBook): Book => (b.entry === "leaf"
  ? { id: b.isbn, entry: "leaf", genre: b.genre, pages: b.pages, axes: b.axes }
  : { id: b.isbn, entry: "target", field: b.field, topic: b.topic, genre: b.genre, pages: b.pages, way: b.way, keywords: b.keywords });
const books = (JSON.parse(readFileSync(path.join(root, "src/data/books.json"), "utf8")) as CatalogBook[]).map(toBook);
const rows = coverage(map, books);
console.log("books | mode | path | scope");
for (const r of rows) console.log(`${String(r.books).padStart(5)} | ${r.mode.padEnd(9)} | ${r.crumbs.join(" › ") || "(좁히지 않음)"} | ${r.scopeKey}`);
const short = rows.filter((r) => r.books < 4).length;
console.log(`\n${rows.length} ends · ${short} with fewer than 4 books`);
```

In `web/package.json` scripts add:
```json
"map:build": "tsx scripts/build-question-map.ts",
"map:coverage": "tsx scripts/paths-coverage.ts"
```

- [ ] **Step 4: Build the data and run the tests**

Run: `npm run map:build` — Expected: `question-map.json: 8 questions, 1 far rules`, exit 0.
Run: `npx vitest run src/lib/paths` — Expected: PASS (incl. `data.test.ts`).
Run: `npm run map:coverage` — Expected: a table, exit 0.
Run: `npx vitest run && npx tsc --noEmit && npm run lint` — Expected: all exit 0.

- [ ] **Step 5: Commit**

```bash
git add docs/question-map.md web/scripts/build-question-map.ts web/scripts/paths-coverage.ts web/src/data/question-map.json web/src/lib/paths/data.test.ts web/package.json
git commit -m "feat(paths): build the question map from the document, report books per path end (v2 plan 1)"
```

---

### Task 8: 질문 지도 초안 (내용) — 사람 확정 관문

**Files:**
- Modify: `docs/question-map.md` (임시 지도 → 전체 초안), `docs/target-chips.md` ("새 키워드 정의" 표에 19개), `web/src/data/question-map.json` (map:build)

이 작업은 코드가 아니라 **사람이 확정할 내용의 초안**이다. 완료 조건이 곧 검증이다.

- [ ] **Step 1: 키워드 정의 19개 초안** — `target-chips.md` "새 키워드 정의" 표에 SQL · 기초 통계 · 확률 · 회귀분석 · 가설검정 · 챗GPT · 클로드 · 제미나이 · 프롬프트 엔지니어링 · 바이브 코딩 · AI 에이전트 · 이미지·영상 생성 · 파이썬 자동화 · 코파일럿·M365 · AI 업무 활용 · 습관 · 집중력 · 뇌과학 · 일하는 법. 각 한 줄 정의 + 헷갈리는 이웃과의 경계(예: 챗GPT = 챗GPT 쓰는 법이 중심 / AI 업무 활용 = 여러 AI 도구로 일하는 법 / 프롬프트 엔지니어링 = 질문 설계법 자체). 정의 표는 매일 태그 작업의 지시문에 들어간다(`src/pipeline/prompt.py`가 이 표를 읽음) — `PYTHONIOENCODING=utf-8 python -m pytest -q src/tests`로 지시문 테스트가 통과하는지 확인.
- [ ] **Step 2: 지도 초안** — `docs/question-map.md`에 설계 3·4절대로:
  - 처음 두 질문(평소/도전, 이야기/배우기) + 갈래 초입(떠오르는 게 있어요/기분 따라)
  - 배우기 좁히기: 12개 주제 → 56개 키워드까지 둘씩 갈라지는 길(주제마다 키워드가 3개 이상이면 두 단계로)
  - 이야기 좁히기: 장르 묶음 → 12개 장르(`book-pool.md` 1-2의 장르; 지금 책이 없는 역사·사회·시사·호러·괴담도 길은 만들고 coverage에서 0으로 드러나게)
  - 기분 질문: 이야기(온도·끌림·얻는 것·세계 — 지금 `balance-game.md` 9문항의 문장을 출발점으로) · 배우기(방식·분량)
  - `far` 표: 갈래마다 먼 갈래(예: 데이터·AI ↔ 인문·시·예술 / SF ↔ 에세이·시 / 마음 돌보기 ↔ 과학 교양)
  - 질문 문장은 짧고 둘 다 끌리게(밸런스 게임 말투), 선택지 글자는 12자 안팎
- [ ] **Step 3: 만들고 재기** — `npm run map:build`(exit 0) → `npm run map:coverage` → 4권 미만 길 목록을 표로 정리(계획 3의 입력).
- [ ] **Step 4: 사용자 검토 요청** — 질문 문장·갈림·먼 곳 표·키워드 정의를 사용자가 읽고 고친다. **확정 전에는 계획 2를 시작하지 않는다.**
- [ ] **Step 5: Commit (사용자 확정 후)**

```bash
git add docs/question-map.md docs/target-chips.md web/src/data/question-map.json
git commit -m "docs: question map v1 and the 19 keyword definitions (user-confirmed)"
```

---

## Self-Review (작성자 확인)

- **설계 범위 대응**: 3절 질문 지도 → Task 2·3·7·8 / 3-4 키워드 정의 → Task 8 / 4절 도전·먼 곳 → Task 4(`applyChallenge`)·8(`far` 표) / 5절 뽑기 1~5 → Task 5, 5-6 시뮬레이션 → Task 6·7(TS로 — Global Constraints에 이유) / 5-7 매일 책 작업 → 계획 3 / 2·6·7·8절(화면·기록·옮기기·시안) → 계획 2.
- **자리표시 없음**: 모든 코드 단계에 코드. Task 8은 내용 작업이라 완료 조건(빌드·검증·coverage·사용자 확정)으로 정의.
- **이름 일관성**: `walkPath`/`Walked`/`applyChallenge`/`drawForPath`/`PathDraw`/`moodScore`/`coverage`/`pathEnds`/`PathEnd`/`validateMap`/`Vocabulary`/`parseQuestionMap`/`MapParseError`/`PathError`/`inScope`/`scopeKey`/`ALL_SCOPE`/`NEUTRAL_MOOD` — 정의한 Task와 쓰는 Task가 같다.
