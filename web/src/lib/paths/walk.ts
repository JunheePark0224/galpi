import type { AxisKey, Entry, Rng, Way } from "@/lib/recommend";
import { LEAF_GENRES } from "../books/taxonomy";
import { ALL_SCOPE, NEUTRAL_MOOD, scopeKey, type Answer, type Effects, type FarRule, type Mood, type QuestionMap, type Scope } from "./types";

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

/**
 * Design 4절: the "what" flips (far scope), the "how" (mood) stays. The first far rule that matches wins. The levels become
 * the far side's entry, then the far scope — the 운명 1장 and any widening stay on the far side. With no rule:
 * - 배우기: the 이야기 entry whole;
 * - 이야기 (10-05 round 2): never 배우기 — one 이야기 genre at random from all of LEAF_GENRES (0-book genres too, they widen),
 *   other than the ones already chosen;
 * - no entry (섞어서): one entry at random.
 * The random picks use the draw's rng (reproducible by the seed); without it (the skip table, E-34 scope_id) the walked
 * scope stays.
 */
export function applyChallenge(map: QuestionMap, w: Walked, rng?: Rng): Walked {
  if (w.mode !== "challenge") return w;
  const rule = map.far.find((r) => matches(r, w.scope));
  if (!rule && w.scope.entry === null) {
    if (!rng) return w;
    const entry: Entry = rng() < 0.5 ? "leaf" : "target";
    const scope = { ...ALL_SCOPE, entry };
    return { ...w, scope, levels: [ALL_SCOPE, scope] };
  }
  if (!rule && w.scope.entry === "leaf") {
    if (!rng) return w;
    const others = LEAF_GENRES.filter((g) => !w.scope.genres?.includes(g));
    const genres = others.length ? others : [...LEAF_GENRES];
    const scope: Scope = { ...ALL_SCOPE, entry: "leaf", genres: [genres[Math.floor(rng() * genres.length)]] };
    return { ...w, scope, levels: [ALL_SCOPE, { ...ALL_SCOPE, entry: "leaf" }, scope] };
  }
  const scope: Scope = rule ? { ...ALL_SCOPE, ...rule.to } : { ...ALL_SCOPE, entry: "leaf" };
  const side: Scope = { ...ALL_SCOPE, entry: scope.entry };
  const levels = scopeKey(scope) === scopeKey(side) ? [ALL_SCOPE, side] : [ALL_SCOPE, side, scope];
  const crosses = w.scope.entry === "target" && scope.entry === "leaf";
  return { ...w, scope, levels, mood: crosses ? waysOnStoryAxes(w.mood) : w.mood };
}
