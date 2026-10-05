import { parseFoundRequest, type FoundRequest } from "@/lib/collection/meeting";
import { GUEST_TRIES } from "./guest";

/**
 * v1.7.1: a bookmark moved from this browser to the account still owes its 도감 report (POST /api/collection/found,
 * `kept`). It waits here — the draw's ticket, the bookmark's place and its book — until the server answers it for good
 * (recorded, or a definite refusal); a server or network failure is tried again on later visits, at most GUEST_TRIES
 * times. The bookmark itself is not saved again. Nothing about the person: a random number, a signature, book numbers.
 */
export const DEX_PENDING_KEY = "galpi.guestDex";
const VERSION = 1;
const ISBN13 = /^97[89]\d{10}$/;

export interface PendingDex { meeting: FoundRequest; isbn: string; tries?: number }

const keyOf = (e: PendingDex) => `${e.meeting.seed}:${e.meeting.iat}:${e.meeting.index}`;

function parseEntry(v: unknown): PendingDex | null {
  if (typeof v !== "object" || v === null || Array.isArray(v)) return null;
  const { meeting, isbn, tries } = v as Record<string, unknown>;
  const m = parseFoundRequest(meeting);
  if (!m || typeof isbn !== "string" || !ISBN13.test(isbn)) return null;
  if (tries !== undefined && !(typeof tries === "number" && Number.isInteger(tries) && tries >= 0)) return null;
  return { meeting: m, isbn, ...(tries === undefined ? {} : { tries }) };
}

/** The reports still owed, oldest first ([] when none, or when storage cannot be read). */
export function pendingDex(): PendingDex[] {
  try {
    const stored = JSON.parse(window.localStorage.getItem(DEX_PENDING_KEY) ?? "null") as { v?: unknown; items?: unknown } | null;
    if (!stored || stored.v !== VERSION || !Array.isArray(stored.items)) return [];
    return stored.items.map(parseEntry).filter((e): e is PendingDex => e !== null);
  } catch {
    return [];
  }
}

function write(items: readonly PendingDex[]): void {
  try {
    if (items.length === 0) window.localStorage.removeItem(DEX_PENDING_KEY);
    else window.localStorage.setItem(DEX_PENDING_KEY, JSON.stringify({ v: VERSION, items }));
  } catch {
    // storage blocked: the report is tried once now and not again
  }
}

/** Owed from now on (a bookmark of a draw once — the same bookmark added again is ignored). */
export function addPendingDex(entries: readonly PendingDex[]): void {
  if (entries.length === 0) return;
  const now = pendingDex();
  const known = new Set(now.map(keyOf));
  write([...now, ...entries.filter((e) => !known.has(keyOf(e)))]);
}

/** After a round of reports: `done` leave; `failed` count one more try and leave at GUEST_TRIES. */
export function settlePendingDex(done: readonly PendingDex[], failed: readonly PendingDex[]): void {
  const doneKeys = new Set(done.map(keyOf));
  const failedKeys = new Set(failed.map(keyOf));
  write(pendingDex()
    .filter((e) => !doneKeys.has(keyOf(e)))
    .map((e) => (failedKeys.has(keyOf(e)) ? { ...e, tries: (e.tries ?? 0) + 1 } : e))
    .filter((e) => (e.tries ?? 0) < GUEST_TRIES));
}
