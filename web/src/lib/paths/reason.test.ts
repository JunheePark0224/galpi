import { describe, expect, it } from "vitest";
import type { LeafBook, TargetBook } from "@/lib/recommend";
import { pathReason } from "./reason";
import { ALL_SCOPE, NEUTRAL_MOOD } from "./types";

const t = (topic: string, keywords: string[], way: TargetBook["way"], pages: number): TargetBook =>
  ({ id: "T", entry: "target", field: "데이터·통계", topic, genre: topic, pages, way, keywords });
const leaf: LeafBook = { id: "L", entry: "leaf", genre: "에세이", pages: 300, axes: { temp: 1, pull: 0, gain: 0, world: 0 } };

describe("pathReason (S-06 / 책갈피 뒷면 나온 이유, from the path)", () => {
  it("🍃: the mood axes the book shares", () => {
    const w = { scope: { ...ALL_SCOPE, entry: "leaf" as const }, mood: { ...NEUTRAL_MOOD, axes: { temp: 1, pull: 0, gain: 0, world: 0 } } };
    expect(pathReason(leaf, w)).toEqual({ label: "나온 이유", items: ["따뜻함"] });
  });

  it("🎯 in the narrowed scope: topic, the keyword it matched, the way it is (one of those chosen) and length", () => {
    const w = { scope: { ...ALL_SCOPE, entry: "target" as const, topics: ["데이터 분석"], keywords: ["SQL"] }, mood: { ...NEUTRAL_MOOD, ways: ["실습", "사례"] as const, len: 1 as const } };
    expect(pathReason(t("데이터 분석", ["SQL"], "실습", 200), w)).toEqual({ label: "나온 이유", items: ["데이터 분석", "SQL", "따라 하며 실습", "얇게"] });
    expect(pathReason(t("데이터 분석", ["SQL"], "개념", 200), w)).toEqual({ label: "나온 이유", items: ["데이터 분석", "SQL", "얇게"] });
  });

  it("🎯 from above the scope (the 운명 1장 or a widened draw): what the book is", () => {
    const w = { scope: { ...ALL_SCOPE, entry: "target" as const, topics: ["데이터 분석"] }, mood: NEUTRAL_MOOD };
    expect(pathReason(t("통계", ["회귀분석"], "개념", 300), w)).toEqual({ label: "이 책은", items: ["통계", "개념부터 쉽게"] });
  });

  it("🎯 when no topic was chosen: the book's own topic counts as asked", () => {
    const w = { scope: { ...ALL_SCOPE, entry: "target" as const }, mood: NEUTRAL_MOOD };
    expect(pathReason(t("데이터 분석", ["SQL"], "사례", 300), w)).toEqual({ label: "나온 이유", items: ["데이터 분석"] });
  });
});
