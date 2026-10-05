import { GOOD_SHARE, RECOMMENDED } from "./params";
import type { Book, DrawResult, DrawPick, Rng } from "./types";

type Scored = { book: Book; score: number };

export interface DrawOptions {
  seen: ReadonlySet<string>;
  tau: number;
  delta: number;
  maxSameGenre: number;
  /** Most recommended books of one entry (🍃 / 🎯) — 2 makes "섞어서" two of each. None = no limit. */
  maxPerEntry?: number;
  rng: Rng;
  inRandomPool: (b: Book) => boolean;
}
export interface DrawInput { score: (b: Book) => number | null; maxPossible: number }

/** Design 5-3: one book per author in a draw — two books share an author when they share a name. */
export function sharesAuthor(a: Book, b: Book): boolean {
  return Boolean(a.authors?.some((n) => b.authors?.includes(n)));
}

/**
 * Weighted sampling without replacement (weight e^((score - top)/tau)); tau = 0 means strict top-k. A book is passed over
 * when its genre (maxSame) or entry (maxPerEntry) is full, or it shares an author with a book already picked.
 */
export function weightedPick(cands: Scored[], k: number, tau: number, rng: Rng, maxSame: number, maxPerEntry = Infinity): Scored[] {
  const pool = [...cands];
  const picked: Scored[] = [];
  const perGenre = new Map<string, number>();
  const perEntry = new Map<string, number>();
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
    const e = perEntry.get(choice.book.entry) ?? 0;
    if (n >= maxSame || e >= maxPerEntry || picked.some((p) => sharesAuthor(p.book, choice.book))) continue;
    perGenre.set(choice.book.genre, n + 1);
    perEntry.set(choice.book.entry, e + 1);
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
    if (score !== null && Number.isFinite(score)) cands.push({ book, score });   // NaN/±Infinity would spin the widening loop forever
  }
  if (!cands.length) return { picks: [], widened: false, exhausted: true };

  const best = Math.max(...cands.map((c) => c.score));
  let d = opts.delta;
  let recommended: Scored[] = [];
  for (;;) {
    recommended = weightedPick(cands.filter((c) => c.score >= best - d), RECOMMENDED, opts.tau, opts.rng, opts.maxSameGenre, opts.maxPerEntry);
    if (recommended.length >= RECOMMENDED || best - d <= Math.min(...cands.map((c) => c.score))) break;
    d += 1;
  }

  const chosen = new Set(recommended.map((c) => c.book.id));
  const genres = recommended.map((c) => c.book.genre);
  const randomPool = books.filter((b) => !opts.seen.has(b.id) && !chosen.has(b.id) && opts.inRandomPool(b)
    && genres.filter((g) => g === b.genre).length < opts.maxSameGenre && !recommended.some((c) => sharesAuthor(c.book, b)));
  const random = randomPool.length ? randomPool[Math.floor(opts.rng() * randomPool.length)] : null;

  const mean = recommended.reduce((s, c) => s + c.score, 0) / Math.max(recommended.length, 1);
  const exhausted = recommended.length < RECOMMENDED || (input.maxPossible > 0 && mean < GOOD_SHARE * input.maxPossible);

  const picks: DrawPick[] = recommended.map((c) => ({ book: c.book, score: c.score, kind: "recommended" }));
  if (random) {
    const randomScore = input.score(random);
    picks.push({ book: random, score: randomScore !== null && Number.isFinite(randomScore) ? randomScore : 0, kind: "random" });
  }
  return { picks: shuffle(picks, opts.rng), widened: d > opts.delta, exhausted };
}
