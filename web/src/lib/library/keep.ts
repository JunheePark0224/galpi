import { addSavedCount, openLoginSheet, setKeepState, signedOut } from "@/lib/account/store";
import { setAmplitudeUser } from "@/lib/track/amplitude";
import { track } from "@/lib/track/client";
import { libraryRequest } from "./client";
import { clearPending, readPending, writePending } from "./pending";
import type { SaveInput } from "./service";

/**
 * F-12 꽂기 in the browser, outside React: the button only shows the book's keep state (account store). E-15 when a new
 * bookmark is kept (not for a book already kept); a session that ran out sends the person to log in again with the
 * bookmark waiting.
 */
export async function keepBookmark(item: SaveInput, auto: boolean): Promise<void> {
  setKeepState(item.isbn, "saving");
  const answer = await libraryRequest("POST", "/api/library/saves", item);
  if (answer.status === 401) {
    signedOut();
    setAmplitudeUser(null);
    writePending(item);
    setKeepState(item.isbn, null);
    openLoginSheet("save");
    return;
  }
  const body = answer.body as { ok?: unknown; saved?: unknown } | null;
  if (!answer.ok || body?.ok !== true) {
    setKeepState(item.isbn, "failed");
    return;
  }
  setKeepState(item.isbn, "saved");
  if (body.saved === true) {
    track("book_saved", { book_id: item.isbn, is_auto_save: auto });
    addSavedCount(1);
  }
}

/** S-06 [내 책갈피에 꽂기]: E-11, then keep — or, logged out, let the bookmark wait in this tab and open the login sheet. */
export function pressKeep(item: SaveInput, loggedIn: boolean): void {
  track("save_clicked", { book_id: item.isbn, is_logged_in: loggedIn });
  if (loggedIn) {
    void keepBookmark(item, false);
    return;
  }
  writePending(item);
  openLoginSheet("save");
}

/** Right after a login came back (LoginReturn, after E-14): keep the bookmark that waited for it, once. */
export async function keepWaiting(): Promise<void> {
  const waiting = readPending();
  if (!waiting) return;
  clearPending();
  await keepBookmark(waiting, true);
}
