import { afterEach, describe, expect, it, vi } from "vitest";
import { SQL_PATH } from "@/lib/paths/__fixtures__/paths";
import { INITIAL, type FlowState } from "./state";
import { commonProps, setEntry, setMode } from "@/lib/track/common";
import { FLOW_KEY, loadFlow, restoreFlow, saveFlow, shouldResume } from "./storage";

describe("flow storage", () => {
  afterEach(() => {
    sessionStorage.clear();
    vi.restoreAllMocks();
  });

  it("round-trips the state in this tab", () => {
    const s: FlowState = { ...INITIAL, step: "questions", answers: SQL_PATH.slice(0, 3), asked: 3 };
    saveFlow(s);
    expect(loadFlow()).toEqual(s);
  });

  it("turns a request cut off by a reload into a retry", () => {
    saveFlow({ ...INITIAL, step: "book", answers: SQL_PATH, status: "loading", drawId: 1 });
    expect(loadFlow()).toMatchObject({ step: "book", status: "error" });
  });

  it.each([
    ["nothing saved", null],
    ["broken JSON", "{"],
    ["another version", JSON.stringify({ v: 0, state: { ...INITIAL, step: "questions" } })],
    ["a version-5 flow (9 balance questions, 🎯 form)", JSON.stringify({ v: 5, state: { ...INITIAL, step: "leaf", entry: "leaf", choices: ["A"], order: [0, 1, 2, 3, 4, 5, 6, 7, 8] } })],
    ["an unknown step", JSON.stringify({ v: 6, state: { ...INITIAL, step: "shelf" } })],
    ["answers off the map", JSON.stringify({ v: 6, state: { ...INITIAL, step: "questions", answers: [{ node: "branch", choice: "A" }] } })],
    ["answers that are not a list", JSON.stringify({ v: 6, state: { ...INITIAL, step: "questions", answers: "start" } })],
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

describe("shouldResume (reload / back-forward / discarded resume; a fresh open does not)", () => {
  it.each([
    ["reload", false, true],
    ["back_forward", false, true],
    ["navigate", false, false],
    ["prerender", false, false],
    ["navigate", true, true],        // Chrome restores a discarded tab as a plain navigation
    ["reload", true, true],
    [undefined, false, true],        // no navigation timing: keep the old behaviour
    [undefined, true, true],
  ])("type %s, discarded %s -> %s", (navType, discarded, want) => {
    expect(shouldResume(navType, discarded)).toBe(want);
  });
});

describe("shouldResume after a login (P5 decision 5: back to the same book, not the start)", () => {
  it("resumes a fresh navigation that comes back from /auth/callback", () => {
    expect(shouldResume("navigate", false, true)).toBe(true);
    expect(shouldResume("navigate", false, false)).toBe(false);
  });
});

describe("restoreFlow on a fresh open", () => {
  const midRound: FlowState = { ...INITIAL, step: "bookmarks", answers: SQL_PATH.slice(0, 2), index: 2, reactions: ["curious", "pass"], seen: ["b1", "b2"] };

  afterEach(() => sessionStorage.clear());

  it("starts at S-01 with the books already shown still excluded", () => {
    saveFlow(midRound);
    expect(restoreFlow(false)).toEqual({ ...INITIAL, seen: ["b1", "b2"] });
  });

  it("moves to the next round once for a flow that was mid-round", () => {
    saveFlow(midRound);
    const before = commonProps().round;
    restoreFlow(false);
    expect(commonProps().round).toBe(before + 1);
  });

  it("clears the entry chosen in the abandoned round, but not when the saved flow was at home", () => {
    setEntry("leaf");
    setMode("challenge");
    saveFlow({ ...INITIAL, seen: ["b1"] });
    restoreFlow(false);
    expect(commonProps().entry).toBe("leaf");
    saveFlow(midRound);
    restoreFlow(false);
    expect(commonProps().entry).toBeNull();
    expect(commonProps().mode).toBeNull();
  });

  it("does not move the round when the saved flow was already at home", () => {
    saveFlow({ ...INITIAL, seen: ["b1"] });
    const before = commonProps().round;
    expect(restoreFlow(false)).toEqual({ ...INITIAL, seen: ["b1"] });
    expect(commonProps().round).toBe(before);
  });

  it("does not move the round twice when init runs twice (StrictMode)", () => {
    saveFlow(midRound);
    const before = commonProps().round;
    restoreFlow(false);
    restoreFlow(false);
    expect(commonProps().round).toBe(before + 1);
  });

  it("forgets the old flow in storage, so a later reload resumes at S-01", () => {
    saveFlow(midRound);
    restoreFlow(false);
    expect(restoreFlow(true)).toEqual({ ...INITIAL, seen: ["b1", "b2"] });
  });

  it("changes nothing when nothing usable was saved", () => {
    const before = commonProps().round;
    expect(restoreFlow(false)).toEqual(INITIAL);
    expect(commonProps().round).toBe(before);
  });

  it("resumes untouched when asked to", () => {
    saveFlow(midRound);
    const before = commonProps().round;
    expect(restoreFlow(true)).toEqual(midRound);
    expect(commonProps().round).toBe(before);
  });
});

describe("loadFlow reads the navigation type of this document load", () => {
  const mid: FlowState = { ...INITIAL, step: "end", answers: SQL_PATH, seen: ["x"] };

  function stubNavigation(type: string | undefined, wasDiscarded = false) {
    vi.spyOn(performance, "getEntriesByType").mockReturnValue(type === undefined ? [] : ([{ type }] as unknown as PerformanceEntryList));
    Object.defineProperty(document, "wasDiscarded", { value: wasDiscarded, configurable: true });
  }

  /** A fresh module copy = a fresh document load (the decision is kept per document). */
  async function freshLoad() {
    vi.resetModules();
    return import("./storage");
  }

  afterEach(() => {
    Reflect.deleteProperty(document, "wasDiscarded");
    vi.restoreAllMocks();
    sessionStorage.clear();
  });

  it.each(["reload", "back_forward"])("resumes on %s", async (type) => {
    stubNavigation(type);
    const { loadFlow: load, saveFlow: save } = await freshLoad();
    save(mid);
    expect(load()).toEqual(mid);
  });

  it("resumes a discarded tab restored as a plain navigation", async () => {
    stubNavigation("navigate", true);
    const { loadFlow: load, saveFlow: save } = await freshLoad();
    save(mid);
    expect(load()).toEqual(mid);
  });

  it("starts at INITIAL on navigate, keeping seen", async () => {
    stubNavigation("navigate");
    const { loadFlow: load, saveFlow: save } = await freshLoad();
    save(mid);
    expect(load()).toEqual({ ...INITIAL, seen: ["x"] });
  });

  it("resumes when navigation timing is unavailable", async () => {
    stubNavigation(undefined);
    const { loadFlow: load, saveFlow: save } = await freshLoad();
    save(mid);
    expect(load()).toEqual(mid);
  });

  it("resumes when reading navigation timing throws", async () => {
    vi.spyOn(performance, "getEntriesByType").mockImplementation(() => { throw new Error("unsupported"); });
    const { loadFlow: load, saveFlow: save } = await freshLoad();
    save(mid);
    expect(load()).toEqual(mid);
  });

  it("settleOpen decides first and loadFlow adds nothing: one round move, entry cleared", async () => {
    stubNavigation("navigate");
    const { loadFlow: load, saveFlow: save, settleOpen } = await freshLoad();
    const { commonProps: common, setEntry: entry } = await import("@/lib/track/common");
    entry("leaf");
    save(mid);
    const before = common().round;
    settleOpen();
    settleOpen();
    expect(load()).toEqual({ ...INITIAL, seen: ["x"] });
    expect(common()).toMatchObject({ round: before + 1, entry: null, mode: null });
  });

  it("decides once per document: a later mount (browser back from /privacy) resumes", async () => {
    stubNavigation("navigate");
    const { loadFlow: load, saveFlow: save } = await freshLoad();
    save(mid);
    load();                                       // the document's own load: fresh open
    const played: FlowState = { ...mid, step: "questions" };
    save(played);                                 // the visitor plays on, goes to /privacy and comes back
    expect(load()).toEqual(played);
  });
});
