import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { CommonProps } from "./schema";

const initAll = vi.fn();
const amplitudeTrack = vi.fn();
vi.mock("@amplitude/unified", () => ({ initAll: (...a: unknown[]) => initAll(...a), track: (...a: unknown[]) => amplitudeTrack(...a) }));

const KEY_NAME = "NEXT_PUBLIC_AMPLITUDE_API_KEY";
const FAKE_KEY = "test-key-not-real";

const common: CommonProps = {
  anon_id: "11111111-1111-4111-8111-111111111111", user_id: null, session_id: "s1", round: 2, entry: "leaf",
  screen_version: "v1", referrer: "https://x.example/", returning: true, device: "phone", in_app_browser: false,
};

async function load() {
  return import("./amplitude");
}

describe("amplitude init", () => {
  beforeEach(() => {
    vi.resetModules();
    initAll.mockReset().mockResolvedValue(undefined);
    amplitudeTrack.mockReset();
    localStorage.clear();
    sessionStorage.clear();
  });
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
  });

  it("does not call initAll without a key and warns exactly once", async () => {
    vi.stubEnv(KEY_NAME, "");
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const { startAmplitude } = await load();
    startAmplitude();
    startAmplitude();
    expect(initAll).not.toHaveBeenCalled();
    expect(warn).toHaveBeenCalledTimes(1);
    expect(warn).toHaveBeenCalledWith("Amplitude API key missing — analytics disabled");
  });

  it("treats a blank key like a missing one", async () => {
    vi.stubEnv(KEY_NAME, "   ");
    vi.spyOn(console, "warn").mockImplementation(() => {});
    const { startAmplitude } = await load();
    startAmplitude();
    expect(initAll).not.toHaveBeenCalled();
  });

  it("calls initAll exactly once with autocapture, 20% replay and the Galpi anonymous id as deviceId", async () => {
    vi.stubEnv(KEY_NAME, FAKE_KEY);
    const { startAmplitude } = await load();
    startAmplitude();
    startAmplitude();
    expect(initAll).toHaveBeenCalledTimes(1);
    const [key, options] = initAll.mock.calls[0];
    expect(key).toBe(FAKE_KEY);
    const stored = localStorage.getItem("galpi.anon");
    expect(stored).toMatch(/^[0-9a-f-]{36}$/);
    expect(options).toEqual({
      analytics: { autocapture: true, deviceId: stored },
      sessionReplay: { sampleRate: 0.2, privacyConfig: { defaultMaskLevel: "medium" } },
    });
  });

  it("reuses an anonymous id that is already stored", async () => {
    vi.stubEnv(KEY_NAME, FAKE_KEY);
    localStorage.setItem("galpi.anon", "22222222-2222-4222-8222-222222222222");
    const { startAmplitude } = await load();
    startAmplitude();
    expect(initAll.mock.calls[0][1].analytics.deviceId).toBe("22222222-2222-4222-8222-222222222222");
  });

  it("never throws when initAll throws or rejects, and stops sending afterwards", async () => {
    vi.stubEnv(KEY_NAME, FAKE_KEY);
    initAll.mockImplementation(() => { throw new Error("boom"); });
    const { startAmplitude, sendToAmplitude } = await load();
    expect(() => startAmplitude()).not.toThrow();
    sendToAmplitude("visit", {}, common);
    expect(amplitudeTrack).not.toHaveBeenCalled();
  });

  it("swallows a rejected init promise", async () => {
    vi.stubEnv(KEY_NAME, FAKE_KEY);
    initAll.mockRejectedValue(new Error("network"));
    const { startAmplitude } = await load();
    expect(() => startAmplitude()).not.toThrow();
    await Promise.resolve();
    await Promise.resolve();
  });
});

describe("sendToAmplitude", () => {
  beforeEach(() => {
    vi.resetModules();
    initAll.mockReset().mockResolvedValue(undefined);
    amplitudeTrack.mockReset();
    localStorage.clear();
    vi.stubEnv(KEY_NAME, FAKE_KEY);
  });
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
  });

  it("sends nothing while Amplitude is off", async () => {
    vi.stubEnv(KEY_NAME, "");
    vi.spyOn(console, "warn").mockImplementation(() => {});
    const { startAmplitude, sendToAmplitude } = await load();
    startAmplitude();
    sendToAmplitude("entry_selected", { entry: "leaf" }, common);
    expect(amplitudeTrack).not.toHaveBeenCalled();
  });

  it("sends the same event name and props plus the analysis-relevant common props", async () => {
    const { startAmplitude, sendToAmplitude } = await load();
    startAmplitude();
    sendToAmplitude("chip_selected", { question: "topic", value: "history", edit: false }, common);
    expect(amplitudeTrack).toHaveBeenCalledTimes(1);
    expect(amplitudeTrack).toHaveBeenCalledWith("chip_selected", {
      entry: "leaf", round: 2, screen_version: "v1", device: "phone", in_app_browser: false, returning: true,
      question: "topic", value: "history", edit: false,
    });
  });

  it("keeps the event's own props when a name collides with a common prop", async () => {
    const { startAmplitude, sendToAmplitude } = await load();
    startAmplitude();
    sendToAmplitude("entry_selected", { entry: "target" }, { ...common, entry: null });
    expect(amplitudeTrack.mock.calls[0][1].entry).toBe("target");
  });

  it("leaves out entry when the visitor has not chosen one yet", async () => {
    const { startAmplitude, sendToAmplitude } = await load();
    startAmplitude();
    sendToAmplitude("visit", {}, { ...common, entry: null });
    expect(amplitudeTrack.mock.calls[0][1]).not.toHaveProperty("entry");
  });

  it("adds prompt_version only to visit", async () => {
    const { startAmplitude, sendToAmplitude } = await load();
    startAmplitude();
    sendToAmplitude("visit", {}, common);
    sendToAmplitude("book_opened", {}, common);
    expect(amplitudeTrack.mock.calls[0][1].prompt_version).toBe("BA400.4");
    expect(amplitudeTrack.mock.calls[1][1]).not.toHaveProperty("prompt_version");
  });

  it("sends props alone when common props are unavailable", async () => {
    const { startAmplitude, sendToAmplitude } = await load();
    startAmplitude();
    sendToAmplitude("book_opened", { a: 1 }, null);
    expect(amplitudeTrack).toHaveBeenCalledWith("book_opened", { a: 1 });
  });

  it("never throws when Amplitude's track throws", async () => {
    const { startAmplitude, sendToAmplitude } = await load();
    startAmplitude();
    amplitudeTrack.mockImplementation(() => { throw new Error("sdk broke"); });
    expect(() => sendToAmplitude("visit", {}, common)).not.toThrow();
  });
});
