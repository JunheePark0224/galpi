import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import type { ArtCombo } from "@/lib/art/combine";
import { parseQuestionMap, type Answer } from "@/lib/paths";
import { decodeShare, encodeShare, MAX_CODE, type SharedDraw } from "./code";

const MINI = parseQuestionMap(readFileSync(path.join(process.cwd(), "src/lib/paths/__fixtures__/mini-map.md"), "utf8"));
const a = (node: string, choice: Answer["choice"]): Answer => ({ node, choice });
const STORY = [a("start", "A"), a("branch", "A"), a("story-world", "B"), a("mood-temp", "unsure"), a("mood-len", "A")];
const art = (animal: ArtCombo["animal"], bg: ArtCombo["bg"], ground: ArtCombo["ground"]): ArtCombo => ({ animal, bg, ground, rare: false });
const SHARED: SharedDraw = {
  answers: STORY,
  books: ["9788937460449", "9791190090018", "9788954682152", "9788983711892", "9791168340947"],
  arts: [art("cat", "peach", "none"), art("whitetiger", "galaxy", "musicbox"), art("dog", "summer", "teacup"),
    art("whale", "night", "grass"), art("owl", "study", "goldbook")],
};
const known = (id: string) => SHARED.books.includes(id);

describe("share code — the answers, the five books and their pictures in a link (F-27, 10-07)", () => {
  it("round-trips a finished path, the books in order and each picture with its rarity worked out", () => {
    const code = encodeShare(MINI, SHARED);
    expect(code).toMatch(/^[0-9A-Za-z.~_-]+$/);
    expect(code.length).toBeLessThanOrEqual(MAX_CODE);
    const back = decodeShare(MINI, code, known)!;
    expect(back.answers).toEqual(STORY);
    expect(back.books).toEqual(SHARED.books);
    expect(back.arts.map((x) => [x.animal, x.bg, x.ground])).toEqual(SHARED.arts.map((x) => [x.animal, x.bg, x.ground]));
    expect(back.arts.map((x) => x.rare)).toEqual([false, true, true, true, true]);
  });

  it("refuses anything that is not a code we wrote — and never throws", () => {
    const code = encodeShare(MINI, SHARED);
    const [v, ans, books, arts] = code.split("~");
    const bad = [
      "", "x", `9~${ans}~${books}~${arts}`, `${v}~${ans}~${books}`, `${v}~${ans}~${books}~${arts}~more`,
      `${v}~zz9A~${books}~${arts}`,                                   // a node we do not have
      `${v}~${ans.replace("A", "Q")}~${books}~${arts}`,               // a choice we do not have
      `${v}~${ans.split(".").slice(0, 2).join(".")}~${books}~${arts}`, // a path that does not end
      `${v}~${ans}.0A~${books}~${arts}`,                              // an answer after the end
      `${v}~${ans}~${books.replace("9788937460449", "1234")}~${arts}`,  // a book not in the catalog
      `${v}~${ans}~${books}.${books.split(".")[0]}~${arts}0aa`,       // the same book twice
      `${v}~${ans}~${books}~${arts.slice(0, -3)}`,                    // a picture missing
      `${v}~${ans}~${books}~${arts.slice(0, -3)}zzz`,                 // a picture value we do not draw
      `${v}~${ans}~~`, "1~~~", "a".repeat(MAX_CODE + 1),
      `${v}~0${ans}~${books}~${arts}`,                                // a second spelling of the same code ("00A" for "0A")
      `${v}~${ans}~${books}~${arts.toUpperCase()}`,                   // base-36 digits in the other case
      `${v}~${ans}~${books}.9788937460449x~${arts}000`,               // a sixth book
    ];
    for (const c of bad) expect(decodeShare(MINI, c, known), c).toBeNull();
  });

  it("reads at most five books and never more answers than the map has questions", () => {
    const six = { ...SHARED, books: [...SHARED.books, "9780000000006"], arts: [...SHARED.arts, SHARED.arts[0]] };
    expect(decodeShare(MINI, encodeShare(MINI, six), () => true)).toBeNull();
    const one = { ...SHARED, books: SHARED.books.slice(0, 1), arts: SHARED.arts.slice(0, 1) };
    expect(decodeShare(MINI, encodeShare(MINI, one), known)?.books).toEqual(SHARED.books.slice(0, 1));
  });

  it("does not write a code for nothing to share", () => {
    expect(() => encodeShare(MINI, { ...SHARED, books: [], arts: [] })).toThrow(/books/);
    expect(() => encodeShare(MINI, { ...SHARED, arts: SHARED.arts.slice(1) })).toThrow(/picture/);
  });
});
