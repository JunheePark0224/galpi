import { LEAF_GENRES, TOPICS } from "../books/taxonomy";
import type { Vocabulary } from "./validate";

/**
 * Every genre a path may name: the 12 🍃 genres and the 🎯 topics (a 🎯 book's genre is its topic). The design assumes all of
 * them exist, so the map is checked against this list, not against the genres books.json happens to have yet — a genre
 * with no books is a path end with 0 books (coverage shows it; drawForPath widens).
 */
export const MAP_GENRES: readonly string[] = [...LEAF_GENRES, ...TOPICS];

/** The vocabulary the map is checked against (build script and data test share it): vocab.json keywords + MAP_GENRES. */
export function mapVocabulary(vocab: Record<string, { keywords: Record<string, string> }>): Vocabulary {
  return {
    topics: Object.fromEntries(Object.entries(vocab).map(([t, v]) => [t, Object.keys(v.keywords)])),
    genres: [...MAP_GENRES],
  };
}
