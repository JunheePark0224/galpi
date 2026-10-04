import type { Answer } from "../types";

const path = (...steps: [string, Answer["choice"]][]): Answer[] => steps.map(([node, choice]) => ({ node, choice }));

/**
 * docs/question-map.md, design 3-3 예시 길 (SQL): 10 questions, ends in the SQL keyword. "써먹는 쪽" (실습·사례) is not split
 * further: the SQL books have no 사례 book, so learn-way-use is passed over (mood-skips.json, design 5-2).
 */
export const SQL_PATH = path(
  ["start", "A"], ["branch", "B"], ["learn-intro", "A"], ["learn-area", "A"], ["learn-work", "A"], ["learn-tools", "A"],
  ["learn-data-field", "A"], ["learn-data-tool", "A"], ["learn-way", "B"], ["learn-len", "A"],
);
/** 갈피를 못 잡겠어요 at the branch: both sides mixed, one mood question. */
export const MIXED_PATH = path(["start", "A"], ["branch", "unsure"], ["mix-len", "A"]);
/** 도전: SF chosen, drawn from the far side (에세이·시), the mood kept. */
export const CHALLENGE_PATH = path(
  ["start", "B"], ["branch", "A"], ["story-intro", "A"], ["story-shelf", "A"], ["story-fiction", "B"], ["story-genre", "A"],
  ["story-temp", "A"], ["story-pull", "unsure"], ["story-len", "A"],
);
