import { catalog } from "@/lib/books/catalog";
import { drawPath } from "@/lib/books/draw";
import { parseDrawRequest } from "@/lib/books/request";
import { issueTicket } from "@/lib/collection/ticket";
import { drawViewer } from "@/lib/library/viewer";
import { guardJson } from "@/lib/server/guard";
import { mulberry32 } from "@/lib/recommend";

// 1000 seen ids × ~16 bytes + 40 answers stay well under this.
const MAX_BYTES = 32_000;
const PER_MINUTE = 60;

/**
 * v2: POST { answers, seen?, seed? } — a finished path of the question map → five bookmarks + the path S-04 shows, and
 * (도감 v1) `art`: the signed seed the pictures are drawn from (lib/collection/ticket). Left out of the draw: `seen` (this tab's
 * books, and a guest's saved books — the client adds them) and, from the session only, the logged-in person's saved books (10-07).
 */
export async function POST(request: Request): Promise<Response> {
  const guarded = await guardJson(request, { route: "draw", limit: PER_MINUTE, maxBytes: MAX_BYTES });
  if (!guarded.ok) return guarded.response;
  const parsed = parseDrawRequest(guarded.body);
  if (!parsed) return Response.json({ error: "invalid draw request" }, { status: 400 });

  // the session is looked up only when an auth cookie is there: the ticket's person (sub) and the books they saved
  const { userId: sub, saved } = await drawViewer(request);
  const rng = mulberry32(parsed.seed ?? crypto.getRandomValues(new Uint32Array(1))[0]);
  const drawn = drawPath(parsed.answers, new Set([...parsed.seen, ...saved]), rng, catalog());
  // 도감 v1: the pictures' seed is always the server's own (never the request's `seed`, which only replays the books)
  // v3: the ticket signs the draw's books in order, so it can only ever vouch for these bookmarks
  return Response.json({ ...drawn, art: issueTicket(drawn.picks.map((p) => p.card.id), { sub }) });
}
