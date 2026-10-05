import { artsForDraw, type ArtCombo } from "@/lib/art/combine";
import { guarded, json, ok, person, PER_MINUTE, storeFor, type Person } from "@/lib/collection/http";
import { recordMeeting } from "@/lib/collection/service";
import { isFresh, parseFoundRequest, signingSecret, verifyTicket, type FoundRequest } from "@/lib/collection/ticket";
import { ISBN13 } from "@/lib/library/http";
import { supabaseStore } from "@/lib/library/supabaseStore";
import { guardJson } from "@/lib/server/guard";

/** v3 tickets carry the draw's books (up to MAX_TICKET_PICKS ISBN-13s), plus `isbn` and `kept` on the kept path. */
const MAX_BYTES = 700;

/** One answer for every "this is not yours to record" (no oracle between "not your bookmark" and "already claimed"). */
const NOT_RECORDED_ERROR = "not recorded";
const NOT_RECORDED = (): Response => json(403, NOT_RECORDED_ERROR);

const samePicture = (a: ArtCombo, b: ArtCombo) => a.animal === b.animal && a.bg === b.bg && a.sky === b.sky && a.ground === b.ground;

/**
 * 도감 v1: a bookmark was shown on S-05 to a logged-in person. Body { seed, count, iat, sub, sig, isbns, index } — the draw's
 * signed ticket (/api/books/draw, v3: the draw's books are signed too) and which bookmark. The signature is checked before
 * anything else, the picture is worked out here (never taken from the browser), its parts are recorded, and the new ones
 * come back for the "처음 만난 …!" badge. The ticket must be this person's own (`sub`), or a logged-out draw's (sub null — a
 * draw started before logging in): then each bookmark goes to the first person who claims it (0007), once.
 *
 * v1.7 `kept: true` + `isbn`: a bookmark saved before logging in has just reached the account (lib/library/merge). Only for
 * a logged-out draw (sub null), of any age (a login a month later loses nothing — the claim makes it single-use, so a
 * shared ticket gains nothing from time), only for the book the ticket signed
 * at that place (`isbns[index]`), only when the person's own saved bookmark of that book has that very first picture
 * (꾸미기 does not change it), and only once per bookmark of a draw (0007 claims) — so a shared ticket fills at most one
 * 도감, with bookmarks that person really kept. Every such refusal answers the same (403 "not recorded" — no oracle).
 * While the claims table is missing, a logged-out draw records nothing (503); the person's own draws are unaffected.
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
  if (keptIsbn !== undefined) {
    if (found.sub !== null) return json(403, "not a logged-out draw");
    if (found.isbns[found.index] !== keptIsbn) return json(403, "not this bookmark's book");
  }
  // 2 hours for a bookmark shown on S-05 (nothing is lost: it is recorded while shown); none for one kept before a login
  if (keptIsbn === undefined && !isFresh(found.iat)) return json(403, "expired ticket");
  const who = await person();
  if (who instanceof Response) return who;
  if (found.sub !== null && found.sub !== who.userId) return json(403, "not your ticket");
  const store = storeFor(who, true);
  if (store instanceof Response) return store;
  return guarded(async () => {
    if (keptIsbn !== undefined && !(await keptThis(who, found, keptIsbn))) return NOT_RECORDED();
    // a logged-out draw: the first person to claim this bookmark (a missing table throws → 503, nothing recorded)
    if (found.sub === null && !(await store.claimKept({ seed: found.seed, iat: found.iat, index: found.index }))) return NOT_RECORDED();
    return ok({ ok: true, found: await recordMeeting(store, found, found.index) });
  });
}

/** The person saved this book, and its first picture is the ticket's bookmark. */
async function keptThis(who: Person, found: FoundRequest, isbn: string): Promise<boolean> {
  const row = (await supabaseStore(who.db, who.userId).saves()).find((s) => s.isbn === isbn);
  return !!row && samePicture(row.originalArt ?? row.art, artsForDraw(found.count, found.seed)[found.index]);
}
