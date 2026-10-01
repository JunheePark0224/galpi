import { createBrowserClient } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";
import { authConfig } from "./config";
import { safeNext, type Provider } from "./next";

let client: SupabaseClient | null = null;

function browserClient(): SupabaseClient | null {
  if (client) return client;
  const config = authConfig();
  if (!config) return null;
  client = createBrowserClient(config.url, config.anonKey);
  return client;
}

/** Login is offered only when Supabase Auth is configured (NEXT_PUBLIC_ values at build time). */
export const authEnabled = (): boolean => authConfig() !== null;

/**
 * Leaves for Kakao / Google (E-13 is sent by the caller just before). They come back through /auth/callback, which
 * returns to `next` — the page the person was on. false = the login could not start (no config or Supabase refused).
 */
export async function startLogin(provider: Provider, next: string): Promise<boolean> {
  const c = browserClient();
  if (!c) return false;
  const redirectTo = `${window.location.origin}/auth/callback?next=${encodeURIComponent(safeNext(next))}`;
  const { error } = await c.auth.signInWithOAuth({ provider, options: { redirectTo } });
  return !error;
}

/** PRD F-11 로그아웃: ends the session in this browser only (other devices stay logged in). */
export async function logout(): Promise<boolean> {
  const c = browserClient();
  if (!c) return false;
  const { error } = await c.auth.signOut({ scope: "local" });
  return !error;
}
