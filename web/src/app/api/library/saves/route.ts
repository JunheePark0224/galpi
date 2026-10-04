import { catalog } from "@/lib/books/catalog";
import { kstDate } from "@/lib/books/library";
import { badRequest, guarded, ISBN13, openLibrary, reply, UUID } from "@/lib/library/http";
import { MAX_SAVES, moveBookmark, removeBookmark, saveBookmark } from "@/lib/library/service";
import { parseArt, parseMetOn, parseReason } from "@/lib/library/validate";

const isbnOf = (v: unknown): string | null => (typeof v === "string" && ISBN13.test(v) ? v : null);
/** A drag's place on the rod: absent, or a whole number 0..MAX_SAVES — anything else is null (refused). */
const indexOf = (v: unknown): number | undefined | null =>
  v === undefined ? undefined : typeof v === "number" && Number.isInteger(v) && v >= 0 && v <= MAX_SAVES ? v : null;

/** F-12 꽂기: { isbn, art, reason, metOn } — a book of our catalogue, the picture and 나온 이유 it was met with. */
export async function POST(request: Request): Promise<Response> {
  const opened = await openLibrary(request, "save", true);
  if (opened instanceof Response) return opened;
  const { body } = opened;
  const isbn = isbnOf(body.isbn);
  const art = parseArt(body.art);
  const reason = parseReason(body.reason);
  const metOn = parseMetOn(body.metOn, kstDate(new Date()));
  if (!isbn || !art || !reason || !metOn || !catalog().some((b) => b.isbn === isbn)) return badRequest();
  return guarded(async () => reply(await saveBookmark(opened.store, { isbn, art, reason, metOn })));
}

/** S-09 [빼기]: { isbn }. */
export async function DELETE(request: Request): Promise<Response> {
  const opened = await openLibrary(request, "unsave", true);
  if (opened instanceof Response) return opened;
  const isbn = isbnOf(opened.body.isbn);
  if (!isbn) return badRequest();
  return guarded(async () => reply(await removeBookmark(opened.store, isbn)));
}

/** F-13 옮기기: { isbn, shelfId, index? } — at that place on the rod (0-based, without this bookmark), or to its front. */
export async function PATCH(request: Request): Promise<Response> {
  const opened = await openLibrary(request, "move", true);
  if (opened instanceof Response) return opened;
  const isbn = isbnOf(opened.body.isbn);
  const shelfId = opened.body.shelfId;
  const index = indexOf(opened.body.index);
  if (!isbn || typeof shelfId !== "string" || !UUID.test(shelfId) || index === null) return badRequest();
  return guarded(async () => reply(await moveBookmark(opened.store, isbn, shelfId, index)));
}
