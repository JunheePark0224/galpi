import { catalog } from "@/lib/books/catalog";
import { drawPath } from "@/lib/books/draw";
import { parseDrawRequest } from "@/lib/books/request";
import { guardJson } from "@/lib/server/guard";
import { mulberry32 } from "@/lib/recommend";

// 1000 seen ids × ~16 bytes + 40 answers stay well under this.
const MAX_BYTES = 32_000;
const PER_MINUTE = 60;

/** v2: POST { answers, seen?, seed? } — a finished path of the question map → five bookmarks + the path S-04 shows. */
export async function POST(request: Request): Promise<Response> {
  const guarded = await guardJson(request, { route: "draw", limit: PER_MINUTE, maxBytes: MAX_BYTES });
  if (!guarded.ok) return guarded.response;
  const parsed = parseDrawRequest(guarded.body);
  if (!parsed) return Response.json({ error: "invalid draw request" }, { status: 400 });

  const rng = mulberry32(parsed.seed ?? crypto.getRandomValues(new Uint32Array(1))[0]);
  return Response.json(drawPath(parsed.answers, new Set(parsed.seen), rng, catalog()));
}
