import { describe, expect, it } from "vitest";
import { EMPTY_FORM, FREE_PLACEHOLDER, WAY_CHIPS, formReady, goalSubmittedProps, targetAnswersFrom } from "./target";

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
    const goal = { text: "SQL", topic: "데이터 분석" as const, keywords: ["SQL"], matched: true, missing: null, method: "word" as const };
    expect(targetAnswersFrom({ ...EMPTY_FORM, free: "SQL" }, goal)).toEqual({ topic: "데이터 분석", way: null, len: 0, keywords: ["SQL"] });
  });

  it("builds E-26 goal_submitted props: chosen topic, or the topic the written goal matched", () => {
    expect(goalSubmittedProps({ topic: "통계", free: null, len: "thin", way: "실습" }, null, false))
      .toEqual({ topic: "통계", is_free_text: false, len: "thin", way: "실습", is_edit: false });
    const goal = { text: "SQL", topic: "데이터 분석" as const, keywords: ["SQL"], matched: true, missing: null, method: "word" as const };
    expect(goalSubmittedProps({ ...EMPTY_FORM, free: "SQL" }, goal, true))
      .toEqual({ topic: "데이터 분석", is_free_text: true, len: null, way: null, is_edit: true });
  });

  it("builds E-26 props for an unmatched written goal: topic = the nearest topic, is_free_text still true", () => {
    const goal = { text: "아무말", topic: "데이터 분석" as const, keywords: [], matched: false, missing: null, method: "word" as const };
    expect(goalSubmittedProps({ ...EMPTY_FORM, free: "아무말", len: "thick" }, goal, false))
      .toEqual({ topic: "데이터 분석", is_free_text: true, len: "thick", way: null, is_edit: false });
  });

  it("builds E-26 props for an untouched example chip: is_free_text false — 보기 그대로, not the visitor's own words", () => {
    const goal = { text: "불안할 때", topic: "마음 돌보기" as const, keywords: ["불안·걱정"], matched: true, missing: null, method: "example" as const };
    expect(goalSubmittedProps({ ...EMPTY_FORM, free: "불안할 때", way: "사례" }, goal, false))
      .toEqual({ topic: "마음 돌보기", is_free_text: false, len: null, way: "사례", is_edit: false });
  });

  it("uses the B placeholder in the 무엇을 field", () => {
    expect(FREE_PLACEHOLDER).toBe("요즘 알고 싶은 걸 적어 주세요 (30자)");
  });

  it("labels 읽는 방식 chips as target-chips.md does", () => {
    expect(WAY_CHIPS.map((c) => c.label)).toEqual(["개념부터 쉽게", "따라 하며 실습 (바로 써먹기)", "사례로 술술"]);
  });
});
