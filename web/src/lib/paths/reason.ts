import { reasonLine, type Book, type Reason } from "@/lib/recommend";
import type { Walked } from "./walk";

/**
 * "나온 이유" for a book drawn on a path — the same reasonLine as v1, fed from the path: 🍃 by the mood axes and length,
 * 🎯 by the scope's topic (the book's own when no topic or the book is in it) and keywords, the mood's way and length.
 * Pass the walk after applyChallenge, so a challenge book is explained by the far scope it came from.
 */
export function pathReason(book: Book, w: Pick<Walked, "scope" | "mood">): Reason {
  if (book.entry === "leaf") return reasonLine(book, { ...w.mood.axes, len: w.mood.len });
  const topics = w.scope.topics;
  const topic = topics === null || topics.includes(book.topic) ? book.topic : topics[0];
  return reasonLine(book, { topic, way: w.mood.way, len: w.mood.len, keywords: w.scope.keywords ?? [] });
}
