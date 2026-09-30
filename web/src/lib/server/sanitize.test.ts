// @vitest-environment node
import { describe, expect, it } from "vitest";
import { cleanJson, cleanText, MAX_DEPTH, TooDeepError } from "./sanitize";

describe("cleanText", () => {
  it("removes NUL, replaces lone surrogates, keeps whole pairs", () => {
    expect(cleanText("a\u0000b\ud800c\udc00d😀")).toBe("ab\ufffdc\ufffdd😀");
  });
});

describe("cleanJson", () => {
  it("allows nesting up to MAX_DEPTH and refuses more", () => {
    const nest = (n: number): unknown => (n === 0 ? "leaf" : [nest(n - 1)]);
    expect(() => cleanJson(nest(MAX_DEPTH))).not.toThrow();
    expect(() => cleanJson(nest(MAX_DEPTH + 1))).toThrow(TooDeepError);
    expect(() => cleanJson(JSON.parse("[".repeat(3300) + "]".repeat(3300)))).toThrow(TooDeepError);
  });
});
