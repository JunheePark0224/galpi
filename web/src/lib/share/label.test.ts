import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { parseQuestionMap, type Answer } from "@/lib/paths";
import type { Book, LeafBook, TargetBook } from "@/lib/recommend";
import { NO_CHIP_LINE, shareLabel } from "./label";

const MINI = parseQuestionMap(readFileSync(path.join(process.cwd(), "src/lib/paths/__fixtures__/mini-map.md"), "utf8"));
const a = (node: string, choice: Answer["choice"]): Answer => ({ node, choice });
const leaf = (id: string, genre: string, temp: -1 | 0 | 1 | null, pages = 250): LeafBook => ({
  id, entry: "leaf", genre, pages, axes: { temp, pull: 0, gain: 0, world: 1 },
});
const target = (id: string, topic: string, keywords: string[], way: TargetBook["way"], pages = 250): TargetBook => ({
  id, entry: "target", field: "데이터·통계", topic, genre: topic, pages, way, keywords,
});

const STORY = [a("start", "A"), a("branch", "A"), a("story-world", "B"), a("mood-temp", "A"), a("mood-len", "A")];
const SF_WARM: Book[] = [1, 2, 3, 4].map((i) => leaf(`s${i}`, "SF·판타지", 1));

describe("shareLabel — 내가 고른 길, only what every one of the five bookmarks matches (F-27, 10-07)", () => {
  it("keeps every choice the five books all match, in path order, without the route or the intro answers", () => {
    const books = [...SF_WARM, leaf("s5", "SF·판타지", 1)];
    expect(shareLabel(MINI, STORY, books)).toEqual({ chips: ["이야기에 빠지기", "딴 세상", "따뜻한 이야기", "가볍게 한 권"], challenge: false });
  });

  it("drops a choice the 운명 card (one level up) does not match, and keeps the rest", () => {
    const books = [...SF_WARM, leaf("fate", "한국 소설", 1)];       // the 운명 card: a Korean novel, still warm and thin
    expect(shareLabel(MINI, STORY, books).chips).toEqual(["이야기에 빠지기", "따뜻한 이야기", "가볍게 한 권"]);
  });

  it("drops a mood the books do not all have: an axis value, an empty axis (비움), a length", () => {
    expect(shareLabel(MINI, STORY, [...SF_WARM, leaf("cold", "SF·판타지", -1)]).chips).not.toContain("따뜻한 이야기");
    expect(shareLabel(MINI, STORY, [...SF_WARM, leaf("empty", "SF·판타지", null)]).chips).not.toContain("따뜻한 이야기");
    expect(shareLabel(MINI, STORY, [...SF_WARM, leaf("thick", "SF·판타지", 1, 300)]).chips).not.toContain("가볍게 한 권");
    const deep = [a("start", "A"), a("branch", "A"), a("story-world", "B"), a("mood-temp", "unsure"), a("mood-len", "B")];
    expect(shareLabel(MINI, deep, SF_WARM.map((b) => ({ ...b, pages: 400 }))).chips).toEqual(["이야기에 빠지기", "딴 세상", "깊게 파고들기"]);
    expect(shareLabel(MINI, deep, [...SF_WARM.map((b) => ({ ...b, pages: 400 })), leaf("mid", "SF·판타지", 1, 300)]).chips)
      .not.toContain("깊게 파고들기");
  });

  it("checks 🎯 topics, keywords and the way, and a 🍃 book never matches a 🎯 choice", () => {
    const sql = [a("start", "A"), a("branch", "B"), a("learn-area", "A"), a("learn-data", "A"), a("mood-way", "B"), a("mood-len", "unsure")];
    const books = [1, 2, 3, 4, 5].map((i) => target(`t${i}`, "데이터 분석", ["SQL"], "실습"));
    expect(shareLabel(MINI, sql, books).chips).toEqual(["뭔가 배우기", "데이터를 다루기", "DB에서 꺼내기", "바로 따라 하기"]);
    const mixed = [...books.slice(0, 4), target("x", "데이터 분석", ["엑셀"], "개념")];
    expect(shareLabel(MINI, sql, mixed).chips).toEqual(["뭔가 배우기", "데이터를 다루기"]);
    expect(shareLabel(MINI, sql, [...books.slice(0, 4), leaf("l", "에세이", 1)]).chips).toEqual([]);
  });

  it("marks the challenge route instead of a chip; the far books drop the path's own scope", () => {
    const challenge = [a("start", "B"), ...STORY.slice(1)];
    const far = [1, 2, 3, 4, 5].map((i) => leaf(`f${i}`, "에세이", 1));
    expect(shareLabel(MINI, challenge, far)).toEqual({ chips: ["이야기에 빠지기", "따뜻한 이야기", "가볍게 한 권"], challenge: true });
  });

  it("gives no chips for no books, an unsure branch (섞어서) or answers that set nothing", () => {
    expect(shareLabel(MINI, STORY, [])).toEqual({ chips: [], challenge: false });
    expect(shareLabel(MINI, [a("start", "A"), a("branch", "unsure"), a("mood-len", "unsure")], SF_WARM).chips).toEqual([]);
    expect(NO_CHIP_LINE).toBe("기분 따라 골랐어요");
  });

  it("lists a label once when two answers carry the same words", () => {
    const twice = parseQuestionMap(readFileSync(path.join(process.cwd(), "src/lib/paths/__fixtures__/mini-map.md"), "utf8")
      .replace("A: 가볍게 한 권 | len=+1", "A: 따뜻한 이야기 | len=+1"));
    expect(shareLabel(twice, STORY, [...SF_WARM, leaf("s5", "SF·판타지", 1)]).chips).toEqual(["이야기에 빠지기", "딴 세상", "따뜻한 이야기"]);
  });
});
