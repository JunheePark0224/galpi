import { describe, expect, it } from "vitest";
import type { LibraryView } from "./types";
import { moveLocally, removeLocally } from "./view";

const ART = { animal: "fox", bg: "night", sky: "moon", ground: "books", rare: false } as const;
const bm = (isbn: string, animal: "fox" | "owl" = "fox") => ({
  isbn, art: { ...ART, animal }, reason: { label: "이 책은" as const, items: [] }, metOn: "2026-10-01",
  card: { id: isbn, entry: "leaf" as const, title: isbn, author: "가", genre: "에세이", field: null, oneLiner: "?", oneLinerStyle: "question" as const },
});
const VIEW: LibraryView = {
  count: 3, animals: 2,
  shelves: [
    { id: "a", name: "첫", position: 0, bookmarks: [bm("1"), bm("2", "owl")] },
    { id: "b", name: "둘", position: 1, bookmarks: [bm("3")] },
  ],
};

describe("moveLocally — the rods as they will be, before the server answers", () => {
  it("takes the bookmark off its rod and hangs it in front of the other", () => {
    const next = moveLocally(VIEW, "1", "b");
    expect(next.shelves.map((s) => s.bookmarks.map((b) => b.isbn))).toEqual([["2"], ["1", "3"]]);
    expect(next.count).toBe(3);
    expect(VIEW.shelves[0].bookmarks.map((b) => b.isbn)).toEqual(["1", "2"]);     // the old view is untouched
  });

  it("changes nothing for an unknown bookmark or rod, or the same rod", () => {
    expect(moveLocally(VIEW, "9", "b")).toBe(VIEW);
    expect(moveLocally(VIEW, "1", "zz")).toBe(VIEW);
    expect(moveLocally(VIEW, "1", "a")).toBe(VIEW);
  });
});

describe("removeLocally", () => {
  it("takes the bookmark out and counts again", () => {
    const next = removeLocally(VIEW, "2");
    expect(next.shelves[0].bookmarks.map((b) => b.isbn)).toEqual(["1"]);
    expect(next).toMatchObject({ count: 2, animals: 1 });
    expect(removeLocally(VIEW, "9")).toBe(VIEW);
  });
});
