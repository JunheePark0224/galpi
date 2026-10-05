import "server-only";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

let client: SupabaseClient | null | undefined;
/**
 * The server's own Supabase client (service role, SUPABASE_SERVICE_ROLE_KEY) — for the writes people may not make with
 * their session: the 도감 (0004) and, since 0007, new bookmarks. Always scoped by the caller to the session's verified
 * user id. null without the key (the writes it guards then fail closed).
 */
export function serviceClient(): SupabaseClient | null {
  if (client !== undefined) return client;
  const url = (process.env.SUPABASE_URL ?? "").trim();
  const key = (process.env.SUPABASE_SERVICE_ROLE_KEY ?? "").trim();
  client = url && key ? createClient(url, key, { auth: { persistSession: false } }) : null;
  return client;
}
