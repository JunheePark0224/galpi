import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { sendToAmplitude } from "./amplitude";
import { track } from "./client";

vi.mock("./amplitude", () => ({ sendToAmplitude: vi.fn(), startAmplitude: vi.fn() }));

describe("track", () => {
  const originalBeacon = Object.getOwnPropertyDescriptor(navigator, "sendBeacon");

  beforeEach(() => { vi.mocked(sendToAmplitude).mockReset(); });
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
    if (originalBeacon) Object.defineProperty(navigator, "sendBeacon", originalBeacon);
    else Reflect.deleteProperty(navigator, "sendBeacon");
  });

  it("posts the event with common props to /api/track", async () => {
    const send = vi.fn().mockReturnValue(true);
    Object.defineProperty(navigator, "sendBeacon", { value: send, configurable: true });
    track("entry_selected", { entry: "leaf" });
    expect(send).toHaveBeenCalledTimes(1);
    const [url, blob] = send.mock.calls[0];
    expect(url).toBe("/api/track");
    expect(blob).toBeInstanceOf(Blob);
    const text = await blob.text();
    const data = JSON.parse(text);
    expect(data.name).toBe("entry_selected");
    expect(data.props.entry).toBe("leaf");
    expect(data.common.anon_id).toBeDefined();
  });

  it("never throws when sending fails", () => {
    Object.defineProperty(navigator, "sendBeacon", { value: () => { throw new Error("offline"); }, configurable: true });
    expect(() => track("visit")).not.toThrow();
  });

  it("falls back to fetch when sendBeacon returns false", () => {
    const send = vi.fn().mockReturnValue(false);
    const fetchMock = vi.fn().mockResolvedValue({ ok: true });
    Object.defineProperty(navigator, "sendBeacon", { value: send, configurable: true });
    vi.stubGlobal("fetch", fetchMock);
    track("visit");
    expect(send).toHaveBeenCalledTimes(1);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, opts] = fetchMock.mock.calls[0];
    expect(url).toBe("/api/track");
    expect(opts.method).toBe("POST");
  });

  it("also hands the same event to Amplitude with the common props", () => {
    Object.defineProperty(navigator, "sendBeacon", { value: vi.fn().mockReturnValue(true), configurable: true });
    track("chip_selected", { question: "len", value: "short" });
    expect(sendToAmplitude).toHaveBeenCalledTimes(1);
    const [name, props, common] = vi.mocked(sendToAmplitude).mock.calls[0];
    expect(name).toBe("chip_selected");
    expect(props).toEqual({ question: "len", value: "short" });
    expect(common?.anon_id).toMatch(/^[0-9a-f-]{36}$/);
  });

  it("still sends to Supabase (/api/track) when Amplitude throws", () => {
    const send = vi.fn().mockReturnValue(true);
    Object.defineProperty(navigator, "sendBeacon", { value: send, configurable: true });
    vi.mocked(sendToAmplitude).mockImplementation(() => { throw new Error("amplitude down"); });
    expect(() => track("visit")).not.toThrow();
    expect(send).toHaveBeenCalledTimes(1);
  });

  it("still sends to Amplitude when the Supabase path fails", () => {
    Object.defineProperty(navigator, "sendBeacon", { value: () => { throw new Error("offline"); }, configurable: true });
    track("visit");
    expect(sendToAmplitude).toHaveBeenCalledTimes(1);
  });
});
