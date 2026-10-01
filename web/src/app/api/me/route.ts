import { cookies } from "next/headers";
import { LOGIN_COOKIE, parseLoginCookie } from "@/lib/auth/next";
import { authClient, sessionUserId } from "@/lib/auth/server";
import { catalog } from "@/lib/books/catalog";
import { guarded } from "@/lib/library/http";
import { savedIsbns } from "@/lib/library/supabaseStore";
import { guardRequest } from "@/lib/server/guard";

const PER_MINUTE = 60;
const noStore = { "Cache-Control": "no-store" };

/**
 * The header's question (S-01 top right): logged in, and how many bookmarks (books still in our catalogue — the count
 * S-09 shows). id = the Supabase user id (a random UUID, for Amplitude setUserId — taxonomy 3-2); never an email or a
 * name. login = the proof /auth/callback left (E-14), handed over once and deleted.
 */
export async function GET(request: Request): Promise<Response> {
  const refused = guardRequest(request, { route: "me", limit: PER_MINUTE });
  if (refused) return refused;
  return guarded(async () => {
    const out = (enabled: boolean) => Response.json({ enabled, loggedIn: false, id: null, count: 0, login: null }, { headers: noStore });
    const db = await authClient();
    if (!db) return out(false);
    const userId = await sessionUserId(db);
    if (!userId) return out(true);
    const store = await cookies();
    const login = parseLoginCookie(store.get(LOGIN_COOKIE)?.value);
    if (store.has(LOGIN_COOKIE)) store.delete(LOGIN_COOKIE);
    const books = new Set(catalog().map((b) => b.isbn));
    const count = (await savedIsbns(db, userId)).filter((isbn) => books.has(isbn)).length;
    return Response.json({ enabled: true, loggedIn: true, id: userId, count, login }, { headers: noStore });
  });
}
