import { afterEach, describe, expect, it, vi } from "vitest";
import { flowHomeSnapshot, forgetFlowHome, goFlowHome, setFlowHome } from "./homeLink";

describe("the header's [처음으로] reaches the flow (10-09, D안)", () => {
  afterEach(() => forgetFlowHome());

  it("nothing to go back from until the flow says it left S-01", () => {
    expect(flowHomeSnapshot()).toBe(false);
    expect(goFlowHome()).toBe(false);
  });

  it("while the flow is away from S-01 the link runs the flow's own home", () => {
    const home = vi.fn();
    setFlowHome(home);
    expect(flowHomeSnapshot()).toBe(true);
    expect(goFlowHome()).toBe(true);
    expect(home).toHaveBeenCalledTimes(1);
  });

  it("back at S-01 (null) the link has nothing to do", () => {
    const home = vi.fn();
    setFlowHome(home);
    setFlowHome(null);
    expect(flowHomeSnapshot()).toBe(false);
    expect(goFlowHome()).toBe(false);
    expect(home).not.toHaveBeenCalled();
  });

  it("the unregister only clears its own handler", () => {
    const first = vi.fn();
    const second = vi.fn();
    const off = setFlowHome(first);
    setFlowHome(second);
    off();
    goFlowHome();
    expect(second).toHaveBeenCalledTimes(1);
  });
});
