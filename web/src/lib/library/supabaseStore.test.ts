import { describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";

vi.mock("server-only", () => ({}));
import { LibraryWriteOff, savedIsbns, supabaseStore } from "./supabaseStore";

type Result = { data?: unknown; error?: { code: string } | null; count?: number };

/** A query builder that records every call and resolves to the next queued result. */
function fakeDb(results: Result[]) {
  const calls: string[] = [];
  const queue = [...results];
  const builder: Record<string, unknown> = {};
  for (const m of ["select", "insert", "upsert", "update", "delete", "eq", "order", "single"]) {
    builder[m] = (...args: unknown[]) => {
      calls.push(`${m}(${args.map((a) => JSON.stringify(a)).join(",")})`);
      return builder;
    };
  }
  builder.then = (resolve: (r: Result) => void) => resolve({ error: null, ...queue.shift() });
  const db = { from: (table: string) => { calls.push(`from(${table})`); return builder; } } as unknown as SupabaseClient;
  return { db, calls };
}

const ROW = { isbn: "9788998441012", art: {}, reason: { label: "이 책은", items: [] }, met_on: "2026-10-01", shelf_id: "s", position: 0 };

describe("supabaseStore — every statement filtered to the person (RLS says the same)", () => {
  it("reads rods and bookmarks in order", async () => {
    const { db, calls } = fakeDb([{ data: [{ id: "s", name: "첫", position: 0 }] }, { data: [ROW] }]);
    const store = supabaseStore(db, "u1");
    expect(await store.shelves()).toEqual([{ id: "s", name: "첫", position: 0 }]);
    expect(await store.saves()).toEqual([{ isbn: ROW.isbn, art: {}, reason: ROW.reason, metOn: "2026-10-01", shelfId: "s", position: 0, originalArt: null }]);
    expect(calls).toEqual([
      "from(shelves)", 'select("id, name, position")', 'eq("user_id","u1")', 'order("position")',
      "from(saves)", 'select("isbn, art, reason, met_on, shelf_id, position, original_art")', 'eq("user_id","u1")', 'order("position")', 'order("created_at")',
    ]);
  });

  it("reads the first picture (0005), and without the column (0005 not applied) the rods still load — originalArt null", async () => {
    const first = { animal: "fox" };
    const withColumn = fakeDb([{ data: [{ ...ROW, original_art: first }] }]);
    expect((await supabaseStore(withColumn.db, "u1").saves())[0].originalArt).toEqual(first);
    const { db, calls } = fakeDb([{ error: { code: "42703" } }, { data: [ROW] }]);
    expect((await supabaseStore(db, "u1").saves())[0].originalArt).toBeNull();
    expect(calls.filter((c) => c.startsWith("select"))).toEqual([
      'select("isbn, art, reason, met_on, shelf_id, position, original_art")', 'select("isbn, art, reason, met_on, shelf_id, position")',
    ]);
    const broken = fakeDb([{ error: { code: "42501" } }]);
    await expect(supabaseStore(broken.db, "u1").saves()).rejects.toThrow("library saves failed: 42501");
  });

  it("꾸미기 writes art only (never original_art), for this person's book", async () => {
    const art = { animal: "otter", bg: "peach", sky: "moon", ground: "none", rare: true } as const;
    const { db, calls } = fakeDb([{ data: [{ isbn: "9788998441012" }] }, { data: [] }, { error: { code: "42501" } }]);
    const store = supabaseStore(db, "u1");
    expect(await store.updateArt("9788998441012", art)).toBe(true);
    expect(calls).toEqual(["from(saves)", `update(${JSON.stringify({ art })})`, 'eq("user_id","u1")', 'eq("isbn","9788998441012")', 'select("isbn")']);
    expect(await store.updateArt("9788998441029", art)).toBe(false);
    await expect(store.updateArt("9788998441012", art)).rejects.toThrow("library decorate failed: 42501");
  });

  it("makes the first rod with insert-or-nothing, then reads it", async () => {
    const { db, calls } = fakeDb([{}, { data: { id: "s", name: "첫 막대", position: 0 } }]);
    expect(await supabaseStore(db, "u1").firstShelf("첫 막대")).toEqual({ id: "s", name: "첫 막대", position: 0 });
    expect(calls.slice(0, 2)).toEqual(["from(shelves)", 'upsert({"user_id":"u1","name":"첫 막대","position":0},{"onConflict":"user_id,position","ignoreDuplicates":true})']);
  });

  it("turns 'already there' and 'not your rod' into false / null, other errors into a thrown code", async () => {
    const dup = { error: { code: "23505" } };
    const fk = { error: { code: "23503" } };
    const { db } = fakeDb([dup, dup, fk, fk, { error: { code: "42501" } }]);
    const store = supabaseStore(db, "u1", db);
    const row = { isbn: "9788998441012", art: {} as never, reason: { label: "이 책은" as const, items: [] }, metOn: "2026-10-01", shelfId: "s", position: 0 };
    expect(await store.insertSave(row)).toBe(false);
    expect(await store.insertShelf("x", 1)).toBeNull();
    expect(await store.updateSave("9788998441012", { shelfId: "t", position: -1 })).toBe(false);
    expect(await store.deleteShelf("s")).toBe(false);
    await expect(store.renameShelf("s", "x")).rejects.toThrow("library rename shelf failed: 42501");
  });

  it("saves a bookmark with the server's client only, user_id from the session; without it the save fails closed (0007)", async () => {
    const session = fakeDb([]);
    const server = fakeDb([{}]);
    const row = { isbn: "9788998441012", art: {} as never, reason: { label: "이 책은" as const, items: [] }, metOn: "2026-10-01", shelfId: "s", position: 0 };
    expect(await supabaseStore(session.db, "u1", server.db).insertSave(row)).toBe(true);
    expect(session.calls).toEqual([]);
    expect(server.calls[0]).toBe("from(saves)");
    expect(server.calls[1]).toMatch(/^insert\(\{"user_id":"u1",/);
    await expect(supabaseStore(session.db, "u1").insertSave(row)).rejects.toBeInstanceOf(LibraryWriteOff);
    expect(session.calls).toEqual([]);
  });

  it("reports whether a change touched a row", async () => {
    const { db, calls } = fakeDb([{ data: [{ isbn: "1" }] }, { data: [] }, { data: [{ id: "s" }] }, { data: [{ id: "s" }] }, {}, { data: { id: "n", name: "x", position: 2 } }]);
    const store = supabaseStore(db, "u1", db);
    expect(await store.deleteSave("9788998441012")).toBe(true);
    expect(await store.updateSave("9788998441012", { shelfId: "t", position: -1 })).toBe(false);
    expect(await store.renameShelf("s", "새 이름")).toBe(true);
    expect(await store.deleteShelf("s")).toBe(true);
    expect(await store.insertSave({ isbn: "9788998441012", art: {} as never, reason: { label: "이 책은", items: [] }, metOn: "2026-10-01", shelfId: "s", position: -1 })).toBe(true);
    expect(await store.insertShelf("x", 2)).toEqual({ id: "n", name: "x", position: 2 });
    expect(calls).toContain('insert({"user_id":"u1","isbn":"9788998441012","art":{},"reason":{"label":"이 책은","items":[]},"met_on":"2026-10-01","shelf_id":"s","position":-1})');
    expect(calls).toContain('update({"shelf_id":"t","position":-1})');
  });

  it("takes every bookmark of the person in one statement and counts the rows; a failure throws its code", async () => {
    const { db, calls } = fakeDb([{ data: [{ isbn: "1" }, { isbn: "2" }] }, { data: null }, { error: { code: "42501" } }]);
    const store = supabaseStore(db, "u1");
    expect(await store.deleteAllSaves()).toBe(2);
    expect(calls).toEqual(["from(saves)", "delete()", 'eq("user_id","u1")', 'select("isbn")']);
    expect(await store.deleteAllSaves()).toBe(0);
    await expect(store.deleteAllSaves()).rejects.toThrow("library unsave all failed: 42501");
  });

  it("takes the bookmarks of one rod only (막대 지우기) and counts them; a failure throws its code", async () => {
    const { db, calls } = fakeDb([{ data: [{ isbn: "1" }, { isbn: "2" }] }, { data: null }, { error: { code: "42501" } }]);
    const store = supabaseStore(db, "u1");
    expect(await store.deleteShelfSaves("s")).toBe(2);
    expect(calls).toEqual(["from(saves)", "delete()", 'eq("user_id","u1")', 'eq("shelf_id","s")', 'select("isbn")']);
    expect(await store.deleteShelfSaves("s")).toBe(0);
    await expect(store.deleteShelfSaves("s")).rejects.toThrow("library unsave rod failed: 42501");
  });

  it("lists the kept ISBNs for the header count", async () => {
    const { db, calls } = fakeDb([{ data: [{ isbn: "1" }, { isbn: "2" }] }]);
    expect(await savedIsbns(db, "u1")).toEqual(["1", "2"]);
    expect(calls).toEqual(["from(saves)", 'select("isbn")', 'eq("user_id","u1")']);
  });
});
