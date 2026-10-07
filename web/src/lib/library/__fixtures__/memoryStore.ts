import type { LibraryStore, SaveRow, Shelf } from "../types";

/** In-memory LibraryStore for tests (and the E2E mock's shape): one person's rows, same rules as the database. */
export function memoryStore(init: { shelves?: Shelf[]; saves?: SaveRow[] } = {}): LibraryStore & { data: { shelves: Shelf[]; saves: SaveRow[] } } {
  const data = { shelves: [...(init.shelves ?? [])], saves: [...(init.saves ?? [])] };
  let next = data.shelves.length;
  const byPos = (a: { position: number }, b: { position: number }) => a.position - b.position;
  return {
    data,
    shelves: async () => [...data.shelves].sort(byPos),
    saves: async () => [...data.saves].sort(byPos),
    firstShelf: async (name) => {
      const found = data.shelves.find((s) => s.position === 0);
      if (found) return found;
      const shelf = { id: `shelf-${next++}`, name, position: 0 };
      data.shelves = [...data.shelves, shelf];
      return shelf;
    },
    insertSave: async (row) => {
      if (data.saves.some((s) => s.isbn === row.isbn)) return false;
      data.saves = [...data.saves, { ...row, originalArt: row.art }];   // 0005's trigger: the first picture is the kept one
      return true;
    },
    deleteSave: async (isbn) => {
      const before = data.saves.length;
      data.saves = data.saves.filter((s) => s.isbn !== isbn);
      return data.saves.length < before;
    },
    deleteAllSaves: async () => {
      const removed = data.saves.length;
      data.saves = [];
      return removed;
    },
    deleteShelfSaves: async (shelfId) => {
      const removed = data.saves.filter((s) => s.shelfId === shelfId).length;
      data.saves = data.saves.filter((s) => s.shelfId !== shelfId);
      return removed;
    },
    updateSave: async (isbn, change) => {
      if (!data.saves.some((s) => s.isbn === isbn)) return false;
      data.saves = data.saves.map((s) => (s.isbn === isbn ? { ...s, ...change } : s));
      return true;
    },
    updateArt: async (isbn, art) => {
      if (!data.saves.some((s) => s.isbn === isbn)) return false;
      data.saves = data.saves.map((s) => (s.isbn === isbn ? { ...s, art } : s));
      return true;
    },
    insertShelf: async (name, position) => {
      if (data.shelves.some((s) => s.position === position)) return null;
      const shelf = { id: `shelf-${next++}`, name, position };
      data.shelves = [...data.shelves, shelf];
      return shelf;
    },
    renameShelf: async (id, name) => {
      if (!data.shelves.some((s) => s.id === id)) return false;
      data.shelves = data.shelves.map((s) => (s.id === id ? { ...s, name } : s));
      return true;
    },
    deleteShelf: async (id) => {
      const shelf = data.shelves.find((s) => s.id === id);
      if (!shelf || shelf.position === 0 || data.saves.some((s) => s.shelfId === id)) return false;
      data.shelves = data.shelves.filter((s) => s.id !== id);
      return true;
    },
  };
}
