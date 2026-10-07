import { describe, expect, it } from "vitest";
import { cleanShelfName, parseArt, parseMetOn, parseReason, SHELF_NAME_MAX } from "./validate";

const ART = { animal: "fox", bg: "night", ground: "books", rare: false };

describe("parseArt — only picture parts we draw (DESIGN A-01~A-04)", () => {
  it("keeps a valid combination and nothing else", () => {
    expect(parseArt({ ...ART, extra: "x" })).toEqual(ART);
  });
  it("refuses unknown parts and wrong shapes", () => {
    for (const bad of [null, "fox", [], { ...ART, animal: "dragon" }, { ...ART, bg: "red" }, { ...ART, ground: "lava" }, { ...ART, ground: "moon" }, { ...ART, rare: "no" }]) {
      expect(parseArt(bad), JSON.stringify(bad)).toBeNull();
    }
  });
  it("reads a four-part picture from before 10-07 A as three parts: the sky prop dropped, fireflies as the empty ground", () => {
    expect(parseArt({ animal: "whale", bg: "lavender", sky: "bigStar", ground: "none", rare: false }))
      .toEqual({ animal: "whale", bg: "lavender", ground: "none", rare: false });
    expect(parseArt({ ...ART, sky: "goldmoon", ground: "firefly", rare: true })).toEqual({ ...ART, ground: "none", rare: false });
  });
  it("accepts the 한정판·초판본 parts and works `rare` out from the parts, whatever the browser said", () => {
    const first = { animal: "bluedragon", bg: "galaxy", ground: "goldbook", rare: false };
    expect(parseArt(first)).toEqual({ ...first, rare: true });
    expect(parseArt({ animal: "cat", bg: "summer", ground: "grass" })).toEqual({ animal: "cat", bg: "summer", ground: "grass", rare: true });
    expect(parseArt({ ...ART, ground: "clover", rare: false })?.rare).toBe(true);
    expect(parseArt({ ...ART, rare: true })?.rare).toBe(false);   // a claimed rare with common parts is not rare
  });
});

describe("parseReason — the 나온 이유 shown on the back face", () => {
  it("keeps the label and up to five short items", () => {
    expect(parseReason({ label: "나온 이유", items: ["데이터 분석", "실습"] })).toEqual({ label: "나온 이유", items: ["데이터 분석", "실습"] });
    expect(parseReason({ label: "이 책은", items: [] })).toEqual({ label: "이 책은", items: [] });
  });
  it("refuses other labels, too many or too long items, and markup", () => {
    expect(parseReason({ label: "x", items: [] })).toBeNull();
    expect(parseReason({ label: "나온 이유", items: Array(6).fill("a") })).toBeNull();
    expect(parseReason({ label: "나온 이유", items: ["a".repeat(41)] })).toBeNull();
    expect(parseReason({ label: "나온 이유", items: ["<b>"] })).toBeNull();
    expect(parseReason({ label: "나온 이유", items: [1] })).toBeNull();
    expect(parseReason(null)).toBeNull();
  });
});

describe("parseMetOn — 만난 날 (YYYY-MM-DD, Korean date)", () => {
  const today = "2026-10-01";
  it("keeps a real date up to today", () => {
    expect(parseMetOn("2026-10-01", today)).toBe("2026-10-01");
    expect(parseMetOn("2026-09-30", today)).toBe("2026-09-30");
  });
  it("refuses tomorrow, impossible dates and other shapes", () => {
    for (const bad of ["2026-10-02", "2026-02-30", "2026-1-1", "", 20261001, null]) expect(parseMetOn(bad, today), String(bad)).toBeNull();
  });
});

describe("cleanShelfName — the person's own words, at most 12 characters", () => {
  it("trims, joins spaces and keeps Korean and emoji", () => {
    expect(cleanShelfName("  읽을   책  ")).toBe("읽을 책");
    expect(cleanShelfName("🌙 밤에 읽기")).toBe("🌙 밤에 읽기");
    expect(SHELF_NAME_MAX).toBe(12);
  });
  it("takes out control characters and angle brackets", () => {
    expect(cleanShelfName("a\u0000b​c<d>")).toBe("abcd");
  });
  it("refuses empty and too long names (counted in characters, not UTF-16 units)", () => {
    expect(cleanShelfName("   ")).toBeNull();
    expect(cleanShelfName(1)).toBeNull();
    expect(cleanShelfName("가".repeat(12))).toBe("가".repeat(12));
    expect(cleanShelfName("가".repeat(13))).toBeNull();
    expect(cleanShelfName("🌙".repeat(12))).toBe("🌙".repeat(12));
  });
});
