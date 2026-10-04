import { drawBookmarks, leafScore, LEAF_PARAMS, maxPossibleLeaf, TARGET_PARAMS, type Book, type DrawPick, type DrawResult, type Entry, type Rng } from "@/lib/recommend";
import { GOOD_SHARE, RECOMMENDED } from "@/lib/recommend/params";
import { lengthPoints } from "@/lib/recommend/score";
import { ALL_SCOPE, inScope, type Mood, type QuestionMap, type Scope } from "./types";
import { applyChallenge, type Walked } from "./walk";

export interface PathDraw extends DrawResult { scopeCount: number; widenedScope: boolean }

/**
 * When the scope is widened, each level closer to the person's answers leads the next wider one by this much.
 * It is larger than any mood score (|score| ≤ 5), so every book of the narrowed scope is drawn first, then the level
 * above, then the rest; the mood orders books within a level. The lead is taken off again before the picks go out.
 */
const LEVEL_LEAD = 100;

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

/** Same rule as drawBookmarks: fewer than 4 recommended, or their mean mood score under half of the best possible. */
function exhaustedBy(picks: DrawPick[], max: number): boolean {
  const rec = picks.filter((p) => p.kind === "recommended");
  const mean = rec.reduce((s, p) => s + p.score, 0) / Math.max(rec.length, 1);
  return rec.length < RECOMMENDED || (max > 0 && mean < GOOD_SHARE * max);
}

export function drawForPath(books: Book[], map: QuestionMap, walked: Walked, opts: { seen: ReadonlySet<string>; rng: Rng }): PathDraw {
  if (walked.next !== null) throw new Error(`path not finished: next question is "${walked.next}"`);
  const w = applyChallenge(map, walked);
  const unseen = books.filter((b) => !opts.seen.has(b.id));
  const count = (s: Scope) => unseen.filter((b) => inScope(b, s)).length;
  const scopeCount = count(w.scope);
  const widenedScope = scopeCount < RECOMMENDED;
  // Design 5절-5: too few → the level above; still too few → the whole entry (the whole library if none was chosen).
  const wholeEntry: Scope = { ...ALL_SCOPE, entry: w.parentScope.entry };
  const pool = !widenedScope ? w.scope : count(w.parentScope) >= RECOMMENDED ? w.parentScope : wholeEntry;
  const lead = (b: Book) => (widenedScope ? (inScope(b, w.scope) ? 2 : inScope(b, w.parentScope) ? 1 : 0) * LEVEL_LEAD : 0);
  // Narrowed to genres (or 🎯): no genre cap, so "SF only" still yields 4 SF books. Only a broad 🍃/mixed scope keeps the cap.
  // Decided by the person's scope, so widening never caps the books they narrowed to.
  const base = pool.entry === "target" ? TARGET_PARAMS : LEAF_PARAMS;
  const narrowed = w.scope.entry === "target" || w.scope.genres !== null;
  const max = maxPossible(pool.entry, w.mood);
  const result = drawBookmarks(books, {
    score: (b) => (inScope(b, pool) ? moodScore(b, w.mood) + lead(b) : null),
    maxPossible: max,
  }, {
    seen: opts.seen, rng: opts.rng, tau: base.tau, delta: base.delta,
    maxSameGenre: narrowed ? TARGET_PARAMS.maxSameGenre : LEAF_PARAMS.maxSameGenre,
    // 운명 1장: one level up from the scope; once widened to the whole entry, from there (the level above is all recommended)
    inRandomPool: (b) => inScope(b, pool === wholeEntry ? wholeEntry : w.parentScope),
  });
  if (!widenedScope) return { ...result, scopeCount, widenedScope };
  const picks = result.picks.map((p) => ({ ...p, score: p.score - lead(p.book) }));
  return { picks, widened: result.widened, exhausted: exhaustedBy(picks, max), scopeCount, widenedScope };
}
