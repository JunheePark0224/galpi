import type { AxisKey, BalanceChoice, LeafAnswers, Tag } from "./types";

export const QUESTION_AXIS: readonly (AxisKey | "len")[] =
  ["temp", "pull", "gain", "world", "temp", "pull", "gain", "world", "len"];

const VALUE: Record<BalanceChoice, number> = { A: 1, B: -1, unsure: 0 };

export function leafAnswersFrom(choices: BalanceChoice[]): LeafAnswers {
  if (choices.length !== QUESTION_AXIS.length) throw new Error("leafAnswersFrom needs 9 answers");
  const out: LeafAnswers = { temp: 0, pull: 0, gain: 0, world: 0, len: 0 };
  choices.forEach((c, i) => {
    const axis = QUESTION_AXIS[i];
    if (axis === "len") out.len = VALUE[c] as Tag;
    else out[axis] += VALUE[c];
  });
  return out;
}
