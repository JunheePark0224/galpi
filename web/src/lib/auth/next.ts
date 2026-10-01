/** Login providers (PRD F-11: Kakao on top, Google below; no own sign-up). Same values as taxonomy PROVIDER. */
export const PROVIDERS = ["kakao", "google"] as const;
export type Provider = (typeof PROVIDERS)[number];

/** Query keys /auth/callback adds on the way back. The page reads them once (E-14) and takes them off the address. */
export const LOGIN_PARAMS = ["login", "first"] as const;
const MAX_NEXT = 500;
const BASE = "http://galpi.invalid";

export const isProvider = (v: unknown): v is Provider => typeof v === "string" && (PROVIDERS as readonly string[]).includes(v);

/**
 * The page to return to after logging in — a path on this site or "/". Anything that could leave the site (another
 * origin, "//host", "/\host", an encoded "//") falls back to the start: an open redirect would let a link use Galpi's
 * login to send people elsewhere.
 */
export function safeNext(raw: unknown): string {
  if (typeof raw !== "string" || raw.length > MAX_NEXT || !raw.startsWith("/") || raw.startsWith("//") || raw.startsWith("/\\")) return "/";
  let url: URL;
  try {
    url = new URL(raw, BASE);
  } catch {
    return "/";
  }
  let decoded: string;
  try {
    decoded = decodeURIComponent(url.pathname);
  } catch {
    return "/";
  }
  if (url.origin !== BASE || decoded.startsWith("//") || decoded.includes("\\")) return "/";
  for (const key of LOGIN_PARAMS) url.searchParams.delete(key);
  return url.pathname + url.search;
}

/** next + the login mark: ?login=<provider>&first=<0|1>, or ?login=failed when the code exchange did not work. */
export function withLoginMark(next: string, provider: Provider | null, first: boolean): string {
  const url = new URL(safeNext(next), BASE);
  if (provider) {
    url.searchParams.set("login", provider);
    url.searchParams.set("first", first ? "1" : "0");
  } else {
    url.searchParams.set("login", "failed");
  }
  return url.pathname + url.search;
}

export interface LoginMark { provider: Provider | null; first: boolean }

/** The mark on the page's address, or null. provider null = the login failed. */
export function readLoginMark(params: URLSearchParams): LoginMark | null {
  const login = params.get("login");
  if (login === "failed") return { provider: null, first: false };
  if (!isProvider(login)) return null;
  return { provider: login, first: params.get("first") === "1" };
}

/**
 * Server-side proof of a login that just finished (security review L1): /auth/callback sets this short-lived HttpOnly
 * cookie and /api/me hands it over once and deletes it, so E-14 is sent only for a real return from Kakao / Google —
 * never for a link someone made up with ?login=.
 */
export const LOGIN_COOKIE = "galpi_login";
export const LOGIN_COOKIE_SECONDS = 300;
export const encodeLoginCookie = (provider: Provider, first: boolean): string => `${provider}:${first ? 1 : 0}`;
export function parseLoginCookie(value: string | undefined): { provider: Provider; first: boolean } | null {
  const [provider, first] = (value ?? "").split(":");
  return isProvider(provider) && (first === "0" || first === "1") ? { provider, first: first === "1" } : null;
}

let markAtLoad: LoginMark | null | undefined;

/**
 * The login mark of the address this document was loaded with, read once (code review): flow restore (settleOpen)
 * and LoginReturn both ask, and LoginReturn takes the mark off the address — whichever asks first, both get the same.
 */
export function loginMarkAtLoad(): LoginMark | null {
  if (markAtLoad === undefined) markAtLoad = typeof window === "undefined" ? null : readLoginMark(new URLSearchParams(window.location.search));
  return markAtLoad;
}

/** Test seam: module state survives between tests. */
export function forgetLoginMarkForTests(): void {
  markAtLoad = undefined;
}
