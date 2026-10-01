import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { sendToAmplitude } from "./amplitude";
import { track } from "./client";
import { ROUND_ENDING_EVENTS } from "./schema";

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

  /** Rounds of the events posted so far, read back from the beacon bodies. */
  async function postedRounds(send: ReturnType<typeof vi.fn>): Promise<number[]> {
    return Promise.all(send.mock.calls.map(async ([, blob]) => JSON.parse(await (blob as Blob).text()).common.round as number));
  }

  it("ends the round after home_clicked: it carries the old round, the next event the new one (taxonomy 3-1a)", async () => {
    const send = vi.fn().mockReturnValue(true);
    Object.defineProperty(navigator, "sendBeacon", { value: send, configurable: true });
    track("book_opened", {});
    track("home_clicked", { curious_count: 2, source: "end" });
    track("entry_selected", {});
    const [before, ending, after] = await postedRounds(send);
    expect(ending).toBe(before);
    expect(after).toBe(before + 1);
  });

  it("ends the round after redraw_clicked too — P4 only has to send E-19", async () => {
    expect(ROUND_ENDING_EVENTS).toEqual(["redraw_clicked", "home_clicked"]);
    const send = vi.fn().mockReturnValue(true);
    Object.defineProperty(navigator, "sendBeacon", { value: send, configurable: true });
    track("redraw_clicked", { curious_count: 0 });
    track("bookmark_shown", { book_id: "9788998441012", position: 1, one_liner_style: "question", pick_type: "recommended", art: {} });
    const [ending, next] = await postedRounds(send);
    expect(next).toBe(ending + 1);
  });

  it("keeps the round for every other event — an edit and its new draw stay in the same round", async () => {
    const send = vi.fn().mockReturnValue(true);
    Object.defineProperty(navigator, "sendBeacon", { value: send, configurable: true });
    track("goal_submitted", { topic: "통계", is_free_text: false, len: null, way: null, is_edit: true });
    track("first_page_edited", { changed_items: ["len"] });
    track("bookmark_reacted", { book_id: "1", position: 1, reaction: "pass", pick_type: "random", one_liner_style: "summary" });
    expect(new Set(await postedRounds(send)).size).toBe(1);
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
