/** Shared request guards for the public POST routes: same-origin, rate limit, body size cap. */

export type Capped = { ok: true; body: unknown } | { ok: false; response: Response };

const reject = (status: number, error: string, headers?: Record<string, string>): Response =>
  Response.json({ error }, { status, headers });

const originOf = (value: string | null): string | null => {
  if (!value) return null;
  try {
    const o = new URL(value).origin;
    return o === "null" ? null : o;
  } catch {
    return null;
  }
};

/**
 * True when the request comes from this site's own pages. Browsers always send Origin on a POST
 * (sendBeacon and fetch included); Referer is the fallback. Neither header = refused.
 * Behind a proxy the public host and scheme arrive in x-forwarded-host / x-forwarded-proto.
 */
export function sameOrigin(req: Request): boolean {
  const claimed = originOf(req.headers.get("origin")) ?? originOf(req.headers.get("referer"));
  if (!claimed) return false;
  const url = new URL(req.url);
  const allowed = new Set([url.origin]);
  const forwarded = req.headers.get("x-forwarded-host")?.split(",")[0]?.trim();
  if (forwarded) {
    const proto = req.headers.get("x-forwarded-proto")?.split(",")[0]?.trim() || url.protocol.replace(":", "");
    allowed.add(`${proto}://${forwarded}`);
  }
  return allowed.has(claimed);
}

/** Caller identity for rate limiting: first x-forwarded-for address (set by the platform proxy) + route name. */
export function clientKey(req: Request, route: string): string {
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
  return `${ip}:${route}`;
}

// Fixed-window counters kept in this instance's memory. Serverless instances do not share it, so the real
// limit is "per instance" — good enough to stop a script hammering one endpoint, not a substitute for a WAF.
const MAX_KEYS = 10_000;
const windows = new Map<string, { count: number; resetAt: number }>();

export type RateResult = { ok: true } | { ok: false; retryAfter: number };

/** For tests: how many keys the limiter currently holds. */
export const rateLimitKeyCount = (): number => windows.size;

export function rateLimit(key: string, limit: number, windowMs: number): RateResult {
  const now = Date.now();
  const current = windows.get(key);
  if (current && current.resetAt > now) {
    if (current.count >= limit) return { ok: false, retryAfter: Math.ceil((current.resetAt - now) / 1000) };
    current.count += 1;
    return { ok: true };
  }
  if (windows.size >= MAX_KEYS) {
    for (const [k, w] of windows) if (w.resetAt <= now) windows.delete(k);
    // still full of live windows: drop the oldest ones (Map keeps insertion order)
    for (const k of windows.keys()) {
      if (windows.size < MAX_KEYS) break;
      windows.delete(k);
    }
  }
  windows.delete(key);            // re-insert so the newest window sits last
  windows.set(key, { count: 1, resetAt: now + windowMs });
  return { ok: true };
}

/** Reads the body as JSON without ever holding more than maxBytes: 413 when over, 400 when not JSON. */
export async function readJsonCapped(req: Request, maxBytes: number): Promise<Capped> {
  const declared = Number(req.headers.get("content-length"));
  if (Number.isFinite(declared) && declared > maxBytes) return { ok: false, response: reject(413, "too large") };

  const chunks: Uint8Array[] = [];
  let total = 0;
  const reader = req.body?.getReader();
  if (reader) {
    try {
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        total += value.byteLength;
        if (total > maxBytes) {
          await reader.cancel();
          return { ok: false, response: reject(413, "too large") };
        }
        chunks.push(value);
      }
    } catch {
      // the client went away in the middle of the body
      return { ok: false, response: reject(400, "unreadable body") };
    }
  }
  const bytes = new Uint8Array(total);
  let offset = 0;
  for (const c of chunks) {
    bytes.set(c, offset);
    offset += c.byteLength;
  }
  try {
    return { ok: true, body: JSON.parse(new TextDecoder().decode(bytes)) };
  } catch {
    return { ok: false, response: reject(400, "invalid json") };
  }
}

/**
 * origin → rate (per minute), cheapest refusal first: the refusal to send, or null to go on. For a GET from our own pages
 * the browser sends no Origin, so sameOrigin falls back to the Referer (Referrer-Policy strict-origin-when-cross-origin).
 */
export function guardRequest(req: Request, opts: { route: string; limit: number }): Response | null {
  if (!sameOrigin(req)) return reject(403, "forbidden");
  const rate = rateLimit(clientKey(req, opts.route), opts.limit, 60_000);
  if (!rate.ok) return reject(429, "too many requests", { "Retry-After": String(rate.retryAfter) });
  return null;
}

/** origin → rate → size, in that order (cheapest refusal first). */
export async function guardJson(
  req: Request,
  opts: { route: string; limit: number; maxBytes: number },
): Promise<Capped> {
  const refused = guardRequest(req, opts);
  if (refused) return { ok: false, response: refused };
  return readJsonCapped(req, opts.maxBytes);
}
