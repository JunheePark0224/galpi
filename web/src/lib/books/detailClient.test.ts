import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { emptyDetail, type BookDetail } from "./detail";
import { clearDetailLoads, loadDetail } from "./detailClient";

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
