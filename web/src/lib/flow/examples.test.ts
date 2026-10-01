import { describe, expect, it } from "vitest";
import vocab from "@/data/vocab.json";
import { TOPICS, type Topic } from "@/lib/books/taxonomy";
import type { Vocab } from "@/lib/books/types";
import { GOAL_MAX } from "@/lib/goal/match";
import { EXAMPLE_CHIPS, exampleGoal, shownExamples } from "./examples";

const ALL: readonly Topic[] = TOPICS;

describe("example chips (S-02 🎯 B, context 10-01)", () => {
  it("are the six decided phrases, in order", () => {
    expect(EXAMPLE_CHIPS.map((c) => c.text)).toEqual(["돈 관리", "취업 준비", "불안할 때", "데이터 분석", "AI 잘 쓰기", "글 잘 쓰기"]);
  });

  it("each point at one of our topics with keywords from its closed list, short enough for the field", () => {
    const v = vocab as Vocab;
    for (const c of EXAMPLE_CHIPS) {
      expect(TOPICS).toContain(c.topic);
      expect(c.text.length).toBeLessThanOrEqual(GOAL_MAX);
      for (const k of c.keywords) expect(Object.keys(v[c.topic]?.keywords ?? {})).toContain(k);
    }
  });

  it("shows only the chips whose topic is active, keeping the order", () => {
    expect(shownExamples(ALL).map((c) => c.text)).toHaveLength(6);
    expect(shownExamples(["AI 활용", "데이터 분석", "통계"]).map((c) => c.text)).toEqual(["데이터 분석", "AI 잘 쓰기"]);
    expect(shownExamples([])).toEqual([]);
  });

  it("turns an untouched example into its fixed match, no sorting needed", () => {
    expect(exampleGoal("불안할 때", ALL)).toEqual({ text: "불안할 때", topic: "마음 돌보기", keywords: [], matched: true, method: "example" });
    expect(exampleGoal("  취업 준비 ", ALL)).toEqual({ text: "취업 준비", topic: "취업·커리어", keywords: ["자소서·면접"], matched: true, method: "example" });
    expect(exampleGoal("AI 잘 쓰기", ALL)).toMatchObject({ topic: "AI 활용", keywords: [] });
  });

  it("treats edited text, other text or an example of an inactive topic as a written goal (null)", () => {
    expect(exampleGoal("불안할 때 읽을 책", ALL)).toBeNull();
    expect(exampleGoal("SQL", ALL)).toBeNull();
    expect(exampleGoal("", ALL)).toBeNull();
    expect(exampleGoal("돈 관리", ["데이터 분석", "AI 활용"])).toBeNull();
  });

  it("returns fresh keyword lists (the table is never shared out)", () => {
    const a = exampleGoal("취업 준비", ALL);
    a?.keywords.push("x");
    expect(exampleGoal("취업 준비", ALL)?.keywords).toEqual(["자소서·면접"]);
  });
});
