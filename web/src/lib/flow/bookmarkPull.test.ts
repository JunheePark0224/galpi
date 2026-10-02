import { describe, expect, it } from "vitest";
import { metDate } from "./bookmarkPull";

describe("metDate (C-13 back: 만난 날 YYYY. M. D.)", () => {
  it("writes the local date without leading zeros", () => {
    expect(metDate(new Date(2026, 9, 1))).toBe("2026. 10. 1.");
    expect(metDate(new Date(2027, 0, 9, 23, 59))).toBe("2027. 1. 9.");
  });
});
