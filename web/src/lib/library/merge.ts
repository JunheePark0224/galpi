import { refreshSavedCount, setKeepState, signedOut } from "@/lib/account/store";
import { reportKeptMeeting } from "@/lib/collection/client";
import { setAmplitudeUser } from "@/lib/track/amplitude";
import { track } from "@/lib/track/client";
import { libraryRequest, type LibraryAnswer } from "./client";
import { addPendingDex, pendingDex, settlePendingDex, type PendingDex } from "./dexPending";
import { dropGuestSaves, failGuestSaves, guestSaves } from "./guest";
import { saveInput, trackFound } from "./keep";

/** full: bookmarks let go because the account already holds MAX_SAVES — the person is told once (LoginReturn). */
export interface MergeResult { full: number }
const NONE: MergeResult = { full: 0 };

const listeners = new Set<() => void>();

/** S-09 reads its rods again when bookmarks arrived from this browser (the first read may have come before them). */
export function onGuestMerged(listener: () => void): () => void {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
}

/** Only one tab of this browser moves the bookmarks at a time (Web Locks, or a short-lived storage lock). */
const LOCK = "galpi.guestMerge";
const LOCK_KEY = `${LOCK}.lock`;
const LOCK_MS = 30_000;

function takeStorageLock(): string | null {
  const token = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  try {
    let held: { at?: unknown } | null = null;
    try {
      held = JSON.parse(window.localStorage.getItem(LOCK_KEY) ?? "null") as { at?: unknown } | null;
    } catch {
      held = null;                       // a broken entry holds nothing
    }
    if (held && typeof held.at === "number" && Date.now() - held.at < LOCK_MS) return null;
    window.localStorage.setItem(LOCK_KEY, JSON.stringify({ token, at: Date.now() }));
    // read back: if another tab wrote in between, it won
    return (JSON.parse(window.localStorage.getItem(LOCK_KEY) ?? "null") as { token?: unknown } | null)?.token === token ? token : null;
  } catch {
    return token;                        // no storage: there is nothing kept here to move twice
  }
}

function dropStorageLock(token: string): void {
  try {
    const held = JSON.parse(window.localStorage.getItem(LOCK_KEY) ?? "null") as { token?: unknown } | null;
    if (held?.token === token) window.localStorage.removeItem(LOCK_KEY);
  } catch {
    // nothing to let go
  }
}

async function underLock(run: () => Promise<MergeResult>): Promise<MergeResult> {
  const locks = typeof navigator === "undefined" ? undefined : navigator.locks;
  if (locks?.request) return locks.request(LOCK, { ifAvailable: true }, (lock) => (lock ? run() : NONE));
  const token = takeStorageLock();
  if (!token) return NONE;
  try {
    return await run();
  } finally {
    dropStorageLock(token);
  }
}

/** Worth trying again on a later visit: offline, a timeout, too many requests, or a server failure. */
const retryable = ({ status }: LibraryAnswer) => status === 0 || status === 408 || status === 429 || status >= 500;

/**
 * The 도감 reports still owed (bookmarks that reached the account — their tickets prove the pictures): E-36 for each new
 * part. Recorded or refused for good (4xx) → done; a server or network failure → tried again on a later visit (at most
 * GUEST_TRIES); a run-out session → left untouched. The bookmark itself is never saved again for this.
 */
async function settleDex(): Promise<void> {
  const done: PendingDex[] = [];
  const failed: PendingDex[] = [];
  for (const entry of pendingDex()) {
    const answer = await reportKeptMeeting(entry.meeting, entry.isbn);
    if (answer.status === 401) break;
    if (answer.ok) {
      done.push(entry);
      trackFound(answer.body);
    } else if (retryable(answer)) {
      failed.push(entry);
    } else {
      done.push(entry);                  // refused for good: asking again would not change the answer
    }
  }
  settlePendingDex(done, failed);
}

let running: Promise<MergeResult> | null = null;

/**
 * After a login is confirmed (LoginReturn, any page): the bookmarks kept in this browser go to the account one by one —
 * oldest first, so the newest ends at the front of the first rod as it would have. Each that the server took (a book
 * already there included) leaves this browser. One the server refuses for good (the account is full, the book left the
 * catalogue) leaves too — the full ones are counted so the person hears it once. A server or network failure stays and
 * is tried again on the next visit, at most GUEST_TRIES times. The header count is then read from the server (never
 * added up here — a library read may have set it meanwhile). E-39 once: on the first try right after a login
 * (`afterLogin` — E-14 in this page load), or whenever a book was added; a quiet retry that adds nothing sends nothing.
 * Each bookmark that reached the account and carries its draw's ticket is reported to the 도감 (v1.7 — E-36 for new parts;
 * one kept before that has no ticket and is not recorded: nothing proves its picture).
 * No E-15 per book. Called twice at once it runs once, and only one tab of this browser runs it.
 */
export function mergeGuestSaves(afterLogin: boolean): Promise<MergeResult> {
  running ??= underLock(() => merge(afterLogin)).finally(() => { running = null; });
  return running;
}

async function merge(afterLogin: boolean): Promise<MergeResult> {
  const items = guestSaves();
  if (items.length === 0) {
    await settleDex();                   // a later visit: only the 도감 reports still owed
    return NONE;
  }
  let signedOutNow = false;
  const moved: string[] = [];
  const retry: string[] = [];
  let merged = 0;
  let full = 0;
  const owed: PendingDex[] = [];
  for (const item of [...items].reverse()) {
    const answer = await libraryRequest("POST", "/api/library/saves", saveInput(item));
    if (answer.status === 401) {        // the session ran out: the rest waits for the next login, untouched
      signedOut();
      setAmplitudeUser(null);
      signedOutNow = true;
      break;
    }
    const body = answer.body as { ok?: unknown; saved?: unknown; error?: unknown } | null;
    if (answer.ok && body?.ok === true) {
      moved.push(item.isbn);
      setKeepState(item.isbn, "saved");
      if (body.saved === true) merged += 1;
      trackFound(answer.body);           // a logged-out draw's parts, recorded with the save
      if (item.meeting) owed.push({ meeting: item.meeting, isbn: item.isbn });
    } else if (answer.ok || retryable(answer)) {
      retry.push(item.isbn);
    } else {
      moved.push(item.isbn);             // refused for good: holding it here would only send it again on every visit
      if (body?.error === "full") full += 1;
    }
  }
  addPendingDex(owed);                   // owed before the bookmarks leave this browser, so a closed tab loses nothing
  dropGuestSaves(moved);
  failGuestSaves(retry);
  if (!signedOutNow) await settleDex();
  if (afterLogin || merged > 0) track("guest_saves_merged", { guest_count: items.length, merged_count: merged });
  if (merged > 0) {
    await refreshSavedCount();
    listeners.forEach((l) => l());
  }
  return { full };
}
