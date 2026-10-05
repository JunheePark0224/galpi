import { supabaseCollection } from "@/lib/collection/supabaseStore";
import { CollectionUnavailable } from "@/lib/collection/types";
import { badRequest, guarded, ISBN13, openLibrary, reply } from "@/lib/library/http";
import { decorateBookmark } from "@/lib/library/decorate";
import { parseArt } from "@/lib/library/validate";

const unavailable = () => Response.json({ error: "unavailable" }, { status: 503, headers: { "Cache-Control": "no-store" } });

/**
 * 책갈피 꾸미기 (PRD F-13·F-21): { isbn, art } — a new picture for one of the person's bookmarks ([이대로 꽂기]; [처음
 * 그림으로] sends the first picture). The picture is rebuilt from known parts (parseArt, `rare` worked out again), and
 * every part must be in this person's 도감 — read with their own session (RLS) — or on the bookmark's first picture, or
 * the empty ground; anything else is 403. Same guard and rate limit as the other 내 책갈피 writes, its own key.
 */
export async function PATCH(request: Request): Promise<Response> {
  const opened = await openLibrary(request, "decorate", true);
  if (opened instanceof Response) return opened;
  const { body, db, userId } = opened;
  const isbn = typeof body.isbn === "string" && ISBN13.test(body.isbn) ? body.isbn : null;
  const art = parseArt(body.art);
  if (!isbn || !art) return badRequest();
  const owned = () => supabaseCollection(db, null, userId).items();
  return guarded(async () => {
    try {
      return reply(await decorateBookmark(opened.store, owned, isbn, art));
    } catch (err) {
      if (err instanceof CollectionUnavailable) return unavailable();   // 0004 not applied: nothing can be checked
      throw err;
    }
  });
}
