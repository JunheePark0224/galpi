import { act, renderHook, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { LibraryView } from "@/lib/library/types";

const track = vi.fn();
const request = vi.fn();
const addSavedCount = vi.fn();
const setSavedCount = vi.fn();
vi.mock("@/lib/track/client", () => ({ track: (...a: unknown[]) => track(...a) }));
vi.mock("@/lib/library/client", () => ({ libraryRequest: (...a: unknown[]) => request(...a) }));
const signedOut = vi.fn();
const setAmplitudeUser = vi.fn();
vi.mock("@/lib/account/store", () => ({
  addSavedCount: (...a: unknown[]) => addSavedCount(...a),
  setSavedCount: (...a: unknown[]) => setSavedCount(...a),
  signedOut: () => signedOut(),
}));
vi.mock("@/lib/track/amplitude", () => ({ setAmplitudeUser: (...a: unknown[]) => setAmplitudeUser(...a) }));
const merged = new Set<() => void>();
vi.mock("@/lib/library/merge", () => ({ onGuestMerged: (l: () => void) => { merged.add(l); return () => merged.delete(l); } }));
import { useLibrary } from "./useLibrary";

const ART = { animal: "fox", bg: "night", sky: "moon", ground: "books", rare: false } as const;
const card = (id: string) => ({ id, entry: "leaf" as const, title: id, author: "가", genre: "한국 소설", field: null, oneLiner: "?", oneLinerStyle: "question" as const });
const VIEW: LibraryView = {
  count: 1, animals: 1,
  shelves: [
    { id: "a", name: "첫 막대", position: 0, bookmarks: [{ isbn: "1", art: { ...ART }, reason: { label: "이 책은", items: [] }, metOn: "2026-10-01", card: card("1") }] },
    { id: "b", name: "둘", position: 1, bookmarks: [] },
  ],
};
const ok = (body: unknown = { ok: true }) => ({ ok: true, status: 200, body });

describe("useLibrary (S-09)", () => {
  afterEach(() => vi.clearAllMocks());

  it("loads the rods, sends E-17 with the count once, and keeps the header count right", async () => {
    request.mockResolvedValue(ok(VIEW));
    const { result } = renderHook(() => useLibrary());
    await waitFor(() => expect(result.current.status).toBe("ready"));
    expect(result.current.view).toEqual(VIEW);
    expect(request).toHaveBeenCalledWith("GET", "/api/library");
    expect(track).toHaveBeenCalledWith("library_viewed", { saved_count: 1 });
    expect(setSavedCount).toHaveBeenCalledWith(1);
    await act(async () => { await result.current.reload(); });
    expect(track.mock.calls.filter(([n]) => n === "library_viewed")).toHaveLength(1);
  });

  it("reads the rods again when this browser's bookmarks arrived in the account (v1.7), until it is gone", async () => {
    request.mockResolvedValue(ok(VIEW));
    const { result, unmount } = renderHook(() => useLibrary());
    await waitFor(() => expect(result.current.status).toBe("ready"));
    expect(merged.size).toBe(1);
    await act(async () => { merged.forEach((l) => l()); });
    expect(request.mock.calls.filter(([m]) => m === "GET")).toHaveLength(2);
    unmount();
    expect(merged.size).toBe(0);
  });

  it("the read started last wins: a slow first read answering after the merge reload does not undo it", async () => {
    let answerFirst: (v: unknown) => void = () => {};
    const MERGED: LibraryView = { ...VIEW, count: 3 };
    request.mockImplementationOnce(() => new Promise((r) => { answerFirst = r; })).mockResolvedValueOnce(ok(MERGED));
    const { result } = renderHook(() => useLibrary());
    await act(async () => { merged.forEach((l) => l()); });
    await waitFor(() => expect(result.current.view).toEqual(MERGED));
    await act(async () => { answerFirst(ok(VIEW)); });
    expect(result.current.view).toEqual(MERGED);
    expect(setSavedCount.mock.calls).toEqual([[3]]);
    expect(track).toHaveBeenCalledWith("library_viewed", { saved_count: 3 });
  });

  it("says when it could not load, and when the login ran out", async () => {
    request.mockResolvedValueOnce({ ok: false, status: 500, body: null });
    const failed = renderHook(() => useLibrary());
    await waitFor(() => expect(failed.result.current.status).toBe("error"));
    request.mockResolvedValueOnce({ ok: false, status: 401, body: null });
    const out = renderHook(() => useLibrary());
    await waitFor(() => expect(out.result.current.status).toBe("login"));
    expect(signedOut).toHaveBeenCalled();                  // the header follows: the session ran out
    expect(setAmplitudeUser).toHaveBeenCalledWith(null);
    expect(track).not.toHaveBeenCalled();
  });

  it("moves a bookmark (E-30 with the way it was moved) and reloads", async () => {
    request.mockResolvedValue(ok(VIEW));
    const { result } = renderHook(() => useLibrary());
    await waitFor(() => expect(result.current.status).toBe("ready"));
    request.mockResolvedValueOnce(ok()).mockResolvedValueOnce(ok(VIEW));
    let done = false;
    await act(async () => { done = await result.current.move("1", "b", "menu"); });
    expect(done).toBe(true);
    expect(request).toHaveBeenCalledWith("PATCH", "/api/library/saves", { isbn: "1", shelfId: "b" });
    expect(track).toHaveBeenCalledWith("bookmark_moved", { book_id: "1", method: "menu", is_same_shelf: false });
  });

  it("drags a bookmark to a place — another rod or its own (E-30 drag, is_same_shelf)", async () => {
    const two = { ...VIEW, count: 2, shelves: [{ ...VIEW.shelves[0], bookmarks: [VIEW.shelves[0].bookmarks[0], { ...VIEW.shelves[0].bookmarks[0], isbn: "2" }] }, VIEW.shelves[1]] };
    request.mockResolvedValue(ok(two));
    const { result } = renderHook(() => useLibrary());
    await waitFor(() => expect(result.current.status).toBe("ready"));
    request.mockResolvedValueOnce(ok()).mockResolvedValueOnce(ok(two));
    await act(async () => { await result.current.move("1", "a", "drag", 1); });
    expect(request).toHaveBeenCalledWith("PATCH", "/api/library/saves", { isbn: "1", shelfId: "a", index: 1 });
    expect(track).toHaveBeenCalledWith("bookmark_moved", { book_id: "1", method: "drag", is_same_shelf: true });
    request.mockResolvedValueOnce(ok()).mockResolvedValueOnce(ok(two));
    await act(async () => { await result.current.move("2", "b", "drag", 0); });
    expect(request).toHaveBeenCalledWith("PATCH", "/api/library/saves", { isbn: "2", shelfId: "b", index: 0 });
    expect(track).toHaveBeenCalledWith("bookmark_moved", { book_id: "2", method: "drag", is_same_shelf: false });
  });

  it("removes a bookmark (E-16), one less in the header", async () => {
    request.mockResolvedValue(ok(VIEW));
    const { result } = renderHook(() => useLibrary());
    await waitFor(() => expect(result.current.status).toBe("ready"));
    request.mockResolvedValueOnce(ok()).mockResolvedValueOnce(ok(VIEW));
    await act(async () => { await result.current.remove("1"); });
    expect(request).toHaveBeenCalledWith("DELETE", "/api/library/saves", { isbn: "1" });
    expect(track).toHaveBeenCalledWith("book_unsaved", { book_id: "1" });
    expect(addSavedCount).toHaveBeenCalledWith(-1);
  });

  it("adds a rod (E-29 with the new number of rods — never its name), renames and removes rods without events", async () => {
    request.mockResolvedValue(ok(VIEW));
    const { result } = renderHook(() => useLibrary());
    await waitFor(() => expect(result.current.status).toBe("ready"));
    request.mockResolvedValueOnce(ok({ ok: true, shelf: { id: "c", name: "밤", position: 2 } })).mockResolvedValueOnce(ok(VIEW));
    await act(async () => { await result.current.addShelf("밤"); });
    expect(request).toHaveBeenCalledWith("POST", "/api/library/shelves", { name: "밤" });
    expect(track).toHaveBeenCalledWith("shelf_created", { shelf_count: 3 });
    expect(JSON.stringify(track.mock.calls)).not.toContain("밤");
    track.mockClear();
    request.mockResolvedValueOnce(ok()).mockResolvedValueOnce(ok(VIEW));
    await act(async () => { await result.current.renameShelf("b", "새 이름"); });
    request.mockResolvedValueOnce(ok()).mockResolvedValueOnce(ok(VIEW));
    await act(async () => { await result.current.removeShelf("b"); });
    expect(request).toHaveBeenCalledWith("PATCH", "/api/library/shelves", { id: "b", name: "새 이름" });
    expect(request).toHaveBeenCalledWith("DELETE", "/api/library/shelves", { id: "b" });
    expect(track).not.toHaveBeenCalled();
  });

  it("reports a refused change without an event", async () => {
    request.mockResolvedValue(ok(VIEW));
    const { result } = renderHook(() => useLibrary());
    await waitFor(() => expect(result.current.status).toBe("ready"));
    request.mockResolvedValueOnce({ ok: false, status: 409, body: { error: "full" } });
    let done = true;
    await act(async () => { done = await result.current.addShelf("x"); });
    expect(done).toBe(false);
    expect(track).not.toHaveBeenCalledWith("shelf_created", expect.anything());
  });

  it("moves and removes at once on screen, before the server answers — and puts it back if the server says no", async () => {
    request.mockResolvedValue(ok(VIEW));
    const { result } = renderHook(() => useLibrary());
    await waitFor(() => expect(result.current.status).toBe("ready"));
    let answer: (v: unknown) => void = () => {};
    request.mockImplementationOnce(() => new Promise((r) => { answer = r; }));
    let moving: Promise<boolean> = Promise.resolve(false);
    act(() => { moving = result.current.move("1", "b", "drag", 0); });
    expect(result.current.view?.shelves.map((s) => s.bookmarks.map((b) => b.isbn))).toEqual([[], ["1"]]);   // already moved
    request.mockResolvedValueOnce(ok(VIEW));                                                       // the quiet re-read after it
    const reads = request.mock.calls.filter(([m]) => m === "GET").length;
    await act(async () => { answer({ ok: false, status: 500, body: null }); await moving; });
    await waitFor(() => expect(request.mock.calls.filter(([m]) => m === "GET")).toHaveLength(reads + 1));   // the server's order wins
    expect(result.current.view?.shelves.map((s) => s.bookmarks.map((b) => b.isbn))).toEqual([["1"], []]);   // back again
    expect(track).not.toHaveBeenCalledWith("bookmark_moved", expect.anything());

    request.mockImplementationOnce(() => new Promise(() => {}));
    act(() => { void result.current.remove("1"); });
    expect(result.current.view?.count).toBe(0);
  });
});

