import type { ArtCombo } from "@/lib/art/combine";
import type { BookCard } from "@/lib/books/types";
import type { Reason } from "@/lib/recommend";
import type { LibraryStore, LibraryView, Shelf } from "./types";
import { cleanShelfName } from "./validate";

/** PRD F-13: at most five rods (DB: position 0..4). */
export const MAX_SHELVES = 5;
/** Bookmarks per person (the 0003 trigger holds the same line). */
export const MAX_SAVES = 500;
/** The first rod's name until the person renames it. */
export const FIRST_SHELF_NAME = "첫 막대";

export type LibraryError = "full" | "invalid" | "missing" | "first" | "not_empty";
type Result<T = object> = ({ ok: true } & T) | { ok: false; error: LibraryError };

/** In front of the rod: one less than the smallest position on it. */
async function frontOf(store: LibraryStore, shelfId: string): Promise<number> {
  const on = (await store.saves()).filter((s) => s.shelfId === shelfId).map((s) => s.position);
  return on.length ? Math.min(...on) - 1 : 0;
}

export interface SaveInput { isbn: string; art: ArtCombo; reason: Reason; metOn: string }

/** F-12 꽂기: on the first rod, in front. Saving a saved book again is fine (saved: false) — one bookmark per book. */
export async function saveBookmark(store: LibraryStore, input: SaveInput): Promise<Result<{ shelfId: string; saved: boolean }>> {
  const saves = await store.saves();
  const shelf = await store.firstShelf(FIRST_SHELF_NAME);
  if (saves.some((s) => s.isbn === input.isbn)) return { ok: true, shelfId: shelf.id, saved: false };
  if (saves.length >= MAX_SAVES) return { ok: false, error: "full" };
  const saved = await store.insertSave({ ...input, shelfId: shelf.id, position: await frontOf(store, shelf.id) });
  return { ok: true, shelfId: shelf.id, saved };
}

export async function removeBookmark(store: LibraryStore, isbn: string): Promise<Result> {
  return (await store.deleteSave(isbn)) ? { ok: true } : { ok: false, error: "missing" };
}

/**
 * F-13 옮기기 onto one of the person's own rods. Without `index` (the [다른 막대로 옮기기] menu): to the front. With it
 * (drag, 10-04): at that place in the rod's other bookmarks (clamped), and the rod is numbered 0..n-1 again — only the
 * rows whose rod or position changed are written.
 */
export async function moveBookmark(store: LibraryStore, isbn: string, shelfId: string, index?: number): Promise<Result> {
  if (!(await store.shelves()).some((s) => s.id === shelfId)) return { ok: false, error: "missing" };
  if (index === undefined) {
    const moved = await store.updateSave(isbn, { shelfId, position: await frontOf(store, shelfId) });
    return moved ? { ok: true } : { ok: false, error: "missing" };
  }
  const saves = await store.saves();
  const moving = saves.find((s) => s.isbn === isbn);
  if (!moving) return { ok: false, error: "missing" };
  const others = saves.filter((s) => s.shelfId === shelfId && s.isbn !== isbn);
  const at = Math.min(Math.max(index, 0), others.length);
  const order = [...others.slice(0, at), moving, ...others.slice(at)];
  const changed = order.flatMap((s, position) => (s.shelfId === shelfId && s.position === position ? [] : [{ isbn: s.isbn, position }]));
  const done = await Promise.all(changed.map((c) => store.updateSave(c.isbn, { shelfId, position: c.position })));
  const movedAt = changed.findIndex((c) => c.isbn === isbn);
  return movedAt === -1 || done[movedAt] ? { ok: true } : { ok: false, error: "missing" };
}

/** [＋ 막대 추가]: the first free place after the first rod (which it makes if missing). */
export async function addShelf(store: LibraryStore, rawName: unknown): Promise<Result<{ shelf: Shelf }>> {
  const name = cleanShelfName(rawName);
  if (!name) return { ok: false, error: "invalid" };
  await store.firstShelf(FIRST_SHELF_NAME);
  const taken = new Set((await store.shelves()).map((s) => s.position));
  const position = Array.from({ length: MAX_SHELVES - 1 }, (_, i) => i + 1).find((p) => !taken.has(p));
  if (position === undefined) return { ok: false, error: "full" };
  const shelf = await store.insertShelf(name, position);
  return shelf ? { ok: true, shelf } : { ok: false, error: "full" };
}

export async function renameShelf(store: LibraryStore, id: string, rawName: unknown): Promise<Result> {
  const name = cleanShelfName(rawName);
  if (!name) return { ok: false, error: "invalid" };
  return (await store.renameShelf(id, name)) ? { ok: true } : { ok: false, error: "missing" };
}

/** [막대 치우기]: only an empty rod, never the first. */
export async function removeShelf(store: LibraryStore, id: string): Promise<Result> {
  const shelf = (await store.shelves()).find((s) => s.id === id);
  if (!shelf) return { ok: false, error: "missing" };
  if (shelf.position === 0) return { ok: false, error: "first" };
  if ((await store.saves()).some((s) => s.shelfId === id)) return { ok: false, error: "not_empty" };
  return (await store.deleteShelf(id)) ? { ok: true } : { ok: false, error: "not_empty" };
}

/** S-09: rods in order with their bookmarks; a book that left the catalogue is not drawn (and not counted). */
export async function libraryView(store: LibraryStore, cardOf: (isbn: string) => BookCard | null): Promise<LibraryView> {
  const [shelves, saves] = await Promise.all([store.shelves(), store.saves()]);
  const view = shelves.map((shelf) => ({
    ...shelf,
    bookmarks: saves.filter((s) => s.shelfId === shelf.id).flatMap((s) => {
      const card = cardOf(s.isbn);
      return card ? [{ isbn: s.isbn, art: s.art, reason: s.reason, metOn: s.metOn, card }] : [];
    }),
  }));
  const all = view.flatMap((s) => s.bookmarks);
  return { shelves: view, count: all.length, animals: new Set(all.map((b) => b.art.animal)).size };
}
