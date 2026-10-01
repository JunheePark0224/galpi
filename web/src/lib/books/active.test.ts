import { describe, expect, it } from "vitest";
import { MIN_ACTIVE_TOPIC_BOOKS, activeTopics, activeVocab, topicsIn } from "./active";
import type { Vocab } from "./types";

const target = (topic: string) => ({ entry: "target" as const, topic });
const leaf = { entry: "leaf" as const, topic: null };
const books = (topic: string, n: number) => Array.from({ length: n }, () => target(topic));

const VOCAB: Vocab = {
  통계: { keywords: { 확률: "확률" }, terms: [] },
  "데이터 분석": { keywords: { SQL: "SQL" }, terms: ["엑셀"] },
  "습관·집중": { keywords: { 습관: "습관|루틴" }, terms: [] },
};

describe("activeTopics", () => {
  it("turns a topic on at ten books (the 10-01 rule)", () => {
    expect(MIN_ACTIVE_TOPIC_BOOKS).toBe(10);
    expect(activeTopics([...books("통계", 10), ...books("습관·집중", 9)])).toEqual(["통계"]);
  });

  it("counts only 🎯 books and keeps our topic order", () => {
    const all = [...books("습관·집중", 12), ...books("데이터 분석", 10), leaf, target("요리"), ...books("요리", 20)];
    expect(activeTopics(all)).toEqual(["데이터 분석", "습관·집중"]);
  });

  it("takes another threshold and gives nothing for an empty catalogue", () => {
    expect(activeTopics(books("통계", 3), 3)).toEqual(["통계"]);
    expect(activeTopics([])).toEqual([]);
  });
});

describe("activeVocab and topicsIn", () => {
  it("cuts the vocabulary to the active topics, in our topic order", () => {
    const cut = activeVocab(VOCAB, ["습관·집중", "데이터 분석", "AI 활용"]);
    expect(Object.keys(cut)).toEqual(["데이터 분석", "습관·집중"]);
    expect(cut["데이터 분석"]).toBe(VOCAB["데이터 분석"]);
    expect(activeVocab(VOCAB, [])).toEqual({});
  });

  it("lists the topics a vocabulary covers, in our order, ignoring names that are not topics", () => {
    expect(topicsIn(VOCAB)).toEqual(["데이터 분석", "통계", "습관·집중"]);
    expect(topicsIn({ 요리: { keywords: {}, terms: [] } })).toEqual([]);
  });
});
