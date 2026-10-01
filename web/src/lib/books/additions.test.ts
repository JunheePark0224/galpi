import { describe, expect, it } from "vitest";
import { mergeAdditions } from "./additions";
import { normalizeCatalog } from "./normalize";
import type { Vocab } from "./types";

const VOCAB: Vocab = {
  "돈 관리·투자": { keywords: { 주식: "주식", "ETF·펀드": "ETF" }, terms: [] },
  글쓰기: { keywords: { 카피라이팅: "카피" }, terms: [] },
};
const BASE_ROWS = [{
  isbn: "9790000000001", entry: "target", slot: "통계", pages: 200, way: "개념", keywords: ["확률"],
  one_liner: "확률을 처음부터 쉽게 알려줘요", one_liner_style: "summary",
}];
const BASE_BIB = new Map([["9790000000001", { title: "확률 입문", author: "가나다" }]]);
const book = (over: Record<string, unknown> = {}) => ({
  isbn: "9791111111111", title: "돈의 속성", author: "김승호 저", pages: 415, entry: "target", topic: "돈 관리·투자",
  field: "돈·경제", keywords: ["주식"], way: "개념", one_liner: "종잣돈을 모으기 전에 돈을 대하는 태도부터 짚어요",
  one_liner_style: "summary", evidence: "부자의 돈 철학", confidence: 0.8, status: "picked", ...over,
});
const file = (books: unknown[]) => ({ date: "2026-10-01", batch: "pilot", reviewed: false, books });

describe("mergeAdditions", () => {
  it("appends picked books after the base rows and adds their title and cleaned author to the bib", () => {
    const { rows, bib } = mergeAdditions(BASE_ROWS, BASE_BIB, [file([book(), book({ isbn: "9792222222222", status: "reserve" })])], VOCAB);
    expect(rows.map((r) => r.isbn)).toEqual(["9790000000001", "9791111111111"]);
    expect(rows[1]).toMatchObject({ entry: "target", slot: "돈 관리·투자", way: "개념", keywords: ["주식"] });
    expect(bib.get("9791111111111")).toEqual({ title: "돈의 속성", author: "김승호" });
    expect(BASE_ROWS).toHaveLength(1);
    expect(BASE_BIB.has("9791111111111")).toBe(false);
  });

  it("keeps the base rows exactly as they were (same objects, same order)", () => {
    const { rows } = mergeAdditions(BASE_ROWS, BASE_BIB, [], VOCAB);
    expect(rows).toEqual(BASE_ROWS);
  });

  it("produces rows that pass the normal import checks", () => {
    const { rows, bib } = mergeAdditions(BASE_ROWS, BASE_BIB, [file([book()])], VOCAB);
    expect(normalizeCatalog(rows, bib).at(-1)).toMatchObject({ isbn: "9791111111111", field: "돈·경제", author: "김승호" });
  });

  it("rejects a keyword outside its topic's closed list", () => {
    expect(() => mergeAdditions(BASE_ROWS, BASE_BIB, [file([book({ keywords: ["카피라이팅"] })])], VOCAB))
      .toThrow("9791111111111: keyword 카피라이팅 is not in 돈 관리·투자");
  });

  it("rejects a book that is already in the base", () => {
    expect(() => mergeAdditions(BASE_ROWS, BASE_BIB, [file([book({ isbn: "9790000000001" })])], VOCAB))
      .toThrow("9790000000001: already in books");
  });

  it("adds a 🍃 book of the daily pipeline with its genre and axes", () => {
    const leaf = book({ isbn: "9793333333333", entry: "leaf", genre: "호러·괴담", topic: undefined, keywords: undefined,
      way: undefined, axes: { temp: -1, pull: -1, gain: 0, world: -1 }, one_liner: "그 집에서는 왜 밤마다 문이 열릴까요?",
      one_liner_style: "question" });
    const { rows, bib } = mergeAdditions(BASE_ROWS, BASE_BIB, [file([leaf])], VOCAB);
    expect(rows[1]).toEqual({ isbn: "9793333333333", entry: "leaf", slot: "호러·괴담", pages: 415,
      axes: { temp: -1, pull: -1, gain: 0, world: -1 }, keywords: [], one_liner: "그 집에서는 왜 밤마다 문이 열릴까요?",
      one_liner_style: "question" });
    expect(normalizeCatalog(rows, bib).at(-1)).toMatchObject({ genre: "호러·괴담", topic: null, axes: { world: -1 } });
    const odd = mergeAdditions([], new Map(), [file([{ ...leaf, genre: "요리" }])], VOCAB);
    expect(() => normalizeCatalog(odd.rows, odd.bib)).toThrow("unknown leaf genre 요리");
  });

  it("rejects an unknown status, a missing title and an unknown entry", () => {
    expect(() => mergeAdditions([], new Map(), [file([book({ status: "maybe" })])], VOCAB)).toThrow("unknown status maybe");
    expect(() => mergeAdditions([], new Map(), [file([book({ title: "" })])], VOCAB)).toThrow("needs title and author");
    expect(() => mergeAdditions([], new Map(), [file([book({ entry: "both" })])], VOCAB)).toThrow("unknown entry both");
  });

  it("rejects a file without a books list", () => {
    expect(() => mergeAdditions([], new Map(), [{ date: "x" }], VOCAB)).toThrow("additions file needs a books list");
  });
});
