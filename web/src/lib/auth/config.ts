/**
 * Supabase Auth for P5 (PRD F-11). Both values are public by design (the anon key only reaches what RLS allows —
 * 0003_p5_auth.sql), and the browser needs them to start a login, so they are NEXT_PUBLIC_ and inlined at build time.
 * Without them the site runs as before P5: no login place, no saving.
 */
export interface AuthConfig { url: string; anonKey: string }

export function authConfig(): AuthConfig | null {
  const url = (process.env.NEXT_PUBLIC_SUPABASE_URL ?? "").trim();
  const anonKey = (process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "").trim();
  return url && anonKey ? { url, anonKey } : null;
}
