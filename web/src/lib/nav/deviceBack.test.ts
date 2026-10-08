import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { forgetBackHolds, guardFlow, holdBack, setFlowBack } from "./deviceBack";

/** The browser's back key (jsdom moves through its real history and fires popstate a moment later). */
const pressBack = async () => {
  const popped = new Promise((r) => window.addEventListener("popstate", r, { once: true }));
  window.history.back();
  await popped;
  await new Promise((r) => setTimeout(r, 0));
};
const marked = () => Boolean((window.history.state as { galpiBack?: boolean } | null)?.galpiBack);

describe("the phone's back key inside the flow (10-08)", () => {
  beforeEach(() => { window.history.pushState({ base: 1 }, ""); });
  afterEach(() => { forgetBackHolds(); vi.restoreAllMocks(); });

  it("guards one marked entry, keeping the state that was there — never a second one (reload, restored tab)", () => {
    const push = vi.spyOn(window.history, "pushState");
    guardFlow(true);
    guardFlow(true);
    expect(push).toHaveBeenCalledTimes(1);
    expect(window.history.state).toMatchObject({ base: 1, galpiBack: true });
  });

  it("the back key leaves the mark: the flow's handler moves a step", async () => {
    const flow = vi.fn();
    setFlowBack(flow);
    guardFlow(true);
    await pressBack();
    expect(flow).toHaveBeenCalledTimes(1);
    expect(marked()).toBe(false);
  });

  it("back at S-01 by its own button: the mark is taken back quietly, so the next press leaves the site", async () => {
    const flow = vi.fn();
    setFlowBack(flow);
    guardFlow(true);
    const popped = new Promise((r) => window.addEventListener("popstate", r, { once: true }));
    guardFlow(false);
    await popped;
    await new Promise((r) => setTimeout(r, 0));
    expect(marked()).toBe(false);
    expect(flow).not.toHaveBeenCalled();
  });

  it("an open window closes first; closed by its own button it gives its entry back", async () => {
    const flow = vi.fn();
    const sheet = vi.fn();
    setFlowBack(flow);
    guardFlow(true);
    holdBack(sheet);
    await pressBack();
    expect(sheet).toHaveBeenCalledTimes(1);
    expect(flow).not.toHaveBeenCalled();
    expect(marked()).toBe(true);                    // back on the flow's mark

    const other = vi.fn();
    const hold = holdBack(other);
    const popped = new Promise((r) => window.addEventListener("popstate", r, { once: true }));
    hold.release();
    await popped;
    await new Promise((r) => setTimeout(r, 0));
    expect(other).not.toHaveBeenCalled();
    expect(flow).not.toHaveBeenCalled();
    expect(marked()).toBe(true);
    hold.release();                                 // twice: nothing more
  });

  it("a flow that went away is not called", async () => {
    const flow = vi.fn();
    const off = setFlowBack(flow);
    guardFlow(true);
    off();
    await pressBack();
    expect(flow).not.toHaveBeenCalled();
  });
});
