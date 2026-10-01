import { readFileSync } from "node:fs";
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

  it("has the twelve 🍃 genres, the D-A three last", () => {
    expect(LEAF_GENRES).toHaveLength(12);
    expect(LEAF_GENRES.slice(9)).toEqual(["역사", "사회·시사", "호러·괴담"]);
  });

  it("gives every genre a name-tag colour that tokens.css defines (DESIGN T-02)", () => {
    const tokens = readFileSync("src/styles/tokens.css", "utf8");
    for (const genre of LEAF_GENRES) {
      const tone = toneOf({ entry: "leaf", genre, field: null });
      expect(tone.bg, genre).not.toBe("var(--ink-muted)");
      expect(tokens, genre).toContain(`${tone.bg.slice(4, -1)}:`);
    }
    expect(toneOf({ entry: "leaf", genre: "호러·괴담", field: null })).toEqual({ bg: "var(--genre-horror)", fg: "#FFFFFF" });
  });

  it("colours name tags by genre, by field for 🎯, ink text only on 예술·여행", () => {
    expect(toneOf({ entry: "leaf", genre: "에세이", field: null })).toEqual({ bg: "var(--genre-essay)", fg: "#FFFFFF" });
    expect(toneOf({ entry: "leaf", genre: "예술·여행", field: null })).toEqual({ bg: "var(--genre-art-travel)", fg: "var(--ink)" });
    expect(toneOf({ entry: "target", genre: "통계", field: "데이터·통계" })).toEqual({ bg: "var(--field-data)", fg: "#FFFFFF" });
    expect(toneOf({ entry: "leaf", genre: "요리", field: null }).bg).toBe("var(--ink-muted)");
  });
});
