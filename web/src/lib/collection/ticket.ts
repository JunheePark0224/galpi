import "server-only";
import { createHmac, timingSafeEqual } from "node:crypto";
import { newArtSeed } from "@/lib/art/combine";
import type { ArtTicket } from "./types";

export { MAX_TICKET_PICKS, parseFoundRequest, type FoundRequest } from "./meeting";

/** Server-only signing secret for art tickets (docs/deploy.md 3절 — the user sets it on Vercel). */
export const SECRET_ENV = "COLLECTION_SIGNING_SECRET";
/** Outside production only (dev, tests): a fixed, obviously fake secret so the 도감 works locally without setup. */
const DEV_ONLY_SECRET = "galpi-dev-only-collection-secret-not-for-production";
/** A production secret shorter than this is refused (fail closed) — HMAC is only as strong as its key. */
export const MIN_SECRET_LENGTH = 32;
/** A ticket is good for 2 hours after its draw: long enough for a slow round, too short to trade "dex kits". */
export const TICKET_TTL_SECONDS = 2 * 60 * 60;

/** Server clocks may differ a little between instances. */
const CLOCK_SKEW_SECONDS = 300;

let warned = false;
/**
 * The secret, or null — fail closed: tickets carry no signature, nothing is recorded — in production without one or
 * with one shorter than MIN_SECRET_LENGTH (said once in the log, never its value).
 */
export function signingSecret(): string | null {
  const secret = (process.env[SECRET_ENV] ?? "").trim();
  const production = process.env.NODE_ENV === "production";
  if (!secret) return production ? null : DEV_ONLY_SECRET;
  if (production && secret.length < MIN_SECRET_LENGTH) {
    if (!warned) {
      warned = true;
      console.error(`collection: ${SECRET_ENV} is shorter than ${MIN_SECRET_LENGTH} characters — 도감 recording is off`);
    }
    return null;
  }
  return secret;
}

export const nowSeconds = (): number => Math.floor(Date.now() / 1000);

/**
 * v2 (security review 10-05): the issue time and, for a logged-in draw, the person are signed with the seed. v3 (security
 * review of the guest 도감 fix): the draw's books in order too, so a ticket can only ever vouch for those books. v4 (10-07 A,
 * three-part pictures): artsForDraw draws differently from the same seed, so an older ticket must not vouch for a picture.
 */
const mac = (secret: string, t: { seed: number; count: number; iat: number; sub: string | null; isbns: readonly string[] }): string =>
  createHmac("sha256", secret).update(`galpi-art:v4:${t.seed}:${t.count}:${t.iat}:${t.sub ?? ""}:${t.isbns.join(",")}`).digest("base64url");

/** A new ticket for a draw of these books (one picture each): a fresh random seed, now, the logged-in person (or null), signed. */
export function issueTicket(isbns: readonly string[], opts: { sub?: string | null; seed?: number; iat?: number } = {}): ArtTicket {
  const t = { seed: opts.seed ?? newArtSeed(), count: isbns.length, iat: opts.iat ?? nowSeconds(), sub: opts.sub ?? null, isbns: [...isbns] };
  const secret = signingSecret();
  return { ...t, sig: secret ? mac(secret, t) : null };
}

/** True only when `sig` is this server's v4 signature over seed, count, iat, sub and the books (constant-time compare). */
export function verifyTicket(
  ticket: { seed: number; count: number; iat: number; sub: string | null; sig: string; isbns: readonly string[] }, secret: string,
): boolean {
  if (ticket.isbns.length !== ticket.count) return false;
  const expected = Buffer.from(mac(secret, ticket));
  const got = Buffer.from(ticket.sig);
  return got.length === expected.length && timingSafeEqual(got, expected);
}

/** Issued within the last TICKET_TTL_SECONDS (and not from the future beyond clock skew). */
export function isFresh(iat: number, now: number = nowSeconds()): boolean {
  return iat <= now + CLOCK_SKEW_SECONDS && now - iat <= TICKET_TTL_SECONDS;
}
