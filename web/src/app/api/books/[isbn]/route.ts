import { catalog } from "@/lib/books/catalog";
import { bookDetail, cacheSecondsFor } from "@/lib/server/bookDetail";
import { guardRequest } from "@/lib/server/guard";

const ISBN13 = /^97[89]\d{10}$/;
// One S-06 visit asks for at most five books; a person paging back and forth stays far below this.
const PER_MINUTE = 60;

/**
 * GET /api/books/:isbn — YES24 facts for one of OUR books (S-06, PRD F-14). Never a general YES24 proxy:
 * any ISBN outside the catalogue is a 404. A YES24 / Kakao outage is still a 200 with an empty detail (the screen copes).
 */
export async function GET(request: Request, ctx: { params: Promise<{ isbn: string }> }): Promise<Response> {
  const refused = guardRequest(request, { route: "book", limit: PER_MINUTE });
  if (refused) return refused;
  const { isbn } = await ctx.params;
  if (!ISBN13.test(isbn) || !catalog().some((b) => b.isbn === isbn)) {
    return Response.json({ error: "unknown book" }, { status: 404 });
  }
  const detail = await bookDetail(isbn);
  // The browser keeps a real answer as long as the server does (YES24: an hour, Kakao-only: 10 minutes); an empty one is asked again next time.
  const seconds = cacheSecondsFor(detail);
  const cacheControl = seconds > 0 ? `private, max-age=${seconds}` : "no-store";
  return Response.json(detail, { headers: { "Cache-Control": cacheControl } });
}
