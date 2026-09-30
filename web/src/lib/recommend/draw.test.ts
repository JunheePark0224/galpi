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
  it("samples with weight e^((score - top)/tau) when tau > 0", () => {
    const cands = [{ book: mk("hi", "A", 1), score: 3 }, { book: mk("lo", "B", 0), score: 0 }];
    let hi = 0;
    for (let seed = 1; seed <= 2000; seed++) {
      if (weightedPick(cands, 1, 1, mulberry32(seed), 99)[0].book.id === "hi") hi++;
    }
    expect(Math.abs(hi / 2000 - Math.exp(3) / (Math.exp(3) + 1))).toBeLessThan(0.02);
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

  it("survives five redraws without repeats", () => {
    const big: Book[] = Array.from({ length: 30 }, (_, i) => mk(`x${i}`, `G${i % 6}`, ((i % 3) - 1) as number));
    const seen = new Set<string>();
    for (let r = 0; r < 5; r++) {
      const res = drawBookmarks(big, { score: byTemp, maxPossible: 3 }, opts({ seen, rng: mulberry32(r + 1) }));
      res.picks.forEach((p) => { expect(seen.has(p.book.id)).toBe(false); seen.add(p.book.id); });
    }
    expect(seen.size).toBe(25);
  });
});
