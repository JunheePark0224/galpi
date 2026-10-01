import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { ArtCombo } from "@/lib/art/combine";
import type { Reason } from "@/lib/recommend";
import type { LibraryStore, SaveRow, Shelf } from "./types";

const UNIQUE = "23505";
const FOREIGN_KEY = "23503";

/** Database errors leave the route as a plain 500; the log keeps the code only (never values — names are personal). */
const fail = (what: string, code: string | undefined): never => {
  throw new Error(`library ${what} failed: ${code ?? "unknown"}`);
};

interface SaveDbRow { isbn: string; art: ArtCombo; reason: Reason; met_on: string; shelf_id: string; position: number }
const toSave = (r: SaveDbRow): SaveRow => ({ isbn: r.isbn, art: r.art, reason: r.reason, metOn: r.met_on, shelfId: r.shelf_id, position: r.position });

/**
 * The person's rows in Supabase, through a client carrying their session (lib/auth/server) — RLS (0003) limits every
 * statement to them; the user_id filters only say the same thing out loud and use the indexes.
 */
export function supabaseStore(db: SupabaseClient, userId: string): LibraryStore {
  const shelves = () => db.from("shelves");
  const saves = () => db.from("saves");
  return {
    async shelves() {
      const { data, error } = await shelves().select("id, name, position").eq("user_id", userId).order("position");
      if (error) fail("shelves", error.code);
      return (data ?? []) as Shelf[];
    },
    async saves() {
      const { data, error } = await saves().select("isbn, art, reason, met_on, shelf_id, position")
        .eq("user_id", userId).order("position").order("created_at");
      if (error) fail("saves", error.code);
      return ((data ?? []) as SaveDbRow[]).map(toSave);
    },
    async firstShelf(name) {
      // insert … on conflict do nothing: two first saves at the same moment both end with the one rod at position 0
      const { error } = await shelves().upsert({ user_id: userId, name, position: 0 }, { onConflict: "user_id,position", ignoreDuplicates: true });
      if (error) fail("first shelf", error.code);
      const { data, error: readError } = await shelves().select("id, name, position").eq("user_id", userId).eq("position", 0).single();
      if (readError || !data) fail("first shelf read", readError?.code);
      return data as Shelf;
    },
    async insertSave(row) {
      const { error } = await saves().insert({
        user_id: userId, isbn: row.isbn, art: row.art, reason: row.reason, met_on: row.metOn, shelf_id: row.shelfId, position: row.position,
      });
      if (error?.code === UNIQUE) return false;
      if (error) fail("save", error.code);
      return true;
    },
    async deleteSave(isbn) {
      const { data, error } = await saves().delete().eq("user_id", userId).eq("isbn", isbn).select("isbn");
      if (error) fail("unsave", error.code);
      return (data ?? []).length > 0;
    },
    async updateSave(isbn, change) {
      const { data, error } = await saves().update({ shelf_id: change.shelfId, position: change.position })
        .eq("user_id", userId).eq("isbn", isbn).select("isbn");
      if (error?.code === FOREIGN_KEY) return false;
      if (error) fail("move", error.code);
      return (data ?? []).length > 0;
    },
    async insertShelf(name, position) {
      const { data, error } = await shelves().insert({ user_id: userId, name, position }).select("id, name, position").single();
      if (error?.code === UNIQUE) return null;
      if (error) fail("add shelf", error.code);
      return data as Shelf;
    },
    async renameShelf(id, name) {
      const { data, error } = await shelves().update({ name }).eq("user_id", userId).eq("id", id).select("id");
      if (error) fail("rename shelf", error.code);
      return (data ?? []).length > 0;
    },
    async deleteShelf(id) {
      const { data, error } = await shelves().delete().eq("user_id", userId).eq("id", id).select("id");
      if (error?.code === FOREIGN_KEY) return false;
      if (error) fail("remove shelf", error.code);
      return (data ?? []).length > 0;
    },
  };
}

/** The ISBNs the person kept — /api/me counts the ones still in the catalogue, the same count S-09 shows. */
export async function savedIsbns(db: SupabaseClient, userId: string): Promise<string[]> {
  const { data, error } = await db.from("saves").select("isbn").eq("user_id", userId);
  if (error) fail("count", error.code);
  return ((data ?? []) as { isbn: string }[]).map((r) => r.isbn);
}
