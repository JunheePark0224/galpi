import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const load = () => import("./store");
const answer = (body: unknown, ok = true) => vi.fn().mockResolvedValue({ ok, json: async () => body });

beforeEach(() => vi.resetModules());
afterEach(() => vi.unstubAllGlobals());

describe("account store (header, S-06 꽂기, S-09)", () => {
  it("starts unknown, then follows /api/me", async () => {
    const fetchMe = answer({ enabled: true, loggedIn: true, id: "u1", count: 3 });
    vi.stubGlobal("fetch", fetchMe);
    const { accountSnapshot, loadAccount } = await load();
    expect(accountSnapshot()).toEqual({ status: "unknown", id: null, count: 0 });
    await loadAccount();
    expect(accountSnapshot()).toEqual({ status: "in", id: "u1", count: 3 });
    expect(fetchMe).toHaveBeenCalledWith("/api/me", { cache: "no-store", credentials: "same-origin" });
  });

  it("asks once per page unless forced", async () => {
    const fetchMe = answer({ enabled: true, loggedIn: false, id: null, count: 0 });
    vi.stubGlobal("fetch", fetchMe);
    const { accountSnapshot, loadAccount } = await load();
    await Promise.all([loadAccount(), loadAccount()]);
    await loadAccount();
    expect(fetchMe).toHaveBeenCalledTimes(1);
    expect(accountSnapshot().status).toBe("out");
    await loadAccount(true);
    expect(fetchMe).toHaveBeenCalledTimes(2);
  });

  it("is off when login is not set up, and out when the question fails", async () => {
    vi.stubGlobal("fetch", answer({ enabled: false, loggedIn: false, id: null, count: 0 }));
    const first = await load();
    await first.loadAccount();
    expect(first.accountSnapshot().status).toBe("off");
    vi.resetModules();
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("offline")));
    const second = await load();
    await second.loadAccount();
    expect(second.accountSnapshot().status).toBe("out");
  });

  it("tells listeners about count changes and logout", async () => {
    vi.stubGlobal("fetch", answer({ enabled: true, loggedIn: true, id: "u1", count: 1 }));
    const { accountSnapshot, loadAccount, setSavedCount, signedOut, subscribeAccount } = await load();
    await loadAccount();
    const seen = vi.fn();
    const stop = subscribeAccount(seen);
    setSavedCount(2);
    expect(accountSnapshot().count).toBe(2);
    signedOut();
    expect(accountSnapshot()).toEqual({ status: "out", id: null, count: 0 });
    expect(seen).toHaveBeenCalledTimes(2);
    stop();
  });

  it("opens and closes the login sheet with where it was opened from", async () => {
    const { closeLoginSheet, loginSheetSnapshot, openLoginSheet } = await load();
    expect(loginSheetSnapshot()).toBeNull();
    openLoginSheet("save");
    expect(loginSheetSnapshot()).toEqual({ source: "save" });
    closeLoginSheet();
    expect(loginSheetSnapshot()).toBeNull();
  });
});
