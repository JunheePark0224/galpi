import type { Answer, Effects, QuestionMap } from "./types";
import { walkPath } from "./walk";

/** S-04 "당신이 고른 길" (design 10절): the narrowing labels in order, the mood labels in order, the route. */
export interface PathSummary { crumbs: string[]; moods: string[]; mode: "normal" | "challenge" }

/** What a mood answer sets, one slot per axis: "axes.temp", "len", "ways". */
const slots = (e: Effects) => [
  ...Object.keys(e.axes ?? {}).map((axis) => `axes.${axis}`), ...(e.len !== undefined ? ["len"] : []), ...(e.ways ? ["ways"] : []),
];

/**
 * Narrowing crumbs come from walkPath; a mood answer counts only when it sets a mood. Only shown questions are in the
 * answers, so a question the walk passed over (map.skip) never appears. A broad answer made finer by the very next answer
 * (실제로 써먹는 쪽 → 바로 따라 해 보기) shows the finer one only; left broad (못 잡겠어요, or the next question passed over), it shows.
 */
export function pathSummary(map: QuestionMap, answers: Answer[]): PathSummary {
  const w = walkPath(map, answers);
  const chosen = (a: Answer | undefined) => {
    const n = a && map.nodes[a.node];
    return n && a.choice !== "unsure" ? (a.choice === "A" ? n.a : n.b) : undefined;
  };
  const moods = answers.flatMap((ans, i) => {
    const c = chosen(ans);
    if (map.nodes[ans.node].kind !== "mood" || !c) return [];
    const own = slots(c.effects);
    const finer = answers[i + 1]?.node === c.next ? chosen(answers[i + 1]) : undefined;
    const refined = finer !== undefined && own.every((slot) => slots(finer.effects).includes(slot));
    return own.length && !refined ? [c.label] : [];
  });
  return { crumbs: w.crumbs, moods, mode: w.mode };
}
