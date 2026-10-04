import "server-only";
import { createHmac, timingSafeEqual } from "node:crypto";
import { newArtSeed } from "@/lib/art/combine";
import type { ArtTicket } from "./types";

/** Server-only signing secret for art tickets (docs/deploy.md 3절 — the user sets it on Vercel). */
export const SECRET_ENV = "COLLECTION_SIGNING_SECRET";
/** Outside production only (dev, tests): a fixed, obviously fake secret so the 도감 works locally without setup. */
const DEV_ONLY_SECRET = "galpi-dev-only-collection-secret-not-for-production";
/** A draw has five bookmarks; the cap only bounds what a ticket may claim. */
export const MAX_TICKET_PICKS = 10;
const MAX_SEED = 2 ** 32 - 1;

/** The secret, or null in production without one (fail closed: tickets carry no signature, nothing is recorded). */
export function signingSecret(): string | null {
  const secret = (process.env[SECRET_ENV] ?? "").trim();
  if (secret) return secret;
  return process.env.NODE_ENV === "production" ? null : DEV_ONLY_SECRET;
}

const mac = (secret: string, seed: number, count: number): string =>
  createHmac("sha256", secret).update(`galpi-art:v1:${seed}:${count}`).digest("base64url");

/** A new ticket for a draw of `count` pictures: a fresh random seed, signed when there is a secret. */
export function issueTicket(count: number, seed: number = newArtSeed()): ArtTicket {
  const secret = signingSecret();
  return { seed, count, sig: secret ? mac(secret, seed, count) : null };
}

/** True only when `sig` is this server's signature over seed and count (constant-time compare). */
export function verifyTicket(ticket: { seed: number; count: number; sig: string }, secret: string): boolean {
  const expected = Buffer.from(mac(secret, ticket.seed, ticket.count));
  const got = Buffer.from(ticket.sig);
  return got.length === expected.length && timingSafeEqual(got, expected);
}

const isInt = (v: unknown, min: number, max: number): v is number => typeof v === "number" && Number.isInteger(v) && v >= min && v <= max;

/** POST /api/collection/found body: { seed, count, sig, index } — which bookmark of which signed draw was shown. */
export function parseFoundRequest(body: unknown): { seed: number; count: number; sig: string; index: number } | null {
  if (typeof body !== "object" || body === null || Array.isArray(body)) return null;
  const { seed, count, sig, index } = body as Record<string, unknown>;
  if (!isInt(seed, 0, MAX_SEED) || !isInt(count, 1, MAX_TICKET_PICKS) || !isInt(index, 0, MAX_TICKET_PICKS - 1) || index >= count) return null;
  if (typeof sig !== "string" || !/^[A-Za-z0-9_-]{43}$/.test(sig)) return null;
  return { seed, count, sig, index };
}
