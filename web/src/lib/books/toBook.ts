import type { Book } from "@/lib/recommend";
import { authorNames } from "./normalize";
import type { CatalogBook } from "./types";

/** A catalogue row → what the draw scores: our tags, page count and author names (one book per author a draw, design 5-3). */
export function toBook(b: CatalogBook): Book {
  const authors = authorNames(b.author);
  if (b.entry === "leaf") return { id: b.isbn, entry: "leaf", genre: b.genre, pages: b.pages, axes: b.axes, authors };
  return { id: b.isbn, entry: "target", field: b.field, topic: b.topic, genre: b.genre, pages: b.pages, way: b.way, keywords: b.keywords, authors };
}
