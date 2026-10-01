import { NextResponse } from "next/server";
import { isProvider, safeNext, withLoginMark } from "@/lib/auth/next";
import { authClient } from "@/lib/auth/server";

/**
 * Kakao / Google send people back here (Supabase Auth, PKCE). The code becomes the session cookie, the first login
 * writes the profiles row (D-04 — a new row = first login, E-14 is_first_login), and the person goes back to the page
 * they left — the same book on S-06, not the start (P5 decision 5) — with ?login=<provider>&first=<0|1> for that page
 * to send E-14 once. Any failure goes back with ?login=failed.
 */
export async function GET(request: Request): Promise<Response> {
  const url = new URL(request.url);
  const next = safeNext(url.searchParams.get("next"));
  const back = (path: string) => NextResponse.redirect(new URL(path, url.origin));
  const failed = () => back(withLoginMark(next, null, false));

  const code = url.searchParams.get("code");
  const client = await authClient();
  if (!client || !code) return failed();

  const { data, error } = await client.auth.exchangeCodeForSession(code);
  if (error || !data.user) return failed();
  const provider = data.user.app_metadata?.provider;
  if (!isProvider(provider)) {          // only Kakao and Google are switched on; anything else is not ours to keep
    await client.auth.signOut();
    return failed();
  }

  const { data: rows, error: profileError } = await client
    .from("profiles")
    .upsert({ user_id: data.user.id, provider }, { onConflict: "user_id", ignoreDuplicates: true })
    .select("user_id");
  if (profileError) console.error("auth callback: profile write failed", profileError.code);
  const first = !profileError && Array.isArray(rows) && rows.length === 1;
  return back(withLoginMark(next, provider, first));
}
