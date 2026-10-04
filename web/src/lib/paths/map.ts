import built from "@/data/question-map.json";
import skips from "@/data/mood-skips.json";
import type { QuestionMap } from "./types";

/**
 * docs/question-map.md as built by `npm run map:build` — the one map the app and the server walk — with the mood questions
 * to pass over (mood-skips.json, design 5-2): the browser and the server read the same set, so they walk the same path.
 */
export const QUESTION_MAP: QuestionMap = { ...(built as QuestionMap), skip: new Set(skips as string[]) };
