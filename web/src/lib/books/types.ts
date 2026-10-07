import type { ArtTicket } from "@/lib/collection/types";
import type { PathSummary } from "../paths/summary";
import type { Challenge } from "../paths/types";
import type { Reason } from "../recommend/reason";
import type { AxisKey, AxisValue, DrawPick, Entry, Way } from "../recommend/types";

export type OneLinerStyle = "summary" | "question";

interface CatalogBase {
  isbn: string;
  title: string;
  author: string;
  genre: string;
  pages: number;
  keywords: string[];
  one_liner: string;
  one_liner_style: OneLinerStyle;
}

/** Roadmap 3-3 books columns (minus slot) + title and author. Our own tags only — no YES24 text. */
export type CatalogBook =
  | (CatalogBase & { entry: "leaf"; field: null; topic: null; way: null; axes: Record<AxisKey, AxisValue> })
  | (CatalogBase & { entry: "target"; field: string; topic: string; way: Way; axes: null });

/** What the browser gets for one bookmark: no scores, no tags beyond the name tag. */
export interface BookCard {
  id: string;
  entry: Entry;
  title: string;
  author: string;
  genre: string;
  field: string | null;
  oneLiner: string;
  oneLinerStyle: OneLinerStyle;
}

/** reason: S-06 "나온 이유" (PRD F-09) — worked out on the server, where the tags are; random picks get the same format. */
export interface CardPick { card: BookCard; kind: DrawPick["kind"]; reason: Reason }

/** POST /api/books/draw for a v2 path: the same cards, plus what S-04 "당신이 고른 길" shows. */
export interface PathDrawResponse {
  picks: CardPick[];
  exhausted: boolean;
  widened: boolean;
  path: PathSummary;
  /**
   * Challenge rules v2 (10-05): where a challenge draw moved from and to, by which far rule — null on the usual route. Its
   * `reason` (the rule's `why:` line) is shown under the S-04 challenge line (10-06).
   */
  challenge: Challenge | null;
  /** 도감 v1: the server's seed for this draw's pictures, signed (lib/collection/ticket). Absent from older answers. */
  art?: ArtTicket;
}

export interface VocabTopic { keywords: Record<string, string>; terms: string[] }
export type Vocab = Record<string, VocabTopic>;
