import { describe, expect, it } from "vitest";
import { QUESTION_AXIS } from "@/lib/recommend";
import { QUESTIONS } from "./questions";

describe("balance questions", () => {
  it("has one question per axis slot of P1 (4 axes × 2 + length)", () => {
    expect(QUESTIONS).toHaveLength(QUESTION_AXIS.length);
    expect(QUESTIONS.map((q) => q.n)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9]);
  });

  it("puts A on the right for the second question of each axis only", () => {
    expect(QUESTIONS.map((q) => q.aOnLeft)).toEqual([true, true, true, true, false, false, false, false, true]);
  });

  it("keeps the wording of balance-game.md", () => {
    expect(QUESTIONS[0]).toEqual({ n: 1, text: "책을 덮은 뒤, 남았으면 하는 건?", a: "몽글몽글 따뜻함", b: "한동안 멍한 여운", aOnLeft: true });
    expect(QUESTIONS[5].a).toBe("\"이 문장 좀 봐\"");
    expect(QUESTIONS[8].b).toBe("든든하게 두꺼운 책");
  });
});
