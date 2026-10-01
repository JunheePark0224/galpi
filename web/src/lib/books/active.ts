import { TOPICS, type Topic } from "./taxonomy";
import type { CatalogBook, Vocab } from "./types";

/**
 * D-A (context 10-01): a 🎯 topic is active — offered to 직접 쓰기 sorting (the Claude list and enum, word matching) and
 * shown as a chip — only once the catalogue holds this many of its books. Until then a note about it lands on the nearest
 * active topic with matched=false, like any note outside our list. Counted from books.json, so the daily pipeline turns a
 * topic on with the deploy that carries its tenth book.
 */
export const MIN_ACTIVE_TOPIC_BOOKS = 10;

/** Topics with at least `min` 🎯 books, in TOPICS order. */
export function activeTopics(books: readonly Pick<CatalogBook, "entry" | "topic">[], min = MIN_ACTIVE_TOPIC_BOOKS): Topic[] {
  const count = new Map<string, number>();
  for (const b of books) if (b.entry === "target" && b.topic) count.set(b.topic, (count.get(b.topic) ?? 0) + 1);
  return TOPICS.filter((t) => (count.get(t) ?? 0) >= min);
}

/** The vocabulary cut to these topics (TOPICS order) — what sorting and word matching may answer with. */
export function activeVocab(vocab: Vocab, topics: readonly Topic[]): Vocab {
  return Object.fromEntries(TOPICS.filter((t) => topics.includes(t) && Object.hasOwn(vocab, t)).map((t) => [t, vocab[t]]));
}

/** Our topics that a vocabulary covers, in TOPICS order. */
export function topicsIn(vocab: Vocab): Topic[] {
  return TOPICS.filter((t) => Object.hasOwn(vocab, t));
}
