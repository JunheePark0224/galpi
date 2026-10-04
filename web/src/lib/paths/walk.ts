import { ALL_SCOPE, NEUTRAL_MOOD, type Answer, type Effects, type FarRule, type Mood, type QuestionMap, type Scope } from "./types";

export class PathError extends Error {}

export interface Walked {
  next: string | null;
  scope: Scope;
  parentScope: Scope;
  mood: Mood;
  mode: "normal" | "challenge";
  crumbs: string[];
  depth: number;
  unsure: number;
}

const withScope = (s: Scope, e: Effects): Scope => ({
  entry: e.entry ?? s.entry,
  topics: e.topics ?? s.topics,
  keywords: e.keywords ?? s.keywords,
  genres: e.genres ?? s.genres,
});
const withMood = (m: Mood, e: Effects): Mood => ({
  axes: { ...m.axes, ...e.axes },
  len: e.len ?? m.len,
  way: e.way ?? m.way,
});
const changesScope = (e: Effects) => Boolean(e.entry || e.topics || e.keywords || e.genres);

export function walkPath(map: QuestionMap, answers: Answer[]): Walked {
  let w: Walked = { next: map.start, scope: ALL_SCOPE, parentScope: ALL_SCOPE, mood: NEUTRAL_MOOD, mode: "normal", crumbs: [], depth: 0, unsure: 0 };
  for (const ans of answers) {
    if (w.next === null) throw new PathError(`answer for "${ans.node}" after the end of the path`);
    if (ans.node !== w.next) throw new PathError(`expected an answer for "${w.next}", got "${ans.node}"`);
    const node = map.nodes[ans.node];
    if (ans.choice === "unsure") {
      w = { ...w, next: node.unsureNext === "draw" ? null : node.unsureNext, depth: w.depth + 1, unsure: w.unsure + 1 };
      continue;
    }
    const c = ans.choice === "A" ? node.a : node.b;
    const narrows = changesScope(c.effects);
    w = {
      next: c.next === "draw" ? null : c.next,
      scope: withScope(w.scope, c.effects),
      parentScope: narrows ? w.scope : w.parentScope,
      mood: withMood(w.mood, c.effects),
      mode: c.effects.mode ?? w.mode,
      crumbs: narrows ? [...w.crumbs, c.label] : w.crumbs,
      depth: w.depth + 1,
      unsure: w.unsure,
    };
  }
  return w;
}

/** A rule matches when every list it names covers the scope's list (and the entry is the same, if named). */
function matches(rule: FarRule, s: Scope): boolean {
  const covers = (want: string[] | null | undefined, have: string[] | null) => !want || (have !== null && have.every((v) => want.includes(v)));
  return (!rule.from.entry || rule.from.entry === s.entry)
    && covers(rule.from.topics, s.topics) && covers(rule.from.keywords, s.keywords) && covers(rule.from.genres, s.genres);
}

/**
 * Design 4절: the "what" flips (far scope), the "how" (mood) stays. The 운명 1장 comes from the far side's whole entry.
 * The first far rule that matches wins. With no rule, the other entry whole; with no entry chosen (whole library)
 * there is nothing to flip, so the walked scope stays (Ruling 4).
 */
export function applyChallenge(map: QuestionMap, w: Walked): Walked {
  if (w.mode !== "challenge") return w;
  const rule = map.far.find((r) => matches(r, w.scope));
  if (!rule && w.scope.entry === null) return w;
  const other = w.scope.entry === "leaf" ? "target" : "leaf";
  const scope: Scope = rule ? { ...ALL_SCOPE, ...rule.to } : { ...ALL_SCOPE, entry: other };
  return { ...w, scope, parentScope: { ...ALL_SCOPE, entry: scope.entry } };
}
