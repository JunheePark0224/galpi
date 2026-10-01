// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import kakao from "@/lib/books/__fixtures__/kakao-search.json";
import yes24 from "@/lib/books/__fixtures__/yes24-detail.json";
import { clearDetailCache } from "@/lib/server/bookDetail";
import { GET } from "./route";

vi.mock("server-only", () => ({}));

const ISBN = "9790000000001";                 // in books.sample.json (BOOKS_SOURCE=sample)
const ORIGIN = "http://x";
const req = (isbn: string, headers: Record<string, string> = { referer: `${ORIGIN}/`, "x-forwarded-for": "5.5.5.5" }) =>
  GET(new Request(`${ORIGIN}/api/books/${isbn}`, { headers }), { params: Promise.resolve({ isbn }) });
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });

const fetchMock = vi.fn<typeof fetch>();

describe("GET /api/books/[isbn]", () => {
  beforeEach(() => {
    clearDetailCache();
    fetchMock.mockReset();
    vi.stubGlobal("fetch", fetchMock);
    vi.stubEnv("BOOKS_SOURCE", "sample");
    vi.stubEnv("YES24_API_KEY", "test-yes24-key");
    vi.stubEnv("KAKAO_REST_KEY", "test-kakao-key");
  });
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
  });

  it("returns the normalised YES24 detail and lets the browser keep it for an hour", async () => {
    fetchMock.mockResolvedValueOnce(json(yes24));
    const res = await req(ISBN);
    expect(res.status).toBe(200);
    expect(res.headers.get("Cache-Control")).toBe("private, max-age=3600");
    expect(await res.json()).toMatchObject({ source: "yes24", price: 14400, rating: 9.4, pages: 280 });

    const [url, init] = fetchMock.mock.calls[0];
    expect(String(url)).toBe(`https://apis.yes24.com/v1/goods/itemDetail?searchType=ISBN13&query=${ISBN}&detail=Y`);
    expect(init?.headers).toMatchObject({ "X-Api-Key": "test-yes24-key" });
    expect(init?.signal).toBeInstanceOf(AbortSignal);
  });

  it("serves the second visit from memory", async () => {
    fetchMock.mockResolvedValueOnce(json(yes24));
    await req(ISBN);
    expect((await (await req(ISBN)).json()).source).toBe("yes24");
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("falls back to Kakao's cover and price when YES24 fails", async () => {
    fetchMock.mockResolvedValueOnce(json({ success: false, errorCode: "E500" }, 500)).mockResolvedValueOnce(json(kakao));
    const body = await (await req(ISBN)).json();
    expect(body).toMatchObject({ source: "kakao", price: 14400, intro: "", rating: null });
    expect(String(fetchMock.mock.calls[1][0])).toBe(`https://dapi.kakao.com/v3/search/book?target=isbn&query=${ISBN}`);
    expect(fetchMock.mock.calls[1][1]?.headers).toMatchObject({ Authorization: "KakaoAK test-kakao-key" });
  });

  it("answers an empty detail (200, not cached) when both sources are down or time out", async () => {
    fetchMock.mockRejectedValueOnce(new DOMException("timed out", "TimeoutError")).mockRejectedValueOnce(new TypeError("fetch failed"));
    const res = await req(ISBN);
    expect(res.status).toBe(200);
    expect(res.headers.get("Cache-Control")).toBe("no-store");
    expect(await res.json()).toMatchObject({ source: null, intro: "", link: expect.stringContaining(ISBN) });
    fetchMock.mockResolvedValueOnce(json(yes24));
    expect((await (await req(ISBN)).json()).source).toBe("yes24");      // the outage is not remembered
  });

  it("calls nobody without keys (local runs, E2E) and still answers", async () => {
    vi.stubEnv("YES24_API_KEY", "");
    vi.stubEnv("KAKAO_REST_KEY", "");
    expect((await (await req(ISBN)).json()).source).toBeNull();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("is not a YES24 proxy: 404 for a malformed ISBN or one outside our catalogue", async () => {
    expect((await req("12345")).status).toBe(404);
    expect((await req("9788998441012")).status).toBe(404);     // a real book, but not in the sample catalogue
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("refuses another site, or no Origin/Referer at all", async () => {
    expect((await req(ISBN, { referer: "https://evil.example/" })).status).toBe(403);
    expect((await req(ISBN, {})).status).toBe(403);
  });

  it("answers 429 after 60 lookups a minute from one address", async () => {
    vi.stubEnv("YES24_API_KEY", "");
    vi.stubEnv("KAKAO_REST_KEY", "");
    const from = { referer: `${ORIGIN}/`, "x-forwarded-for": "6.6.6.6" };
    for (let i = 0; i < 60; i++) expect((await req(ISBN, from)).status).toBe(200);
    const res = await req(ISBN, from);
    expect(res.status).toBe(429);
    expect(Number(res.headers.get("Retry-After"))).toBeGreaterThan(0);
  });
});
