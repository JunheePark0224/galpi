import { afterEach, describe, expect, it, vi } from "vitest";
import { track } from "./client";

describe("track", () => {
  const originalBeacon = Object.getOwnPropertyDescriptor(navigator, "sendBeacon");

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
});
