import "server-only";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { partsOf, type ArtKind } from "@/lib/art/combine";
import { parseArt } from "@/lib/library/validate";
import { knownItems } from "./service";
import { CollectionUnavailable, type CollectionItem, type CollectionStore } from "./types";

/** Postgres "no such table" and PostgREST "not in the schema cache": 0004 was not applied yet. */
const MISSING = new Set(["42P01", "PGRST205"]);

const fail = (what: string, code: string | undefined): never => {
  if (code && MISSING.has(code)) throw new CollectionUnavailable();
  throw new Error(`collection ${what} failed: ${code ?? "unknown"}`);
};

let writer: SupabaseClient | null | undefined;
/**
 * The server's own client (service role) — the only one that may write the 도감 (0004 grants people select only), so a
 * part can be recorded only after the server re-worked the picture from a signed seed. null without the service key.
 */
export function collectionWriter(): SupabaseClient | null {
  if (writer !== undefined) return writer;
  const url = (process.env.SUPABASE_URL ?? "").trim();
  const key = (process.env.SUPABASE_SERVICE_ROLE_KEY ?? "").trim();
  writer = url && key ? createClient(url, key, { auth: { persistSession: false } }) : null;
  return writer;
}

interface Row { kind: ArtKind; value: string; first_met_at: string; first_art: unknown; is_new: boolean }

/**
 * One person's 도감. Reads go through `reader` (their session — RLS, as in the library); writes through `writer` (the
 * service role), always scoped to the session's verified user id.
 */
export function supabaseCollection(reader: SupabaseClient, write: SupabaseClient | null, userId: string): CollectionStore {
  const writeTo = () => {
    if (!write) throw new Error("collection writes are off");
    return write.from("collection");
  };
  return {
    async items() {
      const { data, error } = await reader.from("collection").select("kind, value, first_met_at, first_art, is_new")
        .eq("user_id", userId).order("first_met_at");
      if (error) fail("read", error.code);
      const rows = ((data ?? []) as Row[]).flatMap((r): CollectionItem[] => {
        const art = parseArt(r.first_art);
        return art ? [{ kind: r.kind, value: r.value, firstMetAt: r.first_met_at, firstArt: art, isNew: r.is_new === true }] : [];
      });
      return knownItems(rows);
    },
    async record(art) {
      const rows = partsOf(art).map((p) => ({ user_id: userId, kind: p.kind, value: p.value, first_art: art }));
      // insert … on conflict do nothing returning: only the parts met for the first time come back
      const { data, error } = await writeTo().upsert(rows, { onConflict: "user_id,kind,value", ignoreDuplicates: true }).select("kind, value");
      if (error) fail("record", error.code);
      return (data ?? []) as { kind: ArtKind; value: string }[];
    },
    async markSeen() {
      const { data, error } = await writeTo().update({ is_new: false }).eq("user_id", userId).eq("is_new", true).select("kind");
      if (error) fail("seen", error.code);
      return (data ?? []).length;
    },
  };
}
