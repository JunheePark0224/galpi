import type { Answer, Effects, QuestionMap } from "./types";
import { walkPath } from "./walk";

/** S-04 "당신이 고른 길" (design 10절): the narrowing labels in order, the mood labels in order, the route. */
export interface PathSummary { crumbs: string[]; moods: string[]; mode: "normal" | "challenge" }

const setsMood = (e: Effects) => e.axes !== undefined || e.len !== undefined || e.way !== undefined;

/** Narrowing crumbs come from walkPath; a mood answer counts only when it sets a mood (a choice that only leads on does not). */
export function pathSummary(map: QuestionMap, answers: Answer[]): PathSummary {
  const w = walkPath(map, answers);
  const moods = answers.flatMap(({ node, choice }) => {
    const n = map.nodes[node];
    if (n.kind !== "mood" || choice === "unsure") return [];
    const c = choice === "A" ? n.a : n.b;
    return setsMood(c.effects) ? [c.label] : [];
  });
  return { crumbs: w.crumbs, moods, mode: w.mode };
}
