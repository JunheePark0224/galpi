import { describe, expect, it } from "vitest";
import type { BookCard } from "@/lib/books/types";
import { EMPTY_MAKER_VIEW, parseMakerView, toMakerView } from "./makerView";
import type { Reason } from "@/lib/recommend";
import type { LibraryView } from "./types";

const card = (id: string): BookCard =>
  ({ id, entry: "leaf", title: `책 ${id}`, author: "저자", genre: "사회·시사", field: null, oneLiner: "한 줄", oneLinerStyle: "question" });
const ART = { animal: "rabbit", bg: "aurora", ground: "grass", rare: true } as const;
const REASON: Reason = { label: "이 책은", items: ["따뜻함"] };

const view: LibraryView = {
  shelves: [
    { id: "shelf-a", name: "첫 막대", position: 0, bookmarks: [
      { isbn: "9788936477196", art: ART, originalArt: ART, reason: REASON, metOn: "2026-10-17", card: card("9788936477196") },
      { isbn: "9788998441012", art: { ...ART, bg: "peach", rare: false }, originalArt: null, reason: REASON, metOn: "2026-10-12", card: card("9788998441012") },
    ] },
    { id: "shelf-b", name: "빈 막대", position: 1, bookmarks: [] },
  ],
  count: 2,
  animals: 1,
};

describe("toMakerView (F-30): the maker's shelf as the public sees it", () => {
  it("keeps each rod's name and order, and each bookmark's picture, met date and card", () => {
    expect(toMakerView(view)).toEqual({
      shelves: [{ name: "첫 막대", bookmarks: [
        { art: ART, metOn: "2026-10-17", card: card("9788936477196") },
        { art: { ...ART, bg: "peach", rare: false }, metOn: "2026-10-12", card: card("9788998441012") },
      ] }],
      count: 2,
    });
  });

  it("sends no account, rod id, reason or first picture — only what the sheet draws", () => {
    const json = JSON.stringify(toMakerView(view));
    for (const hidden of ["shelf-a", "shelf-b", "reason", "originalArt", "이 책은", "position", "animals"]) {
      expect(json).not.toContain(hidden);
    }
  });

  it("leaves out empty rods, and an empty shelf is the empty view", () => {
    expect(toMakerView(view).shelves.map((s) => s.name)).toEqual(["첫 막대"]);
    expect(toMakerView({ shelves: [{ id: "x", name: "빈", position: 0, bookmarks: [] }], count: 0, animals: 0 })).toEqual(EMPTY_MAKER_VIEW);
  });

  it("copies, never shares, the library view's objects", () => {
    const out = toMakerView(view);
    expect(out.shelves[0].bookmarks[0].art).not.toBe(view.shelves[0].bookmarks[0].art);
  });
});

describe("parseMakerView: the browser trusts only a shelf-shaped answer", () => {
  it("accepts the server's view", () => {
    const out = toMakerView(view);
    expect(parseMakerView(JSON.parse(JSON.stringify(out)))).toEqual(out);
  });

  it("refuses anything else", () => {
    for (const bad of [null, "x", { shelves: "nope" }, { shelves: [{ name: 1, bookmarks: [] }] },
      { shelves: [{ name: "a", bookmarks: [{ art: null, metOn: "2026-10-17", card: card("1") }] }] },
      { shelves: [{ name: "a", bookmarks: [{ art: ART, metOn: 5, card: card("1") }] }] },
      { shelves: [{ name: "a", bookmarks: [{ art: { animal: "cat" }, metOn: "2026-10-17", card: card("1") }] }] },
      { shelves: [{ name: "a", bookmarks: [{ art: ART, metOn: "2026-10-17", card: { id: "1", title: "no author" } }] }] },
      { shelves: [{ name: "a", bookmarks: [{ art: ART, metOn: "2026-10-17", card: { title: "no id" } }] }] }]) {
      expect(parseMakerView(bad)).toBeNull();
    }
  });
});
