import { guardRequest } from "@/lib/server/guard";
import { MAKER_CACHE_SECONDS, makerShelf } from "@/lib/server/makerShelf";

// One look opens the sheet once; a person opening and closing it stays far below this.
const PER_MINUTE = 60;

/** GET /api/maker-shelf — S-13 책갈피 구경 (PRD F-30): the maker's shelf, read only, same origin only. */
export async function GET(request: Request): Promise<Response> {
  const refused = guardRequest(request, { route: "maker", limit: PER_MINUTE });
  if (refused) return refused;
  try {
    const view = await makerShelf();
    return Response.json(view, { headers: { "Cache-Control": `private, max-age=${MAKER_CACHE_SECONDS}` } });
  } catch (e) {
    // the message carries the Postgres code only (supabaseStore) — never rows
    console.error("maker shelf failed:", e instanceof Error ? e.message : "unknown");
    return Response.json({ error: "unavailable" }, { status: 503, headers: { "Cache-Control": "no-store" } });
  }
}
