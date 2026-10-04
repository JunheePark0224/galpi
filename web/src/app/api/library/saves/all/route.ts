import { badRequest, guarded, openLibrary, reply } from "@/lib/library/http";
import { removeAllBookmarks } from "@/lib/library/service";

/**
 * S-09 [모두 제거] (10-04): { all: true } — exactly that, anything else is refused (400), so a stray or half-built request
 * never empties the library. Every bookmark of the person goes; the rods and their names stay. Its own rate-limit key.
 */
export async function DELETE(request: Request): Promise<Response> {
  const opened = await openLibrary(request, "unsave_all", true);
  if (opened instanceof Response) return opened;
  const { body } = opened;
  if (body.all !== true || Object.keys(body).length !== 1) return badRequest();
  return guarded(async () => reply(await removeAllBookmarks(opened.store)));
}
