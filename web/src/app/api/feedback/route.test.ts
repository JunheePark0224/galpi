// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/track/store", () => ({ saveEvent: vi.fn() }));
vi.mock("@/lib/server/notify", () => ({ notifyFeedback: vi.fn().mockResolvedValue("sent") }));
/** next/server `after` needs a live request scope: here the callbacks are kept and run by the test, after the answer. */
const { afters } = vi.hoisted(() => ({ afters: [] as (() => unknown)[] }));
vi.mock("next/server", () => ({ after: (fn: () => unknown) => { afters.push(fn); } }));
const runAfters = async () => { for (const fn of afters.splice(0)) await fn(); };
let sessionUser: string | null = null;
vi.mock("@/lib/auth/server", () => ({ authClient: async () => ({}), sessionUserId: async () => sessionUser }));
import { notifyFeedback } from "@/lib/server/notify";
import { saveEvent } from "@/lib/track/store";
import { POST } from "./route";

const common = { anon_id: "anon-1", user_id: null, session_id: "s", round: 2, entry: null, mode: null, screen_version: "v1",
  referrer: "", is_returning: true, device: "phone", is_in_app_browser: false };
const LETTER = "책갈피 고르는 게 재밌어요";
let ip = 0;
/** A fresh address per request unless one is given: the 5-a-minute limit is tested on its own. */
const req = (body: unknown, headers: Record<string, string> = { origin: "http://x", "x-forwarded-for": `8.8.0.${++ip}` }) =>
  new Request("http://x/api/feedback", { method: "POST", body: JSON.stringify(body), headers });
const logs = [vi.spyOn(console, "warn").mockImplementation(() => {}), vi.spyOn(console, "error").mockImplementation(() => {})];

describe("POST /api/feedback (PRD F-26, E-31)", () => {
  beforeEach(() => { vi.mocked(saveEvent).mockResolvedValue(true); sessionUser = null; });
  afterEach(() => { vi.clearAllMocks(); vi.unstubAllEnvs(); afters.length = 0; });

  it("stores E-31 with the trimmed letter and its length, then sends the notice and answers 201", async () => {
    const res = await POST(req({ text: `  ${LETTER}\n`, common }));
    expect(res.status).toBe(201);
    expect(await res.json()).toEqual({ stored: true });
    expect(saveEvent).toHaveBeenCalledWith({
      name: "feedback_sent", props: { feedback_text: LETTER, text_length: LETTER.length }, common,
    });
    expect(notifyFeedback).not.toHaveBeenCalled();     // the answer does not wait for the notice
    await runAfters();
    expect(notifyFeedback).toHaveBeenCalledTimes(1);
    expect(notifyFeedback).toHaveBeenCalledWith();   // nothing of the letter goes to the notice
  });

  it("links the letter to the verified login, never to a user_id the browser wrote", async () => {
    sessionUser = "u-real";
    const withCookie = new Request("http://x/api/feedback", {
      method: "POST", body: JSON.stringify({ text: LETTER, common: { ...common, user_id: "someone-else" } }),
      headers: { origin: "http://x", "x-forwarded-for": "8.8.1.1", cookie: "sb-proj-auth-token=abc" },
    });
    await POST(withCookie);
    expect(saveEvent).toHaveBeenCalledWith(expect.objectContaining({ common: { ...common, user_id: "u-real" } }));
    await POST(req({ text: LETTER, common: { ...common, user_id: "someone-else" } }));
    expect(saveEvent).toHaveBeenLastCalledWith(expect.objectContaining({ common: { ...common, user_id: null } }));
  });

  it.each([
    ["an empty letter", { text: "", common }],
    ["only spaces", { text: "   \n ", common }],
    ["no text", { common }],
    ["a number", { text: 5, common }],
    ["501 characters", { text: "가".repeat(501), common }],
    ["no common block", { text: LETTER }],
    ["a broken common block", { text: LETTER, common: { ...common, device: "toaster" } }],
    ["an array", [LETTER]],
  ])("refuses %s with 400 and stores nothing", async (_, body) => {
    const res = await POST(req(body));
    expect(res.status).toBe(400);
    expect(saveEvent).not.toHaveBeenCalled();
    expect(afters).toHaveLength(0);
  });

  it("keeps exactly 500 characters", async () => {
    const res = await POST(req({ text: "가".repeat(500), common }));
    expect(res.status).toBe(201);
    expect(saveEvent).toHaveBeenCalledWith(expect.objectContaining({ props: { feedback_text: "가".repeat(500), text_length: 500 } }));
  });

  it("answers 202 { stored: false } and sends no notice when the store is deliberately off (TRACK_STORE=off: local, E2E)", async () => {
    vi.stubEnv("TRACK_STORE", "off");
    vi.mocked(saveEvent).mockResolvedValue(false);
    const res = await POST(req({ text: LETTER, common }));
    expect(res.status).toBe(202);
    expect(await res.json()).toEqual({ stored: false });
    expect(afters).toHaveLength(0);
  });

  it("answers 503, not 202, in production when the store is simply not configured — never thanks for a letter nobody kept", async () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("TRACK_STORE", "");
    vi.mocked(saveEvent).mockResolvedValue(false);
    const res = await POST(req({ text: LETTER, common }));
    expect(res.status).toBe(503);
    expect(afters).toHaveLength(0);
  });

  it("answers 500 when the database fails, without logging the letter or sending a notice", async () => {
    vi.mocked(saveEvent).mockRejectedValue(new Error("events insert failed: 42P01"));
    const res = await POST(req({ text: LETTER, common }));
    expect(res.status).toBe(500);
    expect(afters).toHaveLength(0);
    const logged = logs.flatMap((spy) => spy.mock.calls.flat()).map(String).join(" ");
    expect(logged).not.toContain(LETTER);
  });

  it("still answers 201 when the notice fails — the stored letter is what counts", async () => {
    vi.mocked(notifyFeedback).mockResolvedValueOnce("failed");
    expect((await POST(req({ text: LETTER, common }))).status).toBe(201);
    await runAfters();
    expect(notifyFeedback).toHaveBeenCalledTimes(1);
  });

  it("refuses another site with 403", async () => {
    const res = await POST(req({ text: LETTER, common }, { origin: "https://evil.example", "x-forwarded-for": "8.8.2.1" }));
    expect(res.status).toBe(403);
    expect(saveEvent).not.toHaveBeenCalled();
  });

  it("refuses a body over 4 KB with 413", async () => {
    const res = await POST(req({ text: LETTER, common, pad: "x".repeat(5000) }));
    expect(res.status).toBe(413);
    expect(saveEvent).not.toHaveBeenCalled();
  });

  it("answers 429 after 5 letters a minute from one address", async () => {
    const from = { origin: "http://x", "x-forwarded-for": "8.8.3.1" };
    for (let i = 0; i < 5; i++) expect((await POST(req({ text: LETTER, common }, from))).status).toBe(201);
    const res = await POST(req({ text: LETTER, common }, from));
    expect(res.status).toBe(429);
    expect(res.headers.get("Retry-After")).toBeTruthy();
    expect(saveEvent).toHaveBeenCalledTimes(5);
  });

  it("never logs the letter on any path — stored, refused, too large, unstored, notice failed", async () => {
    await POST(req({ text: LETTER, common }));
    await POST(req({ text: `${LETTER}`.repeat(30), common }));                     // 400: too long
    await POST(req({ text: LETTER, common: { ...common, device: "toaster" } }));     // 400: bad common
    await POST(req({ text: LETTER, common, pad: "x".repeat(5000) }));               // 413
    vi.mocked(notifyFeedback).mockResolvedValueOnce("failed");
    await POST(req({ text: LETTER, common }));
    await runAfters();
    vi.mocked(saveEvent).mockResolvedValueOnce(false);
    await POST(req({ text: LETTER, common }));                                      // 503
    const logged = logs.flatMap((spy) => spy.mock.calls.flat()).map(String).join(" ");
    expect(logged).not.toContain(LETTER);
  });
});
