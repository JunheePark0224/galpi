import { describe, expect, it } from "vitest";
import type { BookCard } from "@/lib/books/types";
import { memoryStore } from "./__fixtures__/memoryStore";
import { addShelf, FIRST_SHELF_NAME, libraryView, MAX_SAVES, MAX_SHELVES, moveBookmark, POSITION_STEP, removeAllBookmarks, removeBookmark, removeShelf, removeShelfWithBookmarks, renameShelf, saveBookmark } from "./service";
import type { SaveRow } from "./types";

const ART = { animal: "fox", bg: "night", ground: "books", rare: false } as const;
const input = (isbn: string) => ({ isbn, art: { ...ART }, reason: { label: "나온 이유" as const, items: ["데이터 분석"] }, metOn: "2026-10-01" });
const card = (isbn: string): BookCard => ({ id: isbn, entry: "target", title: `책 ${isbn}`, author: "가", genre: "데이터 분석", field: "데이터·통계", oneLiner: "한 줄", oneLinerStyle: "summary" });

describe("saveBookmark (F-12 꽂기)", () => {
  it("makes the first rod with the first save and puts each new bookmark in front", async () => {
    const store = memoryStore();
    expect(await saveBookmark(store, input("9790000000001"))).toEqual({ ok: true, shelfId: "shelf-0", saved: true });
    await saveBookmark(store, input("9790000000002"));
    expect(store.data.shelves).toEqual([{ id: "shelf-0", name: FIRST_SHELF_NAME, position: 0 }]);
    const view = await libraryView(store, card);
    expect(view.shelves[0].bookmarks.map((b) => b.isbn)).toEqual(["9790000000002", "9790000000001"]);
  });

  it("treats saving the same book again as done (one bookmark per book — the auto-save after login may repeat)", async () => {
    const store = memoryStore();
    await saveBookmark(store, input("9790000000001"));
    expect(await saveBookmark(store, input("9790000000001"))).toEqual({ ok: true, shelfId: "shelf-0", saved: false });
    expect(store.data.saves).toHaveLength(1);
  });

  it("stops at the limit", async () => {
    const saves: SaveRow[] = Array.from({ length: MAX_SAVES }, (_, i) => ({ ...input(String(9790000000000 + i)), shelfId: "s0", position: i }));
    const store = memoryStore({ shelves: [{ id: "s0", name: "a", position: 0 }], saves });
    expect(await saveBookmark(store, input("9799999999999"))).toEqual({ ok: false, error: "full" });
  });
});

describe("rods (C-17)", () => {
  it("adds rods at the first free place up to five, with a cleaned name", async () => {
    const store = memoryStore({ shelves: [{ id: "a", name: "첫", position: 0 }, { id: "b", name: "둘", position: 2 }] });
    expect(await addShelf(store, "  밤에   읽기 ")).toEqual({ ok: true, shelf: { id: "shelf-2", name: "밤에 읽기", position: 1 } });
    await addShelf(store, "넷");
    await addShelf(store, "다섯");
    expect(MAX_SHELVES).toBe(5);
    expect(await addShelf(store, "여섯")).toEqual({ ok: false, error: "full" });
    expect(await addShelf(store, "   ")).toEqual({ ok: false, error: "invalid" });
  });

  it("makes the first rod for someone adding a rod before any save", async () => {
    const store = memoryStore();
    expect(await addShelf(store, "둘째")).toEqual({ ok: true, shelf: { id: "shelf-1", name: "둘째", position: 1 } });
    expect(store.data.shelves.map((s) => s.position)).toEqual([0, 1]);
  });

  it("reports a place taken by another add at the same moment as full", async () => {
    const store = memoryStore({ shelves: [{ id: "a", name: "첫", position: 0 }] });
    store.insertShelf = async () => null;
    expect(await addShelf(store, "둘")).toEqual({ ok: false, error: "full" });
  });

  it("renames with the same cleaning, and only rods that exist", async () => {
    const store = memoryStore({ shelves: [{ id: "a", name: "첫", position: 0 }] });
    expect(await renameShelf(store, "a", "읽을 책")).toEqual({ ok: true });
    expect(store.data.shelves[0].name).toBe("읽을 책");
    expect(await renameShelf(store, "a", "가".repeat(13))).toEqual({ ok: false, error: "invalid" });
    expect(await renameShelf(store, "zz", "x")).toEqual({ ok: false, error: "missing" });
  });

  it("removes only empty rods, never the first", async () => {
    const store = memoryStore({
      shelves: [{ id: "a", name: "첫", position: 0 }, { id: "b", name: "둘", position: 1 }, { id: "c", name: "셋", position: 2 }],
      saves: [{ ...input("9790000000001"), shelfId: "b", position: 0 }],
    });
    expect(await removeShelf(store, "a")).toEqual({ ok: false, error: "first" });
    expect(await removeShelf(store, "b")).toEqual({ ok: false, error: "not_empty" });
    expect(await removeShelf(store, "c")).toEqual({ ok: true });
    expect(await removeShelf(store, "zz")).toEqual({ ok: false, error: "missing" });
  });

  it("[막대 지우기] (10-07): a rod with its bookmarks — counted, the other rods untouched — never the first", async () => {
    const store = memoryStore({
      shelves: [{ id: "a", name: "첫", position: 0 }, { id: "b", name: "둘", position: 1 }, { id: "c", name: "셋", position: 2 }],
      saves: [
        { ...input("9790000000001"), shelfId: "a", position: 0 },
        { ...input("9790000000002"), shelfId: "b", position: 0 },
        { ...input("9790000000003"), shelfId: "b", position: 1 },
      ],
    });
    expect(await removeShelfWithBookmarks(store, "a")).toEqual({ ok: false, error: "first" });
    expect(await removeShelfWithBookmarks(store, "zz")).toEqual({ ok: false, error: "missing" });
    expect(store.data.saves).toHaveLength(3);
    expect(await removeShelfWithBookmarks(store, "b")).toEqual({ ok: true, removed: 2 });
    expect(store.data.shelves.map((s) => s.id)).toEqual(["a", "c"]);
    expect(store.data.saves.map((s) => s.isbn)).toEqual(["9790000000001"]);
    expect(await removeShelfWithBookmarks(store, "c")).toEqual({ ok: true, removed: 0 });
    expect(store.data.shelves.map((s) => s.id)).toEqual(["a"]);
  });
});

describe("moving and removing bookmarks", () => {
  it("moves a bookmark to the front of another of the person's rods", async () => {
    const store = memoryStore({
      shelves: [{ id: "a", name: "첫", position: 0 }, { id: "b", name: "둘", position: 1 }],
      saves: [{ ...input("9790000000001"), shelfId: "a", position: 0 }, { ...input("9790000000002"), shelfId: "b", position: 3 }],
    });
    expect(await moveBookmark(store, "9790000000001", "b")).toEqual({ ok: true });
    const view = await libraryView(store, card);
    expect(view.shelves[1].bookmarks.map((b) => b.isbn)).toEqual(["9790000000001", "9790000000002"]);
    expect(await moveBookmark(store, "9790000000001", "zz")).toEqual({ ok: false, error: "missing" });
    expect(await moveBookmark(store, "9790000000009", "a")).toEqual({ ok: false, error: "missing" });
  });

  describe("drag to a place (index, 10-04)", () => {
    const isbn = (n: number) => `97900000000${String(n).padStart(2, "0")}`;
    /** Rod "a" with these positions (books 1, 2, …), book 50 on rod "b", rod "c" empty; writes are recorded. */
    const rods = (positions: number[]) => {
      const store = memoryStore({
        shelves: [{ id: "a", name: "첫", position: 0 }, { id: "b", name: "둘", position: 1 }, { id: "c", name: "셋", position: 2 }],
        saves: [...positions.map((position, i) => ({ ...input(isbn(i + 1)), shelfId: "a", position })), { ...input(isbn(50)), shelfId: "b", position: 0 }],
      });
      const writes: { isbn: string; position: number }[] = [];
      let open = 0;
      let most = 0;
      const update = store.updateSave;
      store.updateSave = async (id, change) => {
        writes.push({ isbn: id, position: change.position });
        most = Math.max(most, ++open);
        await new Promise((r) => setTimeout(r, 0));
        open--;
        return update(id, change);
      };
      const order = async (shelf = "a") => (await libraryView(store, card)).shelves.find((s) => s.id === shelf)!.bookmarks.map((b) => Number(b.isbn.slice(-2)));
      return { store, writes, order, most: () => most };
    };

    it("between two neighbours: one row, at the midpoint", async () => {
      const r = rods([0, 10]);
      expect(await moveBookmark(r.store, isbn(50), "a", 1)).toEqual({ ok: true });
      expect(r.writes).toEqual([{ isbn: isbn(50), position: 5 }]);
      expect(await r.order()).toEqual([1, 50, 2]);
    });

    it("at the front: one before the first; at the end: one after the last; an empty rod: 0", async () => {
      const r = rods([3, 10]);
      await moveBookmark(r.store, isbn(50), "a", 0);
      expect(r.writes).toEqual([{ isbn: isbn(50), position: 2 }]);
      await moveBookmark(r.store, isbn(1), "a", 9);                       // clamped to the end, its own rod
      expect(r.writes.at(-1)).toEqual({ isbn: isbn(1), position: 11 });
      expect(await r.order()).toEqual([50, 2, 1]);
      await moveBookmark(r.store, isbn(2), "c", 0);
      expect(r.writes.at(-1)).toEqual({ isbn: isbn(2), position: 0 });
      expect(r.writes).toHaveLength(3);
    });

    it("no whole number left between the neighbours: the rod is spaced 1024 apart, only changed rows written", async () => {
      const r = rods([0, 1, 2]);
      expect(await moveBookmark(r.store, isbn(50), "a", 1)).toEqual({ ok: true });
      expect(await r.order()).toEqual([1, 50, 2, 3]);
      expect(r.writes).toEqual([                                          // book 1 kept its 0
        { isbn: isbn(50), position: 1024 }, { isbn: isbn(2), position: 2048 }, { isbn: isbn(3), position: 3072 },
      ]);
      expect(POSITION_STEP).toBe(1024);
    });

    it("renumbers a long rod a few writes at a time", async () => {
      const r = rods(Array.from({ length: 30 }, (_, i) => i));
      expect(await moveBookmark(r.store, isbn(50), "a", 15)).toEqual({ ok: true });
      expect(r.writes).toHaveLength(30);
      expect(r.most()).toBeLessThanOrEqual(10);
      expect((await r.order()).slice(14, 17)).toEqual([15, 50, 16]);
    });

    it("counts only the bookmarks S-09 draws: a book that left the catalogue keeps its place and is not a neighbour", async () => {
      const r = rods([0, 1, 4]);                                          // book 2 (position 1) is no longer in the catalogue
      const shown = (id: string) => id !== isbn(2);
      expect(await moveBookmark(r.store, isbn(50), "a", 1, shown)).toEqual({ ok: true });
      expect(r.writes).toEqual([{ isbn: isbn(50), position: 2 }]);       // between books 1 (0) and 3 (4)
      expect((await r.order()).filter((n) => n !== 2)).toEqual([1, 50, 3]);
      expect(await moveBookmark(r.store, isbn(3), "a", 2, shown)).toEqual({ ok: true });   // drawn [1, 50, 3]: already there
      expect(r.writes).toHaveLength(1);
    });

    it("writes nothing for its own place, and reports a missing bookmark or rod", async () => {
      const r = rods([0, 5]);
      expect(await moveBookmark(r.store, isbn(2), "a", 1)).toEqual({ ok: true });
      expect(r.writes).toEqual([]);
      expect(await moveBookmark(r.store, isbn(9), "a", 0)).toEqual({ ok: false, error: "missing" });
      expect(await moveBookmark(r.store, isbn(1), "zz", 0)).toEqual({ ok: false, error: "missing" });
    });
  });

  it("reports a drag whose bookmark went away while it was written as missing", async () => {
    const store = memoryStore({
      shelves: [{ id: "a", name: "첫", position: 0 }, { id: "b", name: "둘", position: 1 }],
      saves: [{ ...input("9790000000001"), shelfId: "a", position: 5 }],
    });
    store.updateSave = async () => false;
    expect(await moveBookmark(store, "9790000000001", "b", 0)).toEqual({ ok: false, error: "missing" });
  });

  it("removes a bookmark", async () => {
    const store = memoryStore({ shelves: [{ id: "a", name: "첫", position: 0 }], saves: [{ ...input("9790000000001"), shelfId: "a", position: 0 }] });
    expect(await removeBookmark(store, "9790000000001")).toEqual({ ok: true });
    expect(await removeBookmark(store, "9790000000001")).toEqual({ ok: false, error: "missing" });
  });
});

describe("removeAllBookmarks (S-09 [모두 제거])", () => {
  it("takes every bookmark — also books no longer drawn — keeps the rods and their names, and counts what went", async () => {
    const shelves = [{ id: "a", name: "첫", position: 0 }, { id: "b", name: "둘", position: 1 }];
    const store = memoryStore({
      shelves,
      saves: [
        { ...input("9790000000001"), shelfId: "a", position: 0 },
        { ...input("9790000000002"), shelfId: "b", position: 0 },
        { ...input("9790000000003"), shelfId: "b", position: 1 },
      ],
    });
    expect(await removeAllBookmarks(store)).toEqual({ ok: true, removed: 3 });
    expect(store.data.saves).toEqual([]);
    expect(store.data.shelves).toEqual(shelves);
    const view = await libraryView(store, card);
    expect(view).toMatchObject({ count: 0, animals: 0 });
    expect(view.shelves.map((s) => [s.name, s.bookmarks.length])).toEqual([["첫", 0], ["둘", 0]]);
    expect(await removeAllBookmarks(store)).toEqual({ ok: true, removed: 0 });
  });
});

describe("libraryView (S-09)", () => {
  it("counts bookmarks and animal kinds, and leaves out books no longer in the catalogue", async () => {
    const store = memoryStore({
      shelves: [{ id: "a", name: "첫", position: 0 }, { id: "b", name: "둘", position: 1 }],
      saves: [
        { ...input("9790000000001"), shelfId: "a", position: 0 },
        { ...input("9790000000002"), art: { ...ART, animal: "owl" }, shelfId: "b", position: 0 },
        { ...input("9790000000003"), shelfId: "b", position: 1 },
      ],
    });
    const view = await libraryView(store, (isbn) => (isbn === "9790000000003" ? null : card(isbn)));
    expect(view.count).toBe(2);
    expect(view.animals).toBe(2);
    expect(view.shelves.map((s) => [s.name, s.bookmarks.length])).toEqual([["첫", 1], ["둘", 1]]);
  });

  it("is empty for someone with nothing saved", async () => {
    expect(await libraryView(memoryStore(), card)).toEqual({ shelves: [], count: 0, animals: 0 });
  });
});
