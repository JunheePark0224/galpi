import { describe, expect, it } from "vitest";
import { lengthTag, THICK_MIN, THIN_MAX } from "./length";

describe("lengthTag", () => {
  it.each([[150, 1], [280, 1], [281, 0], [379, 0], [380, -1], [800, -1]])("%i pages -> %i", (pages, tag) => {
    expect(lengthTag(pages)).toBe(tag);
  });
  it("is one rule: thin up to 280 pages, thick from 380", () => {
    expect([THIN_MAX, THICK_MIN]).toEqual([280, 380]);
  });
});
