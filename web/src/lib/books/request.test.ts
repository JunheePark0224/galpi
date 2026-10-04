import { describe, expect, it } from "vitest";
import vocabJson from "@/data/vocab.json";
import { MAX_KEYWORDS } from "./taxonomy";
import { MAX_ANSWERS, parseDrawRequest } from "./request";
import { SQL_PATH } from "@/lib/paths/__fixtures__/paths";
import type { Vocab } from "./types";

const vocab = vocabJson as Vocab;
const target = (keywords: unknown) => ({ entry: "target", answers: { topic: "AI 활용", way: null, len: 0, keywords } });
const AI_KEYWORDS = Object.keys(vocab["AI 활용"].keywords);

describe("parseDrawRequest keywords", () => {
  it("counts a repeated keyword once", () => {
    const parsed = parseDrawRequest(target(["챗GPT", "챗GPT", "클로드", "챗GPT"]), vocab);
    expect(parsed?.query).toMatchObject({ entry: "target", answers: { keywords: ["챗GPT", "클로드"] } });
  });

  it("does not let repeats push a valid request over the limit", () => {
    const repeated = Array.from({ length: MAX_KEYWORDS + 3 }, () => "챗GPT");
    expect(parseDrawRequest(target(repeated), vocab)).not.toBeNull();
  });

  it("accepts exactly the limit and rejects one more distinct keyword", () => {
    expect(parseDrawRequest(target(AI_KEYWORDS.slice(0, MAX_KEYWORDS)), vocab)).not.toBeNull();
    expect(parseDrawRequest(target(AI_KEYWORDS.slice(0, MAX_KEYWORDS + 1)), vocab)).toBeNull();
  });
});

describe("parseDrawRequest — v2 path body (no entry)", () => {
  const V = vocab as Vocab;
  it("accepts a finished path with seen and seed", () => {
    expect(parseDrawRequest({ answers: SQL_PATH, seen: ["x"], seed: 3 }, V))
      .toEqual({ query: { entry: "path", answers: SQL_PATH }, seen: ["x"], seed: 3 });
  });
  it("keeps only node and choice of each answer it accepts", () => {
    const parsed = parseDrawRequest({ answers: SQL_PATH.map((a) => ({ ...a })) }, V);
    expect(parsed?.query).toEqual({ entry: "path", answers: SQL_PATH });
  });
  it.each([
    ["answers missing", {}],
    ["answers not a list", { answers: "start" }],
    ["no answers", { answers: [] }],
    ["an unfinished path", { answers: SQL_PATH.slice(0, -1) }],
    ["a question that was not asked", { answers: [{ node: "branch", choice: "A" }] }],
    ["an unknown choice", { answers: [{ node: "start", choice: "C" }, ...SQL_PATH.slice(1)] }],
    ["an extra key on an answer", { answers: [{ node: "start", choice: "A", text: "hi" }, ...SQL_PATH.slice(1)] }],
    ["a node id that is not a string", { answers: [{ node: 1, choice: "A" }] }],
    ["a node id over 64 characters", { answers: [{ node: "x".repeat(65), choice: "A" }] }],
    ["too many answers", { answers: Array.from({ length: MAX_ANSWERS + 1 }, () => ({ node: "start", choice: "A" })) }],
    ["an answer that is not an object", { answers: [null] }],
  ])("refuses %s", (_, body) => {
    expect(parseDrawRequest(body, V)).toBeNull();
  });
});
