import { applyChallenge, QUESTION_MAP, scopeKey, walkPath, type Answer, type Challenge, type QNode, type QuestionMap } from "@/lib/paths";
import type { Entry } from "@/lib/recommend";

/** The question to ask after these answers, or null once the path is finished. Throws PathError off the map. */
export function nextQuestion(answers: readonly Answer[], map: QuestionMap = QUESTION_MAP): QNode | null {
  const next = walkPath(map, [...answers]).next;
  return next === null ? null : map.nodes[next];
}

const isAnswer = (a: unknown): a is Answer =>
  typeof a === "object" && a !== null && typeof (a as Answer).node === "string"
  && ["A", "B", "unsure"].includes((a as Answer).choice);

/** A saved answer list that still walks this map (the map may have changed since it was saved). */
export function isPath(x: unknown, map: QuestionMap = QUESTION_MAP): x is Answer[] {
  if (!Array.isArray(x) || !x.every(isAnswer)) return false;
  try {
    walkPath(map, x);
    return true;
  } catch {
    return false;
  }
}

export const sameAnswers = (a: readonly Answer[], b: readonly Answer[]): boolean =>
  a.length === b.length && a.every((x, i) => x.node === b[i].node && x.choice === b[i].choice);

/** taxonomy v1.0 3-1: common `entry` = the branch chosen (leaf 이야기 / target 배우기), `mode` = the route — none before the first answer. */
export function pathCommon(answers: readonly Answer[], map: QuestionMap = QUESTION_MAP): { entry: Entry | null; mode: "normal" | "challenge" | null } {
  const w = walkPath(map, [...answers]);
  return { entry: w.scope.entry, mode: answers.length === 0 ? null : w.mode };
}

/** E-34 path_completed: the scope the books are drawn from (after the challenge flip — `npm run map:coverage`'s key). */
export function completedProps(answers: readonly Answer[], map: QuestionMap = QUESTION_MAP): { scope_id: string; depth: number; unsure_count: number } {
  const w = walkPath(map, [...answers]);
  return { scope_id: scopeKey(applyChallenge(map, w).scope), depth: w.depth, unsure_count: w.unsure };
}

/**
 * E-07 bookmark_shown (taxonomy v1.5): which challenge rule the draw used and the far genre(s) it moved to — from the draw
 * response, since the server's seed decides both for 섞어서 and the list rules. null, null off the challenge route.
 */
export function challengeProps(challenge: Challenge | null | undefined): { challenge_rule: number | null; challenge_genre: string | null } {
  if (!challenge) return { challenge_rule: null, challenge_genre: null };
  return { challenge_rule: challenge.rule.n, challenge_genre: challenge.to.length > 0 ? challenge.to.join(",") : null };
}
