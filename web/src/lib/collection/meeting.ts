/**
 * Which bookmark of which signed draw (도감 v1) — the body of POST /api/collection/found, and since v1.7 what a bookmark
 * saved before logging in keeps (lib/library/guest), so the 도감 can record it after the login. Shared by the server
 * (checked again there with the signature) and the browser (stored values are read with the same rules). No secrets here.
 */
export interface FoundRequest { seed: number; count: number; iat: number; sub: string | null; sig: string; index: number }

/** A draw has five bookmarks; the cap only bounds what a ticket may claim. */
export const MAX_TICKET_PICKS = 10;
const MAX_SEED = 2 ** 32 - 1;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const isInt = (v: unknown, min: number, max: number): v is number => typeof v === "number" && Number.isInteger(v) && v >= min && v <= max;

/** POST /api/collection/found body: { seed, count, iat, sub, sig, index } — which bookmark of which signed draw was shown. */
export function parseFoundRequest(body: unknown): FoundRequest | null {
  if (typeof body !== "object" || body === null || Array.isArray(body)) return null;
  const { seed, count, iat, sub, sig, index } = body as Record<string, unknown>;
  if (!isInt(seed, 0, MAX_SEED) || !isInt(count, 1, MAX_TICKET_PICKS) || !isInt(index, 0, MAX_TICKET_PICKS - 1) || index >= count) return null;
  if (!isInt(iat, 0, MAX_SEED)) return null;
  if (sub !== null && sub !== undefined && (typeof sub !== "string" || !UUID.test(sub))) return null;
  if (typeof sig !== "string" || !/^[A-Za-z0-9_-]{43}$/.test(sig)) return null;
  return { seed, count, iat, sub: sub ?? null, sig, index };
}
