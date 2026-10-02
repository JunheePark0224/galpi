import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { emptyDetail, type BookDetail } from "./detail";
import { clearDetailLoads, loadDetail, peekDetail, readyCover, waitForCover } from "./detailClient";

const ISBN = "9790000000001";
const DETAIL: BookDetail = { source: "yes24", cover: null, price: 14400, rating: 9.4, pages: 280, intro: "소개.", link: "https://www.yes24.com/product/goods/1" };

describe("loadDetail", () => {
  const fetchMock = vi.fn<typeof fetch>();
  beforeEach(() => {
    clearDetailLoads();
    fetchMock.mockReset();
    vi.stubGlobal("fetch", fetchMock);
  });
  afterEach(() => vi.unstubAllGlobals());

  it("asks our own route once per book", async () => {
    fetchMock.mockResolvedValue(Response.json(DETAIL));
    expect(await loadDetail(ISBN)).toEqual(DETAIL);
    expect(await loadDetail(ISBN)).toEqual(DETAIL);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock).toHaveBeenCalledWith(`/api/books/${ISBN}`);
  });

  it("turns a refused or failed request into the empty detail, and asks again next time", async () => {
    fetchMock.mockResolvedValueOnce(new Response("{}", { status: 429 })).mockRejectedValueOnce(new TypeError("offline"));
    expect(await loadDetail(ISBN)).toEqual(emptyDetail(ISBN));
    expect(await loadDetail(ISBN)).toEqual(emptyDetail(ISBN));
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});

describe("covers ahead (10-02)", () => {
  const fetchMock = vi.fn<typeof fetch>();
  let made: { referrerPolicy: string; src: string; onload: (() => void) | null; onerror: (() => void) | null }[] = [];
  beforeEach(() => {
    clearDetailLoads();
    made = [];
    fetchMock.mockReset();
    vi.stubGlobal("fetch", fetchMock);
    vi.stubGlobal("Image", class { referrerPolicy = ""; src = ""; onload: (() => void) | null = null; onerror: (() => void) | null = null; constructor() { made.push(this); } });
  });
  afterEach(() => { vi.unstubAllGlobals(); vi.useRealTimers(); });

  it("peeks a loaded detail, and loads the cover image once with no referrer", async () => {
    fetchMock.mockResolvedValue(Response.json({ ...DETAIL, cover: "https://image.example/c.jpg" }));
    expect(peekDetail(ISBN)).toBeUndefined();
    const ready = readyCover(ISBN);
    expect(readyCover(ISBN)).toBe(ready);
    await vi.waitFor(() => expect(made).toHaveLength(1));
    expect(made[0]).toMatchObject({ referrerPolicy: "no-referrer", src: "https://image.example/c.jpg" });
    made[0].onload?.();
    await ready;
    expect(peekDetail(ISBN)?.cover).toBe("https://image.example/c.jpg");
  });

  it("is ready at once without a cover, and never waits longer than the limit", async () => {
    fetchMock.mockResolvedValueOnce(Response.json(DETAIL));
    await readyCover(ISBN);
    expect(made).toHaveLength(0);

    vi.useFakeTimers();
    fetchMock.mockResolvedValueOnce(Response.json({ ...DETAIL, cover: "https://image.example/slow.jpg" }));
    let done = false;
    void waitForCover("9790000000002", 3000).then(() => { done = true; });
    await vi.advanceTimersByTimeAsync(2900);
    expect(done).toBe(false);
    await vi.advanceTimersByTimeAsync(200);
    expect(done).toBe(true);
  });
});
