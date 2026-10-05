import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import books from "@/data/books.json";
import skips from "@/data/mood-skips.json";
import built from "@/data/question-map.json";
import vocab from "@/data/vocab.json";
import { toBook } from "@/lib/books/toBook";
import type { CatalogBook } from "@/lib/books/types";
import { pathEnds } from "./coverage";
import { moodSkips } from "./skip";
import { applyChallenge, walkPath } from "./walk";
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

describe("far rules (challenge rules v2, 10-05)", () => {
  const far = (built as QuestionMap).far;
  it("are numbered and titled in the document; the moving reasons (drafts) are written for the 배우기 rules 20-36 only", () => {
    expect(far).toHaveLength(36);
    expect(far.every((r) => typeof r.title === "string" && r.title.length > 0)).toBe(true);
    expect(far.slice(0, 19).every((r) => r.why === undefined)).toBe(true);
    expect(far.slice(19).every((r) => r.from.entry === "target" && typeof r.why === "string")).toBe(true);
  });
  it("19 and 36 are the challenge lists the user approved, and catch every 이야기 / 배우기 scope (no fallback to the other branch)", () => {
    expect(far[18]).toMatchObject({ from: { entry: "leaf" }, to: { entry: "leaf", genres: ["시", "인문", "과학 교양", "예술·여행", "역사", "사회·시사", "호러·괴담"] }, pick: "one" });
    expect(far[35]).toMatchObject({ from: { entry: "target" }, to: { entry: "leaf", genres: ["과학 교양", "인문", "역사", "예술·여행", "사회·시사"] }, pick: "one" });
    expect(far[18].from).toEqual({ entry: "leaf" });
    expect(far[35].from).toEqual({ entry: "target" });
    for (const end of pathEnds(QUESTION_MAP).filter((e) => e.mode === "challenge")) {
      const w = walkPath(QUESTION_MAP, end.example);
      if (w.scope.entry !== null) expect(applyChallenge(QUESTION_MAP, w).challenge, end.scopeKey).toBeDefined();
    }
  });
});

describe("src/data/mood-skips.json", () => {
  it("is moodSkips over today's books.json and map (run npm run map:build or books:import after changing either)", () => {
    expect(skips).toEqual(moodSkips(built as QuestionMap, (books as unknown as CatalogBook[]).map(toBook)));
  });
});
