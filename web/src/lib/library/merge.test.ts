import { afterEach, describe, expect, it, vi } from "vitest";
import type { GuestSave } from "./guest";

const track = vi.fn();
const request = vi.fn();
vi.mock("@/lib/track/client", () => ({ track: (...a: unknown[]) => track(...a) }));
vi.mock("./client", () => ({ libraryRequest: (...a: unknown[]) => request(...a) }));

const isbnAt = (i: number) => `979000000${String(i).padStart(4, "0")}`;
const save = (isbn: string, tries?: number) => ({
  isbn, art: { animal: "fox", bg: "night", sky: "moon", ground: "books", rare: false } as const,
  reason: { label: "나온 이유" as const, items: [] as string[] }, metOn: "2026-10-01",
  card: { id: isbn, entry: "leaf" as const, title: "책", author: "저자", genre: "한국 소설", field: null, oneLiner: "?", oneLinerStyle: "question" as const },
  ...(tries === undefined ? {} : { tries }),
});
const posted = () => request.mock.calls.map((c) => (c[2] as { isbn: string }).isbn);
const saved = (isSaved = true) => ({ ok: true, status: 200, body: { ok: true, saved: isSaved } });
const failed = (status: number, error = "invalid") => ({ ok: false, status, body: status ? { error } : null });
const ME = (count: number) => ({ ok: true, json: async () => ({ enabled: true, loggedIn: true, id: "u1", count }) });
const LOCK_KEY = "galpi.guestMerge.lock";

async function setup(kept: number | GuestSave[], count = 2) {
  vi.resetModules();
  const fetchMe = vi.fn().mockResolvedValue(ME(count));
  vi.stubGlobal("fetch", fetchMe);
  const [merge, store, guest] = await Promise.all([import("./merge"), import("@/lib/account/store"), import("./guest")]);
  await store.loadAccount();
  const items = typeof kept === "number" ? Array.from({ length: kept }, (_, i) => save(isbnAt(i))) : kept;
  for (const item of [...items].reverse()) guest.addGuestSave(item);        // newest first, as kept
  return { merge, store, guest, fetchMe };
}

describe("merge (로그인 뒤 임시 책갈피를 계정으로, E-39)", () => {
  afterEach(() => { vi.unstubAllGlobals(); vi.clearAllMocks(); localStorage.clear(); });

  it("does nothing when this browser kept nothing", async () => {
    const { merge } = await setup(0);
    expect(await merge.mergeGuestSaves(true)).toEqual({ full: 0 });
    expect(request).not.toHaveBeenCalled();
    expect(track).not.toHaveBeenCalled();
  });

  it("sends each one oldest first, without the card; the header count is the server's afterwards, not added up", async () => {
    const { merge, store, guest, fetchMe } = await setup(3);
    request.mockResolvedValueOnce(saved()).mockResolvedValueOnce(saved(false)).mockResolvedValueOnce(saved());
    const heard = vi.fn();
    merge.onGuestMerged(heard);
    store.setSavedCount(40);                                                        // a library read landed meanwhile
    fetchMe.mockResolvedValue(ME(4));
    await merge.mergeGuestSaves(false);
    expect(posted()).toEqual([isbnAt(2), isbnAt(1), isbnAt(0)]);
    expect(request.mock.calls[0]).toEqual(["POST", "/api/library/saves", { isbn: isbnAt(2), art: save("").art, reason: save("").reason, metOn: "2026-10-01" }]);
    expect(guest.guestSaves()).toEqual([]);
    expect(store.accountSnapshot().count).toBe(4);
    expect(store.keepSnapshot(isbnAt(1))).toBe("saved");
    expect(track.mock.calls).toEqual([["guest_saves_merged", { guest_count: 3, merged_count: 2 }]]);
    expect(heard).toHaveBeenCalledTimes(1);
  });

  it("lets go of what the server refuses for good (account full, unknown book), keeps server and network failures to retry", async () => {
    const { merge, guest } = await setup(6);
    request
      .mockResolvedValueOnce(failed(409, "full"))
      .mockResolvedValueOnce(failed(400))                    // no longer in the catalogue
      .mockResolvedValueOnce(failed(500))
      .mockResolvedValueOnce(failed(0))                      // offline
      .mockResolvedValueOnce(failed(429))
      .mockResolvedValueOnce({ ok: true, status: 200, body: null });   // an answer we cannot read: try again later
    expect(await merge.mergeGuestSaves(true)).toEqual({ full: 1 });
    expect(guest.guestSaves().map((s) => [s.isbn, s.tries])).toEqual([[isbnAt(0), 1], [isbnAt(1), 1], [isbnAt(2), 1], [isbnAt(3), 1]]);
    expect(track.mock.calls).toEqual([["guest_saves_merged", { guest_count: 6, merged_count: 0 }]]);
  });

  it("gives up on a bookmark after three failed visits", async () => {
    const { merge, guest } = await setup([save(isbnAt(0), 2), save(isbnAt(1))]);
    request.mockResolvedValue(failed(503));
    await merge.mergeGuestSaves(false);
    expect(guest.guestSaves().map((s) => [s.isbn, s.tries])).toEqual([[isbnAt(1), 1]]);
  });

  it("a quiet retry on a later visit that adds nothing sends no E-39", async () => {
    const { merge, guest } = await setup(2);
    request.mockResolvedValueOnce(saved(false)).mockResolvedValueOnce(failed(500));
    await merge.mergeGuestSaves(false);
    expect(track).not.toHaveBeenCalled();
    expect(guest.guestSaves().map((s) => s.isbn)).toEqual([isbnAt(0)]);
  });

  it("stops at a run-out session: what went stays gone, the rest waits untouched, the header says logged out", async () => {
    const { merge, store, guest } = await setup(3);
    request.mockResolvedValueOnce(saved()).mockResolvedValueOnce(failed(401));
    await merge.mergeGuestSaves(true);
    expect(request).toHaveBeenCalledTimes(2);
    expect(guest.guestSaves().map((s) => [s.isbn, s.tries])).toEqual([[isbnAt(0), undefined], [isbnAt(1), undefined]]);
    expect(store.accountSnapshot().status).toBe("out");
    expect(track.mock.calls).toEqual([["guest_saves_merged", { guest_count: 3, merged_count: 1 }]]);
  });

  it("runs once when called twice at once in this tab", async () => {
    const { merge } = await setup(1);
    request.mockResolvedValue(saved());
    await Promise.all([merge.mergeGuestSaves(true), merge.mergeGuestSaves(true)]);
    expect(request).toHaveBeenCalledTimes(1);
    expect(track).toHaveBeenCalledTimes(1);
  });

  it("another tab holding the storage lock (under 30 s): this tab leaves it; a stale lock is taken; the lock is let go after", async () => {
    const { merge } = await setup(1);
    request.mockResolvedValue(saved());
    localStorage.setItem(LOCK_KEY, JSON.stringify({ token: "other", at: Date.now() - 5_000 }));
    expect(await merge.mergeGuestSaves(true)).toEqual({ full: 0 });
    expect(request).not.toHaveBeenCalled();
    localStorage.setItem(LOCK_KEY, JSON.stringify({ token: "other", at: Date.now() - 31_000 }));
    await merge.mergeGuestSaves(true);
    expect(request).toHaveBeenCalledTimes(1);
    expect(localStorage.getItem(LOCK_KEY)).toBeNull();
  });

  it("a broken lock entry does not block; another tab winning the write between our write and read-back does", async () => {
    const { merge } = await setup(1);
    request.mockResolvedValue(saved());
    localStorage.setItem(LOCK_KEY, "{oops");
    const real = Storage.prototype.getItem;
    let reads = 0;
    const spy = vi.spyOn(Storage.prototype, "getItem").mockImplementation(function (this: Storage, key: string) {
      if (key === LOCK_KEY && ++reads === 2) return JSON.stringify({ token: "other", at: Date.now() });
      return real.call(this, key);
    });
    await merge.mergeGuestSaves(true);
    expect(request).not.toHaveBeenCalled();
    spy.mockRestore();
    localStorage.removeItem(LOCK_KEY);                                            // the other tab finished
    await merge.mergeGuestSaves(true);
    expect(request).toHaveBeenCalledTimes(1);
  });

  it("uses Web Locks when the browser has them: only the tab that gets the lock merges", async () => {
    const { merge } = await setup(1);
    request.mockResolvedValue(saved());
    const lockRequest = vi.fn((_name: string, _opts: unknown, run: (lock: object | null) => Promise<unknown>) => run(null));
    vi.stubGlobal("navigator", { ...navigator, locks: { request: lockRequest } });
    await merge.mergeGuestSaves(true);
    expect(lockRequest).toHaveBeenCalledWith("galpi.guestMerge", { ifAvailable: true }, expect.any(Function));
    expect(request).not.toHaveBeenCalled();
    lockRequest.mockImplementation((_n, _o, run) => run({}));
    await merge.mergeGuestSaves(true);
    expect(request).toHaveBeenCalledTimes(1);
    expect(localStorage.getItem(LOCK_KEY)).toBeNull();
  });

  it("reports each bookmark that reached the account (new or already there) to the 도감 with its ticket — E-36 for new parts", async () => {
    const meeting = (index: number) => ({ seed: 5, count: 5, iat: 1_790_000_000, sub: null, sig: "a".repeat(43), isbns: ["9790000000000", "9790000000001", "9790000000002", "9790000000003", "9790000000004"], index });
    const { merge } = await setup([
      { ...save(isbnAt(0)), meeting: meeting(0) },                                   // already in the account
      { ...save(isbnAt(1)), meeting: meeting(1) },                                   // refused: not reported
      save(isbnAt(2)),                                                                // kept before this fix: no ticket, nothing to prove
      { ...save(isbnAt(3)), meeting: meeting(3) },
    ]);
    const answers: Record<string, unknown> = {
      [isbnAt(3)]: saved(), [isbnAt(2)]: saved(), [isbnAt(1)]: failed(400), [isbnAt(0)]: saved(false),
    };
    request.mockImplementation(async (_m: string, path: string, body: { isbn: string; index?: number }) => {
      if (path === "/api/library/saves") return answers[body.isbn];
      return body.index === 3
        ? { ok: true, status: 200, body: { ok: true, found: [{ kind: "animal", value: "fox" }, { kind: "ground", value: "none" }] } }
        : { ok: false, status: 403, body: { error: "not your bookmark" } };          // a refusal is quiet
    });
    await merge.mergeGuestSaves(true);
    const savesSent = request.mock.calls.filter(([, path]) => path === "/api/library/saves").map(([, , body]) => body as { isbn: string; ticket?: unknown });
    expect(savesSent.map((b) => [b.isbn, b.ticket])).toEqual([
      [isbnAt(3), meeting(3)], [isbnAt(2), undefined], [isbnAt(1), meeting(1)], [isbnAt(0), meeting(0)],
    ]);
    const reports = request.mock.calls.filter(([, path]) => path === "/api/collection/found").map(([, , body]) => body);
    expect(reports).toEqual([
      { ...meeting(3), isbn: isbnAt(3), kept: true },
      { ...meeting(0), isbn: isbnAt(0), kept: true },
    ]);
    expect(track.mock.calls).toEqual([
      ["collection_item_found", { part_kind: "animal", part_value: "fox", tier: "common" }],
      ["guest_saves_merged", { guest_count: 4, merged_count: 2 }],
    ]);
  });

  describe("the 도감 report waits in this browser until the server answers it for good (v1.7.1)", () => {
    const meeting = (index: number) => ({ seed: 6, count: 5, iat: 1_790_000_000, sub: null, sig: "a".repeat(43), isbns: ["9790000000000", "9790000000001", "9790000000002", "9790000000003", "9790000000004"], index });
    const foundCalls = () => request.mock.calls.filter(([, path]) => path === "/api/collection/found");

    it("a failed report (server, network) stays and is tried on the next visit without saving the book again; then it leaves", async () => {
      const { merge, guest } = await setup([{ ...save(isbnAt(0)), meeting: meeting(0) }]);
      const pending = await import("./dexPending");
      request.mockImplementation(async (_m: string, path: string) =>
        (path === "/api/library/saves" ? { ...saved(), body: { ok: true, saved: true, found: [{ kind: "animal", value: "owl" }] } } : failed(503)));
      await merge.mergeGuestSaves(true);
      expect(guest.guestSaves()).toEqual([]);
      expect(pending.pendingDex().map((e) => [e.isbn, e.tries])).toEqual([[isbnAt(0), 1]]);
      expect(track).toHaveBeenCalledWith("collection_item_found", { part_kind: "animal", part_value: "owl", tier: "common" });   // from the save
      request.mockClear();
      track.mockClear();
      request.mockResolvedValue({ ok: true, status: 200, body: { ok: true, found: [] } });
      await merge.mergeGuestSaves(false);                                            // a later visit, nothing left to save
      expect(request.mock.calls.map(([, path]) => path)).toEqual(["/api/collection/found"]);
      expect(pending.pendingDex()).toEqual([]);
      expect(track).not.toHaveBeenCalled();                                          // no E-39 for a report alone
    });

    it("a definite refusal (4xx) lets the report go; repeated failures stop after three visits; a run-out session leaves it untouched", async () => {
      const { merge } = await setup([{ ...save(isbnAt(0)), meeting: meeting(0) }, { ...save(isbnAt(1)), meeting: meeting(1) }]);
      const pending = await import("./dexPending");
      request.mockImplementation(async (_m: string, path: string, body: { index?: number }) => {
        if (path === "/api/library/saves") return saved();
        return body.index === 1 ? failed(403, "not recorded") : failed(0);
      });
      await merge.mergeGuestSaves(true);
      expect(pending.pendingDex().map((e) => [e.isbn, e.tries])).toEqual([[isbnAt(0), 1]]);
      await merge.mergeGuestSaves(false);
      await merge.mergeGuestSaves(false);
      expect(pending.pendingDex()).toEqual([]);
      expect(foundCalls()).toHaveLength(4);
      pending.addPendingDex([{ meeting: meeting(2), isbn: "9790000000002" }]);
      request.mockResolvedValue(failed(401));
      await merge.mergeGuestSaves(false);
      expect(pending.pendingDex().map((e) => e.tries)).toEqual([undefined]);
    });
  });
});
