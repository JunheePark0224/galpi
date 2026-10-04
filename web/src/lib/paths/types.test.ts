import { describe, expect, it } from "vitest";
import type { LeafBook, TargetBook } from "@/lib/recommend";
import { ALL_SCOPE, inScope, scopeKey } from "./types";

const leaf: LeafBook = { id: "L1", entry: "leaf", genre: "SF·판타지", pages: 300, axes: { temp: 0, pull: 1, gain: 0, world: -1 } };
const target: TargetBook = { id: "T1", entry: "target", field: "데이터·통계", topic: "데이터 분석", genre: "데이터 분석", pages: 200, way: "실습", keywords: ["SQL"] };

describe("inScope", () => {
  it("lets every book in the whole scope", () => {
    expect(inScope(leaf, ALL_SCOPE)).toBe(true);
    expect(inScope(target, ALL_SCOPE)).toBe(true);
  });
  it("narrows by entry, topics, keywords and genres together", () => {
    expect(inScope(target, { ...ALL_SCOPE, entry: "target", topics: ["데이터 분석"], keywords: ["SQL"] })).toBe(true);
    expect(inScope(target, { ...ALL_SCOPE, keywords: ["엑셀"] })).toBe(false);
    expect(inScope(leaf, { ...ALL_SCOPE, topics: ["데이터 분석"] })).toBe(false);          // a 🍃 book has no topic
    expect(inScope(leaf, { ...ALL_SCOPE, genres: ["SF·판타지", "에세이"] })).toBe(true);
    expect(inScope(leaf, { ...ALL_SCOPE, entry: "target" })).toBe(false);
    expect(inScope(leaf, { ...ALL_SCOPE, genres: ["에세이"] })).toBe(false);              // genre not in the list
    expect(inScope(leaf, { ...ALL_SCOPE, keywords: ["SQL"] })).toBe(false);               // a 🍃 book has no keywords
    expect(inScope(target, { ...ALL_SCOPE, topics: ["마음 돌보기"] })).toBe(false);
    expect(inScope(target, { ...ALL_SCOPE, genres: [] })).toBe(false);                    // an empty list lets nothing in
  });
  it("keys a scope the same way whatever the order of its lists", () => {
    expect(scopeKey({ ...ALL_SCOPE, genres: ["시", "에세이"] })).toBe(scopeKey({ ...ALL_SCOPE, genres: ["에세이", "시"] }));
    expect(scopeKey(ALL_SCOPE)).toBe("all");
    expect(scopeKey({ entry: "target", topics: ["데이터 분석"], keywords: ["엑셀", "SQL"], genres: null }))
      .toBe("entry=target;topics=데이터 분석;keywords=SQL,엑셀");
    expect(scopeKey({ ...ALL_SCOPE, genres: [] })).toBe("genres=");
  });
});
