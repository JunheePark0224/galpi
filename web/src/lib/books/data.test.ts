import { describe, expect, it } from "vitest";
import real from "@/data/books.json";
import sample from "@/data/books.sample.json";
import vocab from "@/data/vocab.json";
import { normalizeCatalog } from "./normalize";
import { TOPICS } from "./taxonomy";
import type { CatalogBook } from "./types";

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

  it("vocab.json covers all six topics with the 20 keywords of v1.1", () => {
    expect(Object.keys(vocab)).toEqual([...TOPICS]);
    const count = Object.values(vocab).reduce((n, t) => n + Object.keys(t.keywords).length, 0);
    expect(count).toBe(20);
  });
});
