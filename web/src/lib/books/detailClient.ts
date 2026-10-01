import { emptyDetail, type BookDetail } from "./detail";

const loads = new Map<string, Promise<BookDetail>>();

/** For tests: forget earlier loads. */
export const clearDetailLoads = (): void => loads.clear();

/**
 * S-06 asks /api/books/:isbn once per book per page load (the 궁금해요 books are fetched ahead when S-06 opens).
 * Never throws: a failed request is the empty detail, and is asked again next time.
 */
export function loadDetail(isbn: string): Promise<BookDetail> {
  const known = loads.get(isbn);
  if (known) return known;
  const load = fetch(`/api/books/${encodeURIComponent(isbn)}`)
    .then((res) => (res.ok ? (res.json() as Promise<BookDetail>) : emptyDetail(isbn)))
    .catch(() => emptyDetail(isbn))
    .then((detail) => {
      if (!detail.source) loads.delete(isbn);
      return detail;
    });
  loads.set(isbn, load);
  return load;
}
