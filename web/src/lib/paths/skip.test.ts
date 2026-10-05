import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import type { Book, LeafBook, TargetBook } from "@/lib/recommend";
import { parseQuestionMap } from "./parse";
import { askable, MIN_SCORED, moodSkips } from "./skip";
import type { Answer } from "./types";
import { skipKey, walkPath } from "./walk";

const MINI = readFileSync(path.join(process.cwd(), "src/lib/paths/__fixtures__/mini-map.md"), "utf8");
const MAP = parseQuestionMap(MINI);
const a = (node: string, choice: Answer["choice"]): Answer => ({ node, choice });
const SQL = [a("start", "A"), a("branch", "B"), a("learn-area", "A"), a("learn-data", "A")];   // standing before mood-way
const t = (id: string, keywords: string[], way: TargetBook["way"], pages = 320, topic = "데이터 분석"): TargetBook =>
  ({ id, entry: "target", field: "데이터·통계", topic, genre: topic, pages, way, keywords });
const l = (id: string, axes: Partial<LeafBook["axes"]>, genre = "인문", pages = 320): LeafBook =>
  ({ id, entry: "leaf", genre, pages, axes: { temp: 0, pull: 0, gain: 0, world: 0, ...axes } });
const sql = (ways: TargetBook["way"][]) => ways.map((w, i) => t(`s${i}`, ["SQL"], w));

describe("askable (design 5-2: ask only when each answer has a book it scores)", () => {
  it("threshold: one book a side", () => {
    expect(MIN_SCORED).toBe(1);
  });

  it("asks when both answers score a book among more books than places", () => {
    expect(askable(MAP, sql(["개념", "실습", "실습", "실습", "실습"]), walkPath(MAP, SQL))).toBe(true);
  });

  it("passes over when one answer scores no book (no 개념 SQL book)", () => {
    expect(askable(MAP, sql(["실습", "실습", "실습", "실습", "실습"]), walkPath(MAP, SQL))).toBe(false);
  });

  it("passes over when the scope is all drawn anyway (4 books for 4 places)", () => {
    expect(askable(MAP, sql(["개념", "실습", "실습", "실습"]), walkPath(MAP, SQL))).toBe(false);
  });

  it("widened: judges only the books of the level above that compete for the places left", () => {
    const w = walkPath(MAP, SQL);
    const two = [t("s1", ["SQL"], "개념"), t("s2", ["SQL"], "실습")];   // drawn first whatever the answer
    expect(askable(MAP, [...two, t("x1", ["엑셀"], "실습"), t("x2", ["엑셀"], "실습"), t("x3", ["엑셀"], "실습")], w)).toBe(false);
    expect(askable(MAP, [...two, t("x1", ["엑셀"], "개념"), t("x2", ["엑셀"], "실습"), t("x3", ["엑셀"], "실습")], w)).toBe(true);
  });

  it("length: thin and thick on the one page rule", () => {
    const w = walkPath(MAP, [...SQL, a("mood-way", "unsure")]);
    expect(askable(MAP, [280, 300, 320, 340, 360].map((p, i) => t(`s${i}`, ["SQL"], "실습", p)), w)).toBe(false);   // no thick
    expect(askable(MAP, [280, 300, 320, 340, 380].map((p, i) => t(`s${i}`, ["SQL"], "실습", p)), w)).toBe(true);
  });

  it("challenge: judged on the far side, where the way leans a story axis (개념 → 알게 됨, 실습 → 현실)", () => {
    const w = walkPath(MAP, [a("start", "B"), ...SQL.slice(1)]);
    const far = (axes: Partial<LeafBook["axes"]>[]) => [...sql(["실습", "실습", "실습", "실습", "실습"]), ...axes.map((x, i) => l(`e${i}`, x))];
    expect(askable(MAP, far([{ gain: 1 }, { world: 1 }, {}, {}, {}]), w)).toBe(true);
    expect(askable(MAP, far([{ gain: 1 }, { gain: 1 }, {}, {}, {}]), w)).toBe(false);   // no 현실 essay
  });

  it("a choice that only leads to another mood question scores what that question can, when it is asked", () => {
    const map = parseQuestionMap(MINI.replace("B: 바로 따라 하기 | way=실습 | next=mood-len", "B: 바로 따라 하기 | next=mood-len"));
    const w = walkPath(map, SQL);
    const books = [280, 300, 320, 340, 380].map((p, i) => t(`s${i}`, ["SQL"], i === 0 ? "개념" : "실습", p));
    expect(askable(map, books, w)).toBe(true);                                             // B → mood-len: thin + thick books
    expect(askable(map, books.map((b) => ({ ...b, pages: 320 })), w)).toBe(false);          // mood-len passed over → B scores nothing
    const toNarrow = parseQuestionMap(MINI.replace("B: 바로 따라 하기 | way=실습 | next=mood-len", "B: 바로 따라 하기 | next=learn-data"));
    expect(askable(toNarrow, books, walkPath(toNarrow, SQL))).toBe(false);                  // leads to no mood question
  });

  it("is always true where there is no mood question to judge", () => {
    expect(askable(MAP, [], walkPath(MAP, []))).toBe(true);
    expect(askable(MAP, [], walkPath(MAP, [...SQL, a("mood-way", "A"), a("mood-len", "A")]))).toBe(true);
  });
});

describe("moodSkips", () => {
  it("lists every place a mood question cannot change the draw, and the walk then passes over it", () => {
    const books: Book[] = [...sql(["실습", "실습", "실습", "실습", "실습"]), ...[1, 2, 3, 4, 5].map((i) => l(`e${i}`, { temp: 1 }, "에세이", 200))];
    const skips = moodSkips(MAP, books);
    const atWay = walkPath(MAP, SQL);
    expect(skips).toContain(skipKey(atWay));                                               // no 개념 SQL book
    expect(skips).toContain(skipKey(walkPath(MAP, [a("start", "A"), a("branch", "A"), a("story-world", "A")])));   // no 여운 essay
    expect(skips).toEqual([...skips].sort());
    const walked = walkPath({ ...MAP, skip: new Set(skips) }, SQL);
    expect(walked.skipped).toContain("mood-way");
  });

  it("ignores a skip table already on the map (judges the raw map)", () => {
    const books: Book[] = sql(["개념", "실습", "실습", "실습", "실습"]);
    expect(moodSkips({ ...MAP, skip: new Set([skipKey(walkPath(MAP, SQL))]) }, books)).toEqual(moodSkips(MAP, books));
  });
});
