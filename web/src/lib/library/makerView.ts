import type { ArtCombo } from "@/lib/art/combine";
import type { BookCard } from "@/lib/books/types";
import type { LibraryView } from "./types";

/** S-13 (PRD F-30): one bookmark of the maker's shelf as anyone may see it — picture, 만난 날, our card. */
export interface MakerBookmark { art: ArtCombo; metOn: string; card: BookCard }
export interface MakerShelf { name: string; bookmarks: MakerBookmark[] }
export interface MakerView { shelves: MakerShelf[]; count: number }

export const EMPTY_MAKER_VIEW: MakerView = { shelves: [], count: 0 };

/**
 * The maker's library view cut down to what the sheet draws. No account, rod id, 나온 이유 or first picture leaves the
 * server; empty rods are left out (nothing to look at). Order is the maker's own.
 */
export function toMakerView(view: LibraryView): MakerView {
  const shelves = view.shelves
    .filter((shelf) => shelf.bookmarks.length > 0)
    .map((shelf) => ({
      name: shelf.name,
      bookmarks: shelf.bookmarks.map((b) => ({ art: { ...b.art }, metOn: b.metOn, card: { ...b.card } })),
    }));
  return { shelves, count: shelves.reduce((n, s) => n + s.bookmarks.length, 0) };
}

const isRecord = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null && !Array.isArray(v);
const strings = (r: Record<string, unknown>, keys: readonly string[]) => keys.every((k) => typeof r[k] === "string");
const isBookmark = (v: unknown): v is MakerBookmark =>
  isRecord(v) && isRecord(v.art) && strings(v.art, ["animal", "bg", "ground"]) && typeof v.metOn === "string"
  && isRecord(v.card) && strings(v.card, ["id", "title", "author", "oneLiner", "genre"]);
const isShelf = (v: unknown): v is MakerShelf =>
  isRecord(v) && typeof v.name === "string" && Array.isArray(v.bookmarks) && v.bookmarks.every(isBookmark);

/** The browser's check of /api/maker-shelf's answer (a boundary): a shelf-shaped view, or null — the sheet says it could not load. */
export function parseMakerView(body: unknown): MakerView | null {
  if (!isRecord(body) || !Array.isArray(body.shelves) || !body.shelves.every(isShelf)) return null;
  const shelves = body.shelves as MakerShelf[];
  return { shelves, count: shelves.reduce((n, s) => n + s.bookmarks.length, 0) };
}
