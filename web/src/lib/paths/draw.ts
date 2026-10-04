import { drawBookmarks, leafScore, LEAF_PARAMS, maxPossibleLeaf, sharesAuthor, TARGET_PARAMS, type Book, type DrawPick, type DrawResult, type Entry, type Rng } from "@/lib/recommend";
import { GOOD_SHARE, RECOMMENDED } from "@/lib/recommend/params";
import { lengthPoints } from "@/lib/recommend/score";
import { inScope, scopeKey, type Mood, type QuestionMap, type Scope } from "./types";
import { applyChallenge, type Walked } from "./walk";

/** drawnFrom: the walk the books were drawn for — after the challenge flip (its far scope, its mood): reasons come from it. */
export interface PathDraw extends DrawResult { scopeCount: number; widenedScope: boolean; drawnFrom: Walked }

/**
 * When the scope is widened, each level closer to the person's answers leads the next wider one by this much.
 * It is larger than any mood score (|score| ≤ 5), so every book of the narrowed scope is drawn first, then the level
 * above, then the rest; the mood orders books within a level. The lead is taken off again before the picks go out.
 */
const LEVEL_LEAD = 100;
/** Design 5-4 (10-05): "섞어서" (no branch chosen) recommends two 🍃 and two 🎯 books. */
const MIXED_PER_ENTRY = 2;
const ENTRIES: readonly Entry[] = ["leaf", "target"];

/** Design 5절-2: 🍃 by the axes + length (the balance-game rule), 🎯 by way (+2, any of the ways chosen) + length points. */
export function moodScore(book: Book, mood: Mood): number {
  if (book.entry === "leaf") return leafScore(book, { ...mood.axes, len: mood.len });
  return (mood.ways.includes(book.way) ? 2 : 0) + lengthPoints(book.pages, mood.len);
}

/** The best moodScore a book of the pool's entry can get (both entries → the larger), so a cross-entry draw is judged fairly. */
export function maxPossible(entry: Entry | null, mood: Mood): number {
  const leaf = maxPossibleLeaf({ ...mood.axes, len: mood.len });
  const target = (mood.ways.length ? 2 : 0) + (mood.len === 1 ? 2 : mood.len === -1 ? 1 : 0);
  return entry === "leaf" ? leaf : entry === "target" ? target : Math.max(leaf, target);
}

/** How many of these books one draw can show: one per author (design 5-3), counted greedily in order. */
export function distinctAuthors(books: readonly Book[]): number {
  const kept: Book[] = [];
  for (const b of books) if (!kept.some((k) => sharesAuthor(k, b))) kept.push(b);
  return kept.length;
}

/**
 * Design 5-5 (10-05): the levels a draw may widen to, narrowest first — the person's scope, then each level they narrowed
 * through, one at a time, up to their branch (이야기 / 배우기) and never past it. No branch chosen: the whole library.
 */
export function levelsUp(w: Pick<Walked, "levels" | "scope">): Scope[] {
  const own = w.scope.entry === null ? w.levels : w.levels.filter((s) => s.entry !== null);
  return [...own].reverse().filter((s, i, all) => i === 0 || scopeKey(s) !== scopeKey(all[i - 1]));
}

/** The level the four come from: the first, going up, whose books can fill a draw with four authors (else the branch). */
export function poolLevel(books: readonly Book[], up: readonly Scope[]): number {
  const at = up.findIndex((s) => distinctAuthors(books.filter((b) => inScope(b, s))) >= RECOMMENDED);
  return at < 0 ? up.length - 1 : at;
}

/** Same rule as drawBookmarks: fewer than 4 recommended, or their mean mood score under half of the best possible. */
function exhaustedBy(picks: DrawPick[], max: number): boolean {
  const rec = picks.filter((p) => p.kind === "recommended");
  const mean = rec.reduce((s, p) => s + p.score, 0) / Math.max(rec.length, 1);
  return rec.length < RECOMMENDED || (max > 0 && mean < GOOD_SHARE * max);
}

export function drawForPath(books: Book[], map: QuestionMap, walked: Walked, opts: { seen: ReadonlySet<string>; rng: Rng }): PathDraw {
  if (walked.next !== null) throw new Error(`path not finished: next question is "${walked.next}"`);
  const w = applyChallenge(map, walked, opts.rng);
  const unseen = books.filter((b) => !opts.seen.has(b.id));
  const up = levelsUp(w);
  const at = poolLevel(unseen, up);
  const pool = up[at];
  const scopeCount = unseen.filter((b) => inScope(b, w.scope)).length;
  const widenedScope = at > 0;
  const lead = (b: Book) => up.slice(0, at).filter((s) => inScope(b, s)).length * LEVEL_LEAD;
  // Narrowed to genres (or 🎯): no genre cap, so "SF only" still yields 4 SF books. Only a broad 🍃/mixed scope keeps the cap.
  // Decided by the person's scope, so widening never caps the books they narrowed to.
  const base = pool.entry === "target" ? TARGET_PARAMS : LEAF_PARAMS;
  const narrowed = w.scope.entry === "target" || w.scope.genres !== null;
  const max = maxPossible(pool.entry, w.mood);
  const fateLevel = up[Math.min(Math.max(at, 1), up.length - 1)];
  // 섞어서 (round 2): the 운명 1장's branch is 이야기 or 배우기 half and half (by the seed), not in proportion to book counts
  const fateEntry = fateLevel.entry === null && ENTRIES.every((e) => unseen.some((b) => b.entry === e)) ? ENTRIES[opts.rng() < 0.5 ? 0 : 1] : null;
  const result = drawBookmarks(books, {
    score: (b) => (inScope(b, pool) ? moodScore(b, w.mood) + lead(b) : null),
    maxPossible: max,
  }, {
    seen: opts.seen, rng: opts.rng, tau: base.tau, delta: base.delta,
    maxSameGenre: narrowed ? TARGET_PARAMS.maxSameGenre : LEAF_PARAMS.maxSameGenre,
    maxPerEntry: pool.entry === null ? MIXED_PER_ENTRY : undefined,
    // 운명 1장 (5-4): one level up from the person's scope — or the level the four came from, when that is wider — and
    // never past the branch (at the branch: the branch itself; 섞어서: the whole library)
    inRandomPool: (b) => inScope(b, fateLevel) && (fateEntry === null || b.entry === fateEntry),
  });
  if (!widenedScope) return { ...result, scopeCount, widenedScope, drawnFrom: w };
  const picks = result.picks.map((p) => ({ ...p, score: p.score - lead(p.book) }));
  return { picks, widened: result.widened, exhausted: exhaustedBy(picks, max), scopeCount, widenedScope, drawnFrom: w };
}
