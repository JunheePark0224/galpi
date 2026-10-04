import { describe, expect, it } from "vitest";
import { bookTitle } from "./title";

describe("bookTitle", () => {
  it("wraps the title in 『 』", () => {
    expect(bookTitle("물고기는 존재하지 않는다")).toBe("『물고기는 존재하지 않는다』");
  });

  it("drops stray spaces at the ends so the marks sit on the words", () => {
    expect(bookTitle("  채식주의자 ")).toBe("『채식주의자』");
  });
});
