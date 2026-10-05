import { artsForDraw, type ArtCombo } from "@/lib/art/combine";
import { guarded, json, ok, person, PER_MINUTE, storeFor } from "@/lib/collection/http";
import { recordMeeting } from "@/lib/collection/service";
import { GUEST_KEEP_TTL_SECONDS, isFresh, parseFoundRequest, signingSecret, verifyTicket, type FoundRequest } from "@/lib/collection/ticket";
import { ISBN13 } from "@/lib/library/http";
import { supabaseStore } from "@/lib/library/supabaseStore";
import { guardJson } from "@/lib/server/guard";

const MAX_BYTES = 300;

const samePicture = (a: ArtCombo, b: ArtCombo) => a.animal === b.animal && a.bg === b.bg && a.sky === b.sky && a.ground === b.ground;

/**
 * 도감 v1: a bookmark was shown on S-05 to a logged-in person. Body { seed, count, iat, sub, sig, index } — the draw's signed ticket
 * (/api/books/draw) and which bookmark. The signature is checked before anything else, the picture is worked out here
 * (never taken from the browser), its parts are recorded, and the new ones come back for the "처음 만난 …!" badge.
 *
 * v1.7 `kept: true` + `isbn`: a bookmark saved before logging in has just reached the account (lib/library/merge). Only for
 * a logged-out draw (sub null), good for GUEST_KEEP_TTL_SECONDS (7 days, not 2 hours), and only when the person's own
 * saved bookmark of that book is that very picture (its first picture — 꾸미기 does not change it) — so a shared ticket
 * can never fill a 도감 with bookmarks the person did not keep.
 */
export async function POST(request: Request): Promise<Response> {
  const capped = await guardJson(request, { route: "collection-found", limit: PER_MINUTE, maxBytes: MAX_BYTES });
  if (!capped.ok) return capped.response;
  const found = parseFoundRequest(capped.body);
  if (!found) return json(400, "invalid");
  const { kept, isbn } = capped.body as { kept?: unknown; isbn?: unknown };
  const keptIsbn = kept === true ? (typeof isbn === "string" && ISBN13.test(isbn) ? isbn : null) : undefined;
  if (keptIsbn === null) return json(400, "invalid");
  const secret = signingSecret();
  if (!secret) return json(503, "collection is off");                 // production without the secret: fail closed
  if (!verifyTicket(found, secret)) return json(403, "bad ticket");
  if (keptIsbn !== undefined && found.sub !== null) return json(403, "not a logged-out draw");
  if (!isFresh(found.iat, undefined, keptIsbn !== undefined ? GUEST_KEEP_TTL_SECONDS : undefined)) return json(403, "expired ticket");
  const who = await person();
  if (who instanceof Response) return who;
  if (found.sub !== null && found.sub !== who.userId) return json(403, "not your ticket");
  const store = storeFor(who, true);
  if (store instanceof Response) return store;
  return guarded(async () => {
    if (keptIsbn !== undefined && !(await keptThis(who, found, keptIsbn))) return json(403, "not your bookmark");
    return ok({ ok: true, found: await recordMeeting(store, found, found.index) });
  });
}

/** The person saved this book, and its first picture is the ticket's bookmark. */
async function keptThis(who: { db: Parameters<typeof supabaseStore>[0]; userId: string }, found: FoundRequest, isbn: string): Promise<boolean> {
  const row = (await supabaseStore(who.db, who.userId).saves()).find((s) => s.isbn === isbn);
  return !!row && samePicture(row.originalArt ?? row.art, artsForDraw(found.count, found.seed)[found.index]);
}
