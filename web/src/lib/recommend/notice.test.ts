import { describe, expect, it } from "vitest";
import { EXHAUSTED_NOTICE, coverageNotice } from "./notice";

describe("coverageNotice", () => {
  it("says nothing when 4 or more books were found", () => {
    expect(coverageNotice(4, "SQL", "데이터 분석")).toBeNull();
  });
  it("is honest about 1-3 books", () => {
    expect(coverageNotice(2, "SQL", "데이터 분석")).toBe("SQL 책은 아직 2권이에요. 나머지는 가까운 '데이터 분석' 책이에요");
  });
  it("is honest about 0 books", () => {
    expect(coverageNotice(0, "발표", "시간·생산성")).toBe("아직 발표 책이 없어요. 가장 가까운 '시간·생산성' 책을 펼칠게요");
  });
  it("has the exhaustion notice text", () => {
    expect(EXHAUSTED_NOTICE).toBe("조건에 딱 맞는 책은 여기까지예요");
  });
});
