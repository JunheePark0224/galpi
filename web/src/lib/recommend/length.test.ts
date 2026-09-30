import { describe, expect, it } from "vitest";
import { lengthTag } from "./length";

describe("lengthTag", () => {
  it.each([[150, 1], [250, 1], [251, 0], [399, 0], [400, -1], [800, -1]])("%i pages -> %i", (pages, tag) => {
    expect(lengthTag(pages)).toBe(tag);
  });
});
