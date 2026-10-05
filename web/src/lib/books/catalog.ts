import real from "@/data/books.json";
import sample from "@/data/books.sample.json";
import libraryData from "@/data/library.json";
import { kstDate, libraryCount, type LibraryCount } from "./library";
import type { BookCard, CatalogBook } from "./types";

export { toBook } from "./toBook";

/** BOOKS_SOURCE=sample (E2E, tests) draws from the 30-book fixture; otherwise the imported catalogue. Read on every call. */
export function catalog(): CatalogBook[] {
  return (process.env.BOOKS_SOURCE === "sample" ? sample : real) as unknown as CatalogBook[];
}

/**
 * F-23 on S-01: the published catalogue's size and the books its additions file of today (Korean date) added — null below
 * LIBRARY_MIN_BOOKS. Real books always. page.tsx calls it on each regeneration so "오늘" moves with the day.
 */
export function library(now: Date): LibraryCount | null {
  return libraryCount(real.length, libraryData.added as Record<string, number>, kstDate(now));
}

export function toCard(b: CatalogBook): BookCard {
  return { id: b.isbn, entry: b.entry, title: b.title, author: b.author, genre: b.genre, field: b.field, oneLiner: b.one_liner, oneLinerStyle: b.one_liner_style };
}
