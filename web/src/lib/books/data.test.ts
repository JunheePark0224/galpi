import { describe, expect, it } from "vitest";
import real from "@/data/books.json";
import sample from "@/data/books.sample.json";
import vocab from "@/data/vocab.json";
import { normalizeCatalog } from "./normalize";
import { TOPICS } from "./taxonomy";
import type { CatalogBook, Vocab } from "./types";

const asRows = (books: CatalogBook[]) => books.map((b) => ({ ...b, slot: b.entry === "leaf" ? b.genre : b.topic }));

describe("app book data", () => {
  it.each([["books.sample.json", sample], ["books.json", real]])("%s passes the import checks unchanged", (_, data) => {
    const books = data as unknown as CatalogBook[];
    const bib = new Map(books.map((b) => [b.isbn, { title: b.title, author: b.author }]));
    expect(normalizeCatalog(asRows(books), bib)).toEqual(books);
  });

  it("sample has 12 🍃 and 18 🎯 books, enough for one full 🎯 draw in 데이터 분석", () => {
    const books = sample as unknown as CatalogBook[];
    expect(books.filter((b) => b.entry === "leaf")).toHaveLength(12);
    const target = books.filter((b) => b.entry === "target");
    expect(target).toHaveLength(18);
    expect(target.filter((b) => b.topic === "데이터 분석")).toHaveLength(5);
    expect(target.filter((b) => b.keywords.includes("SQL"))).toHaveLength(2);
  });

  it("vocab.json covers all sixteen topics: the 19 keywords of v1.1 left after 마음·회복 moved out + 엑셀·파이썬·데이터 리터러시 back in 데이터 분석 and LLM 원리 in AI 활용 (10-02), the 33 D-A drafts and the 12 drafts of 10-05 (target-chips 2-1)", () => {
    expect(Object.keys(vocab)).toEqual([...TOPICS]);
    const count = (topics: readonly string[]) =>
      topics.reduce((n, t) => n + Object.keys((vocab as Vocab)[t].keywords).length, 0);
    expect(count(TOPICS.slice(0, 6))).toBe(23);
    expect(Object.keys(vocab["AI 활용"].keywords)).toContain("LLM 원리");
    expect(Object.keys(vocab["데이터 분석"].keywords)).toEqual(["SQL", "엑셀", "파이썬", "데이터 리터러시"]);
    expect(count(TOPICS.slice(6, 12))).toBe(33);
    expect(count(TOPICS.slice(12))).toBe(12);
    expect(Object.keys(vocab["마케팅·브랜딩"].keywords)).toEqual(["브랜딩", "콘텐츠 마케팅", "고객 이해"]);
    expect(Object.keys(vocab["리더십"].keywords)).toEqual(["팀 이끌기", "피드백·코칭", "조직 문화"]);
    expect(Object.keys(vocab["건강·운동"].keywords)).toEqual(["운동 습관", "달리기·근력", "잠·회복"]);
    expect(Object.keys(vocab["요리·살림"].keywords)).toEqual(["집밥", "정리·미니멀", "살림 기술"]);
    expect(Object.keys(vocab["돈 관리·투자"].keywords)).toEqual(["재테크 기초", "주식", "ETF·펀드", "부동산·청약", "연금·노후", "돈의 심리"]);
  });
});
