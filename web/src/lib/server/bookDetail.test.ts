// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import yes24 from "@/lib/books/__fixtures__/yes24-detail.json";
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
});
