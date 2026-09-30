import { describe, expect, it } from "vitest";
import { FIELD_OF_TOPIC, LEAF_GENRES, TOPIC_CHIPS, TOPICS, toneOf } from "./taxonomy";

describe("taxonomy", () => {
  it("keeps the six topics in chip order with the verbatim chip labels", () => {
    expect(TOPICS).toEqual(["데이터 분석", "통계", "AI 활용", "업무 자동화", "습관·집중", "시간·생산성"]);
    expect(TOPIC_CHIPS.map((c) => c.label)).toEqual(["데이터 분석", "통계", "AI 똑똑하게 쓰기", "업무 자동화", "습관·집중", "시간·생산성"]);
  });

  it("maps topics to the three fields", () => {
    expect(new Set(Object.values(FIELD_OF_TOPIC))).toEqual(new Set(["데이터·통계", "AI·IT 활용", "습관·자기계발"]));
    expect(FIELD_OF_TOPIC["업무 자동화"]).toBe("AI·IT 활용");
  });

  it("has the nine 🍃 genres", () => {
    expect(LEAF_GENRES).toHaveLength(9);
  });

  it("colours name tags by genre, by field for 🎯, ink text only on 예술·여행", () => {
    expect(toneOf({ entry: "leaf", genre: "에세이", field: null })).toEqual({ bg: "var(--genre-essay)", fg: "#FFFFFF" });
    expect(toneOf({ entry: "leaf", genre: "예술·여행", field: null })).toEqual({ bg: "var(--genre-art-travel)", fg: "var(--ink)" });
    expect(toneOf({ entry: "target", genre: "통계", field: "데이터·통계" })).toEqual({ bg: "var(--field-data)", fg: "#FFFFFF" });
    expect(toneOf({ entry: "leaf", genre: "요리", field: null }).bg).toBe("var(--ink-muted)");
  });
});
