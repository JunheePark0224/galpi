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
    track("first_page_edited", { changed_items: ["len"] });
    expect(send).toHaveBeenCalledTimes(1);
    const [url, blob] = send.mock.calls[0];
    expect(url).toBe("/api/track");
    expect(blob).toBeInstanceOf(Blob);
    const text = await blob.text();
    const data = JSON.parse(text);
    expect(data.name).toBe("first_page_edited");
    expect(data.props).toEqual({ changed_items: ["len"] });
    expect(data.common.anon_id).toBeDefined();
  });

  it("never throws when sending fails", () => {
    Object.defineProperty(navigator, "sendBeacon", { value: () => { throw new Error("offline"); }, configurable: true });
    expect(() => track("site_visited", {})).not.toThrow();
  });

  it("falls back to fetch when sendBeacon returns false", () => {
    const send = vi.fn().mockReturnValue(false);
    const fetchMock = vi.fn().mockResolvedValue({ ok: true });
    Object.defineProperty(navigator, "sendBeacon", { value: send, configurable: true });
    vi.stubGlobal("fetch", fetchMock);
    track("site_visited", {});
    expect(send).toHaveBeenCalledTimes(1);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, opts] = fetchMock.mock.calls[0];
    expect(url).toBe("/api/track");
    expect(opts.method).toBe("POST");
  });

  it("also hands the same event to Amplitude with the common props", () => {
    Object.defineProperty(navigator, "sendBeacon", { value: vi.fn().mockReturnValue(true), configurable: true });
    track("chip_selected", { chip_type: "len", chip_value: "thin", is_edit: false });
    expect(sendToAmplitude).toHaveBeenCalledTimes(1);
    const [name, props, common] = vi.mocked(sendToAmplitude).mock.calls[0];
    expect(name).toBe("chip_selected");
    expect(props).toEqual({ chip_type: "len", chip_value: "thin", is_edit: false });
    expect(common?.anon_id).toMatch(/^[0-9a-f-]{36}$/);
  });

  it("still sends to Supabase (/api/track) when Amplitude throws", () => {
    const send = vi.fn().mockReturnValue(true);
    Object.defineProperty(navigator, "sendBeacon", { value: send, configurable: true });
    vi.mocked(sendToAmplitude).mockImplementation(() => { throw new Error("amplitude down"); });
    expect(() => track("site_visited", {})).not.toThrow();
    expect(send).toHaveBeenCalledTimes(1);
  });

  it("still sends to Amplitude when the Supabase path fails", () => {
    Object.defineProperty(navigator, "sendBeacon", { value: () => { throw new Error("offline"); }, configurable: true });
    track("site_visited", {});
    expect(sendToAmplitude).toHaveBeenCalledTimes(1);
  });

  it("only compiles with the props the spec defines (taxonomy 7-3 ①)", () => {
    Object.defineProperty(navigator, "sendBeacon", { value: vi.fn().mockReturnValue(true), configurable: true });
    // @ts-expect-error — old event name (taxonomy 4-4)
    track("visit", {});
    // @ts-expect-error — entry_selected lost its duplicate `entry` prop
    track("entry_selected", { entry: "leaf" });
    // @ts-expect-error — home_clicked needs source (first_page | end)
    track("home_clicked", { curious_count: 0 });
    // @ts-expect-error — prompt_version is Amplitude only: the Amplitude path adds it, callers never do
    track("site_visited", { prompt_version: "BA400.4" });
    expect(sendToAmplitude).toHaveBeenCalledTimes(4);
  });
});
