import built from "@/data/question-map.json";
import type { QuestionMap } from "./types";

/** docs/question-map.md as built by `npm run map:build` — the one map the app and the server walk. */
export const QUESTION_MAP = built as QuestionMap;
