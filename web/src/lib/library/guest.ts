import { useSyncExternalStore } from "react";
import { kstDate } from "@/lib/books/library";
import type { BookCard } from "@/lib/books/types";
import type { SaveInput } from "./service";
import { parseArt, parseMetOn, parseReason } from "./validate";

/**
 * 로그인 전 내 책갈피 (F-12, 10-05 — plans/2026-10-05-guest-keep.md): bookmarks kept before logging in, in this browser
 * only (localStorage), until LoginReturn moves them to the account (lib/library/merge). One per book, newest first, at
 * most GUEST_MAX. Each keeps what the account would get (SaveInput) plus the book's card from our catalogue, so S-09 can
 * draw it without asking the server — the card is the public catalogue entry, nothing about the person.
 */
export const GUEST_KEY = "galpi.guestSaves";
export const GUEST_MAX = 100;
/** A bookmark whose move to the account failed (server or network) on this many visits is let go. */
export const GUEST_TRIES = 3;
const VERSION = 1;

/** tries: visits whose move to the account failed so far (absent = none). */
export interface GuestSave extends SaveInput { card: BookCard; tries?: number }
/** blocked: this browser keeps nothing (private mode and the like) — the caller offers the login instead. */
export type GuestAdd = "added" | "already" | "full" | "blocked";

const EMPTY: readonly GuestSave[] = [];
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());

const isRecord = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null && !Array.isArray(v);

function parseCard(v: unknown, isbn: string): BookCard | null {
  if (!isRecord(v)) return null;
  const { id, entry, title, author, genre, field, oneLiner, oneLinerStyle } = v;
  if (id !== isbn || (entry !== "leaf" && entry !== "target") || (oneLinerStyle !== "summary" && oneLinerStyle !== "question")) return null;
  if (typeof title !== "string" || typeof author !== "string" || typeof genre !== "string" || typeof oneLiner !== "string") return null;
  if (field !== null && typeof field !== "string") return null;
  return { id, entry, title, author, genre, field, oneLiner, oneLinerStyle };
}

function parseSave(v: unknown): GuestSave | null {
  if (!isRecord(v) || typeof v.isbn !== "string") return null;
  const art = parseArt(v.art);
  const reason = parseReason(v.reason);
  const metOn = parseMetOn(v.metOn, kstDate(new Date()));      // the server's rule: a real date, not after today (KST)
  const card = parseCard(v.card, v.isbn);
  const { tries } = v;
  if (tries !== undefined && !(typeof tries === "number" && Number.isInteger(tries) && tries >= 0)) return null;
  if (!art || !reason || !metOn || !card) return null;
  return { isbn: v.isbn, art, reason, metOn, card, ...(tries === undefined ? {} : { tries }) };
}

function parse(raw: string | null): readonly GuestSave[] {
  if (!raw) return EMPTY;
  try {
    const stored = JSON.parse(raw) as unknown;
    if (!isRecord(stored) || stored.v !== VERSION || !Array.isArray(stored.items)) return EMPTY;
    const items = stored.items.map(parseSave).filter((s): s is GuestSave => s !== null);
    return items.filter((s, i) => items.findIndex((o) => o.isbn === s.isbn) === i);
  } catch {
    return EMPTY;
  }
}

// The snapshot is parsed again only when the stored text changed: the same array back for the same text (React).
let lastRaw: string | null = null;
let last: readonly GuestSave[] = EMPTY;

/** The bookmarks kept in this browser, newest first ([] when none, or when storage cannot be read). */
export function guestSaves(): readonly GuestSave[] {
  let raw: string | null;
  try {
    raw = window.localStorage.getItem(GUEST_KEY);
  } catch {
    return EMPTY;
  }
  if (raw !== lastRaw) {
    lastRaw = raw;
    last = parse(raw);
  }
  return last;
}

function write(items: readonly GuestSave[]): boolean {
  try {
    if (items.length === 0) window.localStorage.removeItem(GUEST_KEY);
    else window.localStorage.setItem(GUEST_KEY, JSON.stringify({ v: VERSION, items }));
  } catch {
    return false;
  }
  emit();
  return true;
}

export function addGuestSave(item: GuestSave): GuestAdd {
  const items = guestSaves();
  if (items.some((s) => s.isbn === item.isbn)) return "already";
  if (items.length >= GUEST_MAX) return "full";
  return write([item, ...items]) ? "added" : "blocked";
}

/** true when it was here and is gone now. */
export function removeGuestSave(isbn: string): boolean {
  const items = guestSaves();
  if (!items.some((s) => s.isbn === isbn)) return false;
  return write(items.filter((s) => s.isbn !== isbn));
}

/** After the move to the account: these books leave this browser. */
export function dropGuestSaves(isbns: readonly string[]): void {
  const items = guestSaves();
  const rest = items.filter((s) => !isbns.includes(s.isbn));
  if (rest.length !== items.length) write(rest);
}

/** A failed move for these (a server or network failure): one more try counted; at GUEST_TRIES the bookmark is let go. */
export function failGuestSaves(isbns: readonly string[]): void {
  if (isbns.length === 0) return;
  const next = guestSaves()
    .map((s) => (isbns.includes(s.isbn) ? { ...s, tries: (s.tries ?? 0) + 1 } : s))
    .filter((s) => (s.tries ?? 0) < GUEST_TRIES);
  write(next);
}

/** Changes here, and in another tab of this browser (the `storage` event). */
export function subscribeGuest(listener: () => void): () => void {
  const other = (e: StorageEvent) => { if (e.key === GUEST_KEY || e.key === null) listener(); };
  listeners.add(listener);
  window.addEventListener("storage", other);
  return () => {
    listeners.delete(listener);
    window.removeEventListener("storage", other);
  };
}

const none = () => EMPTY;
export const useGuestSaves = (): readonly GuestSave[] => useSyncExternalStore(subscribeGuest, guestSaves, none);
