import "server-only";
import { emptyDetail, fromKakao, fromYes24, type BookDetail } from "@/lib/books/detail";

/** Same calls as src/compare_yes24.py and src/compare_apis.py. Keys stay on the server (YES24_API_KEY, KAKAO_REST_KEY). */
const YES24_DETAIL = "https://apis.yes24.com/v1/goods/itemDetail";
const KAKAO_SEARCH = "https://dapi.kakao.com/v3/search/book";

export const UPSTREAM_TIMEOUT_MS = 3000;
/** "짧은 캐시" (PRD F-14): one hour in this instance's memory and in Next's fetch cache. */
export const CACHE_SECONDS = 3600;
const MAX_CACHED = 500;

const cache = new Map<string, { detail: BookDetail; expires: number }>();

/** For tests: forget every cached book. */
export const clearDetailCache = (): void => cache.clear();

async function getJson(url: string, headers: Record<string, string>): Promise<unknown> {
  try {
    const res = await fetch(url, {
      headers,
      signal: AbortSignal.timeout(UPSTREAM_TIMEOUT_MS),
      next: { revalidate: CACHE_SECONDS },
    });
    return res.ok ? await res.json() : null;
  } catch {
    return null;   // timeout, network or not JSON: the next source is tried
  }
}

async function fromSources(isbn: string): Promise<BookDetail> {
  const yes24Key = process.env.YES24_API_KEY?.trim();
  if (yes24Key) {
    const query = new URLSearchParams({ searchType: "ISBN13", query: isbn, detail: "Y" });
    const json = await getJson(`${YES24_DETAIL}?${query}`, { "X-Api-Key": yes24Key, Accept: "application/json" });
    const detail = fromYes24(json, isbn);
    if (detail) return detail;
  }
  const kakaoKey = process.env.KAKAO_REST_KEY?.trim();
  if (kakaoKey) {
    const query = new URLSearchParams({ target: "isbn", query: isbn });
    const detail = fromKakao(await getJson(`${KAKAO_SEARCH}?${query}`, { Authorization: `KakaoAK ${kakaoKey}` }), isbn);
    if (detail) return detail;
  }
  return emptyDetail(isbn);
}

/** YES24 → (failed) Kakao cover and price → (failed) empty detail. Only real answers are cached, so an outage is retried. */
export async function bookDetail(isbn: string, now = Date.now()): Promise<BookDetail> {
  const hit = cache.get(isbn);
  if (hit && hit.expires > now) return hit.detail;
  const detail = await fromSources(isbn);
  if (detail.source) {
    cache.delete(isbn);
    if (cache.size >= MAX_CACHED) cache.delete(cache.keys().next().value as string);   // Map keeps insertion order
    cache.set(isbn, { detail, expires: now + CACHE_SECONDS * 1000 });
  }
  return detail;
}
