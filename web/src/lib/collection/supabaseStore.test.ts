import { afterEach, describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";

vi.mock("server-only", () => ({}));
import { collectionWriter, supabaseCollection } from "./supabaseStore";
import { CollectionUnavailable } from "./types";

type Result = { data?: unknown; error?: { code: string } | null };

/** A query builder that records every call and resolves to the next queued result (as in the library's test). */
function fakeDb(results: Result[]) {
  const calls: string[] = [];
  const queue = [...results];
  const builder: Record<string, unknown> = {};
  for (const m of ["select", "upsert", "update", "eq", "order", "insert"]) {
    builder[m] = (...args: unknown[]) => {
      calls.push(`${m}(${args.map((a) => JSON.stringify(a)).join(",")})`);
      return builder;
    };
  }
  builder.then = (resolve: (r: Result) => void) => resolve({ error: null, ...queue.shift() });
  const db = { from: (table: string) => { calls.push(`from(${table})`); return builder; } } as unknown as SupabaseClient;
  return { db, calls };
}

const ART = { animal: "otter", bg: "peach", sky: "moon", ground: "none", rare: true };

describe("supabaseCollection — reads with the session, writes with the server's key, always for this person", () => {
  afterEach(() => vi.unstubAllEnvs());

  it("claims a kept bookmark with the person's session (RLS); a taken one is this person's only when they can see it (0007)", async () => {
    const claim = { seed: 7, iat: 100, index: 1 };
    const free = fakeDb([{}]);
    expect(await supabaseCollection(free.db, null, "u1").claimKept(claim)).toBe(true);
    expect(free.calls).toEqual(["from(collection_kept_claims)", 'insert({"seed":7,"iat":100,"idx":1,"user_id":"u1"})']);
    const mineAgain = fakeDb([{ error: { code: "23505" } }, { data: [{ user_id: "u1" }] }]);
    expect(await supabaseCollection(mineAgain.db, null, "u1").claimKept(claim)).toBe(true);
    expect(mineAgain.calls.slice(2)).toEqual(["from(collection_kept_claims)", 'select("user_id")', 'eq("seed",7)', 'eq("iat",100)', 'eq("idx",1)']);
    const theirs = fakeDb([{ error: { code: "23505" } }, { data: [] }]);
    expect(await supabaseCollection(theirs.db, null, "u1").claimKept(claim)).toBe(false);
    await expect(supabaseCollection(fakeDb([{ error: { code: "42P01" } }]).db, null, "u1").claimKept(claim)).rejects.toBeInstanceOf(CollectionUnavailable);
    await expect(supabaseCollection(fakeDb([{ error: { code: "42501" } }]).db, null, "u1").claimKept(claim)).rejects.toThrow("collection claim failed: 42501");
    await expect(supabaseCollection(fakeDb([{ error: { code: "23505" } }, { error: { code: "08006" } }]).db, null, "u1").claimKept(claim))
      .rejects.toThrow("collection claim failed: 08006");
  });

  it("reads the person's rows in meeting order and drops rows that are not parts we draw", async () => {
    const { db, calls } = fakeDb([{ data: [
      { kind: "animal", value: "otter", first_met_at: "2026-10-05T01:00:00Z", first_art: ART, is_new: true },
      { kind: "animal", value: "dragon", first_met_at: "2026-10-05T01:00:00Z", first_art: ART, is_new: false },
      { kind: "bg", value: "peach", first_met_at: "2026-10-05T01:00:00Z", first_art: { broken: true }, is_new: false },
      { kind: "ground", value: "none", first_met_at: "2026-10-05T01:00:00Z", first_art: ART, is_new: true },   // before the 10-05 fix
    ] }]);
    expect(await supabaseCollection(db, null, "u1").items()).toEqual([
      { kind: "animal", value: "otter", firstMetAt: "2026-10-05T01:00:00Z", firstArt: ART, isNew: true },
    ]);
    expect(calls).toEqual(["from(collection)", 'select("kind, value, first_met_at, first_art, is_new")', 'eq("user_id","u1")', 'order("first_met_at")']);
  });

  it("records the collectible parts (never the empty ground) with insert-or-nothing and returns only the new ones", async () => {
    const reader = fakeDb([]);
    const { db: writer, calls } = fakeDb([{ data: [{ kind: "animal", value: "otter" }] }]);
    expect(await supabaseCollection(reader.db, writer, "u1").record(ART as never)).toEqual([{ kind: "animal", value: "otter" }]);
    const rows = ["animal:otter", "bg:peach", "sky:moon"].map((p) => {
      const [kind, value] = p.split(":");
      return { user_id: "u1", kind, value, first_art: ART };
    });
    expect(calls).toEqual([
      "from(collection)", `upsert(${JSON.stringify(rows)},{"onConflict":"user_id,kind,value","ignoreDuplicates":true})`, 'select("kind, value")',
    ]);
    expect(reader.calls).toEqual([]);
  });

  it("clears NEW for this person only and counts the rows", async () => {
    const { db, calls } = fakeDb([{ data: [{ kind: "animal" }, { kind: "bg" }] }]);
    expect(await supabaseCollection(db, db, "u1").markSeen()).toBe(2);
    expect(calls).toEqual(["from(collection)", 'update({"is_new":false})', 'eq("user_id","u1")', 'eq("is_new",true)', 'select("kind")']);
  });

  it("says the table is missing (0004 not applied) apart from other errors, and refuses to write without the server key", async () => {
    const { db } = fakeDb([{ error: { code: "PGRST205" } }, { error: { code: "42P01" } }, { error: { code: "42501" } }, {}]);
    const store = supabaseCollection(db, db, "u1");
    await expect(store.items()).rejects.toBeInstanceOf(CollectionUnavailable);
    await expect(store.record(ART as never)).rejects.toBeInstanceOf(CollectionUnavailable);
    await expect(store.markSeen()).rejects.toThrow("collection seen failed: 42501");
    expect(await store.markSeen()).toBe(0);
    await expect(supabaseCollection(db, null, "u1").record(ART as never)).rejects.toThrow("collection writes are off");
  });

  it("has a writer only with the service key", async () => {
    vi.stubEnv("SUPABASE_URL", "");
    vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "");
    vi.resetModules();
    const off = await import("./supabaseStore");
    expect(off.collectionWriter()).toBeNull();
    expect(off.collectionWriter()).toBeNull();   // remembered
    vi.stubEnv("SUPABASE_URL", "http://supabase.test.invalid");
    vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "test-key-not-real");
    vi.resetModules();
    const on = await import("./supabaseStore");
    expect(on.collectionWriter()).not.toBeNull();
    expect(typeof collectionWriter).toBe("function");
  });
});
