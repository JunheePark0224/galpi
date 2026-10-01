import { act, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const track = vi.fn();
const setAmplitudeUser = vi.fn();
const setUserId = vi.fn();
vi.mock("@/lib/track/client", () => ({ track: (...a: unknown[]) => track(...a) }));
vi.mock("@/lib/track/amplitude", () => ({ setAmplitudeUser: (...a: unknown[]) => setAmplitudeUser(...a) }));
vi.mock("@/lib/track/common", () => ({ setUserId: (...a: unknown[]) => setUserId(...a) }));

const me = (body: unknown) => vi.fn().mockResolvedValue({ ok: true, json: async () => body });
const IN = { enabled: true, loggedIn: true, id: "u1", count: 0 };

async function mount(url: string, body: unknown) {
  vi.resetModules();
  window.history.replaceState({ keep: 1 }, "", url);
  const fetchMe = me(body);
  vi.stubGlobal("fetch", fetchMe);
  const [{ LoginReturn }, store] = await Promise.all([import("./LoginReturn"), import("@/lib/account/store")]);
  await act(async () => { render(<LoginReturn />); });
  await act(async () => { await store.loadAccount(); });
  return { store, fetchMe };
}

describe("LoginReturn (E-14 once, then the address is clean)", () => {
  beforeEach(() => vi.useRealTimers());
  afterEach(() => { vi.unstubAllGlobals(); vi.clearAllMocks(); });

  it("sends E-14 with the provider and first-login flag, names the person in Amplitude, and hands the return to S-06", async () => {
    const { store, fetchMe } = await mount("/?y=2&login=kakao&first=1#top", IN);
    expect(track).toHaveBeenCalledWith("login_completed", { provider: "kakao", is_first_login: true });
    expect(setUserId).toHaveBeenCalledWith("u1");
    expect(setAmplitudeUser).toHaveBeenCalledWith("u1", "kakao");
    expect(store.loginReturnSnapshot()).toBe("kakao");
    expect(window.location.pathname + window.location.search + window.location.hash).toBe("/?y=2#top");
    expect(window.history.state).toEqual({ keep: 1 });
    expect(fetchMe).toHaveBeenCalledTimes(1);
  });

  it("on an ordinary visit only names an already logged-in person, without E-14", async () => {
    await mount("/library", IN);
    expect(track).not.toHaveBeenCalled();
    expect(setAmplitudeUser).toHaveBeenCalledWith("u1", undefined);
    expect(window.location.search).toBe("");
  });

  it("says the login did not work after ?login=failed, or when no session came back", async () => {
    await mount("/?login=failed", { enabled: true, loggedIn: false, id: null, count: 0 });
    expect(screen.getByRole("status")).toHaveTextContent("로그인하지 못했어요. 다시 한 번 해 주세요.");
    expect(track).not.toHaveBeenCalled();
    await mount("/?login=google&first=0", { enabled: true, loggedIn: false, id: null, count: 0 });
    expect(track).not.toHaveBeenCalled();
    expect(screen.getAllByRole("status").at(-1)).toHaveTextContent("로그인하지 못했어요");
  });
});
