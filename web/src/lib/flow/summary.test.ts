import { describe, expect, it } from "vitest";
import { EXHAUSTED_NOTICE, type BalanceChoice } from "@/lib/recommend";
import type { GoalMatch } from "@/lib/goal/match";
import type { DrawView } from "./state";
import {
  coverageBucket, coverageNote, editedQuestions, editedTargetFields, firstPageNotices, lengthWord, targetSummary, tasteLines,
} from "./summary";
import { EMPTY_FORM } from "./target";

const nine = (...c: BalanceChoice[]) => c;
const goal = (over: Partial<GoalMatch> = {}): GoalMatch =>
  ({ text: "SQL 공부", topic: "데이터 분석", keywords: ["SQL"], matched: true, missing: null, method: "word", ...over });
const draw = (over: Partial<DrawView> = {}): DrawView =>
  ({ picks: [], exhausted: false, found: null, keywords: [], ...over });
const onePick: DrawView["picks"] = [{
  card: { id: "1", entry: "target", title: "t", author: "a", genre: "데이터 분석", field: "데이터·통계", oneLiner: "o", oneLinerStyle: "summary" },
  kind: "recommended", art: { animal: "cat", bg: "peach", sky: "moon", ground: "none", rare: false },
  reason: { label: "나온 이유", items: ["데이터 분석"] },
}];

describe("tasteLines (from the raw answers, balance-game.md 2절)", () => {
  it("says 확실히 when both answers of an axis agree", () => {
    const lines = tasteLines(nine("A", "B", "A", "B", "A", "B", "A", "B", "A"));
    expect(lines.map((l) => [l.text, l.strength])).toEqual([
      ["확실히 따뜻함", 2], ["확실히 몰입", 2], ["확실히 알게 됨", 2], ["확실히 딴 세상", 2],
    ]);
  });

  it("says 둘 다 좋아요 when they split, and names one side when the other was unsure", () => {
    // 온도 A+B 갈림 / 끌림 unsure+B → 몰입(●○) / 얻는 것 unsure+unsure → 둘 다 좋아요(○○) / 세계 A+B 갈림
    const lines = tasteLines(nine("A", "unsure", "unsure", "A", "B", "B", "unsure", "B", "unsure"));
    expect(lines.map((l) => [l.text, l.strength])).toEqual([
      ["따뜻함 · 여운 둘 다 좋아요", 0], ["몰입", 1], ["알게 됨 · 마음 둘 다 좋아요", 0], ["현실 · 딴 세상 둘 다 좋아요", 0],
    ]);
  });

  it("names the length answer", () => {
    expect([lengthWord("A"), lengthWord("B"), lengthWord("unsure"), lengthWord(undefined)]).toEqual(["얇게", "두껍게", "상관없음", "상관없음"]);
  });
});

describe("targetSummary", () => {
  it("shows chip labels and 상관없음 for empty optional fields", () => {
    expect(targetSummary({ topic: "AI 활용", free: null, len: "thin", way: null }, null)).toEqual([
      { label: "무엇을", value: "AI 똑똑하게 쓰기" }, { label: "분량", value: "얇게" }, { label: "읽는 방식", value: "상관없음" },
    ]);
  });

  it("shows the written goal as written", () => {
    expect(targetSummary({ ...EMPTY_FORM, free: "SQL 공부", way: "실습" }, goal())[0]).toEqual({ label: "무엇을", value: "“SQL 공부”" });
    expect(targetSummary({ ...EMPTY_FORM, free: "SQL 공부", way: "실습" }, goal())[2].value).toBe("따라 하며 실습");
  });
});

describe("coverageNote (F-24 ①+: the line under the path)", () => {
  it("tells how many keyword books there are", () => {
    expect(coverageNote("target", goal(), draw({ found: 2, keywords: ["SQL"], exhausted: true, picks: onePick })))
      .toBe("SQL 책은 아직 2권이에요. 나머지는 가까운 '데이터 분석' 책이에요");
  });

  it("gives a word-match miss (nearest) the old honest line", () => {
    expect(coverageNote("target", goal({ keywords: [], matched: false, text: "발표 준비" }), draw({ found: null, picks: onePick })))
      .toBe("아직 이 주제 책이 없어요. 가장 가까운 '데이터 분석' 책을 펼칠게요");
    expect(firstPageNotices("target", goal({ keywords: [], matched: false }), draw({ exhausted: true, picks: onePick }))).toEqual([]);
  });

  it("says so when the keyword has no books yet", () => {
    expect(coverageNote("target", goal({ keywords: ["제미나이"], topic: "AI 활용" }), draw({ found: 0, keywords: [], picks: onePick })))
      .toBe("아직 이 주제 책이 없어요. 가장 가까운 'AI 활용' 책을 펼칠게요");
  });

  it.each([
    ["enough keyword books", goal(), draw({ found: 6, keywords: ["SQL"], picks: onePick })],
    ["no keyword (①b)", goal({ keywords: [] }), draw({ found: null, picks: onePick })],
    ["② (the missing line says it instead)", goal({ method: "llm", missing: "윈도우 함수" }), draw({ found: 1, keywords: ["SQL"], picks: onePick })],
    ["③ (no topic, no draw)", goal({ keywords: [], matched: false, method: "llm" }), null],
    ["the draw not back yet", goal(), null],
    ["🍃", null, draw({ found: 1, keywords: ["SQL"], picks: onePick })],
  ])("is null for %s", (_, g, d) => {
    expect(coverageNote(g ? "target" : "leaf", g, d)).toBeNull();
  });
});

describe("firstPageNotices (C-14 slips)", () => {
  it("drops the exhausted notice in a round with a coverage line", () => {
    expect(firstPageNotices("target", goal(), draw({ found: 2, keywords: ["SQL"], exhausted: true, picks: onePick }))).toEqual([]);
  });

  it("shows the exhausted notice for 🎯 when there is no coverage line", () => {
    expect(firstPageNotices("target", goal(), draw({ found: 6, keywords: ["SQL"], exhausted: true, picks: onePick }))).toEqual([EXHAUSTED_NOTICE]);
    expect(firstPageNotices("target", null, draw({ exhausted: true, picks: onePick }))).toEqual([EXHAUSTED_NOTICE]);
  });

  it("no longer shows the old 'no books for this topic' slip — ③ says it in the 이렇게 이해했어요 block", () => {
    expect(firstPageNotices("target", goal({ keywords: [], matched: false, text: "발표 준비" }), null)).toEqual([]);
  });

  it("does not show the 🎯 exhausted notice to 🍃 unless the draw is empty", () => {
    expect(firstPageNotices("leaf", null, draw({ exhausted: true, picks: onePick }))).toEqual([]);
    expect(firstPageNotices("leaf", null, draw({ exhausted: true, picks: [] }))).toEqual([EXHAUSTED_NOTICE]);
  });

  it("waits for the draw", () => {
    expect(firstPageNotices("target", goal(), null)).toEqual([]);
  });
});

describe("edit tracking and coverage buckets", () => {
  it("lists changed balance questions", () => {
    expect(editedQuestions(nine("A", "A", "A", "A", "A", "A", "A", "A", "A"), nine("A", "B", "A", "A", "A", "A", "A", "A", "unsure"))).toEqual(["q2", "q9"]);
  });

  it("lists changed 🎯 fields", () => {
    const before = { topic: null, free: "SQL", len: null, way: null } as const;
    expect(editedTargetFields(before, { ...before, len: "thin" })).toEqual(["len"]);
    expect(editedTargetFields(before, { ...before, free: null, topic: "통계", way: "개념" })).toEqual(["topic", "way"]);
    expect(editedTargetFields(before, { ...before })).toEqual([]);
  });

  it("buckets found books as PRD E-22 does", () => {
    expect([0, 1, 3, 4, 17].map(coverageBucket)).toEqual(["0", "1-3", "1-3", "4+", "4+"]);
  });
});
