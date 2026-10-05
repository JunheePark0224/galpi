import { addSavedCount, setKeepState, signedOut } from "@/lib/account/store";
import { setAmplitudeUser } from "@/lib/track/amplitude";
import { track } from "@/lib/track/client";
import { libraryRequest } from "./client";
import { dropGuestSaves, guestSaves } from "./guest";
import { saveInput } from "./keep";

const listeners = new Set<() => void>();

/** S-09 reads its rods again when bookmarks arrived from this browser (the first read may have come before them). */
export function onGuestMerged(listener: () => void): () => void {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
}

let running: Promise<void> | null = null;

/**
 * After a login is confirmed (LoginReturn, any page): the bookmarks kept in this browser go to the account one by one —
 * oldest first, so the newest ends at the front of the first rod as it would have. Each that the server took (a book
 * already there included) leaves this browser; the rest wait for the next visit. The header counts the new ones. E-39
 * once per attempt; no E-15 per book (each was logged when it was kept). Called twice at once, it runs once.
 */
export function mergeGuestSaves(): Promise<void> {
  running ??= merge().finally(() => { running = null; });
  return running;
}

async function merge(): Promise<void> {
  const items = guestSaves();
  if (items.length === 0) return;
  const moved: string[] = [];
  let merged = 0;
  for (const item of [...items].reverse()) {
    const answer = await libraryRequest("POST", "/api/library/saves", saveInput(item));
    if (answer.status === 401) {        // the session ran out: the rest waits for the next login
      signedOut();
      setAmplitudeUser(null);
      break;
    }
    const body = answer.body as { ok?: unknown; saved?: unknown } | null;
    if (!answer.ok || body?.ok !== true) continue;
    moved.push(item.isbn);
    setKeepState(item.isbn, "saved");
    if (body.saved === true) merged += 1;
  }
  dropGuestSaves(moved);
  addSavedCount(merged);
  track("guest_saves_merged", { guest_count: items.length, merged_count: merged });
  if (moved.length > 0) listeners.forEach((l) => l());
}
