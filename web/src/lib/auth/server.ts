import "server-only";
import { createServerClient } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";
import { authConfig } from "./config";

/**
 * A Supabase client acting as the person in this request (their session cookie + the anon key), so RLS decides what
 * it can read and change. Route Handlers only: they may write cookies, which is how a refreshed session gets back to
 * the browser (no proxy file — pages stay static and ask /api/me). One client per request. null without the config.
 */
export async function authClient(): Promise<SupabaseClient | null> {
  const config = authConfig();
  if (!config) return null;
  const store = await cookies();
  return createServerClient(config.url, config.anonKey, {
    cookies: {
      getAll: () => store.getAll(),
      setAll: (list) => {
        for (const { name, value, options } of list) store.set(name, value, options);
      },
    },
  });
}

/** The verified Supabase user id of this session (JWT checked by getClaims), or null when not logged in. */
export async function sessionUserId(client: SupabaseClient): Promise<string | null> {
  const { data, error } = await client.auth.getClaims();
  if (error || !data) return null;
  const sub = data.claims.sub;
  return typeof sub === "string" && sub ? sub : null;
}
