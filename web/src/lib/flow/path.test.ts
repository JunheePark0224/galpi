import { describe, expect, it } from "vitest";
import { CHALLENGE_PATH, MIXED_PATH, SQL_PATH } from "@/lib/paths/__fixtures__/paths";
import { completedProps, isPath, nextQuestion, pathCommon, sameAnswers } from "./path";

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
    const toWay = SQL_PATH.slice(0, 9);                                   // … learn-way B (써먹는 쪽)
    expect(nextQuestion(toWay)?.id).toBe("learn-len");                     // learn-way-use: no 사례 SQL book, passed over
    expect(nextQuestion(toWay.slice(0, -1))?.id).toBe("learn-way");
    expect(isPath([...toWay, { node: "learn-way-use", choice: "A" }])).toBe(false);
  });

  it("builds E-34 path_completed: the drawn scope as map:coverage keys it, the questions and the unsure answers", () => {
    expect(completedProps(SQL_PATH)).toEqual({ scope_id: "entry=target;topics=데이터 분석;keywords=SQL", depth: 10, unsure_count: 0 });
    expect(completedProps(MIXED_PATH)).toEqual({ scope_id: "all", depth: 3, unsure_count: 1 });
    expect(completedProps(CHALLENGE_PATH)).toEqual({ scope_id: "entry=leaf;genres=시,에세이", depth: 9, unsure_count: 1 });
  });
});
