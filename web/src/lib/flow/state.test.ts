import { describe, expect, it } from "vitest";
import type { BalanceChoice } from "@/lib/recommend";
import { INITIAL, curiousPicks, flowReducer, type DrawView, type FlowAction, type FlowState } from "./state";

const art = { animal: "cat", bg: "peach", sky: "moon", ground: "none", rare: false } as const;
const view = (n: number): DrawView => ({
  picks: Array.from({ length: n }, (_, i) => ({
    card: { id: `b${i}`, entry: "leaf" as const, title: `책 ${i}`, author: `저자 ${i}`, genre: "에세이", field: null, oneLiner: "한 줄일까요?", oneLinerStyle: "question" as const },
    kind: i === 0 ? ("random" as const) : ("recommended" as const),
    art,
    reason: { label: "나온 이유" as const, items: ["따뜻함"] },
  })),
  exhausted: false, found: null, keywords: [],
});
const run = (actions: FlowAction[], from: FlowState = INITIAL) => actions.reduce(flowReducer, from);
const answers = (c: BalanceChoice = "A"): FlowAction[] => Array.from({ length: 9 }, () => ({ type: "answer" as const, choice: c }));
const form = { topic: "통계" as const, free: null, len: null, way: null };

describe("flowReducer", () => {
  it("starts an entry and keeps what this session has already shown", () => {
    const s = run([{ type: "start", entry: "leaf" }], { ...INITIAL, seen: ["x"], index: 3 });
    expect(s).toEqual({ ...INITIAL, step: "leaf", entry: "leaf", seen: ["x"] });
  });

  it("asks for a draw after the ninth answer", () => {
    const eight = run([{ type: "start", entry: "leaf" }, ...answers().slice(0, 8)]);
    expect(eight).toMatchObject({ step: "leaf", status: "idle", drawId: 0 });
    const nine = flowReducer(eight, { type: "answer", choice: "B" });
    expect(nine).toMatchObject({ step: "book", status: "loading", drawId: 1, draw: null });
    expect(nine.choices).toHaveLength(9);
    expect(flowReducer(nine, { type: "answer", choice: "A" })).toBe(nine);
  });

  it("asks for a draw when the 🎯 form is sent", () => {
    const s = run([{ type: "start", entry: "target" }, { type: "submitTarget", form, goal: null }]);
    expect(s).toMatchObject({ step: "book", status: "loading", drawId: 1, form });
  });

  it("takes only the answer to the latest request", () => {
    const loading = run([{ type: "start", entry: "leaf" }, ...answers()]);
    expect(flowReducer(loading, { type: "drawn", id: 0, draw: view(5) })).toBe(loading);
    expect(flowReducer(loading, { type: "drawn", id: 1, draw: view(5) })).toMatchObject({ status: "ready", draw: view(5) });
  });

  it("retries a failed draw with a new request id", () => {
    const failed = run([{ type: "start", entry: "leaf" }, ...answers(), { type: "drawFailed", id: 1 }]);
    expect(failed.status).toBe("error");
    expect(flowReducer(failed, { type: "retry" })).toMatchObject({ status: "loading", drawId: 2 });
  });

  it("opens the book once, then shows bookmarks one by one and counts only shown books as seen", () => {
    const ready = run([{ type: "start", entry: "leaf" }, ...answers(), { type: "drawn", id: 1, draw: view(5) }]);
    const opened = flowReducer(ready, { type: "open" });
    expect(opened).toMatchObject({ step: "first", opened: true, seen: [] });
    const first = flowReducer(opened, { type: "next" });
    expect(first).toMatchObject({ step: "bookmarks", index: 0, seen: ["b0"] });
    const end = run([{ type: "react", reaction: "curious" }, { type: "react", reaction: "pass" }, { type: "react", reaction: "pass" },
      { type: "react", reaction: "curious" }, { type: "react", reaction: "pass" }], first);
    expect(end).toMatchObject({ step: "result", result: 0, reactions: ["curious", "pass", "pass", "curious", "pass"], seen: ["b0", "b1", "b2", "b3", "b4"] });
  });

  it("has only as many pages as picks when a draw is short", () => {
    const first = run([{ type: "start", entry: "leaf" }, ...answers(), { type: "drawn", id: 1, draw: view(3) }, { type: "open" }, { type: "next" }]);
    const end = run([{ type: "react", reaction: "pass" }, { type: "react", reaction: "pass" }, { type: "react", reaction: "pass" }], first);
    expect(end.step).toBe("end");
  });

  it("stays on the first page when the draw is empty or not back yet", () => {
    const loading = run([{ type: "start", entry: "leaf" }, ...answers(), { type: "open" }]);
    expect(flowReducer(loading, { type: "next" })).toBe(loading);
    const empty = flowReducer(loading, { type: "drawn", id: 1, draw: view(0) });
    expect(flowReducer(empty, { type: "next" })).toBe(empty);
  });

  it("allows one 🍃 edit and goes straight back to the open book", () => {
    const first = run([{ type: "start", entry: "leaf" }, ...answers(), { type: "drawn", id: 1, draw: view(5) }, { type: "open" }]);
    const editing = flowReducer(first, { type: "edit" });
    expect(editing).toMatchObject({ step: "leaf", edited: true, choices: [], prevChoices: first.choices });
    const back = run(answers("B"), editing);
    expect(back).toMatchObject({ step: "first", status: "loading", drawId: 2, opened: true });
    expect(flowReducer(back, { type: "edit" })).toBe(back);
  });

  it("allows one 🎯 edit that keeps the previous form", () => {
    const first = run([{ type: "start", entry: "target" }, { type: "submitTarget", form, goal: null }, { type: "open" }]);
    const editing = flowReducer(first, { type: "edit" });
    expect(editing).toMatchObject({ step: "target", edited: true, prevForm: form });
    expect(flowReducer(editing, { type: "submitTarget", form: { ...form, len: "thin" }, goal: null })).toMatchObject({ step: "first", drawId: 2 });
  });

  it("shows the 궁금해요 books one by one (S-06), then the end (S-08)", () => {
    const bookmarks = run([{ type: "start", entry: "leaf" }, ...answers(), { type: "drawn", id: 1, draw: view(5) }, { type: "open" }, { type: "next" }]);
    const result = run(["pass", "curious", "pass", "curious", "pass"].map((r) => ({ type: "react", reaction: r }) as FlowAction), bookmarks);
    expect(curiousPicks(result).map((p) => p.card.id)).toEqual(["b1", "b3"]);
    const second = flowReducer(result, { type: "nextResult" });
    expect(second).toMatchObject({ step: "result", result: 1 });
    expect(flowReducer(second, { type: "nextResult" })).toMatchObject({ step: "end", result: 1 });
    expect(flowReducer(bookmarks, { type: "nextResult" })).toBe(bookmarks);
  });

  it("goes straight to the end when nothing was 궁금해요", () => {
    const first = run([{ type: "start", entry: "leaf" }, ...answers(), { type: "drawn", id: 1, draw: view(2) }, { type: "open" }, { type: "next" }]);
    expect(run([{ type: "react", reaction: "pass" }, { type: "react", reaction: "pass" }], first)).toMatchObject({ step: "end" });
  });

  it("goes home keeping only the seen books", () => {
    const end = run([{ type: "start", entry: "leaf" }, ...answers(), { type: "drawn", id: 1, draw: view(1) }, { type: "open" }, { type: "next" }, { type: "react", reaction: "pass" }]);
    expect(flowReducer(end, { type: "home" })).toEqual({ ...INITIAL, seen: ["b0"] });
  });

  it("ignores actions that do not belong to the current step", () => {
    expect(flowReducer(INITIAL, { type: "open" })).toBe(INITIAL);
    expect(flowReducer(INITIAL, { type: "react", reaction: "pass" })).toBe(INITIAL);
    expect(flowReducer(INITIAL, { type: "submitTarget", form, goal: null })).toBe(INITIAL);
    expect(flowReducer(INITIAL, { type: "retry" })).toBe(INITIAL);
  });
});
