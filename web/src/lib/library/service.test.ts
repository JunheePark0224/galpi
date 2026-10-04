import { describe, expect, it } from "vitest";
import type { BookCard } from "@/lib/books/types";
import { memoryStore } from "./__fixtures__/memoryStore";
import { addShelf, FIRST_SHELF_NAME, libraryView, MAX_SAVES, MAX_SHELVES, moveBookmark, removeBookmark, removeShelf, renameShelf, saveBookmark } from "./service";
import type { SaveRow } from "./types";

const ART = { animal: "fox", bg: "night", sky: "moon", ground: "books", rare: false } as const;
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

  it("drags a bookmark to a place on a rod: inserted there, the rod numbered 0..n-1, only changed rows written", async () => {
    const isbns = (view: Awaited<ReturnType<typeof libraryView>>) => view.shelves.map((s) => s.bookmarks.map((b) => b.isbn.slice(-1)));
    const store = memoryStore({
      shelves: [{ id: "a", name: "첫", position: 0 }, { id: "b", name: "둘", position: 1 }],
      saves: [
        { ...input("9790000000001"), shelfId: "a", position: -2 }, { ...input("9790000000002"), shelfId: "a", position: -1 },
        { ...input("9790000000003"), shelfId: "a", position: 0 }, { ...input("9790000000004"), shelfId: "b", position: 0 },
      ],
    });
    const writes: string[] = [];
    const update = store.updateSave;
    store.updateSave = (isbn, change) => { writes.push(isbn.slice(-1)); return update(isbn, change); };

    expect(await moveBookmark(store, "9790000000001", "a", 2)).toEqual({ ok: true });       // same rod, to the end
    expect(isbns(await libraryView(store, card))).toEqual([["2", "3", "1"], ["4"]]);
    expect(store.data.saves.filter((s) => s.shelfId === "a").map((s) => s.position).sort()).toEqual([0, 1, 2]);
    writes.length = 0;
    expect(await moveBookmark(store, "9790000000003", "b", 1)).toEqual({ ok: true });       // another rod, after its one
    expect(isbns(await libraryView(store, card))).toEqual([["2", "1"], ["4", "3"]]);
    expect(writes).toEqual(["3"]);                                                          // "4" kept its place 0
    expect(await moveBookmark(store, "9790000000002", "b", 99)).toEqual({ ok: true });      // clamped to the end
    expect(isbns(await libraryView(store, card))[1]).toEqual(["4", "3", "2"]);
    writes.length = 0;
    expect(await moveBookmark(store, "9790000000002", "b", 2)).toEqual({ ok: true });       // its own place: nothing written
    expect(writes).toEqual([]);
    expect(await moveBookmark(store, "9790000000009", "b", 0)).toEqual({ ok: false, error: "missing" });
    expect(await moveBookmark(store, "9790000000002", "zz", 0)).toEqual({ ok: false, error: "missing" });
  });

  it("reports a drag whose bookmark went away while it was written as missing", async () => {
    const store = memoryStore({ shelves: [{ id: "a", name: "첫", position: 0 }], saves: [{ ...input("9790000000001"), shelfId: "a", position: 5 }] });
    store.updateSave = async () => false;
    expect(await moveBookmark(store, "9790000000001", "a", 0)).toEqual({ ok: false, error: "missing" });
  });

  it("removes a bookmark", async () => {
    const store = memoryStore({ shelves: [{ id: "a", name: "첫", position: 0 }], saves: [{ ...input("9790000000001"), shelfId: "a", position: 0 }] });
    expect(await removeBookmark(store, "9790000000001")).toEqual({ ok: true });
    expect(await removeBookmark(store, "9790000000001")).toEqual({ ok: false, error: "missing" });
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
