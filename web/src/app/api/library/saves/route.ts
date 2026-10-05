import { catalog } from "@/lib/books/catalog";
import { kstDate } from "@/lib/books/library";
import { badRequest, guarded, ISBN13, openLibrary, reply, UUID } from "@/lib/library/http";
import { MAX_SAVES, moveBookmark, removeBookmark, saveBookmark } from "@/lib/library/service";
import { savedArt } from "@/lib/library/savedArt";
import { parseArt, parseMetOn, parseReason } from "@/lib/library/validate";

const isbnOf = (v: unknown): string | null => (typeof v === "string" && ISBN13.test(v) ? v : null);
/** A drag's place on the rod: absent, or a whole number 0..MAX_SAVES — anything else is null (refused). */
const indexOf = (v: unknown): number | undefined | null =>
  v === undefined ? undefined : typeof v === "number" && Number.isInteger(v) && v >= 0 && v <= MAX_SAVES ? v : null;

/**
 * F-12 저장: { isbn, art, reason, metOn, ticket? } — a book of our catalogue, the picture and 나온 이유 it was met with, and
 * (v1.7.1) the draw's signed ticket + the bookmark's place: the picture stored is the server's (lib/library/savedArt).
 */
export async function POST(request: Request): Promise<Response> {
  const opened = await openLibrary(request, "save", true);
  if (opened instanceof Response) return opened;
  const { body } = opened;
  const isbn = isbnOf(body.isbn);
  const art = parseArt(body.art);
  const reason = parseReason(body.reason);
  const metOn = parseMetOn(body.metOn, kstDate(new Date()));
  if (!isbn || !art || !reason || !metOn || !catalog().some((b) => b.isbn === isbn)) return badRequest();
  return guarded(async () => {
    const picture = await savedArt(art, body.ticket, isbn, opened);
    if (!picture) return badRequest();
    return reply(await saveBookmark(opened.store, { isbn, art: picture, reason, metOn }));
  });
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
  // the place counts the bookmarks S-09 draws: books still in the catalogue (as /api/library builds the rods)
  const drawn = new Set(catalog().map((b) => b.isbn));
  return guarded(async () => reply(await moveBookmark(opened.store, isbn, shelfId, index, (id) => drawn.has(id))));
}
