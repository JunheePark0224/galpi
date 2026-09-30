import type { AxisKey, DrawPick, Entry, Tag, Way } from "../recommend/types";

export type OneLinerStyle = "summary" | "question";

interface CatalogBase {
  isbn: string;
  title: string;
  genre: string;
  pages: number;
  keywords: string[];
  one_liner: string;
  one_liner_style: OneLinerStyle;
}

/** Roadmap 3-3 books columns (minus slot) + title. Our own tags only — no YES24 text. */
export type CatalogBook =
  | (CatalogBase & { entry: "leaf"; field: null; topic: null; way: null; axes: Record<AxisKey, Tag> })
  | (CatalogBase & { entry: "target"; field: string; topic: string; way: Way; axes: null });

/** What the browser gets for one bookmark: no scores, no tags beyond the name tag. */
export interface BookCard {
  id: string;
  entry: Entry;
  title: string;
  genre: string;
  field: string | null;
  oneLiner: string;
  oneLinerStyle: OneLinerStyle;
}

export interface CardPick { card: BookCard; kind: DrawPick["kind"] }

/**
 * POST /api/books/draw response.
 * keywords: the requested 🎯 keywords that some book in the topic really has (the rest were dropped before scoring).
 * found: 🎯 books behind the coverage notice (keyword matches, or the whole topic when no keyword was asked); null for 🍃.
 */
export interface DrawResponse {
  picks: CardPick[];
  exhausted: boolean;
  widened: boolean;
  found: number | null;
  keywords: string[];
}

export interface VocabTopic { keywords: Record<string, string>; terms: string[] }
export type Vocab = Record<string, VocabTopic>;
