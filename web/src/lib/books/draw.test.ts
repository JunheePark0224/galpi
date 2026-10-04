// @vitest-environment node
import { describe, expect, it } from "vitest";
import sample from "@/data/books.sample.json";
import { mulberry32 } from "@/lib/recommend";
import { applyChallenge, pathReason, QUESTION_MAP, walkPath } from "@/lib/paths";
import { toBook } from "./catalog";
import { drawPath } from "./draw";
import { CHALLENGE_PATH, MIXED_PATH, SQL_PATH } from "@/lib/paths/__fixtures__/paths";
import type { CatalogBook } from "./types";

const BOOKS = sample as unknown as CatalogBook[];
const none = new Set<string>();

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
      moods: ["실제로 써먹는 쪽", "가볍게 읽히는 얇은 책"], mode: "normal",
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
