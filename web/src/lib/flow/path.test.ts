import { describe, expect, it } from "vitest";
import { CHALLENGE_PATH, MIXED_PATH, SQL_PATH } from "@/lib/paths/__fixtures__/paths";
import { challengeProps, completedProps, isPath, nextQuestion, pathCommon, sameAnswers } from "./path";

describe("flow path helpers (the real question map)", () => {
  it("asks the start question first and nothing after a finished path", () => {
    expect(nextQuestion([])?.id).toBe("start");
    expect(nextQuestion(SQL_PATH.slice(0, 2))?.id).toBe("learn-intro");
    expect(nextQuestion(SQL_PATH)).toBeNull();
  });

  it("checks a saved answer list against the map", () => {
    expect(isPath([])).toBe(true);
    expect(isPath(SQL_PATH.slice(0, 4))).toBe(true);
    expect(isPath(SQL_PATH)).toBe(true);
    expect(isPath("start")).toBe(false);
    expect(isPath([{ node: "branch", choice: "A" }])).toBe(false);
    expect(isPath([{ node: "start", choice: "C" }])).toBe(false);
    expect(isPath([null])).toBe(false);
  });

  it("compares two answer lists by node and choice", () => {
    expect(sameAnswers(SQL_PATH, SQL_PATH.map((a) => ({ ...a })))).toBe(true);
    expect(sameAnswers(SQL_PATH, SQL_PATH.slice(0, -1))).toBe(false);
    expect(sameAnswers(SQL_PATH, [...SQL_PATH.slice(0, -1), { node: "learn-len", choice: "B" }])).toBe(false);
  });

  it("gives the common branch and route: none before the first answer, the branch once chosen (taxonomy v1.0 3-1)", () => {
    expect(pathCommon([])).toEqual({ entry: null, mode: null });
    expect(pathCommon(SQL_PATH.slice(0, 1))).toEqual({ entry: null, mode: "normal" });
    expect(pathCommon(SQL_PATH)).toEqual({ entry: "target", mode: "normal" });
    expect(pathCommon(MIXED_PATH)).toEqual({ entry: null, mode: "normal" });
    expect(pathCommon(CHALLENGE_PATH)).toEqual({ entry: "leaf", mode: "challenge" });   // the branch chosen, not the far side
  });

  it("never asks a mood question the map passes over; one answer back lands on the question shown before it", () => {
    const toWay = SQL_PATH.slice(0, 8);                                   // … learn-data-tool A (DB에서 꺼내기)
    expect(nextQuestion(toWay)?.id).toBe("learn-len");                     // learn-way: 4 SQL books, all drawn — passed over
    expect(nextQuestion(toWay.slice(0, -1))?.id).toBe("learn-data-tool");
    expect(isPath([...toWay, { node: "learn-way", choice: "B" }])).toBe(false);
  });

  it("builds E-34 path_completed: the drawn scope as map:coverage keys it, the questions and the unsure answers", () => {
    expect(completedProps(SQL_PATH)).toEqual({ scope_id: "entry=target;topics=데이터 분석;keywords=SQL", depth: 9, unsure_count: 0 });
    expect(completedProps(MIXED_PATH)).toEqual({ scope_id: "all", depth: 3, unsure_count: 1 });
    expect(completedProps(CHALLENGE_PATH)).toEqual({ scope_id: "entry=leaf;genres=시,에세이", depth: 9, unsure_count: 1 });
  });

  it("builds the E-07 challenge props from the draw's challenge (taxonomy v1.5): null, null off the challenge route", () => {
    expect(challengeProps(null)).toEqual({ challenge_rule: null, challenge_genre: null });
    expect(challengeProps(undefined)).toEqual({ challenge_rule: null, challenge_genre: null });
    const list = { from: ["이야기 · 장르 없음"], to: ["과학 교양"], rule: { n: 19, title: "이야기 · 장르 없음 → 도전 목록" }, reason: null };
    expect(challengeProps(list)).toEqual({ challenge_rule: 19, challenge_genre: "과학 교양" });
    const fixed = { from: ["돈 관리·투자"], to: ["인문", "역사"], rule: { n: 30, title: null }, reason: "x" };
    expect(challengeProps(fixed)).toEqual({ challenge_rule: 30, challenge_genre: "인문,역사" });
    expect(challengeProps({ ...fixed, to: [] })).toEqual({ challenge_rule: 30, challenge_genre: null });
  });
});
