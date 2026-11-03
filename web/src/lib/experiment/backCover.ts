import { currentRound } from "@/lib/track/common";

/**
 * Back-cover experiment (10-12 ~ 11-03, report/README.md): A = today's 뒤표지 (the main button goes on to S-06); B = the same
 * 뒤표지 where the 궁금해요 bookmarks stand out and open their book in a floating card. Ended 11-03 without telling the two
 * apart, so everyone sees A; the B screen stays reachable through ?ab=b for the record, and E-45 is no longer sent.
 */
export type BackCoverVariant = "A" | "B";
/** localStorage key that pins a variant on this browser (screenshots; on a phone set through ?ab=, below). */
export const BACK_COVER_OVERRIDE = "galpi.exp.backCover";

/** The address switch for checking a variant on a phone: ?ab=a or ?ab=b pins this browser, ?ab=off unpins. */
export const BACK_COVER_PARAM = "ab";

/** Reads ?ab= once and takes it out of the address (other tags such as utm_* stay); anything else is ignored. */
function pinFromAddress(): void {
  try {
    const url = new URL(window.location.href);
    const value = url.searchParams.get(BACK_COVER_PARAM);
    if (value === null) return;
    if (value === "a" || value === "b") localStorage.setItem(BACK_COVER_OVERRIDE, value.toUpperCase());
    else if (value === "off") localStorage.removeItem(BACK_COVER_OVERRIDE);
    url.searchParams.delete(BACK_COVER_PARAM);
    window.history.replaceState(window.history.state, "", `${url.pathname}${url.search}${url.hash}`);
  } catch {
    // storage blocked: nothing pinned
  }
}

export function backCoverVariant(): BackCoverVariant {
  pinFromAddress();
  try {
    const pinned = localStorage.getItem(BACK_COVER_OVERRIDE);
    if (pinned === "A" || pinned === "B") return pinned;
  } catch {
    // storage blocked: A
  }
  return "A";
}

const PEEKED = "galpi.exp.peekedRound";
let peekedInMemory: number | null = null;   // storage blocked: remembered for this page load only

/**
 * B card: true the first time a 궁금해요 book opens in this analytics round (common `round`, sessionStorage) — E-09 then,
 * as entering S-06 does. Keyed on the round, not the draw: a draw id restarts after [처음으로], the round does not, and a
 * reload in the same round must not send E-09 again.
 */
export function firstPeekThisRound(): boolean {
  const round = currentRound();
  let last = peekedInMemory;
  try {
    const stored = window.sessionStorage.getItem(PEEKED);
    if (stored !== null) last = Number(stored);
  } catch { /* blocked */ }
  if (last === round) return false;
  peekedInMemory = round;
  try { window.sessionStorage.setItem(PEEKED, String(round)); } catch { /* blocked */ }
  return true;
}
