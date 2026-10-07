import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { ART_KINDS, EMPTY_GROUND, KIND_TIERS } from "@/lib/art/combine";

/**
 * 0006 repeats decorate.ts's rule (partAllowed) and isRare's tier lists inside the database; 0008 (10-07 A) replaces it
 * with the three-part guard. These tests read the LATEST migration that defines the guard and keep its SQL text equal to
 * lib/art/combine.ts, so a new 한정판 part cannot drift from the guard without a red test.
 */
const SUPABASE = path.resolve(process.cwd(), "supabase");
const GUARD = "create or replace function public.saves_art_guard()";
const read = (name: string) => readFileSync(path.join(SUPABASE, "migrations", name), "utf8");
const migration = () => {
  const name = readdirSync(path.join(SUPABASE, "migrations")).sort().filter((f) => read(f).includes(GUARD)).at(-1);
  if (!name) throw new Error("no migration defines saves_art_guard");
  return read(name);
};
const threePart = () => {
  const name = readdirSync(path.join(SUPABASE, "migrations")).find((f) => f.startsWith("0008_"));
  if (!name) throw new Error("migration 0008_* is missing");
  return read(name);
};

/** `when '<kind>' then array['a', 'b']` → { kind: [a, b] } — the non-일반판 parts the trigger counts as rare. */
function rareLists(sql: string): Record<string, string[]> {
  const out: Record<string, string[]> = {};
  for (const m of sql.matchAll(/when '(\w+)' then array\[([^\]]*)\]/g)) {
    out[m[1]] = [...m[2].matchAll(/'(\w+)'/g)].map((v) => v[1]);
  }
  return out;
}

describe("saves art guard (0006, three parts since 0008)", () => {
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
    expect(sql).toContain(`array[${ART_KINDS.map((k) => `'${k}'`).join(", ")}]`);
    expect(sql).toContain("jsonb_build_object('animal', new.art ->> 'animal', 'bg', new.art ->> 'bg', 'ground', new.art ->> 'ground', 'rare', rare)");
    expect(sql.slice(sql.indexOf(GUARD), sql.indexOf("end $$;", sql.indexOf(GUARD)))).not.toMatch(/'sky'/);   // the function itself
  });

  it("runs before an update that changes art only, idempotently", () => {
    const sql = migration();
    expect(sql).toContain("drop trigger if exists saves_art_guard on public.saves;");
    expect(sql).toMatch(/create trigger saves_art_guard before update on public\.saves\s+for each row when \(new\.art is distinct from old\.art\)/);
    expect(sql).toContain("create or replace function public.saves_art_guard()");
    expect(sql).toMatch(/security definer set search_path = ''/);
  });

  it("0008 resets the 도감 for launch, allows no sky kind, and makes every bookmark its first picture in three parts", () => {
    const sql = threePart();
    expect(sql).toBe(migration());                                                    // 0008 is the guard in force
    expect(sql).toContain("delete from public.collection;");
    expect(sql).toContain("check (kind in ('animal', 'bg', 'ground'))");
    expect(sql).toContain("delete from public.collection_kept_claims;");
    expect(sql).toContain("when a ->> 'ground' = 'firefly' then 'none'");
    expect(sql).toMatch(/set original_art = pg_temp\.three_part\(original_art\), art = pg_temp\.three_part\(original_art\)/);
    // the rare lists of the reset are the same as the guard's
    const rare = (kind: string) => [...KIND_TIERS[kind as keyof typeof KIND_TIERS].limited, ...KIND_TIERS[kind as keyof typeof KIND_TIERS].first_edition];
    for (const kind of ART_KINDS) expect(sql).toContain(`array[${rare(kind).map((v) => `'${v}'`).join(", ")}]`);
    // the triggers are back on after the one update
    expect(sql.indexOf("enable trigger saves_original_art")).toBeGreaterThan(sql.indexOf("disable trigger saves_original_art"));
    expect(sql.indexOf("enable trigger saves_art_guard")).toBeGreaterThan(sql.indexOf("disable trigger saves_art_guard"));
    const check = readFileSync(path.join(SUPABASE, "checks", "three_part_art.sql"), "utf8");
    expect(check).toContain("RLS CHECK RESULT");
    expect(check).toContain("after 0008");
  });

  it("has a check script that ends in the RLS CHECK RESULT box", () => {
    const check = readFileSync(path.join(SUPABASE, "checks", "art_guard.sql"), "utf8");
    expect(check).toContain("RLS CHECK RESULT");
    expect(check).toContain("after 0006");
  });
});
