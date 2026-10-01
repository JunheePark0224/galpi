import { afterEach, describe, expect, it, vi } from "vitest";
import { INITIAL, type FlowState } from "./state";
import { FLOW_KEY, loadFlow, saveFlow } from "./storage";

describe("flow storage", () => {
  afterEach(() => {
    sessionStorage.clear();
    vi.restoreAllMocks();
  });

  it("round-trips the state in this tab", () => {
    const s: FlowState = { ...INITIAL, step: "leaf", entry: "leaf", choices: ["A", "B"] };
    saveFlow(s);
    expect(loadFlow()).toEqual(s);
  });

  it("turns a request cut off by a reload into a retry", () => {
    saveFlow({ ...INITIAL, step: "book", entry: "leaf", status: "loading", drawId: 1 });
    expect(loadFlow()).toMatchObject({ step: "book", status: "error" });
  });

  it.each([
    ["nothing saved", null],
    ["broken JSON", "{"],
    ["another version", JSON.stringify({ v: 0, state: { ...INITIAL, step: "leaf" } })],
    ["a version-1 flow (picks without a reason)", JSON.stringify({ v: 1, state: { ...INITIAL, step: "end" } })],
    ["an unknown step", JSON.stringify({ v: 2, state: { ...INITIAL, step: "shelf" } })],
  ])("starts over on %s", (_, raw) => {
    if (raw !== null) sessionStorage.setItem(FLOW_KEY, raw);
    expect(loadFlow()).toEqual(INITIAL);
  });

  it("never throws when storage is blocked", () => {
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => { throw new Error("blocked"); });
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => { throw new Error("blocked"); });
    expect(() => saveFlow(INITIAL)).not.toThrow();
    expect(loadFlow()).toEqual(INITIAL);
  });
});
