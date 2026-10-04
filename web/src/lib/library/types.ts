import type { ArtCombo } from "@/lib/art/combine";
import type { BookCard } from "@/lib/books/types";
import type { Reason } from "@/lib/recommend";

/** C-17 rod. position 0 = the first rod (made with the first save, never removed), at most MAX_SHELVES. */
export interface Shelf { id: string; name: string; position: number }

/** One saves row (D-05) as the store returns it. position: order on the rod, smallest first. */
export interface SaveRow { isbn: string; art: ArtCombo; reason: Reason; metOn: string; shelfId: string; position: number }

/** What S-09 draws: the rod with its bookmarks, each with the card from our catalogue. */
export interface LibraryBookmark { isbn: string; art: ArtCombo; reason: Reason; metOn: string; card: BookCard }
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
  updateSave(isbn: string, change: { shelfId: string; position: number }): Promise<boolean>;
  /** null when that position is taken (two adds at once). */
  insertShelf(name: string, position: number): Promise<Shelf | null>;
  renameShelf(id: string, name: string): Promise<boolean>;
  deleteShelf(id: string): Promise<boolean>;
}
