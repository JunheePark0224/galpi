import { describe, expect, it } from "vitest";
import vocabJson from "@/data/vocab.json";
import { MAX_KEYWORDS } from "./taxonomy";
import { parseDrawRequest } from "./request";
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
