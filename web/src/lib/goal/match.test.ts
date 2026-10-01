import { describe, expect, it } from "vitest";
import type { Vocab } from "@/lib/books/types";
import { MAX_KEYWORDS } from "@/lib/books/taxonomy";
import { GOAL_MAX, matchGoal } from "./match";

// A slice of keyword_vocab.json v1.1 so this test does not move when the real list grows.
const VOCAB: Vocab = {
  "데이터 분석": { keywords: { SQL: "SQL|쿼리|데이터베이스" }, terms: ["파이썬", "엑셀", "시각화"] },
  통계: { keywords: { 회귀분석: "회귀", 확률: "확률" }, terms: ["베이즈"] },
  "AI 활용": {
    keywords: {
      챗GPT: "챗GPT|ChatGPT", 클로드: "클로드|Claude", 제미나이: "제미나이|Gemini", "바이브 코딩": "코덱스|Codex",
      "AI 에이전트": "MCP|에이전트", "이미지·영상 생성": "캔바|미드저니",
    },
    terms: [],
  },
  글쓰기: { keywords: { "에세이·책 쓰기": "에세이 ?쓰기|책 ?쓰기" }, terms: [] },
  "업무 자동화": { keywords: { "파이썬 자동화": "파이썬|Python", "AI 업무 활용": "챗GPT|ChatGPT|생성형 ?AI" }, terms: ["노션"] },
  "습관·집중": { keywords: { "마음·회복": "회복 ?탄력성|스트레스|번아웃|불안" }, terms: ["도파민"] },
  "시간·생산성": { keywords: { "일하는 법": "일 ?잘하는|업무 ?효율|생산성" }, terms: ["시간 관리"] },
};

describe("matchGoal", () => {
  it("never returns more keywords than the server accepts", () => {
    const m = matchGoal("챗GPT 클로드 제미나이 코덱스 MCP 캔바", VOCAB);
    expect(m.keywords).toEqual(["챗GPT", "클로드", "제미나이", "바이브 코딩", "AI 에이전트"]);
    expect(m.keywords).toHaveLength(MAX_KEYWORDS);
    expect(m.topic).toBe("AI 활용");
  });

  it("finds a keyword from our closed list", () => {
    expect(matchGoal("SQL 공부", VOCAB)).toEqual({ text: "SQL 공부", topic: "데이터 분석", keywords: ["SQL"], matched: true, method: "word" });
  });

  it("matches keyword patterns without caring about case", () => {
    expect(matchGoal("chatgpt 잘 쓰기", VOCAB)).toMatchObject({ topic: "AI 활용", keywords: ["챗GPT"], matched: true });
  });

  it("breaks keyword ties by chip order", () => {
    // 챗GPT is a keyword in both AI 활용 and 업무 자동화 (AI 업무 활용): AI 활용 comes first.
    expect(matchGoal("ChatGPT", VOCAB).topic).toBe("AI 활용");
  });

  it("prefers keywords over topic words", () => {
    expect(matchGoal("파이썬으로 엑셀 정리", VOCAB)).toMatchObject({ topic: "업무 자동화", keywords: ["파이썬 자동화"] });
  });

  it("lets the topic's own name settle a word tie: 쓰기 is in AI 활용's label and in 글쓰기", () => {
    expect(matchGoal("소설 쓰기", VOCAB)).toMatchObject({ topic: "글쓰기", keywords: [], matched: true });
    expect(matchGoal("AI 잘 쓰기", VOCAB)).toMatchObject({ topic: "AI 활용", matched: true });
  });

  it("finds worries, not only subjects", () => {
    expect(matchGoal("번아웃", VOCAB)).toMatchObject({ topic: "습관·집중", keywords: ["마음·회복"], matched: true });
  });

  it("falls back to topic names and folded words", () => {
    expect(matchGoal("시간 관리가 어려워요", VOCAB)).toMatchObject({ topic: "시간·생산성", keywords: [], matched: true });
    expect(matchGoal("통계", VOCAB)).toMatchObject({ topic: "통계", keywords: [], matched: true });
    expect(matchGoal("AI", VOCAB)).toMatchObject({ topic: "AI 활용", matched: true });
  });

  it("says honestly when nothing in our list matched", () => {
    expect(matchGoal("발표 준비", VOCAB)).toEqual({ text: "발표 준비", topic: "데이터 분석", keywords: [], matched: false, method: "word" });
    expect(matchGoal("   ", VOCAB)).toMatchObject({ matched: false, text: "" });
  });

  it("searches only the topics of the vocabulary it is given (the active ones)", () => {
    const rest: Vocab = Object.fromEntries(Object.entries(VOCAB).filter(([topic]) => topic !== "습관·집중"));
    expect(matchGoal("번아웃", VOCAB)).toMatchObject({ topic: "습관·집중", matched: true });
    expect(matchGoal("번아웃", rest)).toMatchObject({ matched: false });
    // the topic's own name is not a way in either while it is off
    expect(matchGoal("집중이 안 돼요", VOCAB)).toMatchObject({ topic: "습관·집중", matched: true });
    expect(matchGoal("집중이 안 돼요", rest)).toMatchObject({ topic: "데이터 분석", matched: false });
  });

  it("still answers (unmatched, first topic) when no topic is active", () => {
    expect(matchGoal("집중이 안 돼요", {})).toMatchObject({ topic: "데이터 분석", keywords: [], matched: false });
    expect(matchGoal("", {})).toMatchObject({ topic: "데이터 분석", matched: false });
  });

  it("keeps at most 30 characters", () => {
    expect(matchGoal(`  ${"가".repeat(40)}  `, VOCAB).text).toHaveLength(GOAL_MAX);
  });
});
