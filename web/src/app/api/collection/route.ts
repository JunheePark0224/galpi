import { guarded, ok, person, PER_MINUTE, storeFor } from "@/lib/collection/http";
import { guardRequest } from "@/lib/server/guard";

/** S-09 도감 (PRD F-21): the person's met parts — kind, value, first met, the picture they were met in, NEW. */
export async function GET(request: Request): Promise<Response> {
  const refused = guardRequest(request, { route: "collection", limit: PER_MINUTE });
  if (refused) return refused;
  const who = await person();
  if (who instanceof Response) return who;
  const store = storeFor(who, false);
  if (store instanceof Response) return store;
  return guarded(async () => ok({ items: await store.items() }));
}
