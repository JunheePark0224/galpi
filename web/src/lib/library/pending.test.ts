import { afterEach, describe, expect, it, vi } from "vitest";
import { clearPending, PENDING_KEY, readPending, writePending } from "./pending";

import type { SaveInput } from "./service";

const ITEM: SaveInput = { isbn: "9788998441012", art: { animal: "fox", bg: "night", sky: "moon", ground: "books", rare: false }, reason: { label: "이 책은", items: [] }, metOn: "2026-10-01" };

describe("pending 꽂기 (kept in this tab while the person logs in)", () => {
  afterEach(() => { sessionStorage.clear(); vi.useRealTimers(); });

  it("remembers one bookmark and forgets it on demand", () => {
    writePending(ITEM);
    expect(readPending()).toEqual(ITEM);
    clearPending();
    expect(readPending()).toBeNull();
  });

  it("forgets a bookmark left waiting for more than 30 minutes", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-10-01T10:00:00Z"));
    writePending(ITEM);
    vi.setSystemTime(new Date("2026-10-01T10:31:00Z"));
    expect(readPending()).toBeNull();
  });

  it("ignores anything broken in storage, and survives blocked storage", () => {
    sessionStorage.setItem(PENDING_KEY, "{oops");
    expect(readPending()).toBeNull();
    sessionStorage.setItem(PENDING_KEY, JSON.stringify({ at: Date.now(), item: { isbn: 1 } }));
    expect(readPending()).toBeNull();
    const spy = vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => { throw new Error("blocked"); });
    expect(() => writePending(ITEM)).not.toThrow();
    spy.mockRestore();
  });
});
