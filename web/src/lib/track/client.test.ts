import { afterEach, describe, expect, it, vi } from "vitest";
import { track } from "./client";

describe("track", () => {
  afterEach(() => vi.restoreAllMocks());

  it("posts the event with common props to /api/track", () => {
    const send = vi.fn().mockReturnValue(true);
    Object.defineProperty(navigator, "sendBeacon", { value: send, configurable: true });
    track("entry_selected", { entry: "leaf" });
    expect(send).toHaveBeenCalledTimes(1);
    const [url, blob] = send.mock.calls[0];
    expect(url).toBe("/api/track");
    expect(blob).toBeInstanceOf(Blob);
  });

  it("never throws when sending fails", () => {
    Object.defineProperty(navigator, "sendBeacon", { value: () => { throw new Error("offline"); }, configurable: true });
    expect(() => track("visit")).not.toThrow();
  });
});
