import { afterEach, describe, expect, it, vi } from "vitest";
import { FIRST_GUIDE_KEY, firstGuide, RESULT_GUIDE_KEY, resultGuide } from "./firstGuide";

describe("once-per-browser guide flags (C-20 · C-21)", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    window.localStorage.clear();
    firstGuide.forgetForTests();
    resultGuide.forgetForTests();
  });

  it("keeps the S-05 and S-06 guides apart, each under its own key", () => {
    expect(resultGuide.hasSeen()).toBe(false);
    resultGuide.markSeen();
    expect(window.localStorage.getItem(RESULT_GUIDE_KEY)).toBe("1");
    expect(window.localStorage.getItem(FIRST_GUIDE_KEY)).toBeNull();
    expect(firstGuide.hasSeen()).toBe(false);
    resultGuide.reset();
    expect(resultGuide.hasSeen()).toBe(false);
  });

  it("remembers for this page load when storage is blocked", () => {
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => { throw new Error("blocked"); });
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => { throw new Error("blocked"); });
    expect(resultGuide.hasSeen()).toBe(false);
    expect(() => resultGuide.markSeen()).not.toThrow();
    expect(resultGuide.hasSeen()).toBe(true);
  });
});
