import { describe, expect, it } from "vitest";
import { SQL_PATH } from "@/lib/paths/__fixtures__/paths";
import { MAX_ANSWERS, MAX_SEEN, parseDrawRequest } from "./request";

describe("parseDrawRequest (v2 — a finished path of the question map)", () => {
  it("accepts a finished path with seen and seed", () => {
    expect(parseDrawRequest({ answers: SQL_PATH, seen: ["x"], seed: 3 })).toEqual({ answers: SQL_PATH, seen: ["x"], seed: 3 });
    expect(parseDrawRequest({ answers: SQL_PATH })).toEqual({ answers: SQL_PATH, seen: [], seed: null });
  });

  it("keeps only node and choice of each answer it accepts", () => {
    expect(parseDrawRequest({ answers: SQL_PATH.map((a) => ({ ...a })) })?.answers).toEqual(SQL_PATH);
  });

  it.each([
    ["not an object", "x"],
    ["a v1 🍃 body", { entry: "leaf", choices: ["A", "B", "A", "B", "A", "B", "A", "B", "A"] }],
    ["a v1 🎯 body", { entry: "target", answers: { topic: "통계", way: null, len: 0, keywords: [] } }],
    ["answers missing", {}],
    ["answers not a list", { answers: "start" }],
    ["no answers", { answers: [] }],
    ["an unfinished path", { answers: SQL_PATH.slice(0, -1) }],
    ["a question that was not asked", { answers: [{ node: "branch", choice: "A" }] }],
    ["an unknown choice", { answers: [{ node: "start", choice: "C" }, ...SQL_PATH.slice(1)] }],
    ["an extra key on an answer", { answers: [{ node: "start", choice: "A", text: "hi" }, ...SQL_PATH.slice(1)] }],
    ["a node id that is not a string", { answers: [{ node: 1, choice: "A" }] }],
    ["a node id over 64 characters", { answers: [{ node: "x".repeat(65), choice: "A" }] }],
    ["too many answers", { answers: Array.from({ length: MAX_ANSWERS + 1 }, () => ({ node: "start", choice: "A" })) }],
    ["an answer that is not an object", { answers: [null] }],
    ["seen that is not a list of ids", { answers: SQL_PATH, seen: "9790000000001" }],
    ["a seen id that is not a string", { answers: SQL_PATH, seen: [9790000000001] }],
    ["too many seen ids", { answers: SQL_PATH, seen: Array.from({ length: MAX_SEEN + 1 }, (_, i) => `${i}`) }],
    ["a negative seed", { answers: SQL_PATH, seed: -1 }],
    ["a seed that is not an integer", { answers: SQL_PATH, seed: 1.5 }],
  ])("refuses %s", (_, body) => {
    expect(parseDrawRequest(body)).toBeNull();
  });
});
