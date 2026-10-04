import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import books from "@/data/books.json";
import skips from "@/data/mood-skips.json";
import built from "@/data/question-map.json";
import vocab from "@/data/vocab.json";
import { toBook } from "@/lib/books/toBook";
import type { CatalogBook } from "@/lib/books/types";
import { moodSkips } from "./skip";
import { QUESTION_MAP } from "./map";
import { parseQuestionMap } from "./parse";
import { validateMap } from "./validate";
import { mapVocabulary } from "./vocabulary";
import type { QuestionMap } from "./types";

const DOC = readFileSync(path.resolve(process.cwd(), "..", "docs/question-map.md"), "utf8");

describe("src/data/question-map.json", () => {
  it("is docs/question-map.md as built (run npm run map:build after editing the document)", () => {
    expect(built).toEqual(parseQuestionMap(DOC));
  });
  it("passes the checks against our topics, keywords and every genre we define (books or not)", () => {
    expect(validateMap(built as QuestionMap, mapVocabulary(vocab))).toEqual([]);
  });
  it("is what the app reads (QUESTION_MAP), with the mood questions to pass over", () => {
    expect({ ...QUESTION_MAP, skip: undefined }).toEqual({ ...built, skip: undefined });
    expect(QUESTION_MAP.start).toBe("start");
    expect(QUESTION_MAP.skip).toEqual(new Set(skips));
  });
});

describe("src/data/mood-skips.json", () => {
  it("is moodSkips over today's books.json and map (run npm run map:build or books:import after changing either)", () => {
    expect(skips).toEqual(moodSkips(built as QuestionMap, (books as unknown as CatalogBook[]).map(toBook)));
  });
});
