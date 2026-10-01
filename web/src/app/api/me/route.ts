import { authClient, sessionUserId } from "@/lib/auth/server";
import { countSaves } from "@/lib/library/supabaseStore";
import { guarded } from "@/lib/library/http";
import { guardRequest } from "@/lib/server/guard";

const PER_MINUTE = 60;
const noStore = { "Cache-Control": "no-store" };

/**
 * The header's question (S-01 top right): logged in, and how many bookmarks. id = the Supabase user id (a random UUID,
 * for Amplitude setUserId — taxonomy 3-2); never an email or a name.
 */
export async function GET(request: Request): Promise<Response> {
  const refused = guardRequest(request, { route: "me", limit: PER_MINUTE });
  if (refused) return refused;
  return guarded(async () => {
    const db = await authClient();
    if (!db) return Response.json({ enabled: false, loggedIn: false, id: null, count: 0 }, { headers: noStore });
    const userId = await sessionUserId(db);
    if (!userId) return Response.json({ enabled: true, loggedIn: false, id: null, count: 0 }, { headers: noStore });
    return Response.json({ enabled: true, loggedIn: true, id: userId, count: await countSaves(db, userId) }, { headers: noStore });
  });
}
