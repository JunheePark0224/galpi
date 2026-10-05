import { afterEach, describe, expect, it, vi } from "vitest";

const track = vi.fn();
const request = vi.fn();
vi.mock("@/lib/track/client", () => ({ track: (...a: unknown[]) => track(...a) }));
vi.mock("./client", () => ({ libraryRequest: (...a: unknown[]) => request(...a) }));

const isbnAt = (i: number) => `979000000${String(i).padStart(4, "0")}`;
const save = (isbn: string) => ({
  isbn, art: { animal: "fox", bg: "night", sky: "moon", ground: "books", rare: false } as const,
  reason: { label: "나온 이유" as const, items: [] as string[] }, metOn: "2026-10-01",
  card: { id: isbn, entry: "leaf" as const, title: "책", author: "저자", genre: "한국 소설", field: null, oneLiner: "?", oneLinerStyle: "question" as const },
});
const posted = () => request.mock.calls.map((c) => (c[2] as { isbn: string }).isbn);

async function setup(kept: number, count = 2) {
  vi.resetModules();
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, json: async () => ({ enabled: true, loggedIn: true, id: "u1", count }) }));
  const [merge, store, guest] = await Promise.all([import("./merge"), import("@/lib/account/store"), import("./guest")]);
  await store.loadAccount();
  for (let i = 0; i < kept; i++) guest.addGuestSave(save(isbnAt(i)));
  return { merge, store, guest };
}

describe("merge (로그인 뒤 임시 책갈피를 계정으로, E-39)", () => {
  afterEach(() => { vi.unstubAllGlobals(); vi.clearAllMocks(); localStorage.clear(); });

  it("does nothing when this browser kept nothing", async () => {
    const { merge } = await setup(0);
    await merge.mergeGuestSaves();
    expect(request).not.toHaveBeenCalled();
    expect(track).not.toHaveBeenCalled();
  });

  it("sends each one, oldest first (so the newest ends at the rod's front), without the card; counts only the new ones", async () => {
    const { merge, store, guest } = await setup(3);
    request
      .mockResolvedValueOnce({ ok: true, status: 200, body: { ok: true, saved: true } })
      .mockResolvedValueOnce({ ok: true, status: 200, body: { ok: true, saved: false } })    // already in the account
      .mockResolvedValueOnce({ ok: true, status: 200, body: { ok: true, saved: true } });
    const heard = vi.fn();
    merge.onGuestMerged(heard);
    await merge.mergeGuestSaves();
    expect(posted()).toEqual([isbnAt(0), isbnAt(1), isbnAt(2)]);
    expect(request.mock.calls[0]).toEqual(["POST", "/api/library/saves", { isbn: isbnAt(0), art: save("").art, reason: save("").reason, metOn: "2026-10-01" }]);
    expect(guest.guestSaves()).toEqual([]);
    expect(store.accountSnapshot().count).toBe(4);
    expect(store.keepSnapshot(isbnAt(1))).toBe("saved");
    expect(track.mock.calls).toEqual([["guest_saves_merged", { guest_count: 3, merged_count: 2 }]]);
    expect(heard).toHaveBeenCalledTimes(1);
  });

  it("keeps the ones that failed for the next visit, and asks once even when called twice at once", async () => {
    const { merge, guest } = await setup(3);
    request
      .mockResolvedValueOnce({ ok: true, status: 200, body: { ok: true, saved: true } })
      .mockResolvedValueOnce({ ok: false, status: 409, body: { ok: false, error: "full" } })
      .mockResolvedValueOnce({ ok: true, status: 200, body: null });
    await Promise.all([merge.mergeGuestSaves(), merge.mergeGuestSaves()]);
    expect(request).toHaveBeenCalledTimes(3);
    expect(guest.guestSaves().map((s) => s.isbn)).toEqual([isbnAt(2), isbnAt(1)]);
    expect(track.mock.calls).toEqual([["guest_saves_merged", { guest_count: 3, merged_count: 1 }]]);
  });

  it("stops at a run-out session: what went stays gone, the rest waits, the header says logged out", async () => {
    const { merge, store, guest } = await setup(3);
    const heard = vi.fn();
    const stop = merge.onGuestMerged(heard);
    stop();
    request
      .mockResolvedValueOnce({ ok: true, status: 200, body: { ok: true, saved: true } })
      .mockResolvedValueOnce({ ok: false, status: 401, body: null });
    await merge.mergeGuestSaves();
    expect(request).toHaveBeenCalledTimes(2);
    expect(guest.guestSaves().map((s) => s.isbn)).toEqual([isbnAt(2), isbnAt(1)]);
    expect(store.accountSnapshot().status).toBe("out");
    expect(track.mock.calls).toEqual([["guest_saves_merged", { guest_count: 3, merged_count: 1 }]]);
    expect(heard).not.toHaveBeenCalled();
  });

  it("nothing went through: nothing to tell the library", async () => {
    const { merge } = await setup(1);
    const heard = vi.fn();
    merge.onGuestMerged(heard);
    request.mockResolvedValueOnce({ ok: false, status: 0, body: null });
    await merge.mergeGuestSaves();
    expect(heard).not.toHaveBeenCalled();
    expect(track.mock.calls).toEqual([["guest_saves_merged", { guest_count: 1, merged_count: 0 }]]);
  });
});
