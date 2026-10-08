import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { advance, forgetBackHolds, holdBack, setFlowBack, unwind } from "./deviceBack";

/** Waits for the popstate a history move fires (jsdom moves through its real history a moment later). */
const moved = async (move: () => void) => {
  const popped = new Promise((r) => window.addEventListener("popstate", r, { once: true }));
  move();
  await popped;
  await new Promise((r) => setTimeout(r, 0));
};
const pressBack = () => moved(() => window.history.back());
const depthHere = () => (window.history.state as { galpiDepth?: number } | null)?.galpiDepth ?? 0;

describe("the phone's back key inside the flow (10-08)", () => {
  beforeEach(() => { window.history.pushState({ base: 1 }, ""); forgetBackHolds(); });
  afterEach(() => { forgetBackHolds(); vi.restoreAllMocks(); });

  it("one entry per step forward, keeping the state that was there (Next's router state rides along)", () => {
    advance();
    advance();
    expect(window.history.state).toMatchObject({ base: 1, galpiDepth: 2 });
  });

  it("each press is one step back — several presses in a row too (Chrome only trusts entries added in a tap)", async () => {
    const flow = vi.fn();
    setFlowBack(flow);
    advance();
    advance();
    advance();
    await pressBack();
    await pressBack();
    expect(flow).toHaveBeenCalledTimes(2);
    expect(depthHere()).toBe(1);
  });

  it("forward is followed, never taken for a back press", async () => {
    const flow = vi.fn();
    setFlowBack(flow);
    advance();
    await pressBack();
    await moved(() => window.history.forward());
    expect(flow).toHaveBeenCalledTimes(1);
    expect(depthHere()).toBe(1);
  });

  it("back at S-01 by its own button: the flow's entries are gone over quietly, so the next press leaves the site", async () => {
    const flow = vi.fn();
    setFlowBack(flow);
    advance();
    advance();
    await moved(() => unwind());
    expect(depthHere()).toBe(0);
    expect(flow).not.toHaveBeenCalled();
  });

  it("an open window closes first; closed by its own button it gives its entry back", async () => {
    const flow = vi.fn();
    const sheet = vi.fn();
    setFlowBack(flow);
    advance();
    holdBack(sheet);
    await pressBack();
    expect(sheet).toHaveBeenCalledTimes(1);
    expect(flow).not.toHaveBeenCalled();
    const other = vi.fn();
    const hold = holdBack(other);
    await moved(() => hold.release());
    hold.release();                                  // twice: nothing more
    expect(other).not.toHaveBeenCalled();
    expect(depthHere()).toBe(1);
    await pressBack();
    expect(flow).toHaveBeenCalledTimes(1);
  });

  it("a reload keeps the depth of the entry it is on", async () => {
    window.history.pushState({ galpiDepth: 1 }, "");
    window.history.pushState({ galpiDepth: 2 }, "");
    const flow = vi.fn();
    setFlowBack(flow);                               // the flow mounts again after the reload
    await pressBack();
    expect(flow).toHaveBeenCalledTimes(1);
  });

  it("a flow that went away is not called", async () => {
    const flow = vi.fn();
    const off = setFlowBack(flow);
    advance();
    off();
    await pressBack();
    expect(flow).not.toHaveBeenCalled();
  });
});
