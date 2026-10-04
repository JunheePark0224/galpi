// @vitest-environment node
import { describe, expect, it } from "vitest";
import sample from "@/data/books.sample.json";
import { mulberry32 } from "@/lib/recommend";
import { applyChallenge, pathReason, QUESTION_MAP, walkPath } from "@/lib/paths";
import { toBook } from "./catalog";
import { drawLeaf, drawPath, drawTarget } from "./draw";
import { CHALLENGE_PATH, MIXED_PATH, SQL_PATH } from "@/lib/paths/__fixtures__/paths";
import type { CatalogBook } from "./types";

const BOOKS = sample as unknown as CatalogBook[];
const byId = new Map(BOOKS.map((b) => [b.isbn, b]));
const none = new Set<string>();
const LEAF_CHOICES = ["A", "A", "B", "A", "A", "B", "B", "A", "A"] as const;

describe("drawLeaf", () => {
  it("draws five different 🍃 books, one of them random", () => {
    const res = drawLeaf([...LEAF_CHOICES], none, mulberry32(7), BOOKS);
    expect(res.picks).toHaveLength(5);
    expect(new Set(res.picks.map((p) => p.card.id)).size).toBe(5);
    expect(res.picks.filter((p) => p.kind === "random")).toHaveLength(1);
    expect(res.picks.every((p) => p.card.entry === "leaf")).toBe(true);
    expect(res.found).toBeNull();
    expect(res.keywords).toEqual([]);
  });

  it("never returns a book already shown in this session", () => {
    const seen = new Set(BOOKS.filter((b) => b.entry === "leaf").slice(0, 6).map((b) => b.isbn));
    const res = drawLeaf([...LEAF_CHOICES], seen, mulberry32(3), BOOKS);
    expect(res.picks).toHaveLength(5);
    expect(res.picks.some((p) => seen.has(p.card.id))).toBe(false);
  });

  it("returns an empty, exhausted draw when every 🍃 book was shown", () => {
    const seen = new Set(BOOKS.map((b) => b.isbn));
    expect(drawLeaf([...LEAF_CHOICES], seen, mulberry32(1), BOOKS)).toMatchObject({ picks: [], exhausted: true });
  });
});

describe("drawTarget", () => {
  it("keeps recommended picks in the topic and the random one in the same field", () => {
    const res = drawTarget({ topic: "데이터 분석", way: "실습", len: 1, keywords: [] }, none, mulberry32(5), BOOKS);
    expect(res.picks).toHaveLength(5);
    for (const p of res.picks) {
      const book = byId.get(p.card.id);
      if (p.kind === "recommended") expect(book?.topic).toBe("데이터 분석");
      else expect(book?.field).toBe("데이터·통계");
    }
    expect(res.found).toBe(5);
  });

  it("counts keyword matches for the coverage notice", () => {
    const res = drawTarget({ topic: "데이터 분석", way: null, len: 0, keywords: ["SQL"] }, none, mulberry32(2), BOOKS);
    expect(res.keywords).toEqual(["SQL"]);
    expect(res.found).toBe(2);
  });

  it("drops keywords no book in the topic has", () => {
    const res = drawTarget({ topic: "AI 활용", way: null, len: 0, keywords: ["챗GPT", "제미나이"] }, none, mulberry32(2), BOOKS);
    expect(res.keywords).toEqual(["챗GPT"]);
    expect(res.found).toBe(1);
    const nothing = drawTarget({ topic: "AI 활용", way: null, len: 0, keywords: ["제미나이"] }, none, mulberry32(2), BOOKS);
    expect(nothing.keywords).toEqual([]);
    expect(nothing.found).toBe(0);
  });

  it("does not call a draw exhausted because of an impossible keyword", () => {
    const habit = (i: number): CatalogBook => ({
      isbn: `97911111111${String(i).padStart(2, "0")}`, entry: "target", title: `습관 ${i}`, author: "저자", genre: "습관·집중",
      field: "습관·자기계발", topic: "습관·집중", pages: 300, way: "사례", axes: null, keywords: ["습관"],
      one_liner: "습관을 만드는 법을 알려줘요", one_liner_style: "summary",
    });
    const five = [1, 2, 3, 4, 5].map(habit);
    // Without dropping, maxPossible would be 9 (three keywords) and a mean score of 3 would look exhausted.
    const res = drawTarget({ topic: "습관·집중", way: null, len: 0, keywords: ["습관", "뇌과학", "집중력"] }, none, mulberry32(3), five);
    expect(res.keywords).toEqual(["습관"]);
    expect(res.exhausted).toBe(false);
  });
});

describe("나온 이유 (PRD F-09)", () => {
  it("gives every 🎯 pick the reason line for the scored answers — same format for the random one", () => {
    const res = drawTarget({ topic: "데이터 분석", way: null, len: 0, keywords: ["SQL", "없는 키워드"] }, none, mulberry32(2), BOOKS);
    for (const p of res.picks) {
      const book = byId.get(p.card.id);
      if (book?.topic === "데이터 분석") {
        expect(p.reason.label).toBe("나온 이유");
        expect(p.reason.items[0]).toBe("데이터 분석");
        expect(p.reason.items).not.toContain("없는 키워드");    // dropped before scoring, never claimed as a reason
      } else {
        expect(p.reason.label).toBe("이 책은");
      }
    }
  });

  it("names the matched 🍃 answers", () => {
    const res = drawLeaf([...LEAF_CHOICES], none, mulberry32(7), BOOKS);
    expect(res.picks.every((p) => ["나온 이유", "이 책은"].includes(p.reason.label) && p.reason.items.length > 0)).toBe(true);
  });
});

describe("drawPath (v2: the answers of the question map)", () => {
  const sql = BOOKS.filter((b) => b.keywords.includes("SQL")).map((b) => b.isbn);

  it("SQL path: five different books, one 운명, the SQL books first, and the path for S-04", () => {
    const res = drawPath(SQL_PATH, none, mulberry32(7), BOOKS);
    expect(res.picks).toHaveLength(5);
    expect(new Set(res.picks.map((p) => p.card.id)).size).toBe(5);
    expect(res.picks.filter((p) => p.kind === "random")).toHaveLength(1);
    expect(res.picks.every((p) => p.card.entry === "target")).toBe(true);
    expect(res.picks.filter((p) => sql.includes(p.card.id))).toHaveLength(2);
    expect(res.widened).toBe(true);
    expect(res.path).toEqual({
      crumbs: ["뭔가 배우기", "일을 더 잘하기", "숫자·도구 다루기", "데이터 읽고 분석", "데이터 꺼내는 도구", "DB에서 꺼내기"],
      moods: ["바로 따라 해 보기", "가볍게 한 권"], mode: "normal",
    });
    const sqlPick = res.picks.find((p) => sql.includes(p.card.id) && p.kind === "recommended");
    expect(sqlPick?.reason).toMatchObject({ label: "나온 이유", items: expect.arrayContaining(["데이터 분석", "SQL"]) });
    expect(Object.keys(res.picks[0]).sort()).toEqual(["card", "kind", "reason"]);
  });

  it("challenge path: 🍃 books from the far side, the route kept for S-04", () => {
    const res = drawPath(CHALLENGE_PATH, none, mulberry32(3), BOOKS);
    expect(res.picks).toHaveLength(5);
    expect(res.picks.every((p) => p.card.entry === "leaf")).toBe(true);
    expect(res.path.mode).toBe("challenge");
  });

  it("challenge path: reasons come from the flipped scope (after applyChallenge), not the chosen side", () => {
    const res = drawPath(CHALLENGE_PATH, none, mulberry32(3), BOOKS);
    const walked = walkPath(QUESTION_MAP, CHALLENGE_PATH);
    const flipped = applyChallenge(QUESTION_MAP, walked);
    const byId = new Map(BOOKS.map((b) => [b.isbn, b]));
    for (const p of res.picks) {
      expect(p.reason).toEqual(pathReason(toBook(byId.get(p.card.id) as CatalogBook), flipped));
    }
    expect(flipped.scope).not.toEqual(walked.scope);
  });

  it("mixed path: any book of the library, never one already shown", () => {
    const seen = new Set(BOOKS.slice(0, 10).map((b) => b.isbn));
    const res = drawPath(MIXED_PATH, seen, mulberry32(5), BOOKS);
    expect(res.picks).toHaveLength(5);
    expect(res.picks.some((p) => seen.has(p.card.id))).toBe(false);
    expect(res.path).toEqual({ crumbs: [], moods: ["가볍게 얇은 책"], mode: "normal" });
  });
});
