import { guarded, ok, person, PER_MINUTE, storeFor } from "@/lib/collection/http";
import { guardRequest } from "@/lib/server/guard";

/** The 도감 was seen: NEW leaves every cell (it showed once). No body. */
export async function POST(request: Request): Promise<Response> {
  const refused = guardRequest(request, { route: "collection-seen", limit: PER_MINUTE });
  if (refused) return refused;
  const who = await person();
  if (who instanceof Response) return who;
  const store = storeFor(who, true);
  if (store instanceof Response) return store;
  return guarded(async () => ok({ ok: true, seen: await store.markSeen() }));
}
