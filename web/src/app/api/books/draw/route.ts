import vocab from "@/data/vocab.json";
import { catalog } from "@/lib/books/catalog";
import { drawLeaf, drawPath, drawTarget } from "@/lib/books/draw";
import { parseDrawRequest } from "@/lib/books/request";
import { guardJson } from "@/lib/server/guard";
import type { Vocab } from "@/lib/books/types";
import { mulberry32 } from "@/lib/recommend";

// 1000 seen ids × ~16 bytes + answers stay well under this.
const MAX_BYTES = 32_000;
const PER_MINUTE = 60;

export async function POST(request: Request): Promise<Response> {
  const guarded = await guardJson(request, { route: "draw", limit: PER_MINUTE, maxBytes: MAX_BYTES });
  if (!guarded.ok) return guarded.response;
  const parsed = parseDrawRequest(guarded.body, vocab as Vocab);
  if (!parsed) return Response.json({ error: "invalid draw request" }, { status: 400 });

  const rng = mulberry32(parsed.seed ?? crypto.getRandomValues(new Uint32Array(1))[0]);
  const seen = new Set(parsed.seen);
  const books = catalog();
  const result = parsed.query.entry === "path"
    ? drawPath(parsed.query.answers, seen, rng, books)
    : parsed.query.entry === "leaf"
      ? drawLeaf(parsed.query.choices, seen, rng, books)
      : drawTarget(parsed.query.answers, seen, rng, books);
  return Response.json(result);
}
