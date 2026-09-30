import { describe, expect, it } from "vitest";
import { normalizeBook, normalizeCatalog, normalizeVocab, parseCsv, titlesFromCsv } from "./normalize";

const TITLES = new Map([["9791111111111", "모순"], ["9792222222222", "처음 만나는 SQL"]]);
const leafRow = {
  isbn: "9791111111111", entry: "leaf", slot: "한국 소설", field: null, topic: null, genre: "한국 소설", pages: 308, way: null,
  axes: { temp: 1, pull: -1, gain: 0, world: 1 }, keywords: [], one_liner: "사랑과 현실 사이에서 무엇을 고를까요?", one_liner_style: "question",
};
const targetRow = {
  isbn: "9792222222222", entry: "target", slot: "데이터 분석", field: "데이터·통계", topic: "데이터 분석", genre: "데이터 분석", pages: 240,
  way: "실습", axes: null, keywords: ["SQL", "시각화"], one_liner: "표에서 원하는 줄만 꺼내는 쿼리를 익혀요", one_liner_style: "summary",
};

describe("normalizeBook", () => {
  it("keeps a 🍃 row with its title and axes", () => {
    expect(normalizeBook(leafRow, TITLES)).toEqual({
      isbn: "9791111111111", entry: "leaf", title: "모순", genre: "한국 소설", field: null, topic: null, pages: 308, way: null,
      axes: { temp: 1, pull: -1, gain: 0, world: 1 }, keywords: [], one_liner: "사랑과 현실 사이에서 무엇을 고를까요?", one_liner_style: "question",
    });
  });

  it("derives field and genre of a 🎯 row from its topic", () => {
    const b = normalizeBook({ ...targetRow, field: undefined, genre: undefined }, TITLES);
    expect(b).toMatchObject({
      entry: "target", title: "처음 만나는 SQL", topic: "데이터 분석", genre: "데이터 분석", field: "데이터·통계",
      way: "실습", axes: null, keywords: ["SQL", "시각화"],
    });
  });

  it("accepts Korean one-liner style names", () => {
    expect(normalizeBook({ ...targetRow, one_liner_style: "요약형" }, TITLES).one_liner_style).toBe("summary");
  });

  it.each([
    ["an unknown genre", { ...leafRow, slot: "요리" }, /unknown leaf genre/],
    ["an axis outside -1..1", { ...leafRow, axes: { temp: 2, pull: 0, gain: 0, world: 0 } }, /axis temp/],
    ["a missing title", { ...leafRow, isbn: "9793333333333" }, /no title/],
    ["a bad isbn", { ...leafRow, isbn: "12" }, /13 digits/],
    ["an unknown way", { ...targetRow, way: "독학" }, /way must be/],
    ["an empty one-liner", { ...targetRow, one_liner: "  " }, /one_liner is empty/],
    ["an unknown entry", { ...targetRow, entry: "shelf" }, /unknown entry/],
    ["zero pages", { ...targetRow, pages: 0 }, /pages/],
  ])("rejects %s", (_, row, message) => {
    expect(() => normalizeBook(row, TITLES)).toThrow(message);
  });
});

describe("normalizeCatalog", () => {
  it("accepts a list or an isbn-keyed object", () => {
    expect(normalizeCatalog([leafRow, targetRow], TITLES)).toHaveLength(2);
    const { isbn, ...rest } = leafRow;
    expect(normalizeCatalog({ [isbn]: rest }, TITLES)[0].isbn).toBe(isbn);
  });

  it("rejects duplicates and empty sources", () => {
    expect(() => normalizeCatalog([leafRow, leafRow], TITLES)).toThrow(/duplicate isbn/);
    expect(() => normalizeCatalog([], TITLES)).toThrow(/no books/);
  });
});

describe("CSV titles", () => {
  it("reads quoted titles with commas and a BOM", () => {
    const csv = "﻿entry,slot,title,isbn\r\nleaf,시,\"꽃, 그리고 \"\"나\"\"\",9791111111111\nleaf,시,모순,9792222222222\n";
    expect(parseCsv(csv)[1]).toEqual(["leaf", "시", "꽃, 그리고 \"나\"", "9791111111111"]);
    expect(titlesFromCsv(csv).get("9792222222222")).toBe("모순");
  });

  it("needs isbn and title columns", () => {
    expect(() => titlesFromCsv("a,b\n1,2\n")).toThrow(/isbn and title/);
  });
});

describe("normalizeVocab", () => {
  const topic = (kept: Record<string, { pattern: string }>) => ({ kept, folded: { 파이썬: 4 }, too_common: { 시각화: 11 } });
  const raw: Record<string, ReturnType<typeof topic>> = {
    "데이터 분석": topic({ SQL: { pattern: "SQL|쿼리" } }), 통계: topic({}), "AI 활용": topic({}),
    "업무 자동화": topic({}), "습관·집중": topic({}), "시간·생산성": topic({}),
  };

  it("keeps kept patterns as keywords and folded / too-common names as topic words", () => {
    expect(normalizeVocab(raw)["데이터 분석"]).toEqual({ keywords: { SQL: "SQL|쿼리" }, terms: ["파이썬", "시각화"] });
  });

  it("rejects a missing topic and a broken pattern", () => {
    const missing = Object.fromEntries(Object.entries(raw).filter(([name]) => name !== "통계"));
    expect(() => normalizeVocab(missing)).toThrow(/no topic 통계/);
    expect(() => normalizeVocab({ ...raw, 통계: topic({ 확률: { pattern: "(" } }) })).toThrow(/통계\/확률/);
  });
});
