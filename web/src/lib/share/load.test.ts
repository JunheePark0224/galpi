// @vitest-environment node
import { describe, expect, it } from "vitest";
import { artsForDraw } from "@/lib/art/combine";
import { catalog } from "@/lib/books/catalog";
import { drawPath } from "@/lib/books/draw";
import { QUESTION_MAP } from "@/lib/paths";
import { DATA_PATH } from "@/lib/paths/__fixtures__/paths";
import { mulberry32 } from "@/lib/recommend";
import { encodeShare } from "./code";
import { loadShare } from "./load";

describe("loadShare — a shared link back to its 뒤표지 (F-27)", () => {
  const drawn = drawPath(DATA_PATH, new Set(), mulberry32(11), catalog());
  const arts = artsForDraw(drawn.picks.length, 77);
  const code = encodeShare(QUESTION_MAP, { answers: DATA_PATH, books: drawn.picks.map((p) => p.card.id), arts });

  it("gives the same cards, pictures and label the person saw on their 뒤표지", () => {
    const view = loadShare(code)!;
    expect(view.code).toBe(code);
    expect(view.cards).toEqual(drawn.picks.map((p) => p.card));
    expect(view.arts.map((a) => a.animal)).toEqual(arts.map((a) => a.animal));
    expect(view.label).toEqual(drawn.label);
  });

  it("is null for a code that does not read, or names a book the catalog no longer has", () => {
    expect(loadShare("nonsense")).toBeNull();
    expect(loadShare(code.replace(drawn.picks[0].card.id, "9780000000000"))).toBeNull();
  });
});
