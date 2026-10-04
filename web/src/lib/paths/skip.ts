import type { Book } from "@/lib/recommend";
import { RECOMMENDED } from "@/lib/recommend/params";
import { distinctAuthors, levelsUp, moodScore, poolLevel } from "./draw";
import { inScope, NEUTRAL_MOOD, type AnswerChoice, type Choice, type Effects, type QuestionMap } from "./types";
import { applyChallenge, skipKey, startWalk, takeAnswer, withMood, type Walked } from "./walk";

/**
 * Design 5-2 (10-05): a mood question is asked only when each of its answers has at least this many books it actually
 * scores (mood score > 0) among the books the answer can still move — otherwise it is passed over as "unsure".
 * One book is enough: then that answer brings a book the other answer would not (path-audit.md 2-2: the idle questions
 * were the ones with 0 books on one side, e.g. 시 + 두꺼운 책, 추리 + 문장, SQL + 얇은 책).
 */
export const MIN_SCORED = 1;

const setsMood = (e: Effects) => e.axes !== undefined || e.len !== undefined || e.ways !== undefined;

/**
 * The books a draw for this walk can still choose between, and how many recommended places are left for them. The levels
 * narrower than the pool are drawn whole first (LEVEL_LEAD), so only the pool's other books are open to the mood — and
 * only when they are more than the places left.
 */
function contested(books: readonly Book[], w: Walked): { open: Book[]; places: number } {
  const up = levelsUp(w);
  const at = poolLevel(books, up);
  const inPool = books.filter((b) => inScope(b, up[at]));
  if (at === 0) return { open: inPool, places: RECOMMENDED };
  const narrower = books.filter((b) => inScope(b, up[at - 1]));
  return { open: inPool.filter((b) => !inScope(b, up[at - 1])), places: RECOMMENDED - distinctAuthors(narrower) };
}

/** The books this choice scores, judged as the draw judges them (a challenge on its far side); a choice that only leads to another mood question scores what that question can, if it is asked. */
function scoredBy(map: QuestionMap, c: Choice, w: Walked, books: readonly Book[]): Book[] {
  if (setsMood(c.effects)) {
    const judged = applyChallenge(map, { ...w, mood: withMood(NEUTRAL_MOOD, c.effects) });
    return books.filter((b) => moodScore(b, judged.mood) > 0);
  }
  const next = map.nodes[c.next];
  if (next?.kind !== "mood") return [];
  const at = { ...w, next: next.id };
  if (!askable(map, books, at)) return [];
  return [...new Set([...scoredBy(map, next.a, at, books), ...scoredBy(map, next.b, at, books)])];
}

/**
 * Can the mood question this walk stands before change the draw? Judged on all books (not one visit's seen), on the scope
 * the draw will use (a challenge's far side; 섞어서 + 도전 on the whole library, since its side is drawn at random).
 */
export function askable(map: QuestionMap, books: readonly Book[], w: Walked): boolean {
  const node = w.next === null ? undefined : map.nodes[w.next];
  if (node?.kind !== "mood") return true;
  const { open, places } = contested(books, applyChallenge(map, w));
  if (open.length <= places) return false;
  return [node.a, node.b].every((c) => scoredBy(map, c, w, open).length >= MIN_SCORED);
}

/**
 * Every place a mood question cannot change the draw (skipKey), over every route of the map — the table the walk reads
 * (map.skip). `npm run map:build` and `npm run books:import` write it to src/data/mood-skips.json; a data test keeps it
 * equal to this.
 */
export function moodSkips(map: QuestionMap, books: readonly Book[]): string[] {
  const raw: QuestionMap = { ...map, skip: undefined };
  const out = new Set<string>();
  const seen = new Set<string>();
  const visit = (w: Walked) => {
    if (w.next === null) return;
    const key = skipKey(w);
    if (seen.has(key)) return;
    seen.add(key);
    const node = raw.nodes[w.next];
    if (node.kind === "mood" && !askable(raw, books, w)) out.add(key);
    for (const choice of ["A", "B", "unsure"] as AnswerChoice[]) visit(takeAnswer(raw, w, { node: node.id, choice }));
  };
  visit(startWalk(raw));
  return [...out].sort();
}
