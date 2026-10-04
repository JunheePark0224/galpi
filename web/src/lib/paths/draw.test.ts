import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { mulberry32, type Book, type LeafBook, type TargetBook } from "@/lib/recommend";
import { drawForPath, maxPossible, moodScore } from "./draw";
import { parseQuestionMap } from "./parse";
import { NEUTRAL_MOOD, type Answer } from "./types";
import { walkPath } from "./walk";

const MAP = parseQuestionMap(readFileSync(path.join(process.cwd(), "src/lib/paths/__fixtures__/mini-map.md"), "utf8"));
const a = (node: string, choice: Answer["choice"]): Answer => ({ node, choice });
const SQL = [a("start", "A"), a("branch", "B"), a("learn-area", "A"), a("learn-data", "A"), a("mood-way", "B"), a("mood-len", "A")];

const t = (id: string, keywords: string[], way: TargetBook["way"] = "실습", pages = 200, topic = "데이터 분석"): TargetBook =>
  ({ id, entry: "target", field: "데이터·통계", topic, genre: topic, pages, way, keywords });
const l = (id: string, genre: string): LeafBook => ({ id, entry: "leaf", genre, pages: 250, axes: { temp: 1, pull: 0, gain: 0, world: 0 } });

const BOOKS: Book[] = [
  t("sql1", ["SQL"]), t("sql2", ["SQL"]), t("sql3", ["SQL"], "개념"), t("sql4", ["SQL"], "실습", 450), t("sql5", ["SQL"]),
  t("xl1", ["엑셀"]), t("xl2", ["엑셀"]), t("mind1", ["우울"], "개념", 200, "마음 돌보기"),
  l("e1", "에세이"), l("e2", "에세이"), l("e3", "에세이"), l("e4", "에세이"), l("e5", "에세이"),
];
const opts = (seed = 1, seen: string[] = []) => ({ seen: new Set(seen), rng: mulberry32(seed) });

describe("moodScore", () => {
  it("scores a 🎯 book by way and length, a 🍃 book by the axes and length", () => {
    expect(moodScore(t("x", [], "실습", 200), { ...NEUTRAL_MOOD, way: "실습", len: 1 })).toBe(4);   // way 2 + thin 2
    expect(moodScore(l("y", "에세이"), { ...NEUTRAL_MOOD, axes: { temp: 1, pull: 0, gain: 0, world: 0 }, len: 0 })).toBe(1);
    expect(moodScore(t("z", []), NEUTRAL_MOOD)).toBe(0);
  });
  it("counts length -1 for both entries and no way as nothing", () => {
    expect(moodScore(t("x", [], "실습", 450), { ...NEUTRAL_MOOD, way: null, len: -1 })).toBe(1);          // thick welcome 1
    expect(moodScore(l("y", "에세이"), { ...NEUTRAL_MOOD, len: -1 })).toBe(-1);                             // 250p is thin
  });
});

describe("maxPossible", () => {
  const mood = { axes: { temp: 1, pull: -1, gain: 0, world: 0 }, len: -1 as const, way: "실습" as const };
  it("follows the pool's entry: 🍃 axes + length, 🎯 way + length points, both → the larger", () => {
    expect(maxPossible("leaf", mood)).toBe(3);
    expect(maxPossible("target", mood)).toBe(3);                                       // way 2 + thick 1
    expect(maxPossible("target", { ...mood, way: null, len: 1 })).toBe(2);             // thin 2
    expect(maxPossible("target", { ...mood, len: 0 })).toBe(2);
    expect(maxPossible(null, { ...mood, len: 1 })).toBe(4);                             // 🎯 2 + 2 beats 🍃 1 + 1 + 1
    expect(maxPossible(null, { ...mood, way: null })).toBe(3);                          // 🍃 3 beats 🎯 1
  });
});

describe("drawForPath", () => {
  it("SQL path: four SQL books recommended, the 운명 1장 from 데이터 분석 (one level up)", () => {
    const d = drawForPath(BOOKS, MAP, walkPath(MAP, SQL), opts());
    const rec = d.picks.filter((p) => p.kind === "recommended").map((p) => p.book.id);
    const fate = d.picks.filter((p) => p.kind === "random").map((p) => p.book);
    expect(rec).toHaveLength(4);
    expect(rec.every((id) => id.startsWith("sql"))).toBe(true);
    expect(fate).toHaveLength(1);
    expect(fate[0].entry === "target" && fate[0].topic).toBe("데이터 분석");
    expect(rec).not.toContain(fate[0].id);
    expect(d.scopeCount).toBe(5);
    expect(d.widenedScope).toBe(false);
  });

  it("too few in the scope: widens to the level above and says so", () => {
    const d = drawForPath(BOOKS, MAP, walkPath(MAP, SQL), opts(1, ["sql1", "sql2"]));
    expect(d.widenedScope).toBe(true);
    expect(d.picks.filter((p) => p.kind === "recommended")).toHaveLength(4);
    expect(d.scopeCount).toBe(3);
  });

  it("widened: every book the person narrowed to stays, the 운명 1장 comes from the level above, scores stay mood scores", () => {
    const w = walkPath(MAP, SQL);
    for (let seed = 1; seed <= 50; seed++) {
      const d = drawForPath(BOOKS, MAP, w, opts(seed, ["sql1", "sql2"]));
      const rec = d.picks.filter((p) => p.kind === "recommended").map((p) => p.book.id);
      expect(rec).toHaveLength(4);
      expect(rec).toEqual(expect.arrayContaining(["sql3", "sql4", "sql5"]));   // sql4 is thick: a weak mood match, kept anyway
      const fate = d.picks.filter((p) => p.kind === "random").map((p) => p.book);
      expect(fate).toHaveLength(1);
      expect(fate[0].entry === "target" && fate[0].topic).toBe("데이터 분석");
      expect(d.picks.every((p) => p.score === moodScore(p.book, w.mood))).toBe(true);
      expect(d.exhausted).toBe(false);                                              // mean 2.75 of best 4
    }
  });

  it("widened from a genre: all of that genre stays even past the broad genre cap", () => {
    const books: Book[] = [
      l("s1", "SF·판타지"), l("s2", "SF·판타지"), l("s3", "SF·판타지"),
      ...["e1", "e2", "e3", "e4", "e5", "e6"].map((id) => l(id, "에세이")), l("k1", "한국 소설"), l("k2", "한국 소설"),
    ];
    const SF = [a("start", "A"), a("branch", "A"), a("story-world", "B"), a("mood-temp", "B"), a("mood-len", "B")];
    for (let seed = 1; seed <= 50; seed++) {
      const d = drawForPath(books, MAP, walkPath(MAP, SF), opts(seed));
      expect(d.widenedScope).toBe(true);
      expect(d.picks.filter((p) => p.kind === "recommended").map((p) => p.book.id)).toEqual(expect.arrayContaining(["s1", "s2", "s3"]));
    }
  });

  it("the level above is thin too: widens once more to the whole entry, closer levels first", () => {
    const sparse: Book[] = [
      t("sql1", ["SQL"], "개념", 450), t("xl1", ["엑셀"], "개념", 450),
      ...["m1", "m2", "m3", "m4"].map((id) => t(id, ["우울"], "실습", 200, "마음 돌보기")),
      l("e1", "에세이"), l("e2", "에세이"),
    ];
    for (let seed = 1; seed <= 50; seed++) {
      const d = drawForPath(sparse, MAP, walkPath(MAP, SQL), opts(seed));
      const rec = d.picks.filter((p) => p.kind === "recommended").map((p) => p.book);
      expect(d.widenedScope).toBe(true);
      expect(d.scopeCount).toBe(1);
      expect(rec).toHaveLength(4);
      expect(rec.map((b) => b.id)).toEqual(expect.arrayContaining(["sql1", "xl1"]));   // weak mood matches, but closest
      expect(rec.every((b) => b.entry === "target")).toBe(true);                       // the whole 🎯 entry, not the library
      const fate = d.picks.filter((p) => p.kind === "random");
      expect(fate).toHaveLength(1);
      expect(fate[0].book.entry).toBe("target");
      expect(d.exhausted).toBe(true);                                               // two weak matches: mean 1.5 of best 4
    }
  });

  it("widened and still short: exhausted; with no mood asked, never short of a good match", () => {
    const tiny: Book[] = [t("sql1", ["SQL"]), t("xl1", ["엑셀"])];
    expect(drawForPath(tiny, MAP, walkPath(MAP, SQL), opts()).exhausted).toBe(true);
    const plain = [a("start", "A"), a("branch", "B"), a("learn-area", "A"), a("learn-data", "A"), a("mood-way", "unsure"), a("mood-len", "unsure")];
    const d = drawForPath(BOOKS, MAP, walkPath(MAP, plain), opts(1, ["sql1", "sql2"]));
    expect(d.widenedScope).toBe(true);
    expect(d.exhausted).toBe(false);
  });

  it("challenge: a 데이터 분석 answer draws from the far side (에세이), keeping the mood", () => {
    const d = drawForPath(BOOKS, MAP, walkPath(MAP, [a("start", "B"), ...SQL.slice(1)]), opts());
    const rec = d.picks.filter((p) => p.kind === "recommended");
    expect(rec).toHaveLength(4);
    expect(rec.every((p) => p.book.entry === "leaf" && p.book.genre === "에세이")).toBe(true);
    expect(d.picks.filter((p) => p.kind === "random")).toHaveLength(1);
  });

  it("challenge to the other entry: judged by what that entry can score, not exhausted for crossing", () => {
    const d = drawForPath(BOOKS, MAP, walkPath(MAP, [a("start", "B"), ...SQL.slice(1)]), opts());   // way 실습 + thin, far side 🍃
    expect(d.picks.filter((p) => p.kind === "recommended").every((p) => p.score === 1)).toBe(true);  // thin 1 is all a 🍃 book can get
    expect(d.exhausted).toBe(false);
  });

  it("broad 🍃 scope keeps the genre cap: never more than 2 recommended of one genre", () => {
    const wide: Book[] = [
      ...["a1", "a2", "a3", "a4", "a5", "a6"].map((id) => l(id, "에세이")),
      l("b1", "한국 소설"), l("b2", "한국 소설"), l("c1", "외국 소설"), l("c2", "외국 소설"), l("d1", "SF·판타지"),
    ];
    const LEAF = [a("start", "A"), a("branch", "A"), a("story-world", "unsure"), a("mood-temp", "A"), a("mood-len", "A")];
    for (let seed = 1; seed <= 30; seed++) {
      const d = drawForPath(wide, MAP, walkPath(MAP, LEAF), opts(seed));
      const rec = d.picks.filter((p) => p.kind === "recommended");
      expect(rec).toHaveLength(4);
      const counts = new Map<string, number>();
      for (const p of rec) counts.set(p.book.genre, (counts.get(p.book.genre) ?? 0) + 1);
      expect(Math.max(...counts.values())).toBeLessThanOrEqual(2);
    }
  });

  it("whole library (no entry chosen) keeps the genre cap too", () => {
    const wide: Book[] = [
      ...["a1", "a2", "a3", "a4", "a5"].map((id) => l(id, "에세이")), l("b1", "한국 소설"), l("c1", "외국 소설"),
      t("x1", ["SQL"]), t("x2", ["SQL"]), t("x3", ["SQL"]),
    ];
    const ALL = [a("start", "A"), a("branch", "unsure"), a("mood-len", "A")];
    for (let seed = 1; seed <= 30; seed++) {
      const rec = drawForPath(wide, MAP, walkPath(MAP, ALL), opts(seed)).picks.filter((p) => p.kind === "recommended");
      const counts = new Map<string, number>();
      for (const p of rec) counts.set(p.book.genre, (counts.get(p.book.genre) ?? 0) + 1);
      expect(Math.max(...counts.values())).toBeLessThanOrEqual(2);
    }
  });

  it("a narrowed 🎯 scope has no genre cap: four books of one topic", () => {
    const d = drawForPath(BOOKS, MAP, walkPath(MAP, SQL), opts(3));
    expect(new Set(d.picks.filter((p) => p.kind === "recommended").map((p) => p.book.genre))).toEqual(new Set(["데이터 분석"]));
  });

  it("is reproducible with the same seed", () => {
    const one = drawForPath(BOOKS, MAP, walkPath(MAP, SQL), opts(7)).picks.map((p) => p.book.id);
    const two = drawForPath(BOOKS, MAP, walkPath(MAP, SQL), opts(7)).picks.map((p) => p.book.id);
    expect(one).toEqual(two);
  });

  it("refuses to draw before the path ends", () => {
    expect(() => drawForPath(BOOKS, MAP, walkPath(MAP, SQL.slice(0, 2)), opts())).toThrow(/not finished/);
  });
});
