import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { FIELD_OF_TOPIC, LEAF_GENRES, TOPIC_CHIPS, TOPICS, toneOf } from "./taxonomy";

describe("taxonomy", () => {
  it("has sixteen topics, the D-A six then the 10-05 four last, and still the first six as S-02 chips with their verbatim labels", () => {
    expect(TOPICS).toEqual([
      "데이터 분석", "통계", "AI 활용", "업무 자동화", "습관·집중", "시간·생산성",
      "돈 관리·투자", "경제 상식", "마음 돌보기", "대화·관계", "취업·커리어", "글쓰기",
      "마케팅·브랜딩", "리더십", "건강·운동", "요리·살림",
    ]);
    expect(TOPIC_CHIPS.map((c) => c.topic)).toEqual(TOPICS.slice(0, 6));
    expect(TOPIC_CHIPS.map((c) => c.label)).toEqual(["데이터 분석", "통계", "AI 똑똑하게 쓰기", "업무 자동화", "습관·집중", "시간·생산성"]);
  });

  it("maps topics to six fields — two topics each, four in 일·커리어 and 습관·자기계발 since 10-05 (no new field)", () => {
    const fields = Object.values(FIELD_OF_TOPIC);
    expect(new Set(fields)).toEqual(new Set(["데이터·통계", "AI·IT 활용", "습관·자기계발", "돈·경제", "마음·관계", "일·커리어"]));
    for (const f of new Set(fields)) expect(fields.filter((x) => x === f)).toHaveLength(f === "일·커리어" || f === "습관·자기계발" ? 4 : 2);
    expect(FIELD_OF_TOPIC["업무 자동화"]).toBe("AI·IT 활용");
    expect(FIELD_OF_TOPIC["글쓰기"]).toBe("일·커리어");
    expect([FIELD_OF_TOPIC["마케팅·브랜딩"], FIELD_OF_TOPIC["리더십"]]).toEqual(["일·커리어", "일·커리어"]);
    expect([FIELD_OF_TOPIC["건강·운동"], FIELD_OF_TOPIC["요리·살림"]]).toEqual(["습관·자기계발", "습관·자기계발"]);
  });

  it("has the thirteen 🍃 genres, the D-A three then 로맨스 (10-05) last", () => {
    expect(LEAF_GENRES).toHaveLength(13);
    expect(LEAF_GENRES.slice(9)).toEqual(["역사", "사회·시사", "호러·괴담", "로맨스"]);
  });

  it("gives every genre a name-tag colour that tokens.css defines (DESIGN T-02)", () => {
    const tokens = readFileSync("src/styles/tokens.css", "utf8");
    for (const genre of LEAF_GENRES) {
      const tone = toneOf({ entry: "leaf", genre, field: null });
      expect(tone.bg, genre).not.toBe("var(--ink-muted)");
      expect(tokens, genre).toContain(`${tone.bg.slice(4, -1)}:`);
    }
    expect(toneOf({ entry: "leaf", genre: "호러·괴담", field: null })).toEqual({ bg: "var(--genre-horror)", fg: "#FFFFFF" });
    expect(toneOf({ entry: "leaf", genre: "로맨스", field: null })).toEqual({ bg: "var(--genre-romance)", fg: "#FFFFFF" });
  });

  it("로맨스 has its own deep rose, unlike 한국 소설 and the purples, with white text at 4.5 : 1 or more (DESIGN T-02)", () => {
    const tokens = readFileSync("src/styles/tokens.css", "utf8");
    const hex = (name: string) => tokens.match(new RegExp(`--${name}: (#[0-9A-F]{6})`, "i"))![1];
    const romance = hex("genre-romance");
    expect(romance).toBe("#B81D55");
    const near = ["korean-fiction", "world-fiction", "horror", "history"].map((g) => hex(`genre-${g}`));
    expect(new Set([romance, ...near, hex("field-mind")]).size).toBe(6);
    const lum = (h: string) => {
      const [r, g, b] = [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16) / 255).map((c) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
      return 0.2126 * r + 0.7152 * g + 0.0722 * b;
    };
    expect(1.05 / (lum(romance) + 0.05)).toBeGreaterThanOrEqual(4.5);
  });

  it("gives every field a name-tag colour that tokens.css defines", () => {
    const tokens = readFileSync("src/styles/tokens.css", "utf8");
    for (const topic of TOPICS) {
      const tone = toneOf({ entry: "target", genre: topic, field: FIELD_OF_TOPIC[topic] });
      expect(tone.bg, topic).not.toBe("var(--ink-muted)");
      expect(tokens, topic).toContain(`${tone.bg.slice(4, -1)}:`);
    }
    expect(toneOf({ entry: "target", genre: "글쓰기", field: "일·커리어" })).toEqual({ bg: "var(--field-career)", fg: "#FFFFFF" });
    expect(toneOf({ entry: "target", genre: "리더십", field: "일·커리어" })).toEqual({ bg: "var(--field-career)", fg: "#FFFFFF" });
    expect(toneOf({ entry: "target", genre: "요리·살림", field: "습관·자기계발" })).toEqual({ bg: "var(--field-habit)", fg: "#FFFFFF" });
  });

  it("colours name tags by genre, by field for 🎯, ink text only on 예술·여행", () => {
    expect(toneOf({ entry: "leaf", genre: "에세이", field: null })).toEqual({ bg: "var(--genre-essay)", fg: "#FFFFFF" });
    expect(toneOf({ entry: "leaf", genre: "예술·여행", field: null })).toEqual({ bg: "var(--genre-art-travel)", fg: "var(--ink)" });
    expect(toneOf({ entry: "target", genre: "통계", field: "데이터·통계" })).toEqual({ bg: "var(--field-data)", fg: "#FFFFFF" });
    expect(toneOf({ entry: "leaf", genre: "요리", field: null }).bg).toBe("var(--ink-muted)");
  });
});
