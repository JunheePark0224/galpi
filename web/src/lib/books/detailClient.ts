import { emptyDetail, type BookDetail } from "./detail";

const loads = new Map<string, Promise<BookDetail>>();
const settled = new Map<string, BookDetail>();
const covers = new Map<string, Promise<void>>();

/** For tests: forget earlier loads. */
export const clearDetailLoads = (): void => {
  loads.clear();
  settled.clear();
  covers.clear();
};

/** A detail already loaded in this page, or undefined — S-06 starts with it, so a ready cover is there on the first paint. */
export const peekDetail = (isbn: string): BookDetail | undefined => settled.get(isbn);

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
      else settled.set(isbn, detail);
      return detail;
    });
  loads.set(isbn, load);
  return load;
}

/** How long S-06 waits for a cover before showing the book anyway (then our cloth cover stands in). */
export const COVER_WAIT_MS = 3000;

/**
 * 10-02 (user): the cover image itself is fetched ahead — on 궁금해요 and when S-06 opens — so the book screen appears
 * with its printed cover already there. Resolves when the image loaded or failed, or at once when there is no cover.
 * Same no-referrer request as the <img> in ResultBook, so the browser serves that one from its cache.
 */
export function readyCover(isbn: string): Promise<void> {
  const known = covers.get(isbn);
  if (known) return known;
  const ready = loadDetail(isbn).then((detail) => {
    const src = detail.cover;
    if (!src || typeof Image === "undefined") return;
    return new Promise<void>((resolve) => {
      const img = new Image();
      img.referrerPolicy = "no-referrer";
      img.onload = () => resolve();
      img.onerror = () => resolve();
      img.src = src;
    });
  });
  covers.set(isbn, ready);
  return ready;
}

/** readyCover, but never longer than `ms` (a slow or silent image host must not hold the screen). */
export function waitForCover(isbn: string, ms = COVER_WAIT_MS): Promise<void> {
  return Promise.race([readyCover(isbn), new Promise<void>((resolve) => setTimeout(resolve, ms))]);
}
