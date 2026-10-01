import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { CommonProps } from "./schema";

const { sdk, fakeSdk } = vi.hoisted(() => {
  const state = { loaded: 0, initAll: vi.fn(), track: vi.fn() };
  const factory = () => {
    state.loaded += 1;
    return { initAll: (...a: unknown[]) => state.initAll(...a), track: (...a: unknown[]) => state.track(...a) };
  };
  return { sdk: state, fakeSdk: factory };
});
vi.mock("@amplitude/unified", fakeSdk);

const KEY_NAME = "NEXT_PUBLIC_AMPLITUDE_API_KEY";
const FAKE_KEY = "test-key-not-real";

const common: CommonProps = {
  anon_id: "11111111-1111-4111-8111-111111111111", user_id: null, session_id: "s1", round: 2, entry: "leaf",
  screen_version: "v1", referrer: "https://x.example/", is_returning: true, device: "phone", is_in_app_browser: false,
};

const load = () => import("./amplitude");
/** requestIdleCallback that runs at once, so a test decides when "idle" happens by calling startAmplitude. */
const idleNow = () => vi.stubGlobal("requestIdleCallback", (cb: () => void) => { cb(); return 1; });
const ready = () => vi.waitFor(() => expect(sdk.initAll).toHaveBeenCalled());
const pause = () => new Promise((r) => setTimeout(r, 20));

beforeEach(() => {
  vi.resetModules();
  sdk.loaded = 0;
  sdk.initAll.mockReset().mockResolvedValue(undefined);
  sdk.track.mockReset();
  localStorage.clear();
  sessionStorage.clear();
});
afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  vi.useRealTimers();
});

describe("without a key", () => {
  it("never loads the SDK, warns exactly once and sends nothing", async () => {
    vi.stubEnv(KEY_NAME, "");
    idleNow();
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const { startAmplitude, sendToAmplitude } = await load();
    startAmplitude();
    startAmplitude();
    sendToAmplitude("site_visited", {}, common);
    await pause();
    expect(sdk.loaded).toBe(0);
    expect(sdk.initAll).not.toHaveBeenCalled();
    expect(sdk.track).not.toHaveBeenCalled();
    expect(warn).toHaveBeenCalledTimes(1);
    expect(warn).toHaveBeenCalledWith("Amplitude API key missing — analytics disabled");
  });

  it("treats a blank key like a missing one", async () => {
    vi.stubEnv(KEY_NAME, "   ");
    idleNow();
    vi.spyOn(console, "warn").mockImplementation(() => {});
    const { startAmplitude } = await load();
    startAmplitude();
    await pause();
    expect(sdk.loaded).toBe(0);
  });
});

describe("with a key", () => {
  beforeEach(() => vi.stubEnv(KEY_NAME, FAKE_KEY));

  it("does not touch the SDK until the browser is idle (first paint first)", async () => {
    const idle = vi.fn();
    vi.stubGlobal("requestIdleCallback", idle);
    const { startAmplitude } = await load();
    startAmplitude();
    await pause();
    expect(idle).toHaveBeenCalledTimes(1);
    expect(idle.mock.calls[0][1]).toEqual({ timeout: 2000 });
    expect(sdk.loaded).toBe(0);
    idle.mock.calls[0][0]();
    await ready();
    expect(sdk.loaded).toBe(1);
  });

  it("falls back to a timer where requestIdleCallback does not exist", async () => {
    vi.useFakeTimers();
    vi.stubGlobal("requestIdleCallback", undefined);
    const { startAmplitude } = await load();
    startAmplitude();
    await vi.advanceTimersByTimeAsync(500);
    expect(sdk.loaded).toBe(0);
    await vi.advanceTimersByTimeAsync(1500);
    vi.useRealTimers();
    await ready();
    expect(sdk.initAll).toHaveBeenCalledTimes(1);
  });

  it("calls initAll exactly once: autocapture, 20% replay, engagement skipped, deviceId = anonymous id", async () => {
    idleNow();
    const { startAmplitude } = await load();
    startAmplitude();
    startAmplitude();
    await ready();
    startAmplitude();
    expect(sdk.initAll).toHaveBeenCalledTimes(1);
    const [key, options] = sdk.initAll.mock.calls[0];
    expect(key).toBe(FAKE_KEY);
    const stored = localStorage.getItem("galpi.anon");
    expect(stored).toMatch(/^[0-9a-f-]{36}$/);
    expect(options).toEqual({
      analytics: { autocapture: true, deviceId: stored },
      sessionReplay: { sampleRate: 0.2, privacyConfig: { defaultMaskLevel: "medium" } },
      engagement: { skip: true },
    });
  });

  it("reuses an anonymous id that is already stored", async () => {
    idleNow();
    localStorage.setItem("galpi.anon", "22222222-2222-4222-8222-222222222222");
    const { startAmplitude } = await load();
    startAmplitude();
    await ready();
    expect(sdk.initAll.mock.calls[0][1].analytics.deviceId).toBe("22222222-2222-4222-8222-222222222222");
  });

  it("holds events sent before the SDK is loaded and flushes them in order once initAll has been called", async () => {
    const idle = vi.fn();
    vi.stubGlobal("requestIdleCallback", idle);
    const { startAmplitude, sendToAmplitude } = await load();
    startAmplitude();
    sendToAmplitude("site_visited", {}, common);
    sendToAmplitude("entry_selected", {}, common);
    expect(sdk.track).not.toHaveBeenCalled();
    idle.mock.calls[0][0]();
    await vi.waitFor(() => expect(sdk.track).toHaveBeenCalledTimes(2));
    expect(sdk.track.mock.calls.map((c) => c[0])).toEqual(["site_visited", "entry_selected"]);
    expect(sdk.track.mock.calls[0][1].prompt_version).toBe("BA400.4");
    // later events go straight through
    sendToAmplitude("book_opened", {}, common);
    expect(sdk.track).toHaveBeenCalledTimes(3);
  });

  it("keeps at most 50 waiting events", async () => {
    const idle = vi.fn();
    vi.stubGlobal("requestIdleCallback", idle);
    const { startAmplitude, sendToAmplitude } = await load();
    startAmplitude();
    for (let i = 0; i < 80; i++) sendToAmplitude("chip_selected", { chip_type: "len", chip_value: String(i), is_edit: false }, common);
    idle.mock.calls[0][0]();
    await vi.waitFor(() => expect(sdk.track).toHaveBeenCalled());
    expect(sdk.track).toHaveBeenCalledTimes(50);
    expect(sdk.track.mock.calls[0][1].chip_value).toBe("0");
  });

  it("never throws when initAll throws, stops sending and does not retry", async () => {
    idleNow();
    sdk.initAll.mockImplementation(() => { throw new Error("boom"); });
    const { startAmplitude, sendToAmplitude } = await load();
    expect(() => startAmplitude()).not.toThrow();
    await ready();
    await pause();
    sendToAmplitude("site_visited", {}, common);
    startAmplitude();
    await pause();
    expect(sdk.track).not.toHaveBeenCalled();
    expect(sdk.initAll).toHaveBeenCalledTimes(1);
  });

  it("does not initialise twice after a rejected init (a later route change calls start again)", async () => {
    idleNow();
    sdk.initAll.mockRejectedValue(new Error("plugin step failed"));
    const { startAmplitude, sendToAmplitude } = await load();
    startAmplitude();
    await ready();
    await pause();
    startAmplitude();
    await pause();
    expect(sdk.initAll).toHaveBeenCalledTimes(1);
    sendToAmplitude("site_visited", {}, common);
    expect(sdk.track).not.toHaveBeenCalled();
  });

  it("never throws when the SDK chunk fails to load", async () => {
    idleNow();
    vi.doMock("@amplitude/unified", () => { throw new Error("chunk load failed"); });
    const { startAmplitude, sendToAmplitude } = await load();
    expect(() => startAmplitude()).not.toThrow();
    await pause();
    expect(() => sendToAmplitude("site_visited", {}, common)).not.toThrow();
    vi.doMock("@amplitude/unified", fakeSdk);
  });
});

describe("sendToAmplitude", () => {
  beforeEach(() => {
    vi.stubEnv(KEY_NAME, FAKE_KEY);
    idleNow();
  });

  async function started() {
    const m = await load();
    m.startAmplitude();
    await ready();
    return m.sendToAmplitude;
  }

  it("queues events sent before startAmplitude (AmplitudeInit mounted late) and delivers them once it starts (taxonomy 2-7 a)", async () => {
    const { startAmplitude, sendToAmplitude } = await load();
    sendToAmplitude("site_visited", {}, common);
    sendToAmplitude("entry_selected", {}, common);
    await pause();
    expect(sdk.loaded).toBe(0);
    startAmplitude();
    await vi.waitFor(() => expect(sdk.track).toHaveBeenCalledTimes(2));
    expect(sdk.track.mock.calls.map((c) => c[0])).toEqual(["site_visited", "entry_selected"]);
  });

  it("keeps nothing waiting without a key: those events are never delivered", async () => {
    vi.stubEnv(KEY_NAME, "");
    vi.spyOn(console, "warn").mockImplementation(() => {});
    const { startAmplitude, sendToAmplitude } = await load();
    sendToAmplitude("site_visited", {}, common);
    vi.stubEnv(KEY_NAME, FAKE_KEY);   // only to look inside the queue — a real page never gains a key after its build
    startAmplitude();
    await ready();
    await pause();
    expect(sdk.track).not.toHaveBeenCalled();
  });

  it("gives a queued event the time it happened, not the time it left the queue (taxonomy 2-7 b)", async () => {
    const now = vi.spyOn(Date, "now").mockReturnValue(1_000);
    const { startAmplitude, sendToAmplitude } = await load();
    sendToAmplitude("site_visited", {}, common);
    now.mockReturnValue(5_000);
    startAmplitude();
    await vi.waitFor(() => expect(sdk.track).toHaveBeenCalledTimes(1));
    expect(sdk.track.mock.calls[0][2]).toEqual({ time: 1_000 });
    sendToAmplitude("book_opened", {}, common);
    expect(sdk.track.mock.calls[1][2]).toEqual({ time: 5_000 });
  });

  it("sends the same event name and props plus the analysis-relevant common props", async () => {
    const send = await started();
    send("chip_selected", { chip_type: "topic", chip_value: "데이터 분석", is_edit: false }, common);
    expect(sdk.track).toHaveBeenCalledTimes(1);
    expect(sdk.track).toHaveBeenCalledWith("chip_selected", {
      entry: "leaf", round: 2, screen_version: "v1", device: "phone", is_in_app_browser: false, is_returning: true,
      chip_type: "topic", chip_value: "데이터 분석", is_edit: false,
    }, { time: expect.any(Number) });
  });

  it("sends free_goal_written without goal_text — the written words stay in Supabase (taxonomy 2-7, 6-2)", async () => {
    const send = await started();
    const written = { goal_text: "SQL 공부", topic: "데이터 분석", keywords: ["SQL"], is_matched: true, method: "word" };
    send("free_goal_written", written, common);
    expect(sdk.track.mock.calls[0][1]).not.toHaveProperty("goal_text");
    expect(sdk.track.mock.calls[0][1]).toMatchObject({ topic: "데이터 분석", keywords: ["SQL"], is_matched: true, method: "word" });
    expect(JSON.stringify(sdk.track.mock.calls)).not.toContain("SQL 공부");
  });

  it("drops a prop the spec does not define, so it can neither leak nor shadow a common prop", async () => {
    const send = await started();
    send("entry_selected", { entry: "target", note: "free text" }, { ...common, entry: "leaf" });
    expect(sdk.track.mock.calls[0][1].entry).toBe("leaf");
    expect(sdk.track.mock.calls[0][1]).not.toHaveProperty("note");
  });

  it("leaves out entry when the visitor has not chosen one yet", async () => {
    const send = await started();
    send("site_visited", {}, { ...common, entry: null });
    expect(sdk.track.mock.calls[0][1]).not.toHaveProperty("entry");
  });

  it("adds prompt_version only to site_visited", async () => {
    const send = await started();
    send("site_visited", {}, common);
    send("book_opened", {}, common);
    expect(sdk.track.mock.calls[0][1].prompt_version).toBe("BA400.4");
    expect(sdk.track.mock.calls[1][1]).not.toHaveProperty("prompt_version");
  });

  it("sends props alone when common props are unavailable", async () => {
    const send = await started();
    const own = { chip_type: "len", chip_value: "thin", is_edit: false };
    send("chip_selected", own, null);
    expect(sdk.track).toHaveBeenCalledWith("chip_selected", own, { time: expect.any(Number) });
  });

  it("never throws when Amplitude's track throws", async () => {
    const send = await started();
    sdk.track.mockImplementation(() => { throw new Error("sdk broke"); });
    expect(() => send("site_visited", {}, common)).not.toThrow();
  });
});
