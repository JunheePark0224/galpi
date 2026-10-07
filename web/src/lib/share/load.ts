import type { ArtCombo } from "@/lib/art/combine";
import { catalog, toBook, toCard } from "@/lib/books/catalog";
import type { BookCard } from "@/lib/books/types";
import { QUESTION_MAP } from "@/lib/paths";
import { decodeShare } from "./code";
import { shareLabel, type ShareLabel } from "./label";

/** What a shared 뒤표지 (S-12 page, its link preview, its story image) draws — our tags stay on the server. */
export interface SharedView { code: string; cards: BookCard[]; arts: ArtCombo[]; label: ShareLabel }

/** A share code → the cards, pictures and "내가 고른 길" label, worked out again on the server; null if it does not read. */
export function loadShare(code: string): SharedView | null {
  const books = catalog();
  const byId = new Map(books.map((b) => [b.isbn, b]));
  const shared = decodeShare(QUESTION_MAP, code, (isbn) => byId.has(isbn));
  if (!shared) return null;
  const picked = shared.books.map((isbn) => byId.get(isbn)!);
  return {
    code,
    cards: picked.map(toCard),
    arts: shared.arts,
    label: shareLabel(QUESTION_MAP, shared.answers, picked.map(toBook)),
  };
}
