// @vitest-environment node
import { describe, expect, it } from "vitest";
import sample from "@/data/books.sample.json";
import { mulberry32 } from "@/lib/recommend";
import { drawLeaf, drawTarget } from "./draw";
import type { CatalogBook } from "./types";

const BOOKS = sample as unknown as CatalogBook[];
const byId = new Map(BOOKS.map((b) => [b.isbn, b]));
const none = new Set<string>();
const LEAF_CHOICES = ["A", "A", "B", "A", "A", "B", "B", "A", "A"] as const;

describe("drawLeaf", () => {
  it("draws five different 🍃 books, one of them random", () => {
    const res = drawLeaf([...LEAF_CHOICES], none, mulberry32(7), BOOKS);
    expect(res.picks).toHaveLength(5);
    expect(new Set(res.picks.map((p) => p.card.id)).size).toBe(5);
    expect(res.picks.filter((p) => p.kind === "random")).toHaveLength(1);
    expect(res.picks.every((p) => p.card.entry === "leaf")).toBe(true);
    expect(res.found).toBeNull();
    expect(res.keywords).toEqual([]);
  });

  it("never returns a book already shown in this session", () => {
    const seen = new Set(BOOKS.filter((b) => b.entry === "leaf").slice(0, 6).map((b) => b.isbn));
    const res = drawLeaf([...LEAF_CHOICES], seen, mulberry32(3), BOOKS);
    expect(res.picks).toHaveLength(5);
    expect(res.picks.some((p) => seen.has(p.card.id))).toBe(false);
  });

  it("returns an empty, exhausted draw when every 🍃 book was shown", () => {
    const seen = new Set(BOOKS.map((b) => b.isbn));
    expect(drawLeaf([...LEAF_CHOICES], seen, mulberry32(1), BOOKS)).toMatchObject({ picks: [], exhausted: true });
  });
});

describe("drawTarget", () => {
  it("keeps recommended picks in the topic and the random one in the same field", () => {
    const res = drawTarget({ topic: "데이터 분석", way: "실습", len: 1, keywords: [] }, none, mulberry32(5), BOOKS);
    expect(res.picks).toHaveLength(5);
    for (const p of res.picks) {
      const book = byId.get(p.card.id);
      if (p.kind === "recommended") expect(book?.topic).toBe("데이터 분석");
      else expect(book?.field).toBe("데이터·통계");
    }
    expect(res.found).toBe(5);
  });

  it("counts keyword matches for the coverage notice", () => {
    const res = drawTarget({ topic: "데이터 분석", way: null, len: 0, keywords: ["SQL"] }, none, mulberry32(2), BOOKS);
    expect(res.keywords).toEqual(["SQL"]);
    expect(res.found).toBe(2);
  });

  it("drops keywords no book in the topic has", () => {
    const res = drawTarget({ topic: "AI 활용", way: null, len: 0, keywords: ["챗GPT", "제미나이"] }, none, mulberry32(2), BOOKS);
    expect(res.keywords).toEqual(["챗GPT"]);
    expect(res.found).toBe(1);
    const nothing = drawTarget({ topic: "AI 활용", way: null, len: 0, keywords: ["제미나이"] }, none, mulberry32(2), BOOKS);
    expect(nothing.keywords).toEqual([]);
    expect(nothing.found).toBe(0);
  });

  it("does not call a draw exhausted because of an impossible keyword", () => {
    const habit = (i: number): CatalogBook => ({
      isbn: `97911111111${String(i).padStart(2, "0")}`, entry: "target", title: `습관 ${i}`, author: "저자", genre: "습관·집중",
      field: "습관·자기계발", topic: "습관·집중", pages: 300, way: "사례", axes: null, keywords: ["습관"],
      one_liner: "습관을 만드는 법을 알려줘요", one_liner_style: "summary",
    });
    const five = [1, 2, 3, 4, 5].map(habit);
    // Without dropping, maxPossible would be 9 (three keywords) and a mean score of 3 would look exhausted.
    const res = drawTarget({ topic: "습관·집중", way: null, len: 0, keywords: ["습관", "뇌과학", "집중력"] }, none, mulberry32(3), five);
    expect(res.keywords).toEqual(["습관"]);
    expect(res.exhausted).toBe(false);
  });
});
