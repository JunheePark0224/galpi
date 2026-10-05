import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { MAX_TICKET_PICKS } from "./meeting";

/**
 * 0007 (v1.7.1 security review): one person per bookmark of a draw on the `kept` path. These tests keep the SQL text in step
 * with the code that uses it (supabaseStore.claimKept's columns, MAX_TICKET_PICKS) and with its RLS check script.
 * The SQL itself was run on PGlite with a Supabase auth stand-in: every line of checks/kept_claims_rls.sql "ok".
 */
const SUPABASE = path.resolve(process.cwd(), "supabase");
const read = (dir: string, prefix: string) => {
  const name = readdirSync(path.join(SUPABASE, dir)).find((f) => f.startsWith(prefix));
  if (!name) throw new Error(`${dir}/${prefix}* is missing`);
  return readFileSync(path.join(SUPABASE, dir, name), "utf8");
};
const sql = () => read("migrations", "0007_");
const store = () => readFileSync(path.resolve(process.cwd(), "src/lib/collection/supabaseStore.ts"), "utf8");

describe("0007 collection_kept_claims", () => {
  it("is one row per bookmark of a draw, with the columns claimKept writes and the places a ticket may claim", () => {
    const text = sql();
    expect(text).toMatch(/create table if not exists public\.collection_kept_claims/);
    expect(text).toMatch(/primary key \(seed, iat, idx\)/);
    expect(text).toContain(`check (idx between 0 and ${MAX_TICKET_PICKS - 1})`);
    for (const column of ["seed", "iat", "idx", "user_id"]) expect(text).toMatch(new RegExp(String.raw`^\s+${column} `, "m"));
    expect(store()).toMatch(/insert\(\{ seed, iat, idx: index, user_id: userId \}\)/);
    expect(text).toMatch(/user_id uuid not null references auth\.users \(id\) on delete cascade/);
  });

  it("lets a person insert and read only their own claims — never change or give one up", () => {
    const text = sql();
    expect(text).toMatch(/enable row level security/);
    expect(text).toMatch(/revoke all on public\.collection_kept_claims from anon, authenticated;/);
    expect(text).toMatch(/grant select, insert on public\.collection_kept_claims to authenticated;/);
    expect(text).not.toMatch(/grant [^;]*(update|delete)[^;]* to authenticated/);
    expect(text).toMatch(/for select to authenticated using \(user_id = \(select auth\.uid\(\)\)\)/);
    expect(text).toMatch(/for insert to authenticated with check \(user_id = \(select auth\.uid\(\)\)\)/);
  });

  it("has an RLS check script in the usual style, covering every rule", () => {
    const check = read("checks", "kept_claims_rls");
    expect(check).toContain("RLS CHECK RESULT");
    expect([...check.matchAll(/insert into rls_result (?:values \('|select ')(K\d+) /g)].map((m) => m[1]).filter((k, i, all) => all.indexOf(k) === i))
      .toEqual(["K1", "K2", "K3", "K4", "K5", "K6", "K7", "K8", "K9", "K10"]);
  });
});
