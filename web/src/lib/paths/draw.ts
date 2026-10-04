import { drawBookmarks, leafScore, LEAF_PARAMS, maxPossibleLeaf, TARGET_PARAMS, type Book, type DrawResult, type Entry, type Rng } from "@/lib/recommend";
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

/** The best moodScore a book of the pool's entry can get (both entries → the larger), so a cross-entry draw is judged fairly. */
export function maxPossible(entry: Entry | null, mood: Mood): number {
  const leaf = maxPossibleLeaf({ ...mood.axes, len: mood.len });
  const target = (mood.way ? 2 : 0) + (mood.len === 1 ? 2 : mood.len === -1 ? 1 : 0);
  return entry === "leaf" ? leaf : entry === "target" ? target : Math.max(leaf, target);
}

export function drawForPath(books: Book[], map: QuestionMap, walked: Walked, opts: { seen: ReadonlySet<string>; rng: Rng }): PathDraw {
  if (walked.next !== null) throw new Error(`path not finished: next question is "${walked.next}"`);
  const w = applyChallenge(map, walked);
  const unseen = books.filter((b) => !opts.seen.has(b.id));
  const scopeCount = unseen.filter((b) => inScope(b, w.scope)).length;
  const widenedScope = scopeCount < RECOMMENDED;
  const pool = widenedScope ? w.parentScope : w.scope;
  // Narrowed to genres (or 🎯): no genre cap, so "SF only" still yields 4 SF books. Only a broad 🍃/mixed pool keeps the cap.
  const base = pool.entry === "target" ? TARGET_PARAMS : LEAF_PARAMS;
  const params = { ...base, maxSameGenre: pool.entry === "target" || pool.genres !== null ? TARGET_PARAMS.maxSameGenre : LEAF_PARAMS.maxSameGenre };
  const result = drawBookmarks(books, {
    score: (b) => (inScope(b, pool) ? moodScore(b, w.mood) : null),
    maxPossible: maxPossible(pool.entry, w.mood),
  }, {
    seen: opts.seen, rng: opts.rng, tau: params.tau, delta: params.delta, maxSameGenre: params.maxSameGenre,
    inRandomPool: (b) => inScope(b, w.parentScope),
  });
  return { ...result, scopeCount, widenedScope };
}
