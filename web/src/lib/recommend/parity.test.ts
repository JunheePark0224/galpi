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
