import "server-only";
import { emptyDetail, fromKakao, fromYes24, type BookDetail } from "@/lib/books/detail";

/** Same calls as src/compare_yes24.py and src/compare_apis.py. Keys stay on the server (YES24_API_KEY, KAKAO_REST_KEY). */
const YES24_DETAIL = "https://apis.yes24.com/v1/goods/itemDetail";
const KAKAO_SEARCH = "https://dapi.kakao.com/v3/search/book";

export const UPSTREAM_TIMEOUT_MS = 3000;
/** "짧은 캐시" (PRD F-14): one hour for a YES24 answer, in this instance's memory only (upstream fetches use no Next data cache). */
export const CACHE_SECONDS = 3600;
/** A Kakao-only answer (YES24 failed) is short-lived so YES24 is tried again soon after an outage. */
export const KAKAO_CACHE_SECONDS = 600;
/** How long the memory cache and the browser may keep this answer; 0 for an empty detail. */
export const cacheSecondsFor = (detail: BookDetail): number =>
  detail.source === "yes24" ? CACHE_SECONDS : detail.source === "kakao" ? KAKAO_CACHE_SECONDS : 0;
const MAX_CACHED = 500;

const cache = new Map<string, { detail: BookDetail; expires: number }>();

/** For tests: forget every cached book. */
export const clearDetailCache = (): void => cache.clear();

/** Failures are logged by kind only ("yes24: http 500") — never the URL (it holds the ISBN), headers or keys. */
const logFailure = (source: string, kind: string): void => console.warn(`${source}: ${kind}`);

async function getJson(source: string, url: string, headers: Record<string, string>): Promise<unknown> {
  let res: Response;
  try {
    // no-store: Next's data cache would keep any HTTP 200 (even a failure body) for its whole lifetime
    res = await fetch(url, { headers, signal: AbortSignal.timeout(UPSTREAM_TIMEOUT_MS), cache: "no-store" });
  } catch (error) {
    logFailure(source, error instanceof Error && error.name === "TimeoutError" ? "timeout" : "network error");
    return null;
  }
  if (!res.ok) {
    logFailure(source, `http ${res.status}`);
    return null;
  }
  try {
    return await res.json();
  } catch {
    logFailure(source, "invalid json");
    return null;
  }
}

async function fromSources(isbn: string): Promise<BookDetail> {
  const yes24Key = process.env.YES24_API_KEY?.trim();
  if (yes24Key) {
    const query = new URLSearchParams({ searchType: "ISBN13", query: isbn, detail: "Y" });
    const json = await getJson("yes24", `${YES24_DETAIL}?${query}`, { "X-Api-Key": yes24Key, Accept: "application/json" });
    const detail = fromYes24(json, isbn);
    if (detail) return detail;
  }
  const kakaoKey = process.env.KAKAO_REST_KEY?.trim();
  if (kakaoKey) {
    const query = new URLSearchParams({ target: "isbn", query: isbn });
    const detail = fromKakao(await getJson("kakao", `${KAKAO_SEARCH}?${query}`, { Authorization: `KakaoAK ${kakaoKey}` }), isbn);
    if (detail) return detail;
  }
  return emptyDetail(isbn);
}

/** YES24 → (failed) Kakao cover and price → (failed) empty detail. Only real answers are cached (Kakao's briefly), so an outage is retried. */
export async function bookDetail(isbn: string, now = Date.now()): Promise<BookDetail> {
  const hit = cache.get(isbn);
  if (hit && hit.expires > now) return hit.detail;
  const detail = await fromSources(isbn);
  const seconds = cacheSecondsFor(detail);
  if (seconds > 0) {
    cache.delete(isbn);
    if (cache.size >= MAX_CACHED) cache.delete(cache.keys().next().value as string);   // Map keeps insertion order
    cache.set(isbn, { detail, expires: now + seconds * 1000 });
  }
  return detail;
}
