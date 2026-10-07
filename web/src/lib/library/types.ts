import type { ArtCombo } from "@/lib/art/combine";
import type { BookCard } from "@/lib/books/types";
import type { Reason } from "@/lib/recommend";

/** C-17 rod. position 0 = the first rod (made with the first save, never removed), at most MAX_SHELVES. */
export interface Shelf { id: string; name: string; position: number }

/**
 * One saves row (D-05) as the store returns it. position: order on the rod, smallest first. `art` is the picture shown
 * now (꾸미기 may change it); `originalArt` the one it was kept with (0005 — the database fills it, never the app). null
 * or absent: not known (0005 not applied yet) — 꾸미기 stays off.
 */
export interface SaveRow {
  isbn: string; art: ArtCombo; reason: Reason; metOn: string; shelfId: string; position: number; originalArt?: ArtCombo | null;
}

/** What S-09 draws: the rod with its bookmarks, each with the card from our catalogue. */
/** `originalArt`: the picture it was kept with — null / absent while unknown (0005 not applied, or an older server). */
export interface LibraryBookmark { isbn: string; art: ArtCombo; originalArt?: ArtCombo | null; reason: Reason; metOn: string; card: BookCard }
export interface LibraryShelf extends Shelf { bookmarks: LibraryBookmark[] }
export interface LibraryView { shelves: LibraryShelf[]; count: number; animals: number }

/**
 * The person's rows, through whatever holds them (Supabase with their session in production — RLS keeps it to them;
 * memory in tests). Methods act for that one person only.
 */
export interface LibraryStore {
  shelves(): Promise<Shelf[]>;
  saves(): Promise<SaveRow[]>;
  /** The rod at position 0, made with this name if missing (two first saves at once both end with the same rod). */
  firstShelf(name: string): Promise<Shelf>;
  /** false when this book is already saved (one bookmark per book). */
  insertSave(row: SaveRow): Promise<boolean>;
  deleteSave(isbn: string): Promise<boolean>;
  /** Every bookmark of this person (S-09 [모두 제거]); the rods stay. How many rows went. */
  deleteAllSaves(): Promise<number>;
  /** The bookmarks of one rod (S-09 [막대 지우기], 10-07); how many rows went. */
  deleteShelfSaves(shelfId: string): Promise<number>;
  updateSave(isbn: string, change: { shelfId: string; position: number }): Promise<boolean>;
  /** 꾸미기: the picture shown now (original_art never changes — 0005's trigger). false when this book is not saved. */
  updateArt(isbn: string, art: ArtCombo): Promise<boolean>;
  /** null when that position is taken (two adds at once). */
  insertShelf(name: string, position: number): Promise<Shelf | null>;
  renameShelf(id: string, name: string): Promise<boolean>;
  deleteShelf(id: string): Promise<boolean>;
}

/** The server cannot save bookmarks: no service-role key (0007 — people may no longer insert saves themselves). 503. */
export class LibraryWriteOff extends Error {
  constructor() {
    super("library saves are off");
    this.name = "LibraryWriteOff";
  }
}
