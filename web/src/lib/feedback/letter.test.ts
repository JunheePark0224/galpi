import { describe, expect, it } from "vitest";
import { EVENT_SPEC } from "@/lib/track/schema";
import { cleanLetter, FEEDBACK_MAX } from "./letter";

describe("cleanLetter (PRD F-26)", () => {
  it("keeps the trimmed letter", () => {
    expect(cleanLetter("  좋았어요\n")).toBe("좋았어요");
  });

  it.each([[""], ["   \n\t"], [undefined], [null], [42], [["a"]]])("refuses %j", (raw) => {
    expect(cleanLetter(raw)).toBeNull();
  });

  it("takes 1 to 500 characters after trimming, the same limit as E-31's spec", () => {
    expect(FEEDBACK_MAX).toBe(500);
    expect(EVENT_SPEC.feedback_sent.feedback_text.max).toBe(FEEDBACK_MAX);
    expect(cleanLetter("가".repeat(500))).toHaveLength(500);
    expect(cleanLetter(` ${"가".repeat(500)} `)).toHaveLength(500);
    expect(cleanLetter("가".repeat(501))).toBeNull();
    expect(cleanLetter("a")).toBe("a");
  });
});
