import real from "@/data/books.json";
import sample from "@/data/books.sample.json";
import vocab from "@/data/vocab.json";
import type { Book } from "@/lib/recommend";
import { activeTopics, activeVocab } from "./active";
import type { BookCard, CatalogBook, Vocab } from "./types";

/** BOOKS_SOURCE=sample (E2E, tests) draws from the 30-book fixture; otherwise the imported catalogue. Read on every call. */
export function catalog(): CatalogBook[] {
  return (process.env.BOOKS_SOURCE === "sample" ? sample : real) as unknown as CatalogBook[];
}

/**
 * vocab.json cut to the 🎯 topics the published catalogue (books.json) can fill — what 직접 쓰기 sorting and word matching
 * may answer with (lib/books/active.ts). Always the real books: BOOKS_SOURCE=sample only changes which books are drawn,
 * so E2E sorts notes into the same topics as production. Server code only — it carries the whole catalogue.
 */
export const ACTIVE_VOCAB: Vocab = activeVocab(vocab as Vocab, activeTopics(real as unknown as CatalogBook[]));

export function toBook(b: CatalogBook): Book {
  if (b.entry === "leaf") return { id: b.isbn, entry: "leaf", genre: b.genre, pages: b.pages, axes: b.axes };
  return { id: b.isbn, entry: "target", field: b.field, topic: b.topic, genre: b.genre, pages: b.pages, way: b.way, keywords: b.keywords };
}

export function toCard(b: CatalogBook): BookCard {
  return { id: b.isbn, entry: b.entry, title: b.title, author: b.author, genre: b.genre, field: b.field, oneLiner: b.one_liner, oneLinerStyle: b.one_liner_style };
}
