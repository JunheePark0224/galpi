import { cleanAuthor, type Bib } from "./normalize";
import type { Vocab } from "./types";

type Row = Record<string, unknown>;

// "review": a daily-pipeline book the two AI passes disagreed on, waiting for a person (src/pipeline/review.py --apply) — not imported
const STATUSES = ["picked", "review", "reserve", "dropped"];
const bad = (isbn: unknown, why: string) => new Error(`${String(isbn || "(no isbn)")}: ${why}`);

/**
 * One picked book of data/processed/additions/*.json → a books_v1-shaped row (slot = topic / genre). 🍃 books come from the
 * daily pipeline (D-B) with their four axes; normalizeBook checks the genre list and the axis values.
 */
function toRow(b: Row, vocab: Vocab): Row {
  if (b.entry === "leaf") {
    return {
      isbn: b.isbn, entry: "leaf", slot: b.genre, pages: b.pages, axes: b.axes, keywords: [],
      one_liner: b.one_liner, one_liner_style: b.one_liner_style,
    };
  }
  if (b.entry !== "target") throw bad(b.isbn, `unknown entry ${String(b.entry)}`);
  const topic = String(b.topic ?? "");
  const allowed = vocab[topic]?.keywords ?? {};
  const keywords = Array.isArray(b.keywords) ? b.keywords : [];
  for (const k of keywords) if (!Object.hasOwn(allowed, String(k))) throw bad(b.isbn, `keyword ${String(k)} is not in ${topic}`);
  return {
    isbn: b.isbn, entry: "target", slot: topic, pages: b.pages, way: b.way, keywords: [...keywords],
    one_liner: b.one_liner, one_liner_style: b.one_liner_style,
  };
}

/**
 * books_v1 rows + the picked books of every additions file (the 10-01 pilot, then the daily pipeline) → rows and bib
 * for normalizeCatalog. Base rows keep their order and content; additions come after, file by file. Review, reserve and
 * dropped books stay out. Only our tags, titles and authors are in these files — no YES24 text.
 */
export function mergeAdditions(baseRows: readonly Row[], baseBib: ReadonlyMap<string, Bib>, files: readonly unknown[], vocab: Vocab) {
  const rows: Row[] = [...baseRows];
  const bib = new Map(baseBib);
  const seen = new Set(baseRows.map((r) => String(r.isbn)));
  for (const f of files) {
    const books = (f as { books?: unknown }).books;
    if (!Array.isArray(books)) throw new Error("additions file needs a books list");
    for (const b of books as Row[]) {
      if (!STATUSES.includes(String(b.status))) throw bad(b.isbn, `unknown status ${String(b.status)}`);
      if (b.status !== "picked") continue;
      const isbn = String(b.isbn ?? "");
      if (seen.has(isbn)) throw bad(isbn, "already in books");
      const title = typeof b.title === "string" ? b.title.trim() : "";
      const author = typeof b.author === "string" ? cleanAuthor(b.author) : "";
      if (!title || !author) throw bad(isbn, "an added book needs title and author");
      rows.push(toRow(b, vocab));
      bib.set(isbn, { title, author });
      seen.add(isbn);
    }
  }
  return { rows, bib };
}
