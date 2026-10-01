/**
 * F-23 "갈피의 서재 N권 · 오늘 +M권" on S-01. PRD: shown only after the first fill (about 600 books) — a small number
 * shown large looks small. Like the 10-book topic rule (active.ts) it is counted, not switched on by hand, so the deploy
 * that carries the 600th book turns it on.
 */
export const LIBRARY_MIN_BOOKS = 600;

export interface LibraryCount { total: number; today: number }

/** src/data/library.json: books.json's size and how many books each import day (Korean date) brought in. */
export interface LibraryData { total: number; added: Record<string, number> }

/** The calendar day in Korea (YYYY-MM-DD). Built from parts so no locale's date pattern is relied on. */
export function kstDate(now: Date): string {
  const parts = new Intl.DateTimeFormat("en-US", { timeZone: "Asia/Seoul", year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(now);
  const part = (type: string) => parts.find((p) => p.type === type)?.value ?? "";
  return `${part("year")}-${part("month")}-${part("day")}`;
}

/**
 * books:import → the next library.json. The ISBNs that were not in the previous books.json are stamped with the import's
 * Korean date: the morning pipeline run, or a person's import after review — the day the books are meant to go live,
 * not the date of the additions file they were picked in (a reviewed book can be picked days later). Running the import
 * again brings nothing new and changes nothing.
 */
export function stampLibrary(prev: LibraryData | null, prevIsbns: readonly string[], nextIsbns: readonly string[], today: string): LibraryData {
  const had = new Set(prevIsbns);
  const fresh = nextIsbns.filter((isbn) => !had.has(isbn)).length;
  const added = { ...(prev?.added ?? {}) };
  if (fresh > 0) added[today] = (added[today] ?? 0) + fresh;
  return { total: nextIsbns.length, added };
}

/** total: books in the published catalogue. added: library.json's books per import day. */
export function libraryCount(total: number, added: Readonly<Record<string, number>>, today: string, min = LIBRARY_MIN_BOOKS): LibraryCount | null {
  if (total < min) return null;
  return { total, today: added[today] ?? 0 };
}
