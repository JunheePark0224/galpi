import type { Answer } from "../types";

const path = (...steps: [string, Answer["choice"]][]): Answer[] => steps.map(([node, choice]) => ({ node, choice }));

/**
 * A data path (docs/question-map.md, design 3-3 예시 길 — the SQL example until 10-08): 10 questions, ends in the 엑셀 keyword
 * with the length question. The way question is passed over (mood-skips.json, design 5-2): every 엑셀 book is 실습, so
 * the way answer would change no book. 10-08: the SQL example stopped asking length too (5 SQL books = a whole draw), so the
 * path moved to 엑셀 (12 books) — a keyword with more books than a draw keeps its length question as the library grows.
 */
export const DATA_PATH = path(
  ["start", "A"], ["branch", "B"], ["learn-intro", "A"], ["learn-area", "A"], ["learn-work", "A"], ["learn-tools", "A"],
  ["learn-data-field", "A"], ["learn-data-tool", "B"], ["learn-data-sheet", "A"], ["learn-len", "A"],
);
/** 갈피를 못 잡겠어요 at the branch: both sides mixed, one mood question. */
export const MIXED_PATH = path(["start", "A"], ["branch", "unsure"], ["mix-len", "A"]);
/** 도전: SF chosen, drawn from the far side (에세이·시), the mood kept. */
export const CHALLENGE_PATH = path(
  ["start", "B"], ["branch", "A"], ["story-intro", "A"], ["story-shelf", "A"], ["story-fiction", "B"], ["story-genre", "A"],
  ["story-temp", "A"], ["story-pull", "unsure"], ["story-len", "A"],
);
/**
 * The longest S-04 summary a person meets (10-09 final check): a challenge with no genre chosen (rule 19 — its line wraps
 * on a phone), one path row and all five mood answers.
 */
export const LONG_MOOD_PATH = path(
  ["start", "B"], ["branch", "A"], ["story-intro", "B"], ["story-gain", "A"], ["story-world", "A"], ["story-temp", "A"],
  ["story-pull", "A"], ["story-len", "A"],
);
