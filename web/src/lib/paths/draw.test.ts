import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { mulberry32, type Book, type LeafBook, type TargetBook } from "@/lib/recommend";
import { drawForPath, moodScore } from "./draw";
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

  it("challenge: a 데이터 분석 answer draws from the far side (에세이), keeping the mood", () => {
    const d = drawForPath(BOOKS, MAP, walkPath(MAP, [a("start", "B"), ...SQL.slice(1)]), opts());
    const rec = d.picks.filter((p) => p.kind === "recommended");
    expect(rec).toHaveLength(4);
    expect(rec.every((p) => p.book.entry === "leaf" && p.book.genre === "에세이")).toBe(true);
    expect(d.picks.filter((p) => p.kind === "random")).toHaveLength(1);
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

  it("is reproducible with the same seed", () => {
    const one = drawForPath(BOOKS, MAP, walkPath(MAP, SQL), opts(7)).picks.map((p) => p.book.id);
    const two = drawForPath(BOOKS, MAP, walkPath(MAP, SQL), opts(7)).picks.map((p) => p.book.id);
    expect(one).toEqual(two);
  });

  it("refuses to draw before the path ends", () => {
    expect(() => drawForPath(BOOKS, MAP, walkPath(MAP, SQL.slice(0, 2)), opts())).toThrow(/not finished/);
  });
});
