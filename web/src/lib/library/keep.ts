import { addSavedCount, announceKept, openLoginSheet, setKeepState, signedOut } from "@/lib/account/store";
import { setAmplitudeUser } from "@/lib/track/amplitude";
import { track } from "@/lib/track/client";
import { libraryRequest } from "./client";
import { addGuestSave, removeGuestSave, type GuestSave } from "./guest";
import type { FoundRequest } from "@/lib/collection/meeting";
import type { SaveInput } from "./service";

/**
 * What the account gets: the bookmark without the card (the server has the catalogue), and the draw's signed ticket with
 * the bookmark's place when there is one (v1.7.1 — the server stores the picture worked out from it, never the sent art).
 */
export const saveInput = ({ isbn, art, reason, metOn, meeting }: SaveInput & { meeting?: FoundRequest }): SaveInput & { ticket?: FoundRequest } =>
  ({ isbn, art, reason, metOn, ...(meeting ? { ticket: meeting } : {}) });

/**
 * F-12 저장 in the browser, outside React (v1.7, plans/2026-10-05-guest-keep.md): the button only shows the book's keep
 * state (account store, and logged out the browser's list). Logged in → the account; logged out → this browser
 * (lib/library/guest), moved to the account after a login (lib/library/merge). E-15 for a new bookmark only, with where.
 */
export async function keepBookmark(item: GuestSave): Promise<void> {
  // Shown as kept at once (10-02, user: the wait felt long) — a refusal takes it back below.
  setKeepState(item.isbn, "saved");
  const answer = await libraryRequest("POST", "/api/library/saves", saveInput(item));
  if (answer.status === 401) {          // the session ran out: kept like any logged-out press, in this browser
    signedOut();
    setAmplitudeUser(null);
    setKeepState(item.isbn, null);
    keepInBrowser(item);
    return;
  }
  const body = answer.body as { ok?: unknown; saved?: unknown } | null;
  if (!answer.ok || body?.ok !== true) {
    setKeepState(item.isbn, "failed");
    return;
  }
  if (body.saved === true) {
    track("book_saved", { book_id: item.isbn, is_auto_save: false, storage: "account" });
    addSavedCount(1);
  }
}

/** Logged out: into this browser's list. true when it is new there. 100 already = "full"; storage blocked = the login sheet. */
function keepInBrowser(item: GuestSave): boolean {
  const result = addGuestSave(item);
  if (result === "added") {
    setKeepState(item.isbn, null);       // logged out, "saved" is the browser's list itself
    track("book_saved", { book_id: item.isbn, is_auto_save: false, storage: "browser" });
    return true;
  }
  if (result === "full") setKeepState(item.isbn, "full");
  if (result === "blocked") openLoginSheet("save");      // never a button that does nothing
  return false;
}

/**
 * S-06 [🔖 내 책갈피에 저장]: E-11, then keep. true when the book now shows as newly saved — the screen flies the bookmark
 * to the header and the header shows +1.
 */
export function pressKeep(item: GuestSave, loggedIn: boolean): boolean {
  track("save_clicked", { book_id: item.isbn, is_logged_in: loggedIn });
  if (loggedIn) void keepBookmark(item);
  const shown = loggedIn || keepInBrowser(item);
  if (shown) announceKept();
  return shown;
}

/**
 * S-06 [✓ 내 책갈피에 저장했어요] pressed again: out (E-16). Logged out, from this browser. Logged in, gone at once and
 * then the server is told — a refusal puts it back with a note; a book already gone (404) is quiet. Also S-09's [빼기]
 * for a bookmark kept in this browser. true when it is out.
 */
export async function pressUnkeep(isbn: string, loggedIn: boolean): Promise<boolean> {
  if (!loggedIn) {
    const removed = removeGuestSave(isbn);
    if (removed) track("book_unsaved", { book_id: isbn });
    setKeepState(isbn, null);
    return removed;
  }
  setKeepState(isbn, null);
  const answer = await libraryRequest("DELETE", "/api/library/saves", { isbn });
  if (answer.ok) {
    track("book_unsaved", { book_id: isbn });
    addSavedCount(-1);
    return true;
  }
  if (answer.status === 401) {
    signedOut();
    setAmplitudeUser(null);
    return false;
  }
  if (answer.status === 404) return true;
  setKeepState(isbn, "unkeepFailed");
  return false;
}
