import type { AxisKey, Book, Entry, Rng, Way } from "@/lib/recommend";
import { challengeOf, LEARN_CHALLENGE_GENRES, pickGenre } from "./challenge";
import { ALL_SCOPE, NEUTRAL_MOOD, scopeKey, type Answer, type Challenge, type Effects, type FarRule, type Mood, type QuestionMap, type Scope } from "./types";

export class PathError extends Error {}

export interface Walked {
  next: string | null;
  scope: Scope;
  /** The scopes narrowed through, broadest first: the whole library, then one per narrowing answer — the last is `scope`. */
  levels: Scope[];
  mood: Mood;
  mode: "normal" | "challenge";
  crumbs: string[];
  depth: number;
  unsure: number;
  /** Mood questions passed over (map.skip), in order: never shown, so not in depth, unsure or the answers. */
  skipped: string[];
  /** Set by applyChallenge when a far rule moved the scope: where from, where to, which rule (10-05 v2). */
  challenge?: Challenge;
}

const withScope = (s: Scope, e: Effects): Scope => ({
  entry: e.entry ?? s.entry,
  topics: e.topics ?? s.topics,
  keywords: e.keywords ?? s.keywords,
  genres: e.genres ?? s.genres,
});
export const withMood = (m: Mood, e: Effects): Mood => ({
  axes: { ...m.axes, ...e.axes },
  len: e.len ?? m.len,
  ways: e.ways ?? m.ways,
});
const changesScope = (e: Effects) => Boolean(e.entry || e.topics || e.keywords || e.genres);

/** The key of a walk standing before a question: the question, the route and every level narrowed through (mood-skips.json). */
export const skipKey = (w: Pick<Walked, "next" | "mode" | "levels">): string => `${w.next}|${w.mode}|${w.levels.map(scopeKey).join(">")}`;

/** Design 5-2 (10-05): a mood question that cannot change the draw here is passed over as if answered "unsure". */
function passOver(map: QuestionMap, w: Walked): Walked {
  let out = w;
  while (out.next !== null && map.skip?.has(skipKey(out)) && map.nodes[out.next]?.kind === "mood") {
    const node = map.nodes[out.next];
    out = { ...out, next: node.unsureNext === "draw" ? null : node.unsureNext, skipped: [...out.skipped, node.id] };
  }
  return out;
}

/** Where every path starts: the first question, the whole library, no mood. */
export function startWalk(map: QuestionMap): Walked {
  return passOver(map, {
    next: map.start, scope: ALL_SCOPE, levels: [ALL_SCOPE], mood: NEUTRAL_MOOD, mode: "normal", crumbs: [], depth: 0, unsure: 0, skipped: [],
  });
}

/** One answer further along the path (then past any mood question that cannot change the draw). */
export function takeAnswer(map: QuestionMap, w: Walked, ans: Answer): Walked {
  if (w.next === null) throw new PathError(`answer for "${ans.node}" after the end of the path`);
  if (ans.node !== w.next) throw new PathError(`expected an answer for "${w.next}", got "${ans.node}"`);
  const node = map.nodes[ans.node];
  if (ans.choice === "unsure") {
    return passOver(map, { ...w, next: node.unsureNext === "draw" ? null : node.unsureNext, depth: w.depth + 1, unsure: w.unsure + 1 });
  }
  const c = ans.choice === "A" ? node.a : node.b;
  const narrows = changesScope(c.effects);
  const scope = withScope(w.scope, c.effects);
  return passOver(map, {
    next: c.next === "draw" ? null : c.next,
    scope,
    levels: narrows ? [...w.levels, scope] : w.levels,
    mood: withMood(w.mood, c.effects),
    mode: c.effects.mode ?? w.mode,
    crumbs: narrows ? [...w.crumbs, c.label] : w.crumbs,
    depth: w.depth + 1,
    unsure: w.unsure,
    skipped: w.skipped,
  });
}

export function walkPath(map: QuestionMap, answers: Answer[]): Walked {
  return answers.reduce((w, ans) => takeAnswer(map, w, ans), startWalk(map));
}

/** A rule matches when every list it names covers the scope's list (and the entry is the same, if named). */
function matches(rule: FarRule, s: Scope): boolean {
  const covers = (want: string[] | null | undefined, have: string[] | null) => !want || (have !== null && have.every((v) => want.includes(v)));
  return (!rule.from.entry || rule.from.entry === s.entry)
    && covers(rule.from.topics, s.topics) && covers(rule.from.keywords, s.keywords) && covers(rule.from.genres, s.genres);
}

/**
 * Design 4절 (10-05): in a challenge the "how" of a 🎯 answer still counts on the 🍃 far side — a story book has no way tag,
 * so each way chosen leans one story axis, by the tag rules of balance-game.md 2절: 개념 (원리부터, to understand) →
 * 알게 됨 (gain +1); 실습 (바로 해 볼 방법, for one's own days) → 현실 (world +1); 사례 (남의 이야기로) → 몰입 (pull −1,
 * "비소설은 사례·이야기로 술술이면 몰입").
 */
export const WAY_AXIS: Record<Way, [AxisKey, 1 | -1]> = { 개념: ["gain", 1], 실습: ["world", 1], 사례: ["pull", -1] };

function waysOnStoryAxes(m: Mood): Mood {
  const axes = { ...m.axes };
  for (const way of m.ways) {
    const [axis, sign] = WAY_AXIS[way];
    axes[axis] += sign;
  }
  return { ...m, axes, ways: [] };
}

/** What a challenge draw may use: its rng (the seed) and the catalogue (a list rule counts books per genre). */
export interface ChallengeDraw { rng: Rng; books: readonly Book[] }

/**
 * Design 4절, challenge rules v2 (10-05): the "what" moves within the purpose chosen, the "how" (mood) stays. The first far
 * rule that matches wins; a challenge never leaves the person's branch, and there is no fallback to the other one:
 * - 이야기: to other story genres (rules 1-19); 배우기: to LEARN_CHALLENGE_GENRES only (rules 20-36) — those genres are also
 *   the widest level, so widening and the 운명 1장 stay inside them;
 * - a `pick: one` rule (19, 36 — no genre / no topic chosen) takes one genre of its list (pickGenre: 5+ books, equal chance,
 *   by the seed), else the whole list;
 * - 섞어서 (no branch): one branch at random by the seed, then that branch's rule.
 * Without `draw` (the skip table, coverage, E-34 scope_id) 섞어서 stays as walked and a list rule keeps its whole list.
 * No rule matches → the walk as it was (the data test keeps a rule for every branch of the real map: 19 and 36).
 */
export function applyChallenge(map: QuestionMap, w: Walked, draw?: ChallengeDraw): Walked {
  if (w.mode !== "challenge") return w;
  if (w.scope.entry === null && !draw) return w;
  const entry: Entry = w.scope.entry ?? (draw!.rng() < 0.5 ? "leaf" : "target");
  const own: Scope = { ...w.scope, entry };
  const n = map.far.findIndex((r) => matches(r, own));
  if (n < 0) return w;
  const rule = map.far[n];
  const listed: Scope = { ...ALL_SCOPE, ...rule.to };
  const scope: Scope = rule.pick === "one" && draw ? { ...listed, genres: pickGenre(rule.to, draw.books, draw.rng) } : listed;
  const learn = entry === "target";
  const side: Scope = learn ? { ...ALL_SCOPE, entry: "leaf", genres: [...LEARN_CHALLENGE_GENRES] } : { ...ALL_SCOPE, entry: scope.entry };
  const levels = [ALL_SCOPE, side, scope].filter((s, i, all) => i === 0 || scopeKey(s) !== scopeKey(all[i - 1]));
  const crosses = learn && scope.entry === "leaf";
  const branch = w.scope.entry ?? "mixed";
  return { ...w, scope, levels, mood: crosses ? waysOnStoryAxes(w.mood) : w.mood, challenge: challengeOf(w.scope, branch, rule.n ?? n + 1, rule, scope) };
}
