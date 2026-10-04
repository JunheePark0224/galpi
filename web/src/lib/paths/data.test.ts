import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import built from "@/data/question-map.json";
import vocab from "@/data/vocab.json";
import books from "@/data/books.json";
import { parseQuestionMap } from "./parse";
import { validateMap } from "./validate";
import type { QuestionMap } from "./types";

const DOC = readFileSync(path.resolve(process.cwd(), "..", "docs/question-map.md"), "utf8");

describe("src/data/question-map.json", () => {
  it("is docs/question-map.md as built (run npm run map:build after editing the document)", () => {
    expect(built).toEqual(parseQuestionMap(DOC));
  });
  it("passes the checks against our topics, keywords and genres", () => {
    const topics = Object.fromEntries(Object.entries(vocab as Record<string, { keywords: Record<string, string> }>)
      .map(([t, v]) => [t, Object.keys(v.keywords)]));
    const genres = [...new Set((books as { genre: string }[]).map((b) => b.genre))];
    expect(validateMap(built as QuestionMap, { topics, genres })).toEqual([]);
  });
});
