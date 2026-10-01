import { badRequest, guarded, openLibrary, reply, UUID } from "@/lib/library/http";
import { addShelf, removeShelf, renameShelf } from "@/lib/library/service";

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

/** [막대 치우기]: { id } — empty rods only, never the first. */
export async function DELETE(request: Request): Promise<Response> {
  const opened = await openLibrary(request, "shelf-remove", true);
  if (opened instanceof Response) return opened;
  const id = idOf(opened.body.id);
  if (!id) return badRequest();
  return guarded(async () => reply(await removeShelf(opened.store, id)));
}
