import { afterEach, describe, expect, it, vi } from "vitest";
import type { GuestSave } from "./guest";
import type { SaveInput } from "./service";

const track = vi.fn();
const request = vi.fn();
vi.mock("@/lib/track/client", () => ({ track: (...a: unknown[]) => track(...a) }));
vi.mock("./client", () => ({ libraryRequest: (...a: unknown[]) => request(...a) }));

const ISBN = "9788998441012";
const CARD = { id: ISBN, entry: "leaf", title: "모순", author: "양귀자", genre: "한국 소설", field: null, oneLiner: "?", oneLinerStyle: "question" } as const;
const INPUT: SaveInput = { isbn: ISBN, art: { animal: "fox", bg: "night", sky: "moon", ground: "books", rare: false }, reason: { label: "나온 이유", items: [] }, metOn: "2026-10-01" };
const item = (): GuestSave => ({ ...INPUT, art: { ...INPUT.art }, reason: { ...INPUT.reason }, card: { ...CARD } });
const IN = { enabled: true, loggedIn: true, id: "u1", count: 2 };
const OUT = { enabled: true, loggedIn: false, id: null, count: 0 };

async function setup(me: object = IN) {
  vi.resetModules();
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, json: async () => me }));
  const [keep, store, guest] = await Promise.all([import("./keep"), import("@/lib/account/store"), import("./guest")]);
  await store.loadAccount();
  return { keep, store, guest };
}

describe("keep (F-12 내 책갈피에 저장, v1.7)", () => {
  afterEach(() => { vi.unstubAllGlobals(); vi.clearAllMocks(); vi.restoreAllMocks(); localStorage.clear(); });

  it("logged in: E-11, shown as saved at once, sent without the card, E-15 (account) for a new bookmark, one more in the count", async () => {
    const { keep, store } = await setup();
    request.mockResolvedValue({ ok: true, status: 200, body: { ok: true, saved: true } });
    expect(keep.pressKeep(item(), true)).toBe(true);
    expect(track).toHaveBeenCalledWith("save_clicked", { book_id: ISBN, is_logged_in: true });
    expect(store.keepSnapshot(ISBN)).toBe("saved");
    expect(store.keptSnapshot()).toBe(1);                                              // the header's +1
    await vi.waitFor(() => expect(track).toHaveBeenLastCalledWith("book_saved", { book_id: ISBN, is_auto_save: false, storage: "account" }));
    expect(request).toHaveBeenCalledWith("POST", "/api/library/saves", INPUT);
    expect(store.accountSnapshot().count).toBe(3);
  });

  it("sends the draw's ticket with the save (the server picks the picture from it), never the card", async () => {
    const { keep } = await setup();
    request.mockResolvedValue({ ok: true, status: 200, body: { ok: true, saved: true } });
    const meeting = { seed: 7, count: 5, iat: 1_790_000_000, sub: null, sig: "a".repeat(43), isbns: [ISBN, "9790000000001", "9790000000002", "9790000000003", "9790000000004"], index: 0 };
    await keep.keepBookmark({ ...item(), meeting });
    expect(request).toHaveBeenCalledWith("POST", "/api/library/saves", { ...INPUT, ticket: meeting });
  });

  it("sends E-36 for 도감 parts the save brought in (a logged-out draw's bookmark, v1.7.1)", async () => {
    const { keep } = await setup();
    request.mockResolvedValue({ ok: true, status: 200, body: { ok: true, saved: true, found: [{ kind: "animal", value: "fox" }, { kind: "hat", value: "x" }] } });
    await keep.keepBookmark(item());
    expect(track).toHaveBeenCalledWith("collection_item_found", { part_kind: "animal", part_value: "fox", tier: "common" });
    expect(track.mock.calls.filter(([n]) => n === "collection_item_found")).toHaveLength(1);
  });

  it("does not count or log a book that was already in the account", async () => {
    const { keep, store } = await setup();
    request.mockResolvedValue({ ok: true, status: 200, body: { ok: true, saved: false } });
    await keep.keepBookmark(item());
    expect(store.keepSnapshot(ISBN)).toBe("saved");
    expect(track).not.toHaveBeenCalledWith("book_saved", expect.anything());
    expect(store.accountSnapshot().count).toBe(2);
  });

  it("logged out: kept in this browser — E-11, E-15 (browser), no login sheet, nothing sent", async () => {
    const { keep, store, guest } = await setup(OUT);
    expect(keep.pressKeep(item(), false)).toBe(true);
    expect(track).toHaveBeenCalledWith("save_clicked", { book_id: ISBN, is_logged_in: false });
    expect(track).toHaveBeenCalledWith("book_saved", { book_id: ISBN, is_auto_save: false, storage: "browser" });
    expect(guest.guestSaves()).toEqual([item()]);
    expect(store.loginSheetSnapshot()).toBeNull();
    expect(store.keptSnapshot()).toBe(1);
    expect(request).not.toHaveBeenCalled();
    // pressed again while it is there (another tab, say): nothing new
    track.mockClear();
    expect(keep.pressKeep(item(), false)).toBe(false);
    expect(track).not.toHaveBeenCalledWith("book_saved", expect.anything());
  });

  it("logged out with 100 kept: says so and keeps nothing; storage blocked: the login sheet instead", async () => {
    const { keep, store, guest } = await setup(OUT);
    for (let i = 0; i < guest.GUEST_MAX; i++) {
      const isbn = `979000000${String(i).padStart(4, "0")}`;
      guest.addGuestSave({ ...item(), isbn, card: { ...CARD, id: isbn } });
    }
    expect(keep.pressKeep(item(), false)).toBe(false);
    expect(store.keepSnapshot(ISBN)).toBe("full");
    expect(track).not.toHaveBeenCalledWith("book_saved", expect.anything());
    localStorage.clear();
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => { throw new Error("blocked"); });
    expect(keep.pressKeep(item(), false)).toBe(false);
    expect(store.loginSheetSnapshot()).toEqual({ source: "save" });
    expect(store.keptSnapshot()).toBe(0);
  });

  it("marks a failure; a run-out session keeps it in this browser instead", async () => {
    const { keep, store, guest } = await setup();
    request.mockResolvedValueOnce({ ok: false, status: 500, body: null });
    await keep.keepBookmark(item());
    expect(store.keepSnapshot(ISBN)).toBe("failed");
    request.mockResolvedValueOnce({ ok: false, status: 401, body: null });
    await keep.keepBookmark(item());
    expect(store.keepSnapshot(ISBN)).toBeUndefined();
    expect(store.accountSnapshot().status).toBe("out");
    expect(guest.guestSaves().map((s) => s.isbn)).toEqual([ISBN]);
    expect(track).toHaveBeenCalledWith("book_saved", { book_id: ISBN, is_auto_save: false, storage: "browser" });
  });

  it("logged out, pressed again: out of this browser, E-16", async () => {
    const { keep, guest } = await setup(OUT);
    keep.pressKeep(item(), false);
    expect(await keep.pressUnkeep(ISBN, false)).toBe(true);
    expect(guest.guestSaves()).toEqual([]);
    expect(track).toHaveBeenCalledWith("book_unsaved", { book_id: ISBN });
    track.mockClear();
    expect(await keep.pressUnkeep(ISBN, false)).toBe(false);                           // already gone: no second E-16
    expect(track).not.toHaveBeenCalled();
  });

  it("logged in, pressed again: gone at once, the server is told, E-16 and one fewer in the count", async () => {
    const { keep, store } = await setup();
    store.setKeepState(ISBN, "saved");
    request.mockResolvedValue({ ok: true, status: 200, body: { ok: true } });
    const done = keep.pressUnkeep(ISBN, true);
    expect(store.keepSnapshot(ISBN)).toBeUndefined();
    expect(await done).toBe(true);
    expect(request).toHaveBeenCalledWith("DELETE", "/api/library/saves", { isbn: ISBN });
    expect(track).toHaveBeenCalledWith("book_unsaved", { book_id: ISBN });
    expect(store.accountSnapshot().count).toBe(1);
  });

  it("logged in, pressed again: already gone (404) is quiet; a refusal puts it back; a run-out session logs out", async () => {
    const { keep, store } = await setup();
    request.mockResolvedValueOnce({ ok: false, status: 404, body: null });
    expect(await keep.pressUnkeep(ISBN, true)).toBe(true);
    expect(store.keepSnapshot(ISBN)).toBeUndefined();
    request.mockResolvedValueOnce({ ok: false, status: 500, body: null });
    expect(await keep.pressUnkeep(ISBN, true)).toBe(false);
    expect(store.keepSnapshot(ISBN)).toBe("unkeepFailed");
    expect(track).not.toHaveBeenCalled();
    expect(store.accountSnapshot().count).toBe(2);
    request.mockResolvedValueOnce({ ok: false, status: 401, body: null });
    expect(await keep.pressUnkeep(ISBN, true)).toBe(false);
    expect(store.keepSnapshot(ISBN)).toBeUndefined();
    expect(store.accountSnapshot().status).toBe("out");
  });
});
