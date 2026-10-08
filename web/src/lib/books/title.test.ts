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

  it("drops a trailing list of what the book covers (items split by │ or |) — the shop's keywords, not the name", () => {
    expect(bookTitle("1등급 연구대회 실전가이드 (수업혁신사례연구대회│디지털교육연구대회│인성교육실천사례연구발표대회)"))
      .toBe("『1등급 연구대회 실전가이드』");
    expect(bookTitle("글쓰기 수업 (기획|퇴고)")).toBe("『글쓰기 수업』");
  });

  it("keeps a one-character word on the same line as the next word", () => {
    expect(bookTitle("존재의 세 가지 거짓말")).toBe("『존재의 세 가지 거짓말』");
    expect(bookTitle("모두를 위한 R 데이터 분석 입문")).toBe("『모두를 위한 R 데이터 분석 입문』");
  });

  it("keeps a last one-character word with the word before it", () => {
    expect(bookTitle("확률과 통계 편")).toBe("『확률과 통계 편』");
  });

  it("keeps a joining mark at the end of its line, with the word before it", () => {
    expect(bookTitle("기자의 글쓰기 : 싸움의 정석 (원칙편)")).toBe("『기자의 글쓰기 : 싸움의 정석 (원칙편)』");
    expect(bookTitle("세일즈 레터 & 카피라이팅")).toBe("『세일즈 레터 & 카피라이팅』");
  });

  it("keeps the whole title when it is only a label", () => {
    expect(bookTitle("[예스리커버]")).toBe("『[예스리커버]』");
  });
});
