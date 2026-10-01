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
