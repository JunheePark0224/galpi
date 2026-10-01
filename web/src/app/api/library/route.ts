import { catalog, toCard } from "@/lib/books/catalog";
import { guarded, openLibrary } from "@/lib/library/http";
import { libraryView } from "@/lib/library/service";

/** S-09: the person's rods with their bookmarks, cards from our catalogue (no YES24 text). */
export async function GET(request: Request): Promise<Response> {
  const opened = await openLibrary(request, "library", false);
  if (opened instanceof Response) return opened;
  return guarded(async () => {
    const books = new Map(catalog().map((b) => [b.isbn, b]));
    const view = await libraryView(opened.store, (isbn) => {
      const book = books.get(isbn);
      return book ? toCard(book) : null;
    });
    return Response.json(view, { headers: { "Cache-Control": "no-store" } });
  });
}
