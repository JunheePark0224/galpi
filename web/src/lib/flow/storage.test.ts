import { afterEach, describe, expect, it, vi } from "vitest";
import { INITIAL, type FlowState } from "./state";
import { commonProps, setEntry } from "@/lib/track/common";
import { FLOW_KEY, loadFlow, restoreFlow, saveFlow, shouldResume } from "./storage";

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
    ["a version-2 flow (may carry the removed 마음·회복 keyword)", JSON.stringify({ v: 2, state: { ...INITIAL, step: "end" } })],
    ["an unknown step", JSON.stringify({ v: 3, state: { ...INITIAL, step: "shelf" } })],
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

describe("restoreFlow on a fresh open", () => {
  const midRound: FlowState = { ...INITIAL, step: "bookmarks", entry: "leaf", choices: ["A", "B"], index: 2, reactions: ["curious", "pass"], seen: ["b1", "b2"] };

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
    saveFlow({ ...INITIAL, seen: ["b1"] });
    restoreFlow(false);
    expect(commonProps().entry).toBe("leaf");
    saveFlow(midRound);
    restoreFlow(false);
    expect(commonProps().entry).toBeNull();
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
  const mid: FlowState = { ...INITIAL, step: "end", entry: "target", seen: ["x"] };

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
    expect(common()).toMatchObject({ round: before + 1, entry: null });
  });

  it("decides once per document: a later mount (browser back from /privacy) resumes", async () => {
    stubNavigation("navigate");
    const { loadFlow: load, saveFlow: save } = await freshLoad();
    save(mid);
    load();                                       // the document's own load: fresh open
    const played: FlowState = { ...mid, step: "leaf", entry: "leaf" };
    save(played);                                 // the visitor plays on, goes to /privacy and comes back
    expect(load()).toEqual(played);
  });
});
