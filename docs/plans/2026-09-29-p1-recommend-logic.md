# P1 추천 로직 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 갈피의 추천 규칙(밸런스 답 → 축 점수, 🍃·🎯 점수, 5권 뽑기, 안내 문구, 책소개 자르기, 나온 이유)을 화면과 분리된 순수 함수로 만들고, 테스트 커버리지 100%와 Python 시뮬레이션과 같은 분포를 확인한다.

**Architecture:** `web/src/lib/recommend/`의 작은 파일들. 무작위는 모두 주입된 `Rng`로만 — 테스트는 `mulberry32(seed)`로 결과를 고정한다. 화면·서버·DB를 모른다.

**Tech Stack:** TypeScript · Vitest 5 (+ coverage-v8) · Python 3 (분포 비교용 고정 데이터 한 번 생성)

**Spec:** `docs/balance-game.md` v0.2 (2·3절) · `docs/target-chips.md` v0.2 (3·4절) · `docs/book-pool.md` v0.1 (2절) · `docs/PRD.md` F-05·F-09·F-10 · 로드맵 3-1

## Global Constraints

- 🍃 축 점수: 같은 축 두 답의 합 → -2..2. 분량은 ±1. 책 점수 = Σ(답 × 책 태그) + 분량(답 × 쪽수 태그)
- 쪽수 태그: 250쪽 이하 +1, 400쪽 이상 −1, 그 사이 0
- 🎯 점수: 주제 불일치면 제외(null). 키워드 겹침 1개당 +3, 읽는 방식 같으면 +2, 얇게: ≤250쪽 +2·≥400쪽 −1, 두꺼워도 좋아요: ≥300쪽 +1 (고른 항목만)
- 뽑기: 이미 본 책 제외 → 최고 점수에서 Δ=2 안쪽 → 가중 추첨(가중치 e^((점수−최고)/τ)) → 같은 장르 최대 2권(🎯는 제한 없음) → 4권이 안 차면 Δ를 1씩 넓힘 → 무작위 1권(🍃 전체 / 🎯 같은 분야, 장르 상한 지킴) → 자리 섞기
- 설정: 🍃 τ=1.0 Δ=2 장르 상한 2 · 🎯 τ=0.5 Δ=2
- 바닥 알림: 추천 4권 평균 점수 < 그 사람 최고 가능 점수의 50%
- 책소개: 문장 단위로 120자 넘을 때까지, 첫 문장이 200자 넘으면 150자에서 "…"
- 화면 문구는 PRD·설계 문서 그대로 (한국어)

---

## File Structure

| 파일 | 책임 |
|---|---|
| `web/src/lib/recommend/types.ts` | 로드맵 3-1 타입 |
| `web/src/lib/recommend/rng.ts` | `mulberry32` |
| `web/src/lib/recommend/length.ts` | `lengthTag` |
| `web/src/lib/recommend/answers.ts` | 밸런스 9답 → `LeafAnswers` |
| `web/src/lib/recommend/score.ts` | `leafScore`, `targetScore`, `maxPossibleLeaf`, `maxPossibleTarget` |
| `web/src/lib/recommend/params.ts` | `LEAF_PARAMS`, `TARGET_PARAMS` |
| `web/src/lib/recommend/draw.ts` | `drawBookmarks`, `weightedPick` |
| `web/src/lib/recommend/notice.ts` | `coverageNotice`, `EXHAUSTED_NOTICE` |
| `web/src/lib/recommend/intro.ts` | `truncateIntro` |
| `web/src/lib/recommend/reason.ts` | `reasonLine` |
| `web/src/lib/recommend/index.ts` | 공개 내보내기 |
| `web/src/lib/recommend/__fixtures__/leaf_pool.json`, `leaf_metrics.json` | 분포 비교용 (Python 생성) |
| `src/export_leaf_fixture.py` | 위 고정 데이터 생성 |

테스트는 각 파일 옆 `*.test.ts`.

---

### Task 1: 타입·무작위·쪽수 태그

**Files:**
- Create: `web/src/lib/recommend/types.ts`, `rng.ts`, `rng.test.ts`, `length.ts`, `length.test.ts`

**Interfaces:**
- Produces: 로드맵 3-1의 모든 타입, `mulberry32(seed: number): Rng`, `lengthTag(pages: number): Tag`

- [ ] **Step 1: 실패하는 테스트**

`web/src/lib/recommend/rng.test.ts`:
```ts
import { describe, expect, it } from "vitest";
import { mulberry32 } from "./rng";

describe("mulberry32", () => {
  it("is deterministic for a seed", () => {
    const a = mulberry32(7), b = mulberry32(7);
    expect([a(), a(), a()]).toEqual([b(), b(), b()]);
  });
  it("returns numbers in [0, 1)", () => {
    const r = mulberry32(1);
    for (let i = 0; i < 1000; i++) {
      const x = r();
      expect(x).toBeGreaterThanOrEqual(0);
      expect(x).toBeLessThan(1);
    }
  });
  it("differs between seeds", () => {
    expect(mulberry32(1)()).not.toBe(mulberry32(2)());
  });
});
```

`web/src/lib/recommend/length.test.ts`:
```ts
import { describe, expect, it } from "vitest";
import { lengthTag } from "./length";

describe("lengthTag", () => {
  it.each([[150, 1], [250, 1], [251, 0], [399, 0], [400, -1], [800, -1]])("%i pages -> %i", (pages, tag) => {
    expect(lengthTag(pages)).toBe(tag);
  });
});
```

- [ ] **Step 2: 실패 확인**

Run: `cd web && npm test -- recommend`
Expected: FAIL — modules not found

- [ ] **Step 3: 구현**

`web/src/lib/recommend/types.ts`:
```ts
export type Entry = "leaf" | "target";
export type AxisKey = "temp" | "pull" | "gain" | "world";
export type Tag = -1 | 0 | 1;
export type Way = "개념" | "실습" | "사례";
export type Rng = () => number;

export interface LeafBook { id: string; entry: "leaf"; genre: string; pages: number; axes: Record<AxisKey, Tag> }
export interface TargetBook {
  id: string; entry: "target"; field: string; topic: string; genre: string;
  pages: number; way: Way; keywords: string[];
}
export type Book = LeafBook | TargetBook;

export type BalanceChoice = "A" | "B" | "unsure";
export interface LeafAnswers { temp: number; pull: number; gain: number; world: number; len: Tag }
export interface TargetAnswers { topic: string; way: Way | null; len: Tag; keywords: string[] }

export interface Pick { book: Book; score: number; kind: "recommended" | "random" }
export interface DrawResult { picks: Pick[]; widened: boolean; exhausted: boolean }

export const AXES: readonly AxisKey[] = ["temp", "pull", "gain", "world"];
```

`web/src/lib/recommend/rng.ts`:
```ts
import type { Rng } from "./types";

/** Small seeded PRNG so draws are reproducible in tests. */
export function mulberry32(seed: number): Rng {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
```

`web/src/lib/recommend/length.ts`:
```ts
import type { Tag } from "./types";

/** Thin (<=250 pages) = 1, thick (>=400) = -1, otherwise 0. From YES24 page count, no human judgement. */
export function lengthTag(pages: number): Tag {
  if (pages <= 250) return 1;
  if (pages >= 400) return -1;
  return 0;
}
```

- [ ] **Step 4: 통과 확인**

Run: `npm test -- recommend`
Expected: PASS (3 + 6)

- [ ] **Step 5: Commit**

```bash
git add web/src/lib/recommend
git commit -m "feat(recommend): add types, seeded rng and page-length tag"
```

---

### Task 2: 밸런스 답 → 축 점수

**Files:**
- Create: `web/src/lib/recommend/answers.ts`, `answers.test.ts`

**Interfaces:**
- Consumes: `BalanceChoice`, `LeafAnswers` (Task 1)
- Produces: `leafAnswersFrom(choices: BalanceChoice[]): LeafAnswers`, `QUESTION_AXIS`

질문 순서 (balance-game.md 2절): 1 온도 · 2 끌림 · 3 얻는 것 · 4 세계 · 5 온도 · 6 끌림 · 7 얻는 것 · 8 세계 · 9 분량. `A`는 항상 표의 A쪽(+) — 화면의 좌우 반전은 화면이 처리하고 여기에는 의미(A/B)만 온다.

- [ ] **Step 1: 실패하는 테스트**

`web/src/lib/recommend/answers.test.ts`:
```ts
import { describe, expect, it } from "vitest";
import { leafAnswersFrom } from "./answers";
import type { BalanceChoice } from "./types";

const all = (c: BalanceChoice): BalanceChoice[] => Array(9).fill(c);

describe("leafAnswersFrom", () => {
  it("sums two answers per axis", () => {
    expect(leafAnswersFrom(all("A"))).toEqual({ temp: 2, pull: 2, gain: 2, world: 2, len: 1 });
    expect(leafAnswersFrom(all("B"))).toEqual({ temp: -2, pull: -2, gain: -2, world: -2, len: -1 });
  });

  it("treats a split pair as 0 and unsure as 0", () => {
    const c: BalanceChoice[] = ["A", "A", "unsure", "B", "B", "unsure", "unsure", "B", "unsure"];
    expect(leafAnswersFrom(c)).toEqual({ temp: 0, pull: 1, gain: 0, world: -2, len: 0 });
  });

  it("requires exactly 9 answers", () => {
    expect(() => leafAnswersFrom(["A"])).toThrow("9 answers");
  });
});
```

- [ ] **Step 2: 실패 확인**

Run: `npm test -- answers`
Expected: FAIL — module not found

- [ ] **Step 3: 구현**

`web/src/lib/recommend/answers.ts`:
```ts
import type { AxisKey, BalanceChoice, LeafAnswers, Tag } from "./types";

export const QUESTION_AXIS: readonly (AxisKey | "len")[] =
  ["temp", "pull", "gain", "world", "temp", "pull", "gain", "world", "len"];

const VALUE: Record<BalanceChoice, number> = { A: 1, B: -1, unsure: 0 };

export function leafAnswersFrom(choices: BalanceChoice[]): LeafAnswers {
  if (choices.length !== QUESTION_AXIS.length) throw new Error("leafAnswersFrom needs 9 answers");
  const out: LeafAnswers = { temp: 0, pull: 0, gain: 0, world: 0, len: 0 };
  choices.forEach((c, i) => {
    const axis = QUESTION_AXIS[i];
    if (axis === "len") out.len = VALUE[c] as Tag;
    else out[axis] += VALUE[c];
  });
  return out;
}
```

- [ ] **Step 4: 통과 확인**

Run: `npm test -- answers`
Expected: PASS (3)

- [ ] **Step 5: Commit**

```bash
git add web/src/lib/recommend/answers.ts web/src/lib/recommend/answers.test.ts
git commit -m "feat(recommend): turn nine balance answers into axis scores"
```

---

### Task 3: 점수와 최고 가능 점수

**Files:**
- Create: `web/src/lib/recommend/score.ts`, `score.test.ts`

**Interfaces:**
- Consumes: `lengthTag` (Task 1), 타입
- Produces: `leafScore(b: LeafBook, a: LeafAnswers): number`, `targetScore(b: TargetBook, a: TargetAnswers): number | null`, `maxPossibleLeaf(a: LeafAnswers): number`, `maxPossibleTarget(a: TargetAnswers): number`

- [ ] **Step 1: 실패하는 테스트**

`web/src/lib/recommend/score.test.ts`:
```ts
import { describe, expect, it } from "vitest";
import { leafScore, maxPossibleLeaf, maxPossibleTarget, targetScore } from "./score";
import type { LeafBook, TargetAnswers, TargetBook } from "./types";

const leaf = (axes: LeafBook["axes"], pages = 300): LeafBook => ({ id: "l", entry: "leaf", genre: "에세이", pages, axes });
const tbook = (o: Partial<TargetBook> = {}): TargetBook => ({
  id: "t", entry: "target", field: "데이터", topic: "통계", genre: "통계", pages: 300, way: "개념", keywords: ["확률"], ...o,
});
const tans = (o: Partial<TargetAnswers> = {}): TargetAnswers => ({ topic: "통계", way: null, len: 0, keywords: [], ...o });

describe("leafScore", () => {
  it("multiplies answers by tags and adds length", () => {
    const b = leaf({ temp: 1, pull: -1, gain: 0, world: 1 }, 200);
    expect(leafScore(b, { temp: 2, pull: 2, gain: -2, world: 0, len: 1 })).toBe(2 - 2 + 0 + 0 + 1);
  });
  it("is 0 when the user is neutral everywhere", () => {
    expect(leafScore(leaf({ temp: 1, pull: 1, gain: 1, world: 1 }), { temp: 0, pull: 0, gain: 0, world: 0, len: 0 })).toBe(0);
  });
});

describe("targetScore", () => {
  it("excludes other topics", () => {
    expect(targetScore(tbook({ topic: "AI 활용" }), tans())).toBeNull();
  });
  it("is 0 when nothing but the topic was chosen", () => {
    expect(targetScore(tbook(), tans())).toBe(0);
  });
  it("adds keyword, way and length points", () => {
    const a = tans({ keywords: ["확률", "회귀분석"], way: "개념", len: 1 });
    expect(targetScore(tbook({ pages: 240 }), a)).toBe(3 + 2 + 2);
  });
  it("penalises thick books for 얇게 and rewards them for 두꺼워도 좋아요", () => {
    expect(targetScore(tbook({ pages: 450 }), tans({ len: 1 }))).toBe(-1);
    expect(targetScore(tbook({ pages: 320 }), tans({ len: 1 }))).toBe(0);
    expect(targetScore(tbook({ pages: 320 }), tans({ len: -1 }))).toBe(1);
    expect(targetScore(tbook({ pages: 280 }), tans({ len: -1 }))).toBe(0);
  });
  it("ignores a different way", () => {
    expect(targetScore(tbook({ way: "실습" }), tans({ way: "개념" }))).toBe(0);
  });
});

describe("maxPossible", () => {
  it("leaf = sum of absolute answers", () => {
    expect(maxPossibleLeaf({ temp: 2, pull: -1, gain: 0, world: -2, len: -1 })).toBe(6);
  });
  it("target counts only chosen items", () => {
    expect(maxPossibleTarget(tans())).toBe(0);
    expect(maxPossibleTarget(tans({ keywords: ["확률"], way: "실습", len: 1 }))).toBe(3 + 2 + 2);
    expect(maxPossibleTarget(tans({ len: -1 }))).toBe(1);
  });
});
```

- [ ] **Step 2: 실패 확인**

Run: `npm test -- score`
Expected: FAIL — module not found

- [ ] **Step 3: 구현**

`web/src/lib/recommend/score.ts`:
```ts
import { lengthTag } from "./length";
import { AXES, type LeafAnswers, type LeafBook, type TargetAnswers, type TargetBook } from "./types";

export function leafScore(b: LeafBook, a: LeafAnswers): number {
  let s = a.len * lengthTag(b.pages);
  for (const axis of AXES) s += a[axis] * b.axes[axis];
  return s;
}

export function maxPossibleLeaf(a: LeafAnswers): number {
  return AXES.reduce((sum, axis) => sum + Math.abs(a[axis]), Math.abs(a.len));
}

function lengthPoints(pages: number, len: TargetAnswers["len"]): number {
  if (len === 1) return pages <= 250 ? 2 : pages >= 400 ? -1 : 0;   // 얇게
  if (len === -1) return pages >= 300 ? 1 : 0;                        // 두꺼워도 좋아요
  return 0;                                                            // 보통 / 고르지 않음
}

export function targetScore(b: TargetBook, a: TargetAnswers): number | null {
  if (b.topic !== a.topic) return null;
  let s = 3 * a.keywords.filter((k) => b.keywords.includes(k)).length;
  if (a.way && b.way === a.way) s += 2;
  return s + lengthPoints(b.pages, a.len);
}

export function maxPossibleTarget(a: TargetAnswers): number {
  return 3 * a.keywords.length + (a.way ? 2 : 0) + (a.len === 1 ? 2 : a.len === -1 ? 1 : 0);
}
```

- [ ] **Step 4: 통과 확인**

Run: `npm test -- score`
Expected: PASS (9)

- [ ] **Step 5: Commit**

```bash
git add web/src/lib/recommend/score.ts web/src/lib/recommend/score.test.ts
git commit -m "feat(recommend): score leaf and target books"
```

---

### Task 4: 5권 뽑기

**Files:**
- Create: `web/src/lib/recommend/params.ts`, `draw.ts`, `draw.test.ts`

**Interfaces:**
- Consumes: `Book`, `Pick`, `DrawResult`, `Rng`, `mulberry32`
- Produces:
```ts
export interface DrawOptions { seen: ReadonlySet<string>; tau: number; delta: number; maxSameGenre: number; rng: Rng; inRandomPool: (b: Book) => boolean }
export interface DrawInput { score: (b: Book) => number | null; maxPossible: number }
export function drawBookmarks(books: Book[], input: DrawInput, opts: DrawOptions): DrawResult;
export function weightedPick(cands: { book: Book; score: number }[], k: number, tau: number, rng: Rng, maxSame: number): { book: Book; score: number }[];
export const LEAF_PARAMS: { tau: 1; delta: 2; maxSameGenre: 2 };
export const TARGET_PARAMS: { tau: 0.5; delta: 2; maxSameGenre: 99 };
```

- [ ] **Step 1: 실패하는 테스트**

`web/src/lib/recommend/draw.test.ts`:
```ts
import { describe, expect, it } from "vitest";
import { drawBookmarks, weightedPick } from "./draw";
import { LEAF_PARAMS, TARGET_PARAMS } from "./params";
import { mulberry32 } from "./rng";
import type { Book, LeafBook } from "./types";

const mk = (id: string, genre: string, score: number): LeafBook =>
  ({ id, entry: "leaf", genre, pages: 300, axes: { temp: score as -1 | 0 | 1, pull: 0, gain: 0, world: 0 } });
// score function reads the planted score from axes.temp scaled by 3 so we can control it
const byTemp = (b: Book) => (b.entry === "leaf" ? b.axes.temp * 3 : null);
const opts = (o: Partial<Parameters<typeof drawBookmarks>[2]> = {}) =>
  ({ seen: new Set<string>(), ...LEAF_PARAMS, rng: mulberry32(1), inRandomPool: () => true, ...o });

const pool: Book[] = [
  mk("a1", "A", 1), mk("a2", "A", 1), mk("a3", "A", 1),
  mk("b1", "B", 1), mk("b2", "B", 1), mk("c1", "C", 0), mk("c2", "C", 0), mk("d1", "D", -1), mk("d2", "D", -1),
];

describe("weightedPick", () => {
  it("takes strict top-k when tau = 0", () => {
    const cands = pool.map((b) => ({ book: b, score: byTemp(b)! }));
    const got = weightedPick(cands, 3, 0, mulberry32(3), 99);
    expect(got.map((c) => c.score)).toEqual([3, 3, 3]);
  });
  it("respects the per-genre cap", () => {
    const cands = pool.map((b) => ({ book: b, score: byTemp(b)! }));
    const got = weightedPick(cands, 4, 0, mulberry32(3), 2);
    const genres = got.map((c) => c.book.genre);
    expect(genres.filter((g) => g === "A").length).toBeLessThanOrEqual(2);
    expect(got).toHaveLength(4);
  });
});

describe("drawBookmarks", () => {
  it("returns 4 recommended + 1 random, all different, none already seen", () => {
    const res = drawBookmarks(pool, { score: byTemp, maxPossible: 3 }, opts({ seen: new Set(["a1"]) }));
    const ids = res.picks.map((p) => p.book.id);
    expect(res.picks.filter((p) => p.kind === "recommended")).toHaveLength(4);
    expect(res.picks.filter((p) => p.kind === "random")).toHaveLength(1);
    expect(new Set(ids).size).toBe(5);
    expect(ids).not.toContain("a1");
  });

  it("keeps at most 2 books of a genre in the whole draw", () => {
    const res = drawBookmarks(pool, { score: byTemp, maxPossible: 3 }, opts());
    const counts = res.picks.reduce<Record<string, number>>((m, p) => ({ ...m, [p.book.genre]: (m[p.book.genre] ?? 0) + 1 }), {});
    expect(Math.max(...Object.values(counts))).toBeLessThanOrEqual(2);
  });

  it("is reproducible with the same seed and varies with another", () => {
    const a = drawBookmarks(pool, { score: byTemp, maxPossible: 3 }, opts({ rng: mulberry32(9) }));
    const b = drawBookmarks(pool, { score: byTemp, maxPossible: 3 }, opts({ rng: mulberry32(9) }));
    expect(a.picks.map((p) => p.book.id)).toEqual(b.picks.map((p) => p.book.id));
  });

  it("widens beyond delta when the top tier is too small", () => {
    const res = drawBookmarks(pool, { score: byTemp, maxPossible: 3 }, opts({ delta: 0, maxSameGenre: 1 }));
    expect(res.widened).toBe(true);
    expect(res.picks.filter((p) => p.kind === "recommended")).toHaveLength(4);
  });

  it("flags exhaustion when the recommended mean falls below half of the best possible", () => {
    const seen = new Set(["a1", "a2", "a3", "b1", "b2"]);            // all score-3 books already shown
    const res = drawBookmarks(pool, { score: byTemp, maxPossible: 3 }, opts({ seen }));
    expect(res.exhausted).toBe(true);
  });

  it("never flags exhaustion for a user with nothing to match (maxPossible 0)", () => {
    const res = drawBookmarks(pool, { score: () => 0, maxPossible: 0 }, opts());
    expect(res.exhausted).toBe(false);
  });

  it("skips books the score function excludes and books outside the random pool", () => {
    const onlyA = (b: Book) => (b.genre === "A" ? 1 : null);
    const res = drawBookmarks(pool, { score: onlyA, maxPossible: 1 },
      { ...opts(), ...TARGET_PARAMS, inRandomPool: (b) => b.genre === "Z" });
    expect(res.picks.every((p) => p.book.genre === "A")).toBe(true);
    expect(res.picks.some((p) => p.kind === "random")).toBe(false);
    expect(res.exhausted).toBe(true);                                   // fewer than 4 recommended
  });

  it("scores a random pick the score function excludes as 0 (🎯: same field, other topic)", () => {
    const onlyA = (b: Book) => (b.genre === "A" ? 1 : null);
    const res = drawBookmarks(pool, { score: onlyA, maxPossible: 1 },
      { ...opts(), ...TARGET_PARAMS, inRandomPool: (b) => b.genre === "B" });
    const random = res.picks.find((p) => p.kind === "random");
    expect(random?.book.genre).toBe("B");
    expect(random?.score).toBe(0);
  });

  it("returns an empty exhausted result when nothing is left", () => {
    const res = drawBookmarks(pool, { score: byTemp, maxPossible: 3 }, opts({ seen: new Set(pool.map((b) => b.id)) }));
    expect(res).toEqual({ picks: [], widened: false, exhausted: true });
  });
});
```

- [ ] **Step 2: 실패 확인**

Run: `npm test -- draw`
Expected: FAIL — module not found

- [ ] **Step 3: 구현**

`web/src/lib/recommend/params.ts`:
```ts
/** docs/book-pool.md 2절 — tuned with src/simulate_draws.py */
export const LEAF_PARAMS = { tau: 1, delta: 2, maxSameGenre: 2 } as const;
export const TARGET_PARAMS = { tau: 0.5, delta: 2, maxSameGenre: 99 } as const;
export const GOOD_SHARE = 0.5;
export const RECOMMENDED = 4;
```

`web/src/lib/recommend/draw.ts`:
```ts
import { GOOD_SHARE, RECOMMENDED } from "./params";
import type { Book, DrawResult, Pick, Rng } from "./types";

type Scored = { book: Book; score: number };

export interface DrawOptions {
  seen: ReadonlySet<string>;
  tau: number;
  delta: number;
  maxSameGenre: number;
  rng: Rng;
  inRandomPool: (b: Book) => boolean;
}
export interface DrawInput { score: (b: Book) => number | null; maxPossible: number }

/** Weighted sampling without replacement (weight e^((score - top)/tau)); tau = 0 means strict top-k. */
export function weightedPick(cands: Scored[], k: number, tau: number, rng: Rng, maxSame: number): Scored[] {
  const pool = [...cands];
  const picked: Scored[] = [];
  const perGenre = new Map<string, number>();
  while (pool.length && picked.length < k) {
    let idx: number;
    if (tau === 0) {
      const top = Math.max(...pool.map((c) => c.score));
      const tops = pool.map((c, i) => (c.score === top ? i : -1)).filter((i) => i >= 0);
      idx = tops[Math.floor(rng() * tops.length)];
    } else {
      const top = Math.max(...pool.map((c) => c.score));
      const weights = pool.map((c) => Math.exp((c.score - top) / tau));
      let r = rng() * weights.reduce((a, b) => a + b, 0);
      idx = weights.length - 1;                    // floating-point edge falls on the last one
      for (let i = 0; i < weights.length; i++) {
        r -= weights[i];
        if (r < 0) { idx = i; break; }
      }
    }
    const [choice] = pool.splice(idx, 1);
    const n = perGenre.get(choice.book.genre) ?? 0;
    if (n >= maxSame) continue;
    perGenre.set(choice.book.genre, n + 1);
    picked.push(choice);
  }
  return picked;
}

function shuffle<T>(items: T[], rng: Rng): T[] {
  const out = [...items];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

export function drawBookmarks(books: Book[], input: DrawInput, opts: DrawOptions): DrawResult {
  const cands: Scored[] = [];
  for (const book of books) {
    if (opts.seen.has(book.id)) continue;
    const score = input.score(book);
    if (score !== null) cands.push({ book, score });
  }
  if (!cands.length) return { picks: [], widened: false, exhausted: true };

  const best = Math.max(...cands.map((c) => c.score));
  let d = opts.delta;
  let recommended: Scored[] = [];
  for (;;) {
    recommended = weightedPick(cands.filter((c) => c.score >= best - d), RECOMMENDED, opts.tau, opts.rng, opts.maxSameGenre);
    if (recommended.length >= RECOMMENDED || best - d <= Math.min(...cands.map((c) => c.score))) break;
    d += 1;
  }

  const chosen = new Set(recommended.map((c) => c.book.id));
  const genres = recommended.map((c) => c.book.genre);
  const randomPool = books.filter((b) => !opts.seen.has(b.id) && !chosen.has(b.id) && opts.inRandomPool(b)
    && genres.filter((g) => g === b.genre).length < opts.maxSameGenre);
  const random = randomPool.length ? randomPool[Math.floor(opts.rng() * randomPool.length)] : null;

  const mean = recommended.reduce((s, c) => s + c.score, 0) / Math.max(recommended.length, 1);
  const exhausted = recommended.length < RECOMMENDED || (input.maxPossible > 0 && mean < GOOD_SHARE * input.maxPossible);

  const picks: Pick[] = recommended.map((c) => ({ book: c.book, score: c.score, kind: "recommended" }));
  if (random) picks.push({ book: random, score: input.score(random) ?? 0, kind: "random" });
  return { picks: shuffle(picks, opts.rng), widened: d > opts.delta, exhausted };
}
```

- [ ] **Step 4: 통과 확인**

Run: `npm test -- draw`
Expected: PASS (11)

- [ ] **Step 5: Commit**

```bash
git add web/src/lib/recommend/params.ts web/src/lib/recommend/draw.ts web/src/lib/recommend/draw.test.ts
git commit -m "feat(recommend): draw 4 weighted picks plus 1 random with genre cap"
```

---

### Task 5: 안내 문구·책소개 자르기·나온 이유

**Files:**
- Create: `web/src/lib/recommend/notice.ts`, `notice.test.ts`, `intro.ts`, `intro.test.ts`, `reason.ts`, `reason.test.ts`, `index.ts`

**Interfaces:**
- Consumes: 타입, `lengthTag`
- Produces: `coverageNotice(found: number, keyword: string, topic: string): string | null`, `EXHAUSTED_NOTICE: string`, `truncateIntro(text: string): { text: string; truncated: boolean }`, `reasonLine(book: Book, answers: LeafAnswers | TargetAnswers): { label: "나온 이유" | "이 책은"; items: string[] }`

- [ ] **Step 1: 실패하는 테스트**

`web/src/lib/recommend/notice.test.ts`:
```ts
import { describe, expect, it } from "vitest";
import { EXHAUSTED_NOTICE, coverageNotice } from "./notice";

describe("coverageNotice", () => {
  it("says nothing when 4 or more books were found", () => {
    expect(coverageNotice(4, "SQL", "데이터 분석")).toBeNull();
  });
  it("is honest about 1-3 books", () => {
    expect(coverageNotice(2, "SQL", "데이터 분석")).toBe("SQL 책은 아직 2권이에요. 나머지는 가까운 '데이터 분석' 책이에요");
  });
  it("is honest about 0 books", () => {
    expect(coverageNotice(0, "발표", "시간·생산성")).toBe("아직 발표 책이 없어요. 가장 가까운 '시간·생산성' 책을 펼칠게요");
  });
  it("has the exhaustion notice text", () => {
    expect(EXHAUSTED_NOTICE).toBe("조건에 딱 맞는 책은 여기까지예요");
  });
});
```

`web/src/lib/recommend/intro.test.ts`:
```ts
import { describe, expect, it } from "vitest";
import { truncateIntro } from "./intro";

const s = (n: number, end = ".") => "가".repeat(n - 1) + end;

describe("truncateIntro", () => {
  it("keeps whole sentences until it passes 120 characters", () => {
    const text = `${s(60)} ${s(70)} ${s(50)}`;
    const out = truncateIntro(text);
    expect(out.text).toBe(`${s(60)} ${s(70)}`);
    expect(out.truncated).toBe(true);
  });
  it("returns short text unchanged", () => {
    expect(truncateIntro("짧은 소개예요.")).toEqual({ text: "짧은 소개예요.", truncated: false });
  });
  it("cuts a first sentence longer than 200 characters at 150 with an ellipsis", () => {
    const out = truncateIntro(`${s(230)} ${s(20)}`);
    expect(out.text).toBe(`${"가".repeat(150)}…`);
    expect(out.truncated).toBe(true);
  });
  it("handles empty text", () => {
    expect(truncateIntro("")).toEqual({ text: "", truncated: false });
  });
  it("normalises whitespace and keeps closing quotes with the sentence", () => {
    const out = truncateIntro(`“${"나".repeat(130)}!”\n\n다음 문장.`);
    expect(out.text).toBe(`“${"나".repeat(130)}!”`);
  });
});
```

`web/src/lib/recommend/reason.test.ts`:
```ts
import { describe, expect, it } from "vitest";
import { reasonLine } from "./reason";
import type { LeafBook, TargetBook } from "./types";

const leafBook: LeafBook = { id: "l", entry: "leaf", genre: "에세이", pages: 220, axes: { temp: 1, pull: 1, gain: -1, world: 1 } };
const targetBook: TargetBook = { id: "t", entry: "target", field: "데이터", topic: "통계", genre: "통계", pages: 240,
  way: "개념", keywords: ["확률", "회귀분석"] };

describe("reasonLine", () => {
  it("lists the leaf answers this book matches, strongest first", () => {
    expect(reasonLine(leafBook, { temp: 1, pull: 2, gain: -2, world: 0, len: 1 }))
      .toEqual({ label: "나온 이유", items: ["문장", "마음", "따뜻함", "얇게"] });
  });
  it("says 두껍게 when a thick-book answer meets a thick book", () => {
    const thick: LeafBook = { ...leafBook, pages: 420 };
    expect(reasonLine(thick, { temp: 0, pull: 0, gain: 0, world: 0, len: -1 }))
      .toEqual({ label: "나온 이유", items: ["두껍게"] });
  });
  it("describes the book itself when nothing matches (same format for random picks)", () => {
    expect(reasonLine(leafBook, { temp: -2, pull: -2, gain: 2, world: -2, len: -1 }))
      .toEqual({ label: "이 책은", items: ["따뜻함", "문장", "마음"] });
  });
  it("lists topic, matched keywords, way and length for target books", () => {
    expect(reasonLine(targetBook, { topic: "통계", way: "개념", len: 1, keywords: ["확률"] }))
      .toEqual({ label: "나온 이유", items: ["통계", "확률", "개념부터 쉽게", "얇게"] });
  });
  it("shows only the topic when nothing else was chosen", () => {
    expect(reasonLine(targetBook, { topic: "통계", way: null, len: 0, keywords: [] }))
      .toEqual({ label: "나온 이유", items: ["통계"] });
  });
});
```

- [ ] **Step 2: 실패 확인**

Run: `npm test -- notice intro reason`
Expected: FAIL — modules not found

- [ ] **Step 3: 구현**

`web/src/lib/recommend/notice.ts`:
```ts
export const EXHAUSTED_NOTICE = "조건에 딱 맞는 책은 여기까지예요";

/** docs/target-chips.md 3절: be honest when few books match a free-text goal. */
export function coverageNotice(found: number, keyword: string, topic: string): string | null {
  if (found >= 4) return null;
  if (found > 0) return `${keyword} 책은 아직 ${found}권이에요. 나머지는 가까운 '${topic}' 책이에요`;
  return `아직 ${keyword} 책이 없어요. 가장 가까운 '${topic}' 책을 펼칠게요`;
}
```

`web/src/lib/recommend/intro.ts`:
```ts
const LIMIT = 120;
const LONG_FIRST = 200;
const CUT = 150;

/** Whole sentences only (YES24 terms: no meaning-changing edits). */
export function truncateIntro(text: string): { text: string; truncated: boolean } {
  const full = text.replace(/\s+/g, " ").trim();
  const sentences = full.match(/[^.!?]+[.!?]+["'”’)]*|[^.!?]+$/g) ?? [full];
  const first = sentences[0].trim();
  if (first.length > LONG_FIRST) return { text: `${first.slice(0, CUT).trimEnd()}…`, truncated: true };
  let out = "";
  for (const sentence of sentences) {
    out = `${out} ${sentence.trim()}`.trim();
    if (out.length >= LIMIT) break;
  }
  return { text: out, truncated: out.length < full.length };
}
```

`web/src/lib/recommend/reason.ts`:
```ts
import { lengthTag } from "./length";
import { AXES, type AxisKey, type Book, type LeafAnswers, type TargetAnswers } from "./types";

const AXIS_LABEL: Record<AxisKey, [string, string]> = {
  temp: ["따뜻함", "여운"], pull: ["문장", "몰입"], gain: ["알게 됨", "마음"], world: ["현실", "딴 세상"],
};
const WAY_LABEL = { 개념: "개념부터 쉽게", 실습: "따라 하며 실습", 사례: "사례로 술술" } as const;
const MAX_ITEMS = 5;

type Reason = { label: "나온 이유" | "이 책은"; items: string[] };

export function reasonLine(book: Book, answers: LeafAnswers | TargetAnswers): Reason {
  if (book.entry === "target") {
    const a = answers as TargetAnswers;
    const items = [book.topic, ...a.keywords.filter((k) => book.keywords.includes(k))];
    if (a.way && a.way === book.way) items.push(WAY_LABEL[a.way]);
    if (a.len === 1 && book.pages <= 250) items.push("얇게");
    return { label: "나온 이유", items: items.slice(0, MAX_ITEMS) };
  }
  const a = answers as LeafAnswers;
  const label = (axis: AxisKey, sign: number) => AXIS_LABEL[axis][sign > 0 ? 0 : 1];
  const matched = [...AXES]
    .filter((axis) => a[axis] !== 0 && Math.sign(a[axis]) === book.axes[axis])
    .sort((x, y) => Math.abs(a[y]) - Math.abs(a[x]))
    .map((axis) => label(axis, a[axis]));
  const len = lengthTag(book.pages);
  if (a.len !== 0 && a.len === len) matched.push(a.len > 0 ? "얇게" : "두껍게");
  if (matched.length) return { label: "나온 이유", items: matched.slice(0, MAX_ITEMS) };
  const own = AXES.filter((axis) => book.axes[axis] !== 0).map((axis) => label(axis, book.axes[axis]));
  return { label: "이 책은", items: own.slice(0, 3) };
}
```

`web/src/lib/recommend/index.ts`:
```ts
export * from "./types";
export { mulberry32 } from "./rng";
export { lengthTag } from "./length";
export { leafAnswersFrom, QUESTION_AXIS } from "./answers";
export { leafScore, targetScore, maxPossibleLeaf, maxPossibleTarget } from "./score";
export { LEAF_PARAMS, TARGET_PARAMS } from "./params";
export { drawBookmarks, weightedPick, type DrawInput, type DrawOptions } from "./draw";
export { coverageNotice, EXHAUSTED_NOTICE } from "./notice";
export { truncateIntro } from "./intro";
export { reasonLine } from "./reason";
```

- [ ] **Step 4: 통과 확인**

Run: `npm test -- notice intro reason`
Expected: PASS (14)

- [ ] **Step 5: Commit**

```bash
git add web/src/lib/recommend
git commit -m "feat(recommend): add coverage notice, sentence-safe intro and reason line"
```

---

### Task 6: 시뮬레이션과 같은 분포 (🍃)

**Files:**
- Create: `src/export_leaf_fixture.py`, `web/src/lib/recommend/__fixtures__/leaf_pool.json`, `web/src/lib/recommend/__fixtures__/leaf_metrics.json`, `web/src/lib/recommend/parity.test.ts`

**Interfaces:**
- Consumes: `drawBookmarks`, `leafScore`, `maxPossibleLeaf`, `LEAF_PARAMS`, `mulberry32`; Python `simulate_draws.build_leaf`, `simulate_draws.run`
- Produces: 고정 데이터 2개 (가짜 태그 풀 100권 + Python 지표)

🎯는 문서의 분량 규칙과 시뮬레이션 규칙이 달라 비교하지 않는다 (🎯는 Task 3·4의 단위 테스트로 보장).

- [ ] **Step 1: 고정 데이터 생성 스크립트**

`src/export_leaf_fixture.py`:
```python
"""Export the synthetic 🍃 pool and its Python metrics so the TS draw can be checked against them.

Usage:  python src/export_leaf_fixture.py
Output: web/src/lib/recommend/__fixtures__/leaf_pool.json, leaf_metrics.json
"""
import json
import random
from pathlib import Path

import simulate_draws as sim

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "web" / "src" / "lib" / "recommend" / "__fixtures__"
PAGES_FOR_TAG = {1: 200, 0: 300, -1: 450}  # keeps lengthTag identical to the Python tag


def main() -> None:
    OUT.mkdir(parents=True, exist_ok=True)
    books = sim.build_leaf(random.Random(7))          # same pool run("leaf", ...) builds with seed 7
    pool = [{"id": str(b["id"]), "entry": "leaf", "genre": b["genre"], "pages": PAGES_FOR_TAG[b["len"]],
             "axes": {a: b[a] for a in sim.AXES}} for b in books]
    metrics = sim.run("leaf", 1.0, 2)
    (OUT / "leaf_pool.json").write_text(json.dumps(pool, ensure_ascii=False, indent=1), encoding="utf-8")
    (OUT / "leaf_metrics.json").write_text(json.dumps(
        {"fill_pct": metrics["fill_pct"], "overlap": metrics["overlap_same_answers"],
         "genres_per_draw": metrics["genres_per_draw"]}, indent=1), encoding="utf-8")
    print(f"pool {len(pool)} books, metrics {metrics['fill_pct']}% fill, overlap {metrics['overlap_same_answers']}")


if __name__ == "__main__":
    main()
```

Run (Galpi 폴더에서): `PYTHONIOENCODING=utf-8 python src/export_leaf_fixture.py`
Expected: `pool 100 books, metrics 97.4% fill, overlap 0.26`

- [ ] **Step 2: 실패하는 분포 테스트**

`web/src/lib/recommend/parity.test.ts`:
```ts
import { describe, expect, it } from "vitest";
import metrics from "./__fixtures__/leaf_metrics.json";
import poolJson from "./__fixtures__/leaf_pool.json";
import { drawBookmarks } from "./draw";
import { LEAF_PARAMS } from "./params";
import { mulberry32 } from "./rng";
import { leafScore, maxPossibleLeaf } from "./score";
import type { Book, LeafAnswers, LeafBook, Tag } from "./types";

const pool = poolJson as LeafBook[];

function* allAnswers(): Generator<LeafAnswers> {
  const vals = [-2, -1, 0, 1, 2];
  for (const temp of vals) for (const pull of vals) for (const gain of vals) for (const world of vals)
    for (const len of [-1, 0, 1] as Tag[]) yield { temp, pull, gain, world, len };
}

function draw(a: LeafAnswers, seed: number) {
  return drawBookmarks(pool, { score: (b: Book) => leafScore(b as LeafBook, a), maxPossible: maxPossibleLeaf(a) },
    { seen: new Set(), ...LEAF_PARAMS, rng: mulberry32(seed), inRandomPool: () => true });
}

describe("leaf draw matches src/simulate_draws.py (τ=1.0, Δ=2)", () => {
  it("fill %, same-answer overlap and genre spread stay within tolerance", () => {
    let n = 0, filled = 0, overlap = 0, genres = 0;
    for (const a of allAnswers()) {
      const first = draw(a, n * 2 + 1), second = draw(a, n * 2 + 2);
      const rec = (r: typeof first) => r.picks.filter((p) => p.kind === "recommended");
      if (rec(first).every((p) => p.score > 0)) filled += 1;
      const s1 = new Set(rec(first).map((p) => p.book.id)), s2 = new Set(rec(second).map((p) => p.book.id));
      const inter = [...s1].filter((id) => s2.has(id)).length;
      overlap += inter / new Set([...s1, ...s2]).size;
      genres += new Set(first.picks.map((p) => p.book.genre)).size;
      n += 1;
    }
    expect(n).toBe(1875);
    expect(Math.abs((100 * filled) / n - metrics.fill_pct)).toBeLessThanOrEqual(3);
    expect(Math.abs(overlap / n - metrics.overlap)).toBeLessThanOrEqual(0.05);
    expect(Math.abs(genres / n - metrics.genres_per_draw)).toBeLessThanOrEqual(0.2);
  });
});
```

- [ ] **Step 3: 실행**

Run: `npm test -- parity`
Expected: PASS. 실패하면 **테스트 허용 범위를 넓히지 말고** `draw.ts`와 `simulate_draws.py`의 차이(장르 상한 적용 순서, 넓히기 조건, 무작위 칸 조건)를 찾아 코드를 고친다.

- [ ] **Step 4: Commit**

```bash
git add src/export_leaf_fixture.py web/src/lib/recommend/__fixtures__ web/src/lib/recommend/parity.test.ts
git commit -m "test(recommend): check leaf draw distribution against the Python simulation"
```

---

### Task 7: 커버리지 100%와 전체 검증

**Files:**
- Modify: `web/vitest.config.ts`

- [ ] **Step 1: 추천 로직 커버리지 문턱 설정**

`web/vitest.config.ts`의 `coverage`를 다음으로 바꾼다.
```ts
coverage: {
  provider: "v8",
  include: ["src/lib/**"],
  exclude: ["src/**/*.test.*", "src/**/__fixtures__/**", "src/lib/recommend/index.ts", "src/lib/recommend/types.ts"],
  thresholds: { "src/lib/recommend/**": { lines: 100, branches: 100, functions: 100, statements: 100 } },
},
```

- [ ] **Step 2: 실행**

Run: `npm run test:cov`
Expected: PASS, `src/lib/recommend` 100% lines/branches/functions/statements. 모자란 줄이 있으면 그 줄을 지나가는 테스트를 **해당 파일의 테스트에** 추가한다(허용 범위를 낮추지 않는다).

- [ ] **Step 3: 전체 검증**

Run: `npm run typecheck && npm run lint && npm run test:cov && npm run build`
Expected: 모두 통과

- [ ] **Step 4: Commit**

```bash
git add web/vitest.config.ts web/src/lib/recommend
git commit -m "test(recommend): enforce 100% coverage for recommendation logic"
```

---

## P1 완료 기준 확인 (`docs/PHASES.md`)

- [ ] 로직 테스트 커버리지 100% (Task 7)
- [ ] 가짜 책으로 "추천 4 + 무작위 1, 중복 없음" — Task 4 테스트, "5번 다시 뽑기" — 아래 한 줄을 `draw.test.ts`에 두고 통과:
  ```ts
  it("survives five redraws without repeats", () => {
    const big: Book[] = Array.from({ length: 30 }, (_, i) => mk(`x${i}`, `G${i % 6}`, ((i % 3) - 1) as number));
    const seen = new Set<string>();
    for (let r = 0; r < 5; r++) {
      const res = drawBookmarks(big, { score: byTemp, maxPossible: 3 }, opts({ seen, rng: mulberry32(r + 1) }));
      res.picks.forEach((p) => { expect(seen.has(p.book.id)).toBe(false); seen.add(p.book.id); });
    }
    expect(seen.size).toBe(25);
  });
  ```
- [ ] 🍃 분포가 시뮬레이션과 같다 (Task 6)
- [ ] `docs/process.md` 기록, `feat/p1-recommend` → `main` 병합
