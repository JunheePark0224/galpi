// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { memoryStore } from "@/lib/library/__fixtures__/memoryStore";
import type { LibraryStore } from "@/lib/library/types";
import { CollectionUnavailable } from "@/lib/collection/types";

vi.mock("server-only", () => ({}));
let userId: string | null = "u1";
let store: ReturnType<typeof memoryStore>;
let owned: { kind: string; value: string }[] = [];
let ownedFails: Error | null = null;
const readers: unknown[] = [];
vi.mock("@/lib/auth/server", () => ({
  authClient: async () => ({ session: "of u1" }),
  sessionUserId: async () => userId,
}));
vi.mock("@/lib/library/supabaseStore", () => ({ supabaseStore: () => store as LibraryStore }));
vi.mock("@/lib/collection/supabaseStore", () => ({
  supabaseCollection: (reader: unknown, writer: unknown, who: string) => {
    readers.push({ reader, writer, who });
    return { items: async () => { if (ownedFails) throw ownedFails; return owned; } };
  },
}));
const error = vi.spyOn(console, "error").mockImplementation(() => {});

import { PATCH as decorate } from "./route";

const ORIGIN = "http://x";
let ip = 0;
const patch = (body: unknown, origin = ORIGIN) => new Request(`${ORIGIN}/api/library/saves/art`, {
  method: "PATCH", headers: { origin, "x-forwarded-for": `10.1.0.${ip++ % 250}`, "content-type": "application/json" }, body: JSON.stringify(body),
});

const ISBN = "9788998441012";
const SHELF = "11111111-1111-4111-8111-111111111111";
const FIRST = { animal: "fox", bg: "night", sky: "moon", ground: "books", rare: false } as const;
const row = (art: object, originalArt: object | null | undefined = FIRST) =>
  ({ isbn: ISBN, art: art as never, originalArt: originalArt as never, reason: { label: "이 책은" as const, items: [] }, metOn: "2026-10-05", shelfId: SHELF, position: 0 });

describe("PATCH /api/library/saves/art (책갈피 꾸미기)", () => {
  beforeEach(() => {
    store = memoryStore({ shelves: [{ id: SHELF, name: "첫 막대", position: 0 }], saves: [row(FIRST)] });
    owned = [{ kind: "animal", value: "otter" }, { kind: "bg", value: "galaxy" }, { kind: "animal", value: "fox" }];
    ownedFails = null;
    readers.length = 0;
  });
  afterEach(() => { userId = "u1"; vi.clearAllMocks(); });

  it("saves a picture made of collected parts, reading the 도감 with the person's session (no server key)", async () => {
    const res = await decorate(patch({ isbn: ISBN, art: { ...FIRST, animal: "otter", bg: "galaxy" } }));
    expect(res.status).toBe(200);
    const saved = { animal: "otter", bg: "galaxy", sky: "moon", ground: "books", rare: true };
    expect(await res.json()).toEqual({ ok: true, art: saved });
    expect(store.data.saves[0].art).toEqual(saved);
    expect(store.data.saves[0].originalArt).toEqual(FIRST);                     // the first picture never changes
    expect(readers).toEqual([{ reader: { session: "of u1" }, writer: null, who: "u1" }]);
  });

  it("refuses a part that is not in the person's 도감 (403) and changes nothing", async () => {
    const res = await decorate(patch({ isbn: ISBN, art: { ...FIRST, animal: "bluedragon" } }));
    expect(res.status).toBe(403);
    expect(await res.json()).toEqual({ error: "forbidden" });
    expect(store.data.saves[0].art).toEqual(FIRST);
  });

  it("allows the empty ground and the bookmark's own first parts without a 도감 row", async () => {
    owned = [];                                                                   // kept before a login: nothing recorded
    const none = await decorate(patch({ isbn: ISBN, art: { ...FIRST, ground: "none" } }));
    expect(none.status).toBe(200);
    const back = await decorate(patch({ isbn: ISBN, art: FIRST }));              // [처음 그림으로]
    expect(back.status).toBe(200);
    expect(store.data.saves[0].art).toEqual(FIRST);
    // a part of another bookmark's first picture is not this bookmark's: still refused
    expect((await decorate(patch({ isbn: ISBN, art: { ...FIRST, sky: "rainbow" } }))).status).toBe(403);
  });

  it("works `rare` out again from the parts — a tampered flag is never stored", async () => {
    const common = await decorate(patch({ isbn: ISBN, art: { ...FIRST, rare: true } }));
    expect((await common.json()).art.rare).toBe(false);
    expect(store.data.saves[0].art.rare).toBe(false);
    await decorate(patch({ isbn: ISBN, art: { ...FIRST, animal: "otter", rare: false } }));
    expect(store.data.saves[0].art).toEqual({ ...FIRST, animal: "otter", rare: true });
  });

  it("refuses an unknown part, a bad isbn or shape (400), a book not saved (404), another site (403) and no login (401)", async () => {
    expect((await decorate(patch({ isbn: ISBN, art: { ...FIRST, animal: "dragon" } }))).status).toBe(400);
    expect((await decorate(patch({ isbn: "123", art: FIRST }))).status).toBe(400);
    expect((await decorate(patch({ isbn: ISBN }))).status).toBe(400);
    expect((await decorate(patch({ isbn: "9788998441029", art: FIRST }))).status).toBe(404);
    expect((await decorate(patch({ isbn: ISBN, art: FIRST }, "https://evil.example"))).status).toBe(403);
    userId = null;
    expect((await decorate(patch({ isbn: ISBN, art: FIRST }))).status).toBe(401);
  });

  it("is unavailable (503) before 0005 (no first picture) or without the 도감 table, and a database error is a plain 500", async () => {
    store = memoryStore({ shelves: [{ id: SHELF, name: "첫 막대", position: 0 }], saves: [row(FIRST, null)] });
    expect((await decorate(patch({ isbn: ISBN, art: FIRST }))).status).toBe(503);
    store = memoryStore({ shelves: [{ id: SHELF, name: "첫 막대", position: 0 }], saves: [row(FIRST)] });
    ownedFails = new CollectionUnavailable();
    expect((await decorate(patch({ isbn: ISBN, art: FIRST }))).status).toBe(503);
    ownedFails = new Error("collection read failed: 42501");
    expect((await decorate(patch({ isbn: ISBN, art: FIRST }))).status).toBe(500);
    expect(error).toHaveBeenCalledWith("library:", "collection read failed: 42501");
  });
});
