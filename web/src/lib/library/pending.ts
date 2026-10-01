import type { SaveInput } from "./service";
import { parseArt, parseReason } from "./validate";

/** F-12: the bookmark pressed before logging in, kept in this tab (sessionStorage) until the login comes back. */
export const PENDING_KEY = "galpi.pendingSave";
const MAX_AGE_MS = 30 * 60 * 1000;

export function writePending(item: SaveInput): void {
  try {
    window.sessionStorage.setItem(PENDING_KEY, JSON.stringify({ at: Date.now(), item }));
  } catch {
    // storage blocked: the person can press 꽂기 again after logging in
  }
}

/** The waiting bookmark, or null (none, too old, or not a bookmark we would have written). */
export function readPending(): SaveInput | null {
  try {
    const raw = window.sessionStorage.getItem(PENDING_KEY);
    if (!raw) return null;
    const { at, item } = JSON.parse(raw) as { at?: unknown; item?: Record<string, unknown> };
    if (typeof at !== "number" || Date.now() - at > MAX_AGE_MS || !item) return null;
    const art = parseArt(item.art);
    const reason = parseReason(item.reason);
    if (typeof item.isbn !== "string" || typeof item.metOn !== "string" || !art || !reason) return null;
    return { isbn: item.isbn, art, reason, metOn: item.metOn };
  } catch {
    return null;
  }
}

export function clearPending(): void {
  try {
    window.sessionStorage.removeItem(PENDING_KEY);
  } catch {
    // nothing to clear
  }
}
