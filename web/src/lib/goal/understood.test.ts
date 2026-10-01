import { describe, expect, it, vi } from "vitest";
import type { GoalMatch } from "./match";
import {
  NOT_COVERED, YES24_HOME, openYes24Search, roParticle, similarBooks, understoodOf, understoodPath, unbreakable, yes24FindMissing, yes24FindUrl,
} from "./understood";

const goal = (over: Partial<GoalMatch> = {}): GoalMatch =>
  ({ text: "주식 처음", topic: "돈 관리·투자", keywords: ["주식"], matched: true, missing: null, method: "llm", ...over });

describe("understoodOf (F-24 ①②③, E-22 understood)", () => {
  it.each([
    ["① topic + keyword", goal(), "keyword"],
    ["①b topic only", goal({ keywords: [] }), "topic"],
    ["② a missing thing", goal({ keywords: [], missing: "단타 매매" }), "missing"],
    ["② even with a keyword", goal({ missing: "단타 매매" }), "missing"],
    ["③ no topic (the LLM said so)", goal({ matched: false, keywords: [], missing: "캠핑 장비" }), "none"],
    ["a word-match miss is only the nearest guess, never ③", goal({ method: "word", matched: false, keywords: [] }), "nearest"],
    ["word matching never yields ②", goal({ method: "word", keywords: [], missing: "단타 매매" }), "topic"],
    ["an example chip", goal({ method: "example", keywords: [] }), "topic"],
  ] as const)("%s", (_, g, want) => {
    expect(understoodOf(g)).toBe(want);
  });
});

describe("roParticle (로 / 으로)", () => {
  it.each([
    ["주식", "으로"], ["돈 관리·투자", "로"], ["재테크 기초", "로"], ["자소서·면접", "으로"], ["습관", "으로"],
    ["일하는 법", "으로"], ["발표", "로"], ["회귀분석", "으로"], ["글쓰기", "로"], ["확률", "로"], ["마음 돌보기", "로"],
    ["SQL", "로"], ["AI", "로"], ["ETF", "로"], ["M365", "로"], ["R", "로"], ["CRM", "으로"], ["PDF", "로"], ["10", "으로"],
    ["3", "으로"], ["7", "로"], ["(", "로"],
  ])("%s → %s", (word, want) => {
    expect(roParticle(word)).toBe(want);
  });
});

describe("understoodPath (분야 › 주제 › 키워드)", () => {
  it("① reaches the keyword", () => {
    expect(understoodPath(goal())).toEqual([
      { name: "돈·경제", kind: "reached" }, { name: "돈 관리·투자", kind: "reached" }, { name: "주식", kind: "reached" },
    ]);
  });

  it("① several keywords share the last segment", () => {
    expect(understoodPath(goal({ keywords: ["주식", "ETF·펀드"] })).map((s) => s.name)).toEqual(["돈·경제", "돈 관리·투자", "주식 · ETF·펀드"]);
  });

  it("①b stops at the topic", () => {
    expect(understoodPath(goal({ keywords: [] })).map((s) => s.name)).toEqual(["돈·경제", "돈 관리·투자"]);
  });

  it("② adds the missing thing as an unreached segment", () => {
    expect(understoodPath(goal({ keywords: [], missing: "단타 매매" }))).toEqual([
      { name: "돈·경제", kind: "reached" }, { name: "돈 관리·투자", kind: "reached" }, { name: "단타 매매", kind: "missing" },
    ]);
  });

  it("③ has no path", () => {
    expect(understoodPath(goal({ matched: false, keywords: [] }))).toEqual([]);
  });

  it("a word-match miss (nearest) has no path either", () => {
    expect(understoodPath(goal({ method: "word", matched: false, keywords: [] }))).toEqual([]);
  });
});

describe("copy and the YES24 search", () => {
  it("uses the decided strings", () => {
    expect(NOT_COVERED).toBe("아직 갈피가 다루지 않는 주제예요");
    expect(similarBooks("돈 관리·투자")).toBe("비슷한 '돈 관리·투자' 책을 펼칠게요");
    expect(yes24FindMissing("단타 매매")).toBe("예스24에서 '단타 매매' 찾기");   // the ↗ is an aria-hidden span
  });

  it("searches YES24 for the short missing phrase only — never the note", () => {
    const url = new URL(yes24FindUrl("단타 매매"));
    expect(url.origin).toBe("https://www.yes24.com");
    expect(url.searchParams.get("query")).toBe("단타 매매");
    expect(url.href).not.toContain(encodeURIComponent("주식 단타 매매법"));
  });

  it("opens the search in a new tab only when asked, without our page as opener", () => {
    const open = vi.spyOn(window, "open").mockReturnValue(null);
    openYes24Search("단타 매매");
    openYes24Search(null);
    expect(open.mock.calls).toEqual([
      [yes24FindUrl("단타 매매"), "_blank", "noopener,noreferrer"],
      [YES24_HOME, "_blank", "noopener,noreferrer"],
    ]);
    open.mockRestore();
  });

  it("opens YES24's front page when there is no phrase", () => {
    expect(yes24FindUrl(null)).toBe(YES24_HOME);
  });

  it("keeps a name on one line", () => {
    expect(unbreakable("돈 관리·투자")).toBe("돈\u00a0관리·투자");
  });
});
