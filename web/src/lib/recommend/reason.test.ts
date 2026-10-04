import { describe, expect, it } from "vitest";
import { reasonLine } from "./reason";
import type { LeafBook, TargetBook } from "./types";

const leafBook: LeafBook = { id: "l", entry: "leaf", genre: "에세이", pages: 220, axes: { temp: 1, pull: 1, gain: -1, world: 1 } };
const targetBook: TargetBook = { id: "t", entry: "target", field: "데이터", topic: "통계", genre: "통계", pages: 240,
  way: "개념", keywords: ["확률", "회귀분석"] };

describe("reasonLine", () => {
  it("lists the leaf answers this book matches, strongest first", () => {
    expect(reasonLine(leafBook, { temp: 1, pull: 2, gain: -2, world: 0, len: 1 }))
      .toEqual({ label: "나온 이유", items: ["문장", "마음", "따뜻함", "얇게"] });
  });
  it("says 두껍게 when a thick-book answer meets a thick book", () => {
    const thick: LeafBook = { ...leafBook, pages: 420 };
    expect(reasonLine(thick, { temp: 0, pull: 0, gain: 0, world: 0, len: -1 }))
      .toEqual({ label: "나온 이유", items: ["두껍게"] });
  });
  it("describes the book itself when nothing matches (same format for random picks)", () => {
    expect(reasonLine(leafBook, { temp: -2, pull: -2, gain: 2, world: -2, len: -1 }))
      .toEqual({ label: "이 책은", items: ["따뜻함", "문장", "마음"] });
  });
  it("lists topic, matched keywords, way and length for target books", () => {
    expect(reasonLine(targetBook, { topic: "통계", way: "개념", len: 1, keywords: ["확률"] }))
      .toEqual({ label: "나온 이유", items: ["통계", "확률", "개념부터 쉽게", "얇게"] });
  });
  it("shows only the topic when nothing else was chosen", () => {
    expect(reasonLine(targetBook, { topic: "통계", way: null, len: 0, keywords: [] }))
      .toEqual({ label: "나온 이유", items: ["통계"] });
  });
  it("describes an other-topic target book instead of claiming a reason", () => {
    expect(reasonLine(targetBook, { topic: "AI 활용", way: "개념", len: 1, keywords: ["확률"] }))
      .toEqual({ label: "이 책은", items: ["통계", "개념부터 쉽게"] });
  });
  it("adds 두껍게 for a target book of 380+ pages when thick was chosen (the one page rule)", () => {
    const thick: TargetBook = { ...targetBook, pages: 380 };
    expect(reasonLine(thick, { topic: "통계", way: null, len: -1, keywords: [] }))
      .toEqual({ label: "나온 이유", items: ["통계", "두껍게"] });
    expect(reasonLine(targetBook, { topic: "통계", way: null, len: -1, keywords: [] }))
      .toEqual({ label: "나온 이유", items: ["통계"] });
  });
});
