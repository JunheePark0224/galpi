import real from "@/data/books.json";
import sample from "@/data/books.sample.json";
import type { Book } from "@/lib/recommend";
import type { BookCard, CatalogBook } from "./types";

/** BOOKS_SOURCE=sample (E2E, tests) draws from the 30-book fixture; otherwise the imported catalogue. Read on every call. */
export function catalog(): CatalogBook[] {
  return (process.env.BOOKS_SOURCE === "sample" ? sample : real) as unknown as CatalogBook[];
}

export function toBook(b: CatalogBook): Book {
  if (b.entry === "leaf") return { id: b.isbn, entry: "leaf", genre: b.genre, pages: b.pages, axes: b.axes };
  return { id: b.isbn, entry: "target", field: b.field, topic: b.topic, genre: b.genre, pages: b.pages, way: b.way, keywords: b.keywords };
}

export function toCard(b: CatalogBook): BookCard {
  return { id: b.isbn, entry: b.entry, title: b.title, author: b.author, genre: b.genre, field: b.field, oneLiner: b.one_liner, oneLinerStyle: b.one_liner_style };
}
