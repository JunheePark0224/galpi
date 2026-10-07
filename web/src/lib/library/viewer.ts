import "server-only";
import { authClient, sessionUserId } from "@/lib/auth/server";
import { hasAuthCookie } from "@/lib/track/record";
import { savedIsbns } from "./supabaseStore";

/** Who is drawing (verified from the session cookie, never from the body) and the books they keep in 내 책갈피. */
export interface DrawViewer { userId: string | null; saved: string[] }

const NOBODY: DrawViewer = { userId: null, saved: [] };

/**
 * /api/books/draw (10-07): the logged-in person's saved books are never drawn again. One query, as that person (RLS),
 * only when an auth cookie is there. A failed lookup still lets the draw go on — as not logged in when the session
 * cannot be checked, with nothing left out when only the saves cannot be read (logged, the code only).
 */
export async function drawViewer(req: Request): Promise<DrawViewer> {
  if (!hasAuthCookie(req)) return NOBODY;
  let db: Awaited<ReturnType<typeof authClient>>;
  let userId: string | null;
  try {
    db = await authClient();
    userId = db ? await sessionUserId(db) : null;
  } catch {
    return NOBODY;
  }
  if (!db || !userId) return NOBODY;
  try {
    return { userId, saved: await savedIsbns(db, userId) };
  } catch (err) {
    console.error("draw: saved lookup failed", (err as Error).message);
    return { userId, saved: [] };
  }
}
