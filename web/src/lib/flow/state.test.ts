import { describe, expect, it } from "vitest";
import { SQL_PATH } from "@/lib/paths/__fixtures__/paths";
import { INITIAL, curiousPicks, flowReducer, meetingOf, type DrawView, type FlowAction, type FlowState } from "./state";

const art = { animal: "cat", bg: "peach", sky: "moon", ground: "none", rare: false } as const;
const view = (n: number): DrawView => ({
  picks: Array.from({ length: n }, (_, i) => ({
    card: { id: `b${i}`, entry: "target" as const, title: `책 ${i}`, author: `저자 ${i}`, genre: "데이터 분석", field: "데이터·통계", oneLiner: "한 줄", oneLinerStyle: "summary" as const },
    kind: i === 0 ? ("random" as const) : ("recommended" as const),
    art,
    reason: { label: "나온 이유" as const, items: ["데이터 분석"] },
  })),
  exhausted: false,
  path: { crumbs: ["뭔가 배우기"], moods: [], mode: "normal" },
});
const run = (actions: FlowAction[], from: FlowState = INITIAL) => actions.reduce(flowReducer, from);
const answers = (path = SQL_PATH): FlowAction[] => path.map((a) => ({ type: "answer" as const, choice: a.choice }));
const asked = () => run([{ type: "start" }, ...answers()]);
const opened = () => run([{ type: "drawn", id: 1, draw: view(5) }, { type: "open" }], asked());

describe("flowReducer (v2 questions)", () => {
  it("starts the questions and keeps what this session has already shown", () => {
    expect(run([{ type: "start" }], { ...INITIAL, seen: ["x"], index: 3 })).toEqual({ ...INITIAL, step: "questions", seen: ["x"] });
  });

  it("records each answer against the question on screen and counts every answer given", () => {
    const s = run([{ type: "start" }, ...answers().slice(0, 3)]);
    expect(s).toMatchObject({ step: "questions", asked: 3, status: "idle", drawId: 0 });
    expect(s.answers).toEqual(SQL_PATH.slice(0, 3));
  });

  it("asks for a draw once the path ends, then takes no more answers", () => {
    const s = asked();
    expect(s).toMatchObject({ step: "book", status: "loading", drawId: 1, draw: null, asked: 10, drawnFor: SQL_PATH });
    expect(flowReducer(s, { type: "answer", choice: "A" })).toBe(s);
    expect(flowReducer(INITIAL, { type: "answer", choice: "A" })).toBe(INITIAL);
  });

  it("back on a question drops the last answer; on the first question or elsewhere it changes nothing", () => {
    const back = run([{ type: "start" }, ...answers().slice(0, 2), { type: "back" }]);
    expect(back).toMatchObject({ step: "questions", asked: 2 });
    expect(back.answers).toEqual(SQL_PATH.slice(0, 1));
    const first = run([{ type: "start" }]);
    expect(flowReducer(first, { type: "back" })).toBe(first);
    expect(flowReducer(asked(), { type: "back" })).toEqual(asked());     // S-03: no back
  });

  describe("S-04 [← 질문으로 돌아가기]", () => {
    it("goes back to the last question with the book kept open", () => {
      const s = flowReducer(opened(), { type: "back" });
      expect(s).toMatchObject({ step: "questions", opened: true, status: "ready" });
      expect(s.answers).toEqual(SQL_PATH.slice(0, -1));
    });

    it("the same answer again: straight back to the first page with the same five books", () => {
      const before = opened();
      const s = run([{ type: "back" }, { type: "answer", choice: "A" }], before);
      expect(s).toMatchObject({ step: "first", drawId: 1, status: "ready", asked: 11 });
      expect(s.draw).toBe(before.draw);
    });

    it("another answer: a new draw on the open book", () => {
      const s = run([{ type: "back" }, { type: "answer", choice: "B" }], opened());
      expect(s).toMatchObject({ step: "first", status: "loading", drawId: 2, draw: null });
      expect(s.drawnFor?.at(-1)).toEqual({ node: "learn-len", choice: "B" });
    });

    it("back while the draw is still loading, then the same answer: the late draw still lands on S-04", () => {
      const s = run([{ type: "open" }, { type: "back" }, { type: "answer", choice: "A" }], asked());
      expect(s).toMatchObject({ step: "first", status: "loading", drawId: 1 });
      const landed = flowReducer(s, { type: "drawn", id: 1, draw: view(5) });
      expect(landed).toMatchObject({ step: "first", status: "ready", drawId: 1 });
      expect(landed.draw).not.toBeNull();
    });

    it("the same answer after a failed draw asks again", () => {
      const s = run([{ type: "drawFailed", id: 1 }, { type: "open" }, { type: "back" }, { type: "answer", choice: "A" }], asked());
      expect(s).toMatchObject({ step: "first", status: "loading", drawId: 2 });
    });
  });

  it("ignores a late answer to an older draw and retries a failed one", () => {
    const s = asked();
    expect(flowReducer(s, { type: "drawn", id: 0, draw: view(5) })).toBe(s);
    expect(flowReducer(s, { type: "drawFailed", id: 0 })).toBe(s);
    const failed = flowReducer(s, { type: "drawFailed", id: 1 });
    expect(failed).toMatchObject({ status: "error" });
    expect(flowReducer(failed, { type: "retry" })).toMatchObject({ status: "loading", drawId: 2 });
    expect(flowReducer(s, { type: "retry" })).toBe(s);
  });

  it("opens the book only from S-03, then pages through the bookmarks, marking each as seen", () => {
    expect(flowReducer(INITIAL, { type: "open" })).toBe(INITIAL);
    const first = opened();
    expect(first).toMatchObject({ step: "first", opened: true });
    const marks = flowReducer(first, { type: "next" });
    expect(marks).toMatchObject({ step: "bookmarks", index: 0, seen: ["b0"] });
    const two = flowReducer(marks, { type: "react", reaction: "curious" });
    expect(two).toMatchObject({ index: 1, reactions: ["curious"], seen: ["b0", "b1"] });
  });

  it("waits for the draw before the next page", () => {
    const loading = run([{ type: "open" }], asked());
    expect(flowReducer(loading, { type: "next" })).toBe(loading);
  });

  it("S-06 after a 궁금해요, S-08 after none; ‹ › within the 궁금해요 books", () => {
    const all = (r: "pass" | "curious"): FlowAction[] => Array.from({ length: 5 }, () => ({ type: "react" as const, reaction: r }));
    const marks = flowReducer(opened(), { type: "next" });
    expect(run(all("pass"), marks)).toMatchObject({ step: "end" });
    const mixed = run([{ type: "react", reaction: "curious" }, ...all("pass").slice(0, 2), { type: "react", reaction: "curious" }, { type: "react", reaction: "pass" }], marks);
    expect(mixed).toMatchObject({ step: "result", result: 0 });
    expect(curiousPicks(mixed).map((p) => p.card.id)).toEqual(["b0", "b3"]);
    expect(flowReducer(mixed, { type: "prevResult" })).toBe(mixed);
    const second = flowReducer(mixed, { type: "nextResult" });
    expect(second).toMatchObject({ result: 1 });
    expect(flowReducer(second, { type: "prevResult" })).toMatchObject({ result: 0 });
    expect(flowReducer(second, { type: "nextResult" })).toMatchObject({ step: "end" });
  });

  it("[다시 뽑기]: the same answers, a new closed book, nothing carried over", () => {
    const end = run(Array.from({ length: 5 }, () => ({ type: "react" as const, reaction: "pass" as const })), flowReducer(opened(), { type: "next" }));
    const again = flowReducer(end, { type: "redraw" });
    expect(again).toMatchObject({ step: "book", opened: false, status: "loading", drawId: 2, index: 0, reactions: [], result: 0 });
    expect(again.answers).toEqual(SQL_PATH);
    expect(flowReducer(opened(), { type: "redraw" })).toEqual(opened());
  });

  it("[처음으로] keeps only the books already shown", () => {
    const marks = flowReducer(opened(), { type: "next" });
    expect(flowReducer(marks, { type: "home" })).toEqual({ ...INITIAL, seen: ["b0"] });
  });
});

describe("meetingOf (v1.7: which signed bookmark an S-06 save is, for the 도감 after a login)", () => {
  const ticket = { seed: 99, count: 3, iat: 1_790_000_000, sub: null, sig: "s".repeat(43), isbns: ["a", "b", "c"] };
  const base = view(1);
  const pick = (id: string) => ({ ...base.picks[0], card: { ...base.picks[0].card, id } });
  const draw: DrawView = { ...base, picks: [pick("a"), pick("b"), pick("c")], ticket };

  it("is the draw's ticket and the pick's place in the draw", () => {
    expect(meetingOf(draw, draw.picks[2])).toEqual({ ...ticket, sig: ticket.sig, index: 2 });
  });

  it("is nothing without a signed ticket, or for a pick not in this draw", () => {
    expect(meetingOf({ ...draw, ticket: null }, draw.picks[0])).toBeUndefined();
    expect(meetingOf({ ...draw, ticket: { ...ticket, sig: null } }, draw.picks[0])).toBeUndefined();
    expect(meetingOf(draw, pick("z"))).toBeUndefined();
    expect(meetingOf(null, draw.picks[0])).toBeUndefined();
    expect(meetingOf(draw, undefined)).toBeUndefined();
  });
});
