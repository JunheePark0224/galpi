// @vitest-environment node
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/track/store", () => ({ saveEvent: vi.fn().mockResolvedValue(false) }));
import { saveEvent } from "@/lib/track/store";
import { POST } from "./route";

const common = { anon_id: "a", user_id: null, session_id: "s", round: 1, entry: null, screen_version: "v1",
  referrer: "", returning: false, device: "phone", in_app_browser: false };
const ORIGIN = "http://x";
const from = (ip: string) => ({ origin: ORIGIN, "x-forwarded-for": ip });
const req = (body: unknown, headers: Record<string, string> = from("9.9.9.9")) =>
  new Request("http://x/api/track", { method: "POST", body: JSON.stringify(body), headers });

describe("POST /api/track", () => {
  afterEach(() => vi.clearAllMocks());

  it("accepts a known event", async () => {
    const res = await POST(req({ name: "visit", props: {}, common }));
    expect(res.status).toBe(202);
    expect(saveEvent).toHaveBeenCalledWith({ name: "visit", props: {}, common });
  });

  it("rejects an unknown event name", async () => {
    const res = await POST(req({ name: "drop_table", props: {}, common }));
    expect(res.status).toBe(400);
    expect(saveEvent).not.toHaveBeenCalled();
  });

  it("rejects bodies that are too large with 413", async () => {
    const res = await POST(req({ name: "visit", props: { big: "x".repeat(9000) }, common }));
    expect(res.status).toBe(413);
  });

  it("measures the size limit in bytes, not characters", async () => {
    const res = await POST(req({ name: "visit", props: { big: "가".repeat(3000) }, common }));
    expect(res.status).toBe(413);
    expect(saveEvent).not.toHaveBeenCalled();
  });

  it("refuses another origin with 403 and stores nothing", async () => {
    const res = await POST(req({ name: "visit", props: {}, common }, { origin: "https://evil.example", "x-forwarded-for": "9.9.9.9" }));
    expect(res.status).toBe(403);
    expect(await res.json()).toEqual({ error: "forbidden" });
    expect(saveEvent).not.toHaveBeenCalled();
  });

  it("refuses a request with neither Origin nor Referer", async () => {
    expect((await POST(req({ name: "visit", props: {}, common }, {}))).status).toBe(403);
    expect(saveEvent).not.toHaveBeenCalled();
  });

  it("accepts a same-site Referer when there is no Origin", async () => {
    expect((await POST(req({ name: "visit", props: {}, common }, { referer: "http://x/privacy" }))).status).toBe(202);
  });

  it("answers 429 with Retry-After after 120 events a minute from one address", async () => {
    for (let i = 0; i < 120; i++) expect((await POST(req({ name: "visit", props: {}, common }, from("7.7.7.7")))).status).toBe(202);
    const res = await POST(req({ name: "visit", props: {}, common }, from("7.7.7.7")));
    expect(res.status).toBe(429);
    expect(Number(res.headers.get("Retry-After"))).toBeGreaterThan(0);
    // another address is not affected
    expect((await POST(req({ name: "visit", props: {}, common }, from("7.7.7.8")))).status).toBe(202);
  });

  it("rejects non-object bodies", async () => {
    for (const body of [null, 1, "visit", [1]]) {
      const res = await POST(req(body));
      expect(res.status).toBe(400);
    }
  });

  it("rejects a missing or array common", async () => {
    expect((await POST(req({ name: "visit", props: {} }))).status).toBe(400);
    expect((await POST(req({ name: "visit", props: {}, common: [] }))).status).toBe(400);
    expect(saveEvent).not.toHaveBeenCalled();
  });

  it("rejects a common block with a missing key, a wrong type or a too-long string", async () => {
    const missing: Record<string, unknown> = { ...common };
    delete missing.anon_id;
    for (const bad of [missing, { ...common, round: "1" }, { ...common, device: "tablet" }, { ...common, anon_id: "x".repeat(201) }]) {
      expect((await POST(req({ name: "visit", props: {}, common: bad }))).status).toBe(400);
    }
    expect(saveEvent).not.toHaveBeenCalled();
  });

  it("keeps the event when the referrer is longer than 500 characters, storing it cut", async () => {
    const res = await POST(req({ name: "visit", props: {}, common: { ...common, referrer: "https://s.example/?q=" + "x".repeat(900) } }));
    expect(res.status).toBe(202);
    const stored = vi.mocked(saveEvent).mock.calls[0][0];
    expect(stored.common.referrer).toHaveLength(500);
  });

  it("keeps the event when the referrer cut falls inside an emoji, and stores no lone surrogate", async () => {
    const res = await POST(req({ name: "visit", props: {}, common: { ...common, referrer: "x".repeat(499) + "😀" } }));
    expect(res.status).toBe(202);
    const referrer = vi.mocked(saveEvent).mock.calls[0][0].common.referrer as string;
    expect(referrer).toBe("x".repeat(499));
    expect(referrer.isWellFormed()).toBe(true);
  });

  it("answers 400, not 500, for absurdly deep nesting that fits in the size cap", async () => {
    const deep = (n: number) => "[".repeat(n) + "]".repeat(n);
    const withProps = (n: number) => new Request("http://x/api/track", { method: "POST", headers: from("9.9.9.9"),
      body: `{"name":"visit","props":{"a":${deep(n)}},"common":${JSON.stringify(common)}}` });
    expect((await POST(withProps(3300))).status).toBe(400);
    expect((await POST(new Request("http://x/api/track", { method: "POST", headers: from("9.9.9.9"), body: deep(3300) }))).status).toBe(400);
    expect((await POST(withProps(10))).status).toBe(202);      // ordinary nesting is fine
    expect(saveEvent).toHaveBeenCalledTimes(1);
  });

  it("keeps the event and strips NUL and lone surrogates that Postgres jsonb would refuse", async () => {
    const dirty = { ...common, referrer: "a\u0000b\ud800c" };
    const res = await POST(req({ name: "visit", props: { goal: "책\u0000 \udc00읽기", "\u0000k": 1, nested: [{ t: "x\ud83d" }], ok: "😀" }, common: dirty }));
    expect(res.status).toBe(202);
    expect(saveEvent).toHaveBeenCalledWith({
      name: "visit",
      props: { goal: "책 \ufffd읽기", k: 1, nested: [{ t: "x\ufffd" }], ok: "😀" },
      common: { ...common, referrer: "ab\ufffdc" },
    });
  });

  it("does not let a __proto__ key in props change the stored object's prototype", async () => {
    const res = await POST(new Request("http://x/api/track", { method: "POST", headers: from("9.9.9.9"),
      body: '{"name":"visit","props":{"__proto__":{"polluted":true}},"common":' + JSON.stringify(common) + "}" }));
    expect(res.status).toBe(202);
    const props = vi.mocked(saveEvent).mock.calls[0][0].props;
    expect(Object.getPrototypeOf(props)).toBe(Object.prototype);
    expect(Object.keys(props)).toEqual(["__proto__"]);
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
    const res = await POST(req({ name: "visit", props: {}, common: { ...common, evil: "x".repeat(100), admin: true } }));
    expect(res.status).toBe(202);
    expect(saveEvent).toHaveBeenCalledWith({ name: "visit", props: {}, common });
  });

  it("rejects props that are not an object", async () => {
    for (const props of [[1], "x", 1, null]) {
      expect((await POST(req({ name: "visit", props, common }))).status).toBe(400);
    }
    expect(saveEvent).not.toHaveBeenCalled();
  });

  it("treats missing props as empty", async () => {
    const res = await POST(req({ name: "visit", common }));
    expect(res.status).toBe(202);
    expect(saveEvent).toHaveBeenCalledWith({ name: "visit", props: {}, common });
  });

  it("answers 500 when the store fails", async () => {
    vi.mocked(saveEvent).mockRejectedValueOnce(new Error("boom"));
    vi.spyOn(console, "error").mockImplementation(() => {});
    const res = await POST(req({ name: "visit", props: {}, common }));
    expect(res.status).toBe(500);
    expect(await res.json()).toEqual({ error: "store failed" });
  });

  it("rejects invalid JSON", async () => {
    const res = await POST(new Request("http://x/api/track", { method: "POST", body: "{", headers: from("9.9.9.9") }));
    expect(res.status).toBe(400);
  });
});
