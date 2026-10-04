import { describe, expect, it } from "vitest";
import { bookTitle } from "./title";

describe("bookTitle", () => {
  it("wraps the title in 『 』", () => {
    expect(bookTitle("물고기는 존재하지 않는다")).toBe("『물고기는 존재하지 않는다』");
  });

  it("drops stray spaces at the ends so the marks sit on the words", () => {
    expect(bookTitle("  채식주의자 ")).toBe("『채식주의자』");
  });

  it("collapses doubled spaces", () => {
    expect(bookTitle("클로드 콘텐츠 자동화  with 코워크")).toBe("『클로드 콘텐츠 자동화 with 코워크』");
  });

  it("drops the shop's edition labels", () => {
    expect(bookTitle("[예스리커버] 너를 아끼며 살아라 (10만 부 특별 한정판)")).toBe("『너를 아끼며 살아라』");
    expect(bookTitle("미움받을 용기 (200만 부 기념 스페셜 에디션)")).toBe("『미움받을 용기』");
    expect(bookTitle("이기적 유전자 The Selfish Gene : 50주년 기념판")).toBe("『이기적 유전자 The Selfish Gene』");
  });

  it("keeps a trailing note that is part of the name", () => {
    expect(bookTitle("IT 비전공자를 위한 파이썬 업무 자동화 (RPA)")).toBe("『IT 비전공자를 위한 파이썬 업무 자동화 (RPA)』");
  });

  it("keeps the whole title when it is only a label", () => {
    expect(bookTitle("[예스리커버]")).toBe("『[예스리커버]』");
  });
});
