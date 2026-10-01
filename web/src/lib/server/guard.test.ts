// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { clientKey, rateLimit, rateLimitKeyCount, readJsonCapped, resetDailyBudgets, sameOrigin, takeDailyBudget } from "./guard";

const post = (headers: Record<string, string> = {}, body = "{}", url = "https://galpi.example/api/track") =>
  new Request(url, { method: "POST", body, headers });

describe("sameOrigin", () => {
  it("accepts an Origin equal to the request origin", () => {
    expect(sameOrigin(post({ origin: "https://galpi.example" }))).toBe(true);
  });

  it("rejects another origin, another scheme or another port", () => {
    expect(sameOrigin(post({ origin: "https://evil.example" }))).toBe(false);
    expect(sameOrigin(post({ origin: "http://galpi.example" }))).toBe(false);
    expect(sameOrigin(post({ origin: "https://galpi.example:8443" }))).toBe(false);
  });

  it("accepts the forwarded host behind a proxy", () => {
    const req = post({ origin: "https://galpi.example", "x-forwarded-host": "galpi.example", "x-forwarded-proto": "https" }, "{}", "http://internal:3000/api/track");
    expect(sameOrigin(req)).toBe(true);
  });

  it("does not let a forwarded host excuse a foreign Origin", () => {
    expect(sameOrigin(post({ origin: "https://evil.example", "x-forwarded-host": "galpi.example" }))).toBe(false);
  });

  it("falls back to the Referer origin when there is no Origin", () => {
    expect(sameOrigin(post({ referer: "https://galpi.example/privacy?x=1" }))).toBe(true);
    expect(sameOrigin(post({ referer: "https://evil.example/page" }))).toBe(false);
  });

  it("rejects when neither header is present or they are not URLs", () => {
    expect(sameOrigin(post())).toBe(false);
    expect(sameOrigin(post({ origin: "null" }))).toBe(false);
    expect(sameOrigin(post({ referer: "not a url" }))).toBe(false);
  });
});

describe("sameOrigin with Sec-Fetch-Site", () => {
  it("accepts same-origin when Origin and Referer are both absent", () => {
    expect(sameOrigin(post({ "sec-fetch-site": "same-origin" }))).toBe(true);
  });

  it("refuses same-site, cross-site and none when Origin and Referer are both absent", () => {
    for (const site of ["same-site", "cross-site", "none"]) {
      expect(sameOrigin(post({ "sec-fetch-site": site }))).toBe(false);
    }
  });

  it("lets a present Origin or Referer decide, even against Sec-Fetch-Site", () => {
    expect(sameOrigin(post({ origin: "https://evil.example", "sec-fetch-site": "same-origin" }))).toBe(false);
    expect(sameOrigin(post({ referer: "https://evil.example/x", "sec-fetch-site": "same-origin" }))).toBe(false);
    expect(sameOrigin(post({ origin: "https://galpi.example", "sec-fetch-site": "cross-site" }))).toBe(true);
  });
});

describe("takeDailyBudget", () => {
  beforeEach(() => {
    resetDailyBudgets();
    vi.useFakeTimers({ now: Date.parse("2026-10-01T12:00:00Z"), toFake: ["Date"] });
  });
  afterEach(() => vi.useRealTimers());

  it("hands out `limit` calls a UTC day, then refuses until the date changes", () => {
    for (let i = 0; i < 3; i++) expect(takeDailyBudget("a", 3)).toBe(true);
    expect(takeDailyBudget("a", 3)).toBe(false);
    expect(takeDailyBudget("b", 3)).toBe(true);           // names count separately
    vi.setSystemTime(Date.parse("2026-10-02T00:00:00Z"));
    expect(takeDailyBudget("a", 3)).toBe(true);
  });
});

describe("clientKey", () => {
  it("uses the first x-forwarded-for address plus the route name", () => {
    expect(clientKey(post({ "x-forwarded-for": "1.2.3.4, 10.0.0.1" }), "track")).toBe("1.2.3.4:track");
  });

  it("falls back to unknown", () => {
    expect(clientKey(post(), "track")).toBe("unknown:track");
  });
});

describe("rateLimit", () => {
  beforeEach(() => vi.useFakeTimers({ now: 1_000_000 }));
  afterEach(() => vi.useRealTimers());

  it("lets `limit` calls through per window, then refuses with the seconds to wait", () => {
    const key = "1.1.1.1:a";
    for (let i = 0; i < 3; i++) expect(rateLimit(key, 3, 60_000)).toEqual({ ok: true });
    vi.advanceTimersByTime(20_000);
    expect(rateLimit(key, 3, 60_000)).toEqual({ ok: false, retryAfter: 40 });
  });

  it("frees the key when the window has passed", () => {
    const key = "1.1.1.1:b";
    for (let i = 0; i < 3; i++) rateLimit(key, 3, 60_000);
    expect(rateLimit(key, 3, 60_000).ok).toBe(false);
    vi.advanceTimersByTime(60_001);
    expect(rateLimit(key, 3, 60_000)).toEqual({ ok: true });
  });

  it("counts keys separately", () => {
    for (let i = 0; i < 3; i++) rateLimit("2.2.2.2:a", 3, 60_000);
    expect(rateLimit("2.2.2.2:a", 3, 60_000).ok).toBe(false);
    expect(rateLimit("3.3.3.3:a", 3, 60_000).ok).toBe(true);
    expect(rateLimit("2.2.2.2:b", 3, 60_000).ok).toBe(true);
  });

  it("stays bounded: the map never grows past 10,000 keys, however many distinct callers arrive", () => {
    for (let i = 0; i < 10_500; i++) {
      expect(rateLimit(`flood-${i}`, 1, 60_000).ok).toBe(true);
      expect(rateLimitKeyCount()).toBeLessThanOrEqual(10_000);
    }
    expect(rateLimit("after-flood", 1, 60_000).ok).toBe(true);
    expect(rateLimitKeyCount()).toBeLessThanOrEqual(10_000);
  });
});

describe("readJsonCapped", () => {
  it("parses a small JSON body", async () => {
    expect(await readJsonCapped(post({}, '{"a":1}'), 100)).toEqual({ ok: true, body: { a: 1 } });
  });

  it("answers 413 from content-length before reading", async () => {
    const req = post({ "content-length": "5000" }, "{}");
    const text = vi.spyOn(req, "text");
    const r = await readJsonCapped(req, 100);
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.response.status).toBe(413);
      expect(await r.response.json()).toEqual({ error: "too large" });
    }
    expect(text).not.toHaveBeenCalled();
  });

  it("answers 413 when the body is bigger than declared, counting bytes not characters", async () => {
    const r = await readJsonCapped(post({}, JSON.stringify({ big: "가".repeat(50) })), 100);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.response.status).toBe(413);
  });

  it("answers 400 when the client aborts in the middle of the body", async () => {
    const stream = new ReadableStream<Uint8Array>({
      start(c) {
        c.enqueue(new TextEncoder().encode('{"a":'));
      },
      pull() {
        throw new Error("aborted");
      },
    });
    const req = new Request("https://galpi.example/api/track", { method: "POST", body: stream, duplex: "half" } as RequestInit);
    const r = await readJsonCapped(req, 100);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.response.status).toBe(400);
  });

  it("answers 400 for invalid JSON", async () => {
    const r = await readJsonCapped(post({}, "{"), 100);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.response.status).toBe(400);
  });
});
