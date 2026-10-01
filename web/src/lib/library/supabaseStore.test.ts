import { describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";

vi.mock("server-only", () => ({}));
import { countSaves, supabaseStore } from "./supabaseStore";

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
    expect(await store.saves()).toEqual([{ isbn: ROW.isbn, art: {}, reason: ROW.reason, metOn: "2026-10-01", shelfId: "s", position: 0 }]);
    expect(calls).toEqual([
      "from(shelves)", 'select("id, name, position")', 'eq("user_id","u1")', 'order("position")',
      "from(saves)", 'select("isbn, art, reason, met_on, shelf_id, position")', 'eq("user_id","u1")', 'order("position")', 'order("created_at")',
    ]);
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
    const store = supabaseStore(db, "u1");
    const row = { isbn: "9788998441012", art: {} as never, reason: { label: "이 책은" as const, items: [] }, metOn: "2026-10-01", shelfId: "s", position: 0 };
    expect(await store.insertSave(row)).toBe(false);
    expect(await store.insertShelf("x", 1)).toBeNull();
    expect(await store.updateSave("9788998441012", { shelfId: "t", position: -1 })).toBe(false);
    expect(await store.deleteShelf("s")).toBe(false);
    await expect(store.renameShelf("s", "x")).rejects.toThrow("library rename shelf failed: 42501");
  });

  it("reports whether a change touched a row", async () => {
    const { db, calls } = fakeDb([{ data: [{ isbn: "1" }] }, { data: [] }, { data: [{ id: "s" }] }, { data: [{ id: "s" }] }, {}, { data: { id: "n", name: "x", position: 2 } }]);
    const store = supabaseStore(db, "u1");
    expect(await store.deleteSave("9788998441012")).toBe(true);
    expect(await store.updateSave("9788998441012", { shelfId: "t", position: -1 })).toBe(false);
    expect(await store.renameShelf("s", "새 이름")).toBe(true);
    expect(await store.deleteShelf("s")).toBe(true);
    expect(await store.insertSave({ isbn: "9788998441012", art: {} as never, reason: { label: "이 책은", items: [] }, metOn: "2026-10-01", shelfId: "s", position: -1 })).toBe(true);
    expect(await store.insertShelf("x", 2)).toEqual({ id: "n", name: "x", position: 2 });
    expect(calls).toContain('insert({"user_id":"u1","isbn":"9788998441012","art":{},"reason":{"label":"이 책은","items":[]},"met_on":"2026-10-01","shelf_id":"s","position":-1})');
    expect(calls).toContain('update({"shelf_id":"t","position":-1})');
  });

  it("counts bookmarks without loading them", async () => {
    const { db, calls } = fakeDb([{ count: 3 }]);
    expect(await countSaves(db, "u1")).toBe(3);
    expect(calls).toContain('select("isbn",{"count":"exact","head":true})');
  });
});
