// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { POST } from "./route";
import { SQL_PATH } from "@/lib/paths/__fixtures__/paths";

const PATH = { answers: SQL_PATH };
const ORIGIN = "http://x";
const from = (ip: string) => ({ origin: ORIGIN, "x-forwarded-for": ip });
const req = (body: unknown, headers: Record<string, string> = from("9.9.9.9")) =>
  new Request("http://x/api/books/draw", { method: "POST", body: typeof body === "string" ? body : JSON.stringify(body), headers });

describe("POST /api/books/draw", () => {
  beforeEach(() => vi.stubEnv("BOOKS_SOURCE", "sample"));
  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllEnvs();
  });

  it("is reproducible for a seed", async () => {
    const a = await (await POST(req({ ...PATH, seed: 11 }))).json();
    const b = await (await POST(req({ ...PATH, seed: 11 }))).json();
    expect(a).toEqual(b);
  });

  it("sends only what a bookmark shows — no scores, no tags", async () => {
    const body = await (await POST(req({ ...PATH, seed: 3 }))).json();
    expect(Object.keys(body.picks[0]).sort()).toEqual(["card", "kind", "reason"]);
    expect(body.picks[0].reason).toMatchObject({ label: expect.stringMatching(/^(나온 이유|이 책은)$/), items: expect.any(Array) });
    expect(Object.keys(body.picks[0].card).sort()).toEqual(["author", "entry", "field", "genre", "id", "oneLiner", "oneLinerStyle", "title"]);
  });

  it("refuses another origin with 403", async () => {
    const res = await POST(req(PATH, { origin: "https://evil.example", "x-forwarded-for": "9.9.9.9" }));
    expect(res.status).toBe(403);
  });

  it("refuses a request with neither Origin nor Referer", async () => {
    expect((await POST(req(PATH, {}))).status).toBe(403);
  });

  it("answers 429 with Retry-After after 60 draws a minute from one address", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });   // frozen clock: the 60 draws cannot straddle a minute boundary
    vi.setSystemTime(new Date("2026-10-04T12:00:10Z"));
    for (let i = 0; i < 60; i++) expect((await POST(req({ ...PATH, seed: i }, from("7.7.7.7")))).status).toBe(200);
    const res = await POST(req(PATH, from("7.7.7.7")));
    expect(res.status).toBe(429);
    expect(Number(res.headers.get("Retry-After"))).toBeGreaterThan(0);
  });

  it.each([
    ["not JSON", "{"],
    ["a v1 body", { entry: "leaf", choices: ["A", "B", "A", "B", "A", "B", "A", "B", "A"] }],
    ["an unfinished path", { answers: SQL_PATH.slice(0, 2) }],
    ["an unknown answer", { answers: [{ node: "start", choice: "C" }] }],
    ["seen that is not a list of ids", { ...PATH, seen: "9790000000001" }],
    ["a negative seed", { ...PATH, seed: -1 }],
  ])("rejects %s with 400", async (_, body) => {
    expect((await POST(req(body))).status).toBe(400);
  });

  it("answers 400, not 500, when the client aborts mid-body", async () => {
    const stream = new ReadableStream<Uint8Array>({
      start(c) { c.enqueue(new TextEncoder().encode('{"entry":')); },
      pull() { throw new Error("aborted"); },
    });
    const res = await POST(new Request("http://x/api/books/draw", { method: "POST", headers: from("9.9.9.9"), body: stream, duplex: "half" } as RequestInit));
    expect(res.status).toBe(400);
  });

  it("rejects a body over the size cap with 413", async () => {
    const seen = Array.from({ length: 2500 }, (_, i) => `id-${i}-padding`);
    expect((await POST(req({ ...PATH, seen }))).status).toBe(413);
  });

  it("draws five bookmarks for a v2 path and returns the path S-04 shows", async () => {
    const res = await POST(req({ answers: SQL_PATH, seen: [], seed: 7 }));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.picks).toHaveLength(5);
    expect(Object.keys(body).sort()).toEqual(["exhausted", "path", "picks", "widened"]);
    expect(body.path.crumbs.at(-1)).toBe("DB에서 꺼내기");
    expect(Object.keys(body.picks[0].card).sort()).toEqual(["author", "entry", "field", "genre", "id", "oneLiner", "oneLinerStyle", "title"]);
  });
});
