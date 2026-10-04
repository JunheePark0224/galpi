import "server-only";
import { createHmac, timingSafeEqual } from "node:crypto";
import { newArtSeed } from "@/lib/art/combine";
import type { ArtTicket } from "./types";

/** Server-only signing secret for art tickets (docs/deploy.md 3절 — the user sets it on Vercel). */
export const SECRET_ENV = "COLLECTION_SIGNING_SECRET";
/** Outside production only (dev, tests): a fixed, obviously fake secret so the 도감 works locally without setup. */
const DEV_ONLY_SECRET = "galpi-dev-only-collection-secret-not-for-production";
/** A production secret shorter than this is refused (fail closed) — HMAC is only as strong as its key. */
export const MIN_SECRET_LENGTH = 32;
/** A draw has five bookmarks; the cap only bounds what a ticket may claim. */
export const MAX_TICKET_PICKS = 10;
/** A ticket is good for 2 hours after its draw: long enough for a slow round, too short to trade "dex kits". */
export const TICKET_TTL_SECONDS = 2 * 60 * 60;
/** Server clocks may differ a little between instances. */
const CLOCK_SKEW_SECONDS = 300;
const MAX_SEED = 2 ** 32 - 1;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

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

/** v2 (security review 10-05): the issue time and, for a logged-in draw, the person are signed with the seed. */
const mac = (secret: string, t: { seed: number; count: number; iat: number; sub: string | null }): string =>
  createHmac("sha256", secret).update(`galpi-art:v2:${t.seed}:${t.count}:${t.iat}:${t.sub ?? ""}`).digest("base64url");

/** A new ticket for a draw of `count` pictures: a fresh random seed, now, the logged-in person (or null), signed. */
export function issueTicket(count: number, opts: { sub?: string | null; seed?: number; iat?: number } = {}): ArtTicket {
  const t = { seed: opts.seed ?? newArtSeed(), count, iat: opts.iat ?? nowSeconds(), sub: opts.sub ?? null };
  const secret = signingSecret();
  return { ...t, sig: secret ? mac(secret, t) : null };
}

/** True only when `sig` is this server's v2 signature over seed, count, iat and sub (constant-time compare). */
export function verifyTicket(ticket: { seed: number; count: number; iat: number; sub: string | null; sig: string }, secret: string): boolean {
  const expected = Buffer.from(mac(secret, ticket));
  const got = Buffer.from(ticket.sig);
  return got.length === expected.length && timingSafeEqual(got, expected);
}

/** Issued within the last TICKET_TTL_SECONDS (and not from the future beyond clock skew). */
export function isFresh(iat: number, now: number = nowSeconds()): boolean {
  return iat <= now + CLOCK_SKEW_SECONDS && now - iat <= TICKET_TTL_SECONDS;
}

const isInt = (v: unknown, min: number, max: number): v is number => typeof v === "number" && Number.isInteger(v) && v >= min && v <= max;

export interface FoundRequest { seed: number; count: number; iat: number; sub: string | null; sig: string; index: number }

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
