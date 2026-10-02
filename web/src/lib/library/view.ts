import type { LibraryShelf, LibraryView } from "./types";

const counted = (shelves: LibraryShelf[]): LibraryView => {
  const all = shelves.flatMap((s) => s.bookmarks);
  return { shelves, count: all.length, animals: new Set(all.map((b) => b.art.animal)).size };
};

/**
 * S-09 moves at once (user, 10-02): the rods as the server will order them — the bookmark in front of the other rod
 * (service.moveBookmark) — drawn before the server answers. Same view back when nothing would change.
 */
export function moveLocally(view: LibraryView, isbn: string, shelfId: string): LibraryView {
  const from = view.shelves.find((s) => s.bookmarks.some((b) => b.isbn === isbn));
  const to = view.shelves.find((s) => s.id === shelfId);
  if (!from || !to || from.id === to.id) return view;
  const moving = from.bookmarks.find((b) => b.isbn === isbn);
  if (!moving) return view;
  return counted(view.shelves.map((s) => {
    if (s.id === from.id) return { ...s, bookmarks: s.bookmarks.filter((b) => b.isbn !== isbn) };
    if (s.id === to.id) return { ...s, bookmarks: [moving, ...s.bookmarks] };
    return s;
  }));
}

/** [빼기] at once: the bookmark gone, counts again. */
export function removeLocally(view: LibraryView, isbn: string): LibraryView {
  if (!view.shelves.some((s) => s.bookmarks.some((b) => b.isbn === isbn))) return view;
  return counted(view.shelves.map((s) => ({ ...s, bookmarks: s.bookmarks.filter((b) => b.isbn !== isbn) })));
}
