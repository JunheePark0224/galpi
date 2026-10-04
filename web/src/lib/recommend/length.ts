import type { Tag } from "./types";

/**
 * One page-count rule for every book, 🍃 and 🎯 alike (10-05, docs/balance-game.md 3절): thin ≤ 280 pages, thick ≥ 380.
 * About the thinnest and thickest third of the 376 books of 10-05 (the 33% and 67% points are 280 and 376 pages), and at
 * least 25% of each branch on each side. From the YES24 page count, no human judgement.
 */
export const THIN_MAX = 280;
export const THICK_MIN = 380;

/** Thin = 1, thick = -1, otherwise 0. */
export function lengthTag(pages: number): Tag {
  if (pages <= THIN_MAX) return 1;
  if (pages >= THICK_MIN) return -1;
  return 0;
}
