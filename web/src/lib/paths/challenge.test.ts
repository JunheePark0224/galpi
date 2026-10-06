import { describe, expect, it } from "vitest";
import { mulberry32, type Book, type LeafBook } from "@/lib/recommend";
import { challengeOf, LEARN_CHALLENGE_GENRES, LIST_MIN_BOOKS, NO_CHOICE_LABEL, pickGenre } from "./challenge";
import { ALL_SCOPE } from "./types";

const leaf = (genre: string, n: number): LeafBook[] =>
  Array.from({ length: n }, (_, i) => ({ id: `${genre}${i}`, entry: "leaf", genre, pages: 250, axes: { temp: 0, pull: 0, gain: 0, world: 0 } }));
const TO = { entry: "leaf" as const, genres: ["과학 교양", "인문", "역사", "예술·여행", "사회·시사"] };

describe("challenge rules v2 constants (user, 10-05)", () => {
  it("learning challenges go only to these five genres; a list genre needs 5 books", () => {
    expect(LEARN_CHALLENGE_GENRES).toEqual(["과학 교양", "인문", "역사", "예술·여행", "사회·시사"]);
    for (const g of ["시", "에세이", "한국 소설", "외국 소설", "SF·판타지", "추리·스릴러", "호러·괴담"]) expect(LEARN_CHALLENGE_GENRES).not.toContain(g);
    expect(LIST_MIN_BOOKS).toBe(5);
  });
});

describe("pickGenre", () => {
  const books: Book[] = [...leaf("과학 교양", 10), ...leaf("인문", 10), ...leaf("예술·여행", 5), ...leaf("역사", 4)];

  it("candidates: the list genres with at least 5 books (역사 4, 사회·시사 0 are left out); the same seed, the same genre", () => {
    const count = new Map<string, number>();
    const N = 3000;
    for (let seed = 1; seed <= N; seed++) {
      const [g] = pickGenre(TO, books, mulberry32(seed));
      expect(pickGenre(TO, books, mulberry32(seed))).toEqual([g]);
      count.set(g, (count.get(g) ?? 0) + 1);
    }
    expect([...count.keys()].sort()).toEqual(["과학 교양", "예술·여행", "인문"]);
    // equal chance whatever the book counts (10 · 10 · 5 books → a third each)
    for (const n of count.values()) expect(Math.abs(n / N - 1 / 3)).toBeLessThan(0.03);
  });

  it("counts only books of the far side (a 🎯 book whose genre reads 역사 does not count for 🍃 역사)", () => {
    const withTarget: Book[] = [...leaf("역사", 4), { id: "t", entry: "target", field: "f", topic: "역사", genre: "역사", pages: 200, way: "개념", keywords: [] }];
    expect(pickGenre(TO, withTarget, mulberry32(1))).toEqual(TO.genres);
    expect(pickGenre(TO, [...withTarget, ...leaf("역사", 5).map((b) => ({ ...b, id: `x${b.id}` }))], mulberry32(1))).toEqual(["역사"]);
  });

  it("no genre with 5 books → the whole list as one target; no list → nothing", () => {
    expect(pickGenre(TO, leaf("인문", 4), mulberry32(7))).toEqual(TO.genres);
    expect(pickGenre({ entry: "leaf" }, books, mulberry32(7))).toEqual([]);
  });
});

describe("challengeOf", () => {
  const rule = { from: { entry: "target" as const }, to: TO, title: "배우기 · 주제 없음 → 도전 목록", pick: "one" as const, why: "한 발짝" };

  it("from: the genres or topics chosen, else the branch's no-choice label; the rule numbered from 1; the reason", () => {
    const to = { ...ALL_SCOPE, entry: "leaf" as const, genres: ["인문"] };
    expect(challengeOf({ ...ALL_SCOPE, entry: "target" }, "target", 36, rule, to)).toEqual({
      from: ["배우기 · 주제 없음"], to: ["인문"], rule: { n: 36, title: "배우기 · 주제 없음 → 도전 목록" }, reason: "한 발짝",
    });
    expect(challengeOf({ ...ALL_SCOPE, entry: "target", topics: ["돈 관리·투자", "경제 상식"] }, "target", 30, rule, to).from).toEqual(["돈 관리·투자", "경제 상식"]);
    expect(challengeOf({ ...ALL_SCOPE, entry: "target", keywords: ["SQL"] }, "target", 1, rule, to).from).toEqual(["SQL"]);
    expect(challengeOf({ ...ALL_SCOPE, entry: "leaf", genres: ["SF·판타지"] }, "leaf", 1, rule, to).from).toEqual(["SF·판타지"]);
    expect(challengeOf(ALL_SCOPE, "mixed", 19, rule, to).from).toEqual([NO_CHOICE_LABEL.mixed]);
    expect(challengeOf({ ...ALL_SCOPE, entry: "leaf" }, "leaf", 19, { from: {}, to: {} }, { ...ALL_SCOPE, entry: "leaf" })).toEqual({
      from: ["이야기 · 장르 없음"], to: [], rule: { n: 19, title: null }, reason: null,
    });
  });
});
