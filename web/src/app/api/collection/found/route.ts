import { guarded, json, ok, person, PER_MINUTE, storeFor } from "@/lib/collection/http";
import { recordMeeting } from "@/lib/collection/service";
import { parseFoundRequest, signingSecret, verifyTicket } from "@/lib/collection/ticket";
import { guardJson } from "@/lib/server/guard";

const MAX_BYTES = 300;

/**
 * 도감 v1: a bookmark was shown on S-05 to a logged-in person. Body { seed, count, sig, index } — the draw's signed ticket
 * (/api/books/draw) and which bookmark. The signature is checked before anything else, the picture is worked out here
 * (never taken from the browser), its parts are recorded, and the new ones come back for the "처음 만난 …!" badge.
 */
export async function POST(request: Request): Promise<Response> {
  const capped = await guardJson(request, { route: "collection-found", limit: PER_MINUTE, maxBytes: MAX_BYTES });
  if (!capped.ok) return capped.response;
  const found = parseFoundRequest(capped.body);
  if (!found) return json(400, "invalid");
  const secret = signingSecret();
  if (!secret) return json(503, "collection is off");                 // production without the secret: fail closed
  if (!verifyTicket(found, secret)) return json(403, "bad ticket");
  const who = await person();
  if (who instanceof Response) return who;
  const store = storeFor(who, true);
  if (store instanceof Response) return store;
  return guarded(async () => ok({ ok: true, found: await recordMeeting(store, found, found.index) }));
}
