import { describe, expect, it } from "vitest";
import { EMPTY_FORM, WAY_CHIPS, formReady, targetAnswersFrom } from "./target";

describe("🎯 form", () => {
  it("needs a topic or a non-empty written goal", () => {
    expect(formReady(EMPTY_FORM)).toBe(false);
    expect(formReady({ ...EMPTY_FORM, topic: "통계" })).toBe(true);
    expect(formReady({ ...EMPTY_FORM, free: "   " })).toBe(false);
    expect(formReady({ ...EMPTY_FORM, free: "SQL" })).toBe(true);
  });

  it("maps chips to scoring answers (얇게 +1, 보통 0, 두꺼워도 좋아요 -1)", () => {
    expect(targetAnswersFrom({ topic: "통계", free: null, len: "thin", way: "실습" }, null)).toEqual({ topic: "통계", way: "실습", len: 1, keywords: [] });
    expect(targetAnswersFrom({ topic: "통계", free: null, len: "thick", way: null }, null).len).toBe(-1);
    expect(targetAnswersFrom({ topic: "통계", free: null, len: "normal", way: null }, null).len).toBe(0);
  });

  it("takes topic and keywords from a written goal", () => {
    const goal = { text: "SQL", topic: "데이터 분석" as const, keywords: ["SQL"], matched: true, method: "word" as const };
    expect(targetAnswersFrom({ ...EMPTY_FORM, free: "SQL" }, goal)).toEqual({ topic: "데이터 분석", way: null, len: 0, keywords: ["SQL"] });
  });

  it("labels 읽는 방식 chips as target-chips.md does", () => {
    expect(WAY_CHIPS.map((c) => c.label)).toEqual(["개념부터 쉽게", "따라 하며 실습 (바로 써먹기)", "사례로 술술"]);
  });
});
