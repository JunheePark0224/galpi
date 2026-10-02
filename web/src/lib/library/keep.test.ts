import { afterEach, describe, expect, it, vi } from "vitest";

const track = vi.fn();
const request = vi.fn();
vi.mock("@/lib/track/client", () => ({ track: (...a: unknown[]) => track(...a) }));
vi.mock("./client", () => ({ libraryRequest: (...a: unknown[]) => request(...a) }));

const ISBN = "9788998441012";
const ITEM = { isbn: ISBN, art: { animal: "fox", bg: "night", sky: "moon", ground: "books", rare: false }, reason: { label: "나온 이유", items: [] }, metOn: "2026-10-01" } as const;
const item = () => ({ ...ITEM, art: { ...ITEM.art }, reason: { label: ITEM.reason.label, items: [] as string[] } });

async function setup(me = { enabled: true, loggedIn: true, id: "u1", count: 2 }) {
  vi.resetModules();
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, json: async () => me }));
  const [keep, store, pending] = await Promise.all([import("./keep"), import("@/lib/account/store"), import("./pending")]);
  await store.loadAccount();
  return { keep, store, pending };
}

describe("keep (F-12 꽂기)", () => {
  afterEach(() => { vi.unstubAllGlobals(); vi.clearAllMocks(); sessionStorage.clear(); });

  it("logged in: E-11, saves, E-15 for a new bookmark, one more in the count", async () => {
    const { keep, store } = await setup();
    request.mockResolvedValue({ ok: true, status: 200, body: { ok: true, saved: true } });
    keep.pressKeep(item(), true);
    expect(track).toHaveBeenCalledWith("save_clicked", { book_id: ISBN, is_logged_in: true });
    expect(store.keepSnapshot(ISBN)).toBe("saved");                               // shown as kept at once (10-02)
    await vi.waitFor(() => expect(track).toHaveBeenLastCalledWith("book_saved", { book_id: ISBN, is_auto_save: false }));
    expect(request).toHaveBeenCalledWith("POST", "/api/library/saves", item());
    expect(track).toHaveBeenLastCalledWith("book_saved", { book_id: ISBN, is_auto_save: false });
    expect(store.accountSnapshot().count).toBe(3);
  });

  it("does not count or log a book that was already kept", async () => {
    const { keep, store } = await setup();
    request.mockResolvedValue({ ok: true, status: 200, body: { ok: true, saved: false } });
    await keep.keepBookmark(item(), false);
    expect(store.keepSnapshot(ISBN)).toBe("saved");
    expect(track).not.toHaveBeenCalledWith("book_saved", expect.anything());
    expect(store.accountSnapshot().count).toBe(2);
  });

  it("logged out: the bookmark waits in this tab and the sheet opens from 꽂기 — nothing is sent yet", async () => {
    const { keep, store, pending } = await setup({ enabled: true, loggedIn: false, id: null, count: 0 } as never);
    keep.pressKeep(item(), false);
    expect(track).toHaveBeenCalledWith("save_clicked", { book_id: ISBN, is_logged_in: false });
    expect(pending.readPending()).toEqual(item());
    expect(store.loginSheetSnapshot()).toEqual({ source: "save" });
    expect(request).not.toHaveBeenCalled();
  });

  it("after the login comes back, keeps the waiting bookmark once (E-15 auto, no second E-11)", async () => {
    const { keep, store, pending } = await setup();
    pending.writePending(item());
    request.mockResolvedValue({ ok: true, status: 200, body: { ok: true, saved: true } });
    await keep.keepWaiting();
    await keep.keepWaiting();
    expect(request).toHaveBeenCalledTimes(1);
    expect(track).toHaveBeenCalledWith("book_saved", { book_id: ISBN, is_auto_save: true });
    expect(track).not.toHaveBeenCalledWith("save_clicked", expect.anything());
    expect(store.keepSnapshot(ISBN)).toBe("saved");
    expect(pending.readPending()).toBeNull();
  });

  it("marks a failure, and a run-out session goes back to logging in with the bookmark waiting", async () => {
    const { keep, store, pending } = await setup();
    request.mockResolvedValueOnce({ ok: false, status: 500, body: null });
    await keep.keepBookmark(item(), false);
    expect(store.keepSnapshot(ISBN)).toBe("failed");
    request.mockResolvedValueOnce({ ok: false, status: 401, body: null });
    await keep.keepBookmark(item(), false);
    expect(store.keepSnapshot(ISBN)).toBeUndefined();
    expect(store.accountSnapshot().status).toBe("out");
    expect(store.loginSheetSnapshot()).toEqual({ source: "save" });
    expect(pending.readPending()).toEqual(item());
  });
});
