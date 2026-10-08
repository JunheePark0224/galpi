import { describe, expect, it } from "vitest";
import { deviceBackMove } from "./back";
import { INITIAL, type FlowState } from "./state";

const at = (over: Partial<FlowState>): FlowState => ({ ...INITIAL, ...over });
const one = [{ node: "start", choice: "A" as const }];

describe("deviceBackMove — what the phone's back key does on each screen (10-08, user-approved table)", () => {
  it("home: the browser's own back (leave the site)", () => {
    expect(deviceBackMove(at({ step: "home" }))).toBe("leave");
  });

  it("a question after the first, the closed book and its first page: the previous question", () => {
    for (const step of ["questions", "book", "first"] as const) expect(deviceBackMove(at({ step, answers: one }))).toBe("question");
  });

  it("the first question: home", () => {
    expect(deviceBackMove(at({ step: "questions", answers: [] }))).toBe("home");
  });

  it("the bookmarks and the 뒤표지 hold — a reaction is never undone", () => {
    expect(deviceBackMove(at({ step: "bookmarks", answers: one }))).toBe("hold");
    expect(deviceBackMove(at({ step: "back", answers: one }))).toBe("hold");
  });

  it("the 궁금해요 books step back one by one, then to the 뒤표지; the end goes to the 뒤표지", () => {
    expect(deviceBackMove(at({ step: "result", result: 1 }))).toBe("prevResult");
    expect(deviceBackMove(at({ step: "result", result: 0 }))).toBe("toBack");
    expect(deviceBackMove(at({ step: "end" }))).toBe("toBack");
  });
});
