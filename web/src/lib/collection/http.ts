import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { authClient, sessionUserId } from "@/lib/auth/server";
import { collectionWriter, supabaseCollection } from "./supabaseStore";
import { CollectionUnavailable, type CollectionStore } from "./types";

/** Like the library routes (lib/library/http): per instance and IP. Five bookmarks a draw, draws are 60 a minute. */
export const PER_MINUTE = 60;

const NO_STORE = { "Cache-Control": "no-store" };
export const json = (status: number, error: string): Response => Response.json({ error }, { status, headers: NO_STORE });
export const ok = (body: Record<string, unknown>): Response => Response.json(body, { headers: NO_STORE });

export interface Person { db: SupabaseClient; userId: string }

/** Supabase configured (else 503) and a logged-in person (else 401). */
export async function person(): Promise<Person | Response> {
  const db = await authClient();
  if (!db) return json(503, "login is not set up");
  const userId = await sessionUserId(db);
  if (!userId) return json(401, "login needed");
  return { db, userId };
}

/** The person's 도감 for reading; with `write`, also for recording — 503 when the server cannot write (no service key). */
export function storeFor(p: Person, write: boolean): CollectionStore | Response {
  const writer = collectionWriter();
  if (write && !writer) return json(503, "collection is off");
  return supabaseCollection(p.db, writer, p.userId);
}

/** Database errors: 503 while the table is missing (the 도감 shows its error state), else a plain 500 with the code only. */
export async function guarded(run: () => Promise<Response>): Promise<Response> {
  try {
    return await run();
  } catch (err) {
    if (err instanceof CollectionUnavailable) return json(503, "collection is not ready");
    console.error("collection:", err instanceof Error ? err.message : "unknown error");
    return json(500, "something went wrong");
  }
}
