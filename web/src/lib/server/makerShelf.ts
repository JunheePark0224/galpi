import "server-only";
import { catalog, toCard } from "@/lib/books/catalog";
import { UUID } from "@/lib/library/http";
import { EMPTY_MAKER_VIEW, toMakerView, type MakerView } from "@/lib/library/makerView";
import { libraryView } from "@/lib/library/service";
import { supabaseStore } from "@/lib/library/supabaseStore";
import { serviceClient } from "./serviceClient";

/** The answer is kept this long on one server instance — the maker's shelf changes rarely, visitors may come in bursts. */
export const MAKER_CACHE_SECONDS = 60;

let cached: { view: MakerView; until: number } | null = null;
let warned = false;

/** For tests: forget the kept answer. */
export function clearMakerCache(): void {
  cached = null;
}

/** The one account whose shelf S-13 shows (`MAKER_USER_ID`, server only), or null when it is not set or not a UUID. */
function makerId(): string | null {
  const id = (process.env.MAKER_USER_ID ?? "").trim();
  return UUID.test(id) ? id : null;
}

/**
 * PRD F-30: the maker's rods and bookmarks, read with the server's service-role client — RLS lets a session read only its
 * own rows, so this reads the one configured account and nothing else, and only reads. Not configured (no id, no key —
 * local runs and e2e) is an empty shelf. A database failure throws (the route answers 503) and is not kept.
 */
export async function makerShelf(now: number = Date.now()): Promise<MakerView> {
  if (cached && cached.until > now) return cached.view;
  const id = makerId();
  const db = id ? serviceClient() : null;
  if (!id || !db) {
    // a deploy without the setting shows an empty shelf to everyone — say so once per cold start (no values)
    if (process.env.NODE_ENV === "production" && !warned) {
      warned = true;
      console.warn(`maker shelf off: ${id ? "no service key" : "MAKER_USER_ID missing or not a UUID"}`);
    }
    return EMPTY_MAKER_VIEW;
  }
  const books = new Map(catalog().map((b) => [b.isbn, b]));
  const view = toMakerView(await libraryView(supabaseStore(db, id), (isbn) => {
    const book = books.get(isbn);
    return book ? toCard(book) : null;
  }));
  cached = { view, until: now + MAKER_CACHE_SECONDS * 1000 };
  return view;
}
