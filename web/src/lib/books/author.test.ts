import { describe, expect, it } from "vitest";
import { AUTHOR_MAX, bookAuthor } from "./author";

describe("bookAuthor — the author line on a bookmark (one line, 10-12)", () => {
  it("keeps every author that fits as it is", () => {
    expect(bookAuthor("레프 니콜라예비치 톨스토이")).toBe("레프 니콜라예비치 톨스토이");
    expect(bookAuthor("한강")).toBe("한강");
  });

  it("shortens a long name to the whole words that fit, then …", () => {
    expect(bookAuthor("도쿄지케이카이의과대학 부속병원 영양부")).toBe("도쿄지케이카이의과대학…");
  });

  it("cuts one very long word to fit, then …", () => {
    const long = "가".repeat(AUTHOR_MAX + 5);
    expect(bookAuthor(long)).toBe(`${"가".repeat(AUTHOR_MAX - 1)}…`);
  });

  it("never returns more than AUTHOR_MAX characters", () => {
    for (const a of ["도쿄지케이카이의과대학 부속병원 영양부", "가".repeat(40), "아주 긴 이름 하나 둘 셋 넷 다섯 여섯"]) {
      expect([...bookAuthor(a)].length).toBeLessThanOrEqual(AUTHOR_MAX);
    }
  });
});
