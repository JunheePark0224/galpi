// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import yes24 from "@/lib/books/__fixtures__/yes24-detail.json";
import kakao from "@/lib/books/__fixtures__/kakao-search.json";
import { bookDetail, clearDetailCache } from "./bookDetail";

vi.mock("server-only", () => ({}));

/** A YES24 answer for whatever ISBN the URL asks about. */
const fetchMock = vi.fn<typeof fetch>(async (input) => {
  const isbn = new URL(String(input)).searchParams.get("query");
  const item = { ...yes24.data.items[0], isbn13: isbn };
  return new Response(JSON.stringify({ ...yes24, data: { ...yes24.data, items: [item] } }));
});

describe("bookDetail cache", () => {
  beforeEach(() => {
    clearDetailCache();
    fetchMock.mockClear();
    vi.stubGlobal("fetch", fetchMock);
    vi.stubEnv("YES24_API_KEY", "test-yes24-key");
  });
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
  });

  it("asks YES24 again once the hour is over", async () => {
    await bookDetail("9790000000001", 0);
    await bookDetail("9790000000001", 3_599_999);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    await bookDetail("9790000000001", 3_600_000);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("holds at most 500 books, dropping the oldest", async () => {
    const isbn = (i: number) => `979${String(i).padStart(10, "0")}`;
    for (let i = 0; i <= 500; i++) await bookDetail(isbn(i), 0);
    expect(fetchMock).toHaveBeenCalledTimes(501);
    await bookDetail(isbn(500), 0);                 // newest: still cached
    expect(fetchMock).toHaveBeenCalledTimes(501);
    await bookDetail(isbn(0), 0);                   // oldest: dropped
    expect(fetchMock).toHaveBeenCalledTimes(502);
  });

  it("never lets Next's fetch data cache keep an upstream answer (a 200 failure would be stuck for an hour)", async () => {
    await bookDetail("9790000000001", 0);
    expect(fetchMock.mock.calls[0][1]).toMatchObject({ cache: "no-store" });
    expect(fetchMock.mock.calls[0][1]).not.toHaveProperty("next");
  });

  it("does not remember a 200 that is not a success, so the next visit asks YES24 again", async () => {
    fetchMock.mockResolvedValueOnce(new Response(JSON.stringify({ success: false, errorCode: "E01" })));
    expect((await bookDetail("9790000000001", 0)).source).toBeNull();
    expect((await bookDetail("9790000000001", 1)).source).toBe("yes24");
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  describe("Kakao fallback", () => {
    const yes24Down = () => fetchMock.mockResolvedValueOnce(new Response("{}", { status: 500 }));
    const kakaoUp = () => fetchMock.mockResolvedValueOnce(new Response(JSON.stringify(kakao)));
    beforeEach(() => {
      vi.stubEnv("KAKAO_REST_KEY", "test-kakao-key");
      vi.useFakeTimers();
      vi.setSystemTime(0);
      vi.spyOn(console, "warn").mockImplementation(() => {});
    });
    afterEach(() => {
      vi.useRealTimers();
      vi.restoreAllMocks();
    });

    it("keeps the degraded answer for 10 minutes only, then tries YES24 again", async () => {
      yes24Down();
      kakaoUp();
      expect((await bookDetail("9790000000001")).source).toBe("kakao");
      vi.setSystemTime(599_999);
      expect((await bookDetail("9790000000001")).source).toBe("kakao");
      expect(fetchMock).toHaveBeenCalledTimes(2);
      vi.setSystemTime(600_000);
      expect((await bookDetail("9790000000001")).source).toBe("yes24");
      expect(fetchMock).toHaveBeenCalledTimes(3);
    });

    it("logs only the kind of failure, never a URL, header or key", async () => {
      vi.stubEnv("YES24_API_KEY", "test-yes24-secret");
      vi.stubEnv("KAKAO_REST_KEY", "test-kakao-secret");
      fetchMock
        .mockResolvedValueOnce(new Response("{}", { status: 500 }))
        .mockRejectedValueOnce(new DOMException("timed out", "TimeoutError"));
      await bookDetail("9790000000001");
      fetchMock
        .mockResolvedValueOnce(new Response("<html>", { status: 200 }))
        .mockRejectedValueOnce(new TypeError("fetch failed: https://dapi.kakao.com/?query=9790000000001 test-kakao-secret"));
      await bookDetail("9790000000002");
      const lines = vi.mocked(console.warn).mock.calls.map((c) => c.join(" "));
      expect(lines).toEqual(["yes24: http 500", "kakao: timeout", "yes24: invalid json", "kakao: network error"]);
      for (const line of lines) expect(line).not.toMatch(/secret|https?:|9790000/);
    });
  });
});
