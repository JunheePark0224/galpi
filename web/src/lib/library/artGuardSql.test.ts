import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { ART_KINDS, EMPTY_GROUND, KIND_TIERS } from "@/lib/art/combine";

/**
 * 0006 repeats decorate.ts's rule (partAllowed) and isRare's tier lists inside the database. These tests keep the SQL text
 * equal to lib/art/combine.ts, so a new 한정판 part cannot drift from the guard without a red test.
 */
const SUPABASE = path.resolve(process.cwd(), "supabase");
const migration = () => {
  const name = readdirSync(path.join(SUPABASE, "migrations")).find((f) => f.startsWith("0006_"));
  if (!name) throw new Error("migration 0006_* is missing");
  return readFileSync(path.join(SUPABASE, "migrations", name), "utf8");
};

/** `when '<kind>' then array['a', 'b']` → { kind: [a, b] } — the non-일반판 parts the trigger counts as rare. */
function rareLists(sql: string): Record<string, string[]> {
  const out: Record<string, string[]> = {};
  for (const m of sql.matchAll(/when '(\w+)' then array\[([^\]]*)\]/g)) {
    out[m[1]] = [...m[2].matchAll(/'(\w+)'/g)].map((v) => v[1]);
  }
  return out;
}

describe("0006 saves art guard", () => {
  it("lists exactly the 한정판 + 초판본 parts of every kind (isRare)", () => {
    const lists = rareLists(migration());
    for (const kind of ART_KINDS) {
      const expected = [...KIND_TIERS[kind].limited, ...KIND_TIERS[kind].first_edition];
      expect([...(lists[kind] ?? [])].sort(), kind).toEqual([...expected].sort());
    }
    expect(Object.keys(lists).sort()).toEqual([...ART_KINDS].sort());
  });

  it("allows the empty ground, the first picture's part and the person's 도감 (partAllowed)", () => {
    const sql = migration();
    expect(sql).toContain(`k = 'ground' and v = '${EMPTY_GROUND}'`);
    expect(sql).toContain("old.original_art ->> k = v");
    expect(sql).toMatch(/from public\.collection c where c\.user_id = new\.user_id and c\.kind = k and c\.value = v/);
    expect(sql).toContain("array['animal', 'bg', 'sky', 'ground']");
  });

  it("runs before an update that changes art only, idempotently", () => {
    const sql = migration();
    expect(sql).toContain("drop trigger if exists saves_art_guard on public.saves;");
    expect(sql).toMatch(/create trigger saves_art_guard before update on public\.saves\s+for each row when \(new\.art is distinct from old\.art\)/);
    expect(sql).toContain("create or replace function public.saves_art_guard()");
    expect(sql).toMatch(/security definer set search_path = ''/);
  });

  it("has a check script that ends in the RLS CHECK RESULT box", () => {
    const check = readFileSync(path.join(SUPABASE, "checks", "art_guard.sql"), "utf8");
    expect(check).toContain("RLS CHECK RESULT");
    expect(check).toContain("after 0006");
  });
});
