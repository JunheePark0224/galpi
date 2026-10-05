import { afterEach, describe, expect, it, vi } from "vitest";
import { addPendingDex, DEX_PENDING_KEY, pendingDex, settlePendingDex } from "./dexPending";
import { GUEST_TRIES } from "./guest";

const ISBNS = ["9790000000000", "9790000000001", "9790000000002", "9790000000003", "9790000000004"];
const meeting = (index: number, seed = 5) => ({ seed, count: 5, iat: 1_790_000_000, sub: null, sig: "a".repeat(43), isbns: ISBNS, index });
const entry = (index: number, seed = 5) => ({ meeting: meeting(index, seed), isbn: ISBNS[index] });

describe("dex pending (a moved bookmark's 도감 report, kept until the server answers for good)", () => {
  afterEach(() => { localStorage.clear(); vi.restoreAllMocks(); });

  it("adds each bookmark of a draw once and keeps them in { v: 1, items }", () => {
    expect(pendingDex()).toEqual([]);
    addPendingDex([entry(0), entry(1)]);
    addPendingDex([entry(1), entry(2)]);
    expect(pendingDex().map((e) => e.meeting.index)).toEqual([0, 1, 2]);
    expect(JSON.parse(localStorage.getItem(DEX_PENDING_KEY) ?? "")).toEqual({ v: 1, items: [entry(0), entry(1), entry(2)] });
    addPendingDex([]);
    expect(pendingDex()).toHaveLength(3);
  });

  it("settles: done ones leave, failed ones count a try and leave at GUEST_TRIES; the last one out removes the key", () => {
    addPendingDex([entry(0), entry(1), entry(2)]);
    settlePendingDex([entry(0)], [entry(1)]);
    expect(pendingDex().map((e) => [e.meeting.index, e.tries])).toEqual([[1, 1], [2, undefined]]);
    for (let i = 1; i < GUEST_TRIES; i++) settlePendingDex([], [entry(1)]);
    expect(pendingDex().map((e) => e.meeting.index)).toEqual([2]);
    settlePendingDex([entry(2)], []);
    expect(localStorage.getItem(DEX_PENDING_KEY)).toBeNull();
  });

  it("reads only what it would have written, and survives blocked storage", () => {
    localStorage.setItem(DEX_PENDING_KEY, "{oops");
    expect(pendingDex()).toEqual([]);
    localStorage.setItem(DEX_PENDING_KEY, JSON.stringify({ v: 1, items: [entry(0), { meeting: { ...meeting(1), sig: "x" }, isbn: ISBNS[1] },
      { meeting: meeting(2), isbn: "123" }, { meeting: meeting(3), isbn: ISBNS[3], tries: -1 }, null] }));
    expect(pendingDex()).toEqual([entry(0)]);
    localStorage.setItem(DEX_PENDING_KEY, JSON.stringify({ v: 2, items: [entry(0)] }));
    expect(pendingDex()).toEqual([]);
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => { throw new Error("blocked"); });
    expect(pendingDex()).toEqual([]);
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => { throw new Error("blocked"); });
    expect(() => addPendingDex([entry(0)])).not.toThrow();
  });
});
