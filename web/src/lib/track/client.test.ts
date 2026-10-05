import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { sendToAmplitude } from "./amplitude";
import { NO_CAMPAIGN } from "./campaign";
import { track, trackStored } from "./client";
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
    track("question_back_clicked", { node_id: "branch", depth: 2, source: "question" });
    expect(send).toHaveBeenCalledTimes(1);
    const [url, blob] = send.mock.calls[0];
    expect(url).toBe("/api/track");
    expect(blob).toBeInstanceOf(Blob);
    const text = await blob.text();
    const data = JSON.parse(text);
    expect(data.name).toBe("question_back_clicked");
    expect(data.props).toEqual({ node_id: "branch", depth: 2, source: "question" });
    expect(data.common.anon_id).toBeDefined();
  });

  it("never throws when sending fails", () => {
    Object.defineProperty(navigator, "sendBeacon", { value: () => { throw new Error("offline"); }, configurable: true });
    expect(() => track("site_visited", NO_CAMPAIGN)).not.toThrow();
  });

  it("falls back to fetch when sendBeacon returns false", () => {
    const send = vi.fn().mockReturnValue(false);
    const fetchMock = vi.fn().mockResolvedValue({ ok: true });
    Object.defineProperty(navigator, "sendBeacon", { value: send, configurable: true });
    vi.stubGlobal("fetch", fetchMock);
    track("site_visited", NO_CAMPAIGN);
    expect(send).toHaveBeenCalledTimes(1);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, opts] = fetchMock.mock.calls[0];
    expect(url).toBe("/api/track");
    expect(opts.method).toBe("POST");
  });

  it("also hands the same event to Amplitude with the common props", () => {
    Object.defineProperty(navigator, "sendBeacon", { value: vi.fn().mockReturnValue(true), configurable: true });
    track("path_completed", { scope_id: "all", depth: 3, unsure_count: 1 });
    expect(sendToAmplitude).toHaveBeenCalledTimes(1);
    const [name, props, common] = vi.mocked(sendToAmplitude).mock.calls[0];
    expect(name).toBe("path_completed");
    expect(props).toEqual({ scope_id: "all", depth: 3, unsure_count: 1 });
    expect(common?.anon_id).toMatch(/^[0-9a-f-]{36}$/);
  });

  it("still sends to Supabase (/api/track) when Amplitude throws", () => {
    const send = vi.fn().mockReturnValue(true);
    Object.defineProperty(navigator, "sendBeacon", { value: send, configurable: true });
    vi.mocked(sendToAmplitude).mockImplementation(() => { throw new Error("amplitude down"); });
    expect(() => track("site_visited", NO_CAMPAIGN)).not.toThrow();
    expect(send).toHaveBeenCalledTimes(1);
  });

  it("still sends to Amplitude when the Supabase path fails", () => {
    Object.defineProperty(navigator, "sendBeacon", { value: () => { throw new Error("offline"); }, configurable: true });
    track("site_visited", NO_CAMPAIGN);
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
    track("entry_selected", { source: "home" });
    const [before, ending, after] = await postedRounds(send);
    expect(ending).toBe(before);
    expect(after).toBe(before + 1);
  });

  it("ends the round after redraw_clicked too — P4 only has to send E-19", async () => {
    expect(ROUND_ENDING_EVENTS).toEqual(["redraw_clicked", "home_clicked"]);
    const send = vi.fn().mockReturnValue(true);
    Object.defineProperty(navigator, "sendBeacon", { value: send, configurable: true });
    track("redraw_clicked", { curious_count: 0 });
    track("bookmark_shown", { book_id: "9788998441012", position: 1, one_liner_style: "question", pick_type: "recommended", art: {}, challenge_rule: null, challenge_genre: null });
    const [ending, next] = await postedRounds(send);
    expect(next).toBe(ending + 1);
  });

  it("keeps the round for every other event — going back and a new draw stay in the same round", async () => {
    const send = vi.fn().mockReturnValue(true);
    Object.defineProperty(navigator, "sendBeacon", { value: send, configurable: true });
    track("question_answered", { node_id: "start", kind: "narrow", choice: "A", depth: 1, position: 1, elapsed_ms: 10 });
    track("path_completed", { scope_id: "all", depth: 3, unsure_count: 1 });
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

  it("refuses E-31 at run time too — it is stored by /api/feedback, never through /api/track (taxonomy 2-7, v0.10)", () => {
    const send = vi.fn().mockReturnValue(true);
    const fetchMock = vi.fn();
    Object.defineProperty(navigator, "sendBeacon", { value: send, configurable: true });
    vi.stubGlobal("fetch", fetchMock);
    // @ts-expect-error — the type forbids it as well
    track("feedback_sent", { feedback_text: "x", text_length: 1 });
    expect(send).not.toHaveBeenCalled();
    expect(fetchMock).not.toHaveBeenCalled();
    expect(sendToAmplitude).not.toHaveBeenCalled();
  });
});

describe("trackStored (taxonomy 2-7, v0.10 — E-31)", () => {
  const common = { anon_id: "a", user_id: null, session_id: "s", round: 3, entry: null, mode: null, screen_version: "v1",
    referrer: "", is_returning: false, device: "phone", is_in_app_browser: false } as const;

  beforeEach(() => { vi.mocked(sendToAmplitude).mockReset(); });
  afterEach(() => vi.unstubAllGlobals());

  it("sends only the Amplitude copy, with the common props the route stored — nothing to /api/track", () => {
    const send = vi.fn();
    const fetchMock = vi.fn();
    Object.defineProperty(navigator, "sendBeacon", { value: send, configurable: true });
    vi.stubGlobal("fetch", fetchMock);
    trackStored("feedback_sent", { feedback_text: "좋아요", text_length: 3 }, common);
    expect(sendToAmplitude).toHaveBeenCalledWith("feedback_sent", { feedback_text: "좋아요", text_length: 3 }, common);
    expect(send).not.toHaveBeenCalled();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("never throws when Amplitude does", () => {
    vi.mocked(sendToAmplitude).mockImplementation(() => { throw new Error("down"); });
    expect(() => trackStored("feedback_sent", { feedback_text: "x", text_length: 1 }, common)).not.toThrow();
  });

  it("only takes events stored by their own route — others are refused by type and at run time", () => {
    // @ts-expect-error — site_visited goes through track()
    trackStored("site_visited", {}, common);
    expect(sendToAmplitude).not.toHaveBeenCalled();
  });
});
