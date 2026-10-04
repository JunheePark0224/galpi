import { describe, expect, it } from "vitest";
import { leafScore, maxPossibleLeaf, maxPossibleTarget, targetScore } from "./score";
import type { LeafBook, TargetAnswers, TargetBook } from "./types";

const leaf = (axes: LeafBook["axes"], pages = 300): LeafBook => ({ id: "l", entry: "leaf", genre: "에세이", pages, axes });
const tbook = (o: Partial<TargetBook> = {}): TargetBook => ({
  id: "t", entry: "target", field: "데이터", topic: "통계", genre: "통계", pages: 300, way: "개념", keywords: ["확률"], ...o,
});
const tans = (o: Partial<TargetAnswers> = {}): TargetAnswers => ({ topic: "통계", way: null, len: 0, keywords: [], ...o });

describe("leafScore", () => {
  it("multiplies answers by tags and adds length", () => {
    const b = leaf({ temp: 1, pull: -1, gain: 0, world: 1 }, 200);
    expect(leafScore(b, { temp: 2, pull: 2, gain: -2, world: 0, len: 1 })).toBe(2 - 2 + 0 + 0 + 1);
  });
  it("is 0 when the user is neutral everywhere", () => {
    expect(leafScore(leaf({ temp: 1, pull: 1, gain: 1, world: 1 }), { temp: 0, pull: 0, gain: 0, world: 0, len: 0 })).toBe(0);
  });
});

describe("targetScore", () => {
  it("excludes other topics", () => {
    expect(targetScore(tbook({ topic: "AI 활용" }), tans())).toBeNull();
  });
  it("is 0 when nothing but the topic was chosen", () => {
    expect(targetScore(tbook(), tans())).toBe(0);
  });
  it("adds keyword, way and length points", () => {
    const a = tans({ keywords: ["확률", "회귀분석"], way: "개념", len: 1 });
    expect(targetScore(tbook({ pages: 240 }), a)).toBe(3 + 2 + 2);
  });
  it("penalises thick books for the thin choice and rewards them for the thick one (one page rule: ≤280 / ≥380)", () => {
    expect(targetScore(tbook({ pages: 380 }), tans({ len: 1 }))).toBe(-1);
    expect(targetScore(tbook({ pages: 320 }), tans({ len: 1 }))).toBe(0);
    expect(targetScore(tbook({ pages: 280 }), tans({ len: 1 }))).toBe(2);
    expect(targetScore(tbook({ pages: 380 }), tans({ len: -1 }))).toBe(1);
    expect(targetScore(tbook({ pages: 379 }), tans({ len: -1 }))).toBe(0);
  });
  it("ignores a different way", () => {
    expect(targetScore(tbook({ way: "실습" }), tans({ way: "개념" }))).toBe(0);
  });
});

describe("maxPossible", () => {
  it("leaf = sum of absolute answers", () => {
    expect(maxPossibleLeaf({ temp: 2, pull: -1, gain: 0, world: -2, len: -1 })).toBe(6);
  });
  it("target counts only chosen items", () => {
    expect(maxPossibleTarget(tans())).toBe(0);
    expect(maxPossibleTarget(tans({ keywords: ["확률"], way: "실습", len: 1 }))).toBe(3 + 2 + 2);
    expect(maxPossibleTarget(tans({ len: -1 }))).toBe(1);
  });
});
