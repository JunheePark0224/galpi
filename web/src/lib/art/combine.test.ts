// @vitest-environment node
import { existsSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { ANIMALS, BACKGROUNDS, GROUND_PROPS, SKY_PROPS, artFromSeed, artsForDraw, newArtSeed } from "./combine";

describe("bookmark art", () => {
  it("has 7 × 6 × 5 × 5 = 1,050 combinations (DESIGN 5절)", () => {
    expect(ANIMALS.length * Object.keys(BACKGROUNDS).length * SKY_PROPS.length * GROUND_PROPS.length).toBe(1050);
  });

  it("redraws the same picture from the same seed", () => {
    expect(artFromSeed(42)).toEqual(artFromSeed(42));
    expect(artFromSeed(42)).toEqual(artsForDraw(1, 42)[0]);
  });

  it("uses only known parts and marks nothing rare yet", () => {
    for (let seed = 0; seed < 200; seed++) {
      const a = artFromSeed(seed);
      expect(ANIMALS).toContain(a.animal);
      expect(Object.keys(BACKGROUNDS)).toContain(a.bg);
      expect(SKY_PROPS).toContain(a.sky);
      expect(GROUND_PROPS).toContain(a.ground);
      expect(a.rare).toBe(false);
    }
  });

  it("reaches every animal and never repeats one inside a draw of five", () => {
    const seen = new Set<string>();
    for (let seed = 0; seed < 300; seed++) {
      const five = artsForDraw(5, seed);
      expect(new Set(five.map((a) => a.animal)).size).toBe(5);
      five.forEach((a) => seen.add(a.animal));
    }
    expect(seen.size).toBe(ANIMALS.length);
  });

  it("still returns a picture for every pick when a draw has more picks than animals", () => {
    expect(artsForDraw(9, 1)).toHaveLength(9);
  });

  it("makes 32-bit seeds", () => {
    const s = newArtSeed();
    expect(Number.isInteger(s) && s >= 0 && s < 2 ** 32).toBe(true);
  });

  it("has an SVG in public/animals for every animal", () => {
    for (const animal of ANIMALS) expect(existsSync(path.resolve("public", "animals", `${animal}.svg`))).toBe(true);
  });
});
