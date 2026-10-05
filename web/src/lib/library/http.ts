import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { authClient, sessionUserId } from "@/lib/auth/server";
import { guardJson, guardRequest } from "@/lib/server/guard";
import type { LibraryError } from "./service";
import { supabaseStore } from "./supabaseStore";
import type { LibraryStore } from "./types";

/** Small JSON bodies only: a bookmark (isbn, picture, 나온 이유, date) or a rod name. */
const MAX_BYTES = 2_000;
/** Per instance and IP, like the other routes (lib/server/guard). Moving bookmarks around is quick clicking. */
const PER_MINUTE = 60;

export const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export const ISBN13 = /^97[89]\d{10}$/;

export interface Opened { store: LibraryStore; db: SupabaseClient; userId: string; body: Record<string, unknown> }

const json = (status: number, error: string) => Response.json({ error }, { status, headers: { "Cache-Control": "no-store" } });

/**
 * The common start of every 내 책갈피 route: same site + rate limit (+ the JSON body when `withBody`), Supabase
 * configured (else 503), a logged-in person (else 401). The store acts as that person (RLS).
 */
export async function openLibrary(request: Request, route: string, withBody: boolean): Promise<Opened | Response> {
  let body: Record<string, unknown> = {};
  if (withBody) {
    const guarded = await guardJson(request, { route, limit: PER_MINUTE, maxBytes: MAX_BYTES });
    if (!guarded.ok) return guarded.response;
    if (typeof guarded.body !== "object" || guarded.body === null || Array.isArray(guarded.body)) return json(400, "invalid");
    body = guarded.body as Record<string, unknown>;
  } else {
    const refused = guardRequest(request, { route, limit: PER_MINUTE });
    if (refused) return refused;
  }
  const db = await authClient();
  if (!db) return json(503, "login is not set up");
  const userId = await sessionUserId(db);
  if (!userId) return json(401, "login needed");
  return { store: supabaseStore(db, userId), db, userId, body };
}

const STATUS: Record<LibraryError, number> = { invalid: 400, missing: 404, full: 409, first: 409, not_empty: 409, forbidden: 403, unavailable: 503 };

/** A service result as the response: 200 with the extra fields, or the error with its status. */
export function reply(result: { ok: true } | { ok: false; error: LibraryError }, status = 200): Response {
  if (!result.ok) return json(STATUS[result.error], result.error);
  return Response.json(result, { status, headers: { "Cache-Control": "no-store" } });
}

export const badRequest = (): Response => json(400, "invalid");

/** Unexpected database errors: a plain 500, the code already in the thrown message (no values). */
export async function guarded(run: () => Promise<Response>): Promise<Response> {
  try {
    return await run();
  } catch (err) {
    console.error("library:", err instanceof Error ? err.message : "unknown error");
    return json(500, "something went wrong");
  }
}
