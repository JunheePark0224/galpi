import { badRequest, guarded, openLibrary, reply, UUID } from "@/lib/library/http";
import { addShelf, removeShelf, removeShelfWithBookmarks, renameShelf } from "@/lib/library/service";

const idOf = (v: unknown): string | null => (typeof v === "string" && UUID.test(v) ? v : null);

/** [＋ 막대 추가]: { name }. 201 with the new rod. */
export async function POST(request: Request): Promise<Response> {
  const opened = await openLibrary(request, "shelf-add", true);
  if (opened instanceof Response) return opened;
  return guarded(async () => reply(await addShelf(opened.store, opened.body.name), 201));
}

/** ✎ 이름 고치기: { id, name }. */
export async function PATCH(request: Request): Promise<Response> {
  const opened = await openLibrary(request, "shelf-rename", true);
  if (opened instanceof Response) return opened;
  const id = idOf(opened.body.id);
  if (!id) return badRequest();
  return guarded(async () => reply(await renameShelf(opened.store, id, opened.body.name)));
}

/**
 * [막대 지우기] (10-07): { id } — an empty rod; { id, withBookmarks: true } — the rod and its bookmarks (after the confirm
 * sheet), exactly that, so a stray body never takes bookmarks. Never the first rod (409). The second answers `removed`.
 */
export async function DELETE(request: Request): Promise<Response> {
  const opened = await openLibrary(request, "shelf-remove", true);
  if (opened instanceof Response) return opened;
  const { body } = opened;
  const id = idOf(body.id);
  if (!id) return badRequest();
  const keys = Object.keys(body).sort().join(",");
  if (keys === "id") return guarded(async () => reply(await removeShelf(opened.store, id)));
  if (keys !== "id,withBookmarks" || body.withBookmarks !== true) return badRequest();
  return guarded(async () => reply(await removeShelfWithBookmarks(opened.store, id)));
}
