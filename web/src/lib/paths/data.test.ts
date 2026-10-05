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
  const rule = (n: number) => far.find((r) => r.n === n)!;
  it("are numbered and titled in the document; the moving reasons (drafts) are written for the 배우기 rules and 로맨스 (37) only", () => {
    expect(far).toHaveLength(43);
    expect(far.map((r) => r.n!).sort((a, b) => a - b)).toEqual(Array.from({ length: 43 }, (_, i) => i + 1));
    expect(far.every((r) => typeof r.title === "string" && r.title.length > 0)).toBe(true);
    const story = far.filter((r) => r.from.entry === "leaf");
    expect(story.filter((r) => r.why !== undefined).map((r) => r.n)).toEqual([37]);
    expect(far.filter((r) => r.from.entry === "target").every((r) => typeof r.why === "string")).toBe(true);
    expect(story.map((r) => r.n)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 37, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19]);
  });
  it("10-05: rules 37-43 (로맨스 and the four new topics) sit above the group rules they are narrower than", () => {
    const at = (n: number) => far.findIndex((r) => r.n === n);
    expect(rule(37)).toMatchObject({ from: { entry: "leaf", genres: ["로맨스"] }, to: { entry: "leaf", genres: ["SF·판타지", "역사"] } });
    expect(rule(17).from.genres).toContain("로맨스");
    for (const n of [38, 39, 40, 41]) expect(at(n)).toBeLessThan(at(26));
    for (const n of [42, 43]) expect(at(n)).toBeLessThan(at(31));
    expect(rule(31).from.topics).toEqual(expect.arrayContaining(["마케팅·브랜딩", "리더십"]));
    expect(rule(35).from.topics).toEqual(expect.arrayContaining(["마케팅·브랜딩", "리더십"]));
    expect(rule(32).from.topics).toEqual(expect.arrayContaining(["건강·운동", "요리·살림"]));
    expect(rule(34).from.topics).toEqual(expect.arrayContaining(["건강·운동", "요리·살림"]));
  });
  it("19 and 36 are the challenge lists the user approved, and catch every 이야기 / 배우기 scope (no fallback to the other branch)", () => {
    expect(rule(19)).toMatchObject({ from: { entry: "leaf" }, to: { entry: "leaf", genres: ["시", "인문", "과학 교양", "예술·여행", "역사", "사회·시사", "호러·괴담"] }, pick: "one" });
    expect(rule(36)).toMatchObject({ from: { entry: "target" }, to: { entry: "leaf", genres: ["과학 교양", "인문", "역사", "예술·여행", "사회·시사"] }, pick: "one" });
    expect(rule(19).from).toEqual({ entry: "leaf" });
    expect(rule(36).from).toEqual({ entry: "target" });
    expect(far.findIndex((r) => r.n === 19)).toBe(far.findLastIndex((r) => r.from.entry === "leaf"));
    expect(far.at(-1)!.n).toBe(36);
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
