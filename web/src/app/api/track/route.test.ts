// @vitest-environment node
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/track/store", () => ({ saveEvent: vi.fn().mockResolvedValue(false) }));
let sessionUser: string | null = null;
vi.mock("@/lib/auth/server", () => ({
  authClient: async () => ({}),
  sessionUserId: async () => { if (sessionUser === "throw") throw new Error("auth down"); return sessionUser; },
}));
import { saveEvent } from "@/lib/track/store";
import { POST } from "./route";

const common = { anon_id: "a", user_id: null, session_id: "s", round: 1, entry: null, mode: null, screen_version: "v1",
  referrer: "", is_returning: false, device: "phone", is_in_app_browser: false };
const ORIGIN = "http://x";
/** The route flags dropped props on the server log; keep the test output quiet and read the calls instead. */
const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
const from = (ip: string) => ({ origin: ORIGIN, "x-forwarded-for": ip });
const req = (body: unknown, headers: Record<string, string> = from("9.9.9.9")) =>
  new Request("http://x/api/track", { method: "POST", body: JSON.stringify(body), headers });

describe("POST /api/track", () => {
  afterEach(() => vi.clearAllMocks());

  it("accepts a known event", async () => {
    const res = await POST(req({ name: "site_visited", props: {}, common }));
    expect(res.status).toBe(202);
    expect(saveEvent).toHaveBeenCalledWith({ name: "site_visited", props: {}, common });
  });

  it("refuses E-31 feedback_sent — only /api/feedback stores it (taxonomy 2-7, v0.10)", async () => {
    const res = await POST(req({ name: "feedback_sent", props: { feedback_text: "x", text_length: 1 }, common }));
    expect(res.status).toBe(400);
    expect(saveEvent).not.toHaveBeenCalled();
  });

  it("rejects an unknown event name", async () => {
    const res = await POST(req({ name: "drop_table", props: {}, common }));
    expect(res.status).toBe(400);
    expect(saveEvent).not.toHaveBeenCalled();
  });

  it("rejects bodies that are too large with 413", async () => {
    const res = await POST(req({ name: "site_visited", props: { big: "x".repeat(9000) }, common }));
    expect(res.status).toBe(413);
  });

  it("measures the size limit in bytes, not characters", async () => {
    const res = await POST(req({ name: "site_visited", props: { big: "가".repeat(3000) }, common }));
    expect(res.status).toBe(413);
    expect(saveEvent).not.toHaveBeenCalled();
  });

  it("refuses another origin with 403 and stores nothing", async () => {
    const res = await POST(req({ name: "site_visited", props: {}, common }, { origin: "https://evil.example", "x-forwarded-for": "9.9.9.9" }));
    expect(res.status).toBe(403);
    expect(await res.json()).toEqual({ error: "forbidden" });
    expect(saveEvent).not.toHaveBeenCalled();
  });

  it("refuses a request with neither Origin nor Referer", async () => {
    expect((await POST(req({ name: "site_visited", props: {}, common }, {}))).status).toBe(403);
    expect(saveEvent).not.toHaveBeenCalled();
  });

  it("accepts a same-site Referer when there is no Origin", async () => {
    expect((await POST(req({ name: "site_visited", props: {}, common }, { referer: "http://x/privacy" }))).status).toBe(202);
  });

  it("answers 429 with Retry-After after 120 events a minute from one address", async () => {
    for (let i = 0; i < 120; i++) expect((await POST(req({ name: "site_visited", props: {}, common }, from("7.7.7.7")))).status).toBe(202);
    const res = await POST(req({ name: "site_visited", props: {}, common }, from("7.7.7.7")));
    expect(res.status).toBe(429);
    expect(Number(res.headers.get("Retry-After"))).toBeGreaterThan(0);
    // another address is not affected
    expect((await POST(req({ name: "site_visited", props: {}, common }, from("7.7.7.8")))).status).toBe(202);
  });

  it("rejects non-object bodies", async () => {
    for (const body of [null, 1, "site_visited", [1]]) {
      const res = await POST(req(body));
      expect(res.status).toBe(400);
    }
  });

  it("rejects a missing or array common", async () => {
    expect((await POST(req({ name: "site_visited", props: {} }))).status).toBe(400);
    expect((await POST(req({ name: "site_visited", props: {}, common: [] }))).status).toBe(400);
    expect(saveEvent).not.toHaveBeenCalled();
  });

  it("rejects a common block with a missing key, a wrong type or a too-long string", async () => {
    const missing: Record<string, unknown> = { ...common };
    delete missing.anon_id;
    for (const bad of [missing, { ...common, round: "1" }, { ...common, device: "tablet" }, { ...common, anon_id: "x".repeat(201) }]) {
      expect((await POST(req({ name: "site_visited", props: {}, common: bad }))).status).toBe(400);
    }
    expect(saveEvent).not.toHaveBeenCalled();
  });

  it("keeps the event and stores only the referrer's host when an older page sends a full address (taxonomy v1.4)", async () => {
    const res = await POST(req({ name: "site_visited", props: {}, common: { ...common, referrer: "https://S.example/search?q=" + "x".repeat(900) } }));
    expect(res.status).toBe(202);
    expect(vi.mocked(saveEvent).mock.calls[0][0].common.referrer).toBe("s.example");
  });

  it("keeps the event and stores an empty referrer when it is not an address or a host", async () => {
    const res = await POST(req({ name: "site_visited", props: {}, common: { ...common, referrer: "x".repeat(499) + "😀" } }));
    expect(res.status).toBe(202);
    expect(vi.mocked(saveEvent).mock.calls[0][0].common.referrer).toBe("");
  });

  it("stores the visit's utm tags, cut to 40 characters", async () => {
    const props = { utm_source: "threads", utm_medium: "social", utm_campaign: "c".repeat(60) };
    expect((await POST(req({ name: "site_visited", props, common }))).status).toBe(202);
    expect(saveEvent).toHaveBeenCalledWith({
      name: "site_visited", props: { utm_source: "threads", utm_medium: "social", utm_campaign: "c".repeat(40) }, common,
    });
  });

  it("answers 400, not 500, for absurdly deep nesting that fits in the size cap", async () => {
    const deep = (n: number) => "[".repeat(n) + "]".repeat(n);
    const withProps = (n: number) => new Request("http://x/api/track", { method: "POST", headers: from("9.9.9.9"),
      body: `{"name":"site_visited","props":{"a":${deep(n)}},"common":${JSON.stringify(common)}}` });
    expect((await POST(withProps(3300))).status).toBe(400);
    expect((await POST(new Request("http://x/api/track", { method: "POST", headers: from("9.9.9.9"), body: deep(3300) }))).status).toBe(400);
    expect((await POST(withProps(10))).status).toBe(202);      // ordinary nesting is fine
    expect(saveEvent).toHaveBeenCalledTimes(1);
  });

  it("keeps the event and strips NUL and lone surrogates that Postgres jsonb would refuse", async () => {
    const dirty = { ...common, anon_id: "a\u0000b\ud800c" };
    const props = { node_id: "lea\u0000rn\udc00", kind: "narrow", choice: "A", depth: 1, position: 1, elapsed_ms: 5, "\u0000k": 1 };
    const res = await POST(req({ name: "question_answered", props, common: dirty }));
    expect(res.status).toBe(202);
    expect(saveEvent).toHaveBeenCalledWith({
      name: "question_answered",
      props: { node_id: "learn\ufffd", kind: "narrow", choice: "A", depth: 1, position: 1, elapsed_ms: 5 },
      common: { ...common, anon_id: "ab\ufffdc" },
    });
  });

  it("stores only the props EVENT_SPEC defines and flags the dropped ones by name, never by value", async () => {
    const props = { book_id: "9788998441012", index: 2, position: "2", reaction: "curious", kind: "random", pick_type: "random",
      one_liner_style: "question", secret: "개인 정보" };
    expect((await POST(req({ name: "bookmark_reacted", props, common }))).status).toBe(202);
    expect(saveEvent).toHaveBeenCalledWith({
      name: "bookmark_reacted",
      props: { book_id: "9788998441012", reaction: "curious", pick_type: "random", one_liner_style: "question" },
      common,
    });
    expect(warn).toHaveBeenCalledTimes(1);
    expect(warn.mock.calls[0]).toEqual(["track: dropped props", JSON.stringify({ name: "bookmark_reacted", keys: ["index", "position", "kind", "secret"] })]);
    expect(JSON.stringify(warn.mock.calls)).not.toContain("개인 정보");
  });

  it("keeps a free string prop to 200 characters and logs nothing when every prop matches", async () => {
    const props = { scope_id: "가".repeat(250), depth: 3, unsure_count: 0 };
    expect((await POST(req({ name: "path_completed", props, common }))).status).toBe(202);
    expect(vi.mocked(saveEvent).mock.calls[0][0].props.scope_id).toBe("가".repeat(200));
    expect(warn).not.toHaveBeenCalled();
  });

  it("flags at most 10 dropped keys, each cut to 40 characters", async () => {
    const props = Object.fromEntries(Array.from({ length: 15 }, (_, i) => [`${i}`.padEnd(60, "k"), 1]));
    expect((await POST(req({ name: "book_opened", props, common }))).status).toBe(202);
    const logged = JSON.parse(warn.mock.calls[0][1] as string) as { keys: string[] };
    expect(logged.keys).toHaveLength(10);
    expect(logged.keys.every((k) => k.length === 40)).toBe(true);
  });

  it("does not let a __proto__ key in props change the stored object's prototype", async () => {
    const res = await POST(new Request("http://x/api/track", { method: "POST", headers: from("9.9.9.9"),
      body: '{"name":"site_visited","props":{"__proto__":{"polluted":true}},"common":' + JSON.stringify(common) + "}" }));
    expect(res.status).toBe(202);
    const props = vi.mocked(saveEvent).mock.calls[0][0].props;
    expect(Object.getPrototypeOf(props)).toBe(Object.prototype);
    expect(Object.keys(props)).toEqual([]);              // not in the spec: dropped
  });

  it("answers 400, not 500, when the client aborts mid-body", async () => {
    const stream = new ReadableStream<Uint8Array>({
      start(c) { c.enqueue(new TextEncoder().encode('{"name":')); },
      pull() { throw new Error("aborted"); },
    });
    const res = await POST(new Request("http://x/api/track", { method: "POST", headers: from("9.9.9.9"), body: stream, duplex: "half" } as RequestInit));
    expect(res.status).toBe(400);
  });

  it("drops keys that are not in the common schema", async () => {
    const res = await POST(req({ name: "site_visited", props: {}, common: { ...common, evil: "x".repeat(100), admin: true } }));
    expect(res.status).toBe(202);
    expect(saveEvent).toHaveBeenCalledWith({ name: "site_visited", props: {}, common });
  });

  it("rejects props that are not an object", async () => {
    for (const props of [[1], "x", 1, null]) {
      expect((await POST(req({ name: "site_visited", props, common }))).status).toBe(400);
    }
    expect(saveEvent).not.toHaveBeenCalled();
  });

  it("treats missing props as empty", async () => {
    const res = await POST(req({ name: "site_visited", common }));
    expect(res.status).toBe(202);
    expect(saveEvent).toHaveBeenCalledWith({ name: "site_visited", props: {}, common });
  });

  it("answers 500 when the store fails", async () => {
    vi.mocked(saveEvent).mockRejectedValueOnce(new Error("boom"));
    vi.spyOn(console, "error").mockImplementation(() => {});
    const res = await POST(req({ name: "site_visited", props: {}, common }));
    expect(res.status).toBe(500);
    expect(await res.json()).toEqual({ error: "store failed" });
  });

  it("rejects invalid JSON", async () => {
    const res = await POST(new Request("http://x/api/track", { method: "POST", body: "{", headers: from("9.9.9.9") }));
    expect(res.status).toBe(400);
  });

  describe("user_id comes from the login session, never from the browser (taxonomy 3-2, v0.8)", () => {
    afterEach(() => { sessionUser = null; });
    const withCookie = (body: unknown) => new Request("http://x/api/track", {
      method: "POST", body: JSON.stringify(body), headers: { ...from("9.9.9.8"), cookie: "sb-proj-auth-token=abc" },
    });

    it("drops a user_id the browser made up when nobody is logged in", async () => {
      await POST(req({ name: "site_visited", props: {}, common: { ...common, user_id: "someone-else" } }));
      expect(saveEvent).toHaveBeenCalledWith(expect.objectContaining({ common: expect.objectContaining({ user_id: null }) }));
    });

    it("writes the session's user id, whatever the browser sent", async () => {
      sessionUser = "u-real";
      await POST(withCookie({ name: "site_visited", props: {}, common: { ...common, user_id: "someone-else" } }));
      expect(saveEvent).toHaveBeenCalledWith(expect.objectContaining({ common: expect.objectContaining({ user_id: "u-real" }) }));
    });

    it("keeps the event, as not logged in, when the session cannot be checked", async () => {
      sessionUser = "throw";
      const res = await POST(withCookie({ name: "site_visited", props: {}, common }));
      expect(res.status).toBe(202);
      expect(saveEvent).toHaveBeenCalledWith(expect.objectContaining({ common: expect.objectContaining({ user_id: null }) }));
    });

    it("does not look for a session without a Supabase auth cookie", async () => {
      sessionUser = "u-real";
      await POST(req({ name: "site_visited", props: {}, common }));
      expect(saveEvent).toHaveBeenCalledWith(expect.objectContaining({ common: expect.objectContaining({ user_id: null }) }));
    });
  });
});
