import { afterEach, describe, expect, it, vi } from "vitest";
import { forgetPullHintForTests, hasSeenPullHint, markPullHintSeen, metDate, PULL_HINT_KEY } from "./bookmarkPull";

describe("metDate (C-13 back: 만난 날 YYYY. M. D.)", () => {
  it("writes the local date without leading zeros", () => {
    expect(metDate(new Date(2026, 9, 1))).toBe("2026. 10. 1.");
    expect(metDate(new Date(2027, 0, 9, 23, 59))).toBe("2027. 1. 9.");
  });
});

describe("pull hint (C-16: first time only, per browser)", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    window.localStorage.clear();
    forgetPullHintForTests();
  });

  it("is unseen until marked, then seen", () => {
    expect(hasSeenPullHint()).toBe(false);
    markPullHintSeen();
    expect(window.localStorage.getItem(PULL_HINT_KEY)).toBe("1");
    expect(hasSeenPullHint()).toBe(true);
  });

  it("falls back to this page load when storage is blocked: shown once, never throws", () => {
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => { throw new Error("blocked"); });
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => { throw new Error("blocked"); });
    expect(hasSeenPullHint()).toBe(false);
    expect(() => markPullHintSeen()).not.toThrow();
    expect(hasSeenPullHint()).toBe(true);
  });
});
