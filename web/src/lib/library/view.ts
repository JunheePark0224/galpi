import type { ArtCombo } from "@/lib/art/combine";
import type { LibraryShelf, LibraryView } from "./types";

const counted = (shelves: LibraryShelf[]): LibraryView => {
  const all = shelves.flatMap((s) => s.bookmarks);
  return { shelves, count: all.length, animals: new Set(all.map((b) => b.art.animal)).size };
};

/**
 * S-09 moves at once (user, 10-02): the rods as the server will order them (service.moveBookmark) — at `index` of the
 * rod's other bookmarks (a drag, 10-04 — the same rod too), or in front of another rod — drawn before the server answers.
 * Same view back when nothing would change.
 */
export function moveLocally(view: LibraryView, isbn: string, shelfId: string, index?: number): LibraryView {
  const from = view.shelves.find((s) => s.bookmarks.some((b) => b.isbn === isbn));
  const to = view.shelves.find((s) => s.id === shelfId);
  if (!from || !to || (from.id === to.id && index === undefined)) return view;
  const moving = from.bookmarks.find((b) => b.isbn === isbn);
  if (!moving) return view;
  const others = to.bookmarks.filter((b) => b.isbn !== isbn);
  const at = Math.min(Math.max(index ?? 0, 0), others.length);
  const placed = [...others.slice(0, at), moving, ...others.slice(at)];
  if (from.id === to.id && placed.every((b, i) => b === to.bookmarks[i])) return view;
  return counted(view.shelves.map((s) => {
    if (s.id === to.id) return { ...s, bookmarks: placed };
    if (s.id === from.id) return { ...s, bookmarks: s.bookmarks.filter((b) => b.isbn !== isbn) };
    return s;
  }));
}

/** [빼기] at once: the bookmark gone, counts again. */
export function removeLocally(view: LibraryView, isbn: string): LibraryView {
  if (!view.shelves.some((s) => s.bookmarks.some((b) => b.isbn === isbn))) return view;
  return counted(view.shelves.map((s) => ({ ...s, bookmarks: s.bookmarks.filter((b) => b.isbn !== isbn) })));
}

/** 꾸미기 at once: the bookmark's new picture on its rod (and in the open sheet), counts again (동물 M종 may change). */
export function artLocally(view: LibraryView, isbn: string, art: ArtCombo): LibraryView {
  if (!view.shelves.some((s) => s.bookmarks.some((b) => b.isbn === isbn))) return view;
  return counted(view.shelves.map((s) => ({ ...s, bookmarks: s.bookmarks.map((b) => (b.isbn === isbn ? { ...b, art } : b)) })));
}
