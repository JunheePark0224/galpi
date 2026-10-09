/**
 * The phone's back key inside the one-page flow (10-08, plans/2026-10-08-device-back.md). The address never changes
 * between steps, so the browser has nothing to go back to and leaves the site.
 *
 * One history entry per step forward, added in the tap that takes the step (`advance`) — never after a back press.
 * Chrome skips back over entries a page adds without a user tap (its "history manipulation" intervention: the entry
 * before one added without activation is marked skippable), which is why re-adding an entry after each back press
 * worked once and then left the site (10-08, user on a phone). Each entry carries its depth (`galpiDepth`); a popstate
 * to a lower depth is the back key: an open window closes first, else the flow's handler moves one step.
 * When the flow is at S-01 again, `unwind` goes back over the flow's remaining entries so the next press leaves the site.
 * Each entry copies the current history state, so Next's router state (__NA) rides along and a back press restores
 * the same page instead of reloading it (app-router.js onPopState).
 */
export interface BackHold {
  /** closed some other way: take the entry back (no handler runs) */
  release(): void;
}

type Entry = { galpiDepth?: number; galpiSheet?: boolean };

let depth = 0;
let holds: { depth: number; onBack: () => void }[] = [];
let flowBack: (() => void) | null = null;
let ignore = 0;
let listening = false;
/** S-01 reached while a window was open: the unwind is owed when the last window closes. */
let unwindOwed = false;

const depthHere = () => (window.history.state as Entry | null)?.galpiDepth ?? 0;

function popped(): void {
  const here = depthHere();
  if (ignore > 0) {
    ignore -= 1;           // a move this module made itself
    depth = here;
    return;
  }
  if (here >= depth) {     // forward (or no move): follow it, nothing to undo
    depth = here;
    return;
  }
  depth = here;
  const sheet = holds.at(-1);
  if (sheet && sheet.depth > here) {
    holds = holds.slice(0, -1);
    sheet.onBack();
    return;
  }
  flowBack?.();
}

function listen(): void {
  if (listening) return;
  depth = depthHere();     // a reload or a restored tab keeps the depth of the entry it is on
  window.addEventListener("popstate", popped);
  listening = true;
}

function push(extra: Entry): void {
  depth += 1;
  window.history.pushState({ ...(window.history.state ?? {}), galpiDepth: depth, ...extra }, "");
}

/** The flow's back-key handler; returns the unregister (call it when the flow goes away). */
export function setFlowBack(onBack: () => void): () => void {
  listen();
  flowBack = onBack;
  return () => { if (flowBack === onBack) flowBack = null; };
}

/** A step forward, from a tap: one entry the back key can take back. Call it inside the tap's handler. */
export function advance(): void {
  listen();
  unwindOwed = false;
  push({ galpiSheet: false });
}

/** At S-01 again: go back over the flow's entries left (one move), so the next press leaves the site. */
export function unwind(): void {
  listen();
  if (holds.length > 0) {
    unwindOwed = true;
    return;
  }
  if (depth <= 0) return;
  ignore += 1;
  window.history.go(-depth);
}

export function holdBack(onBack: () => void): BackHold {
  listen();
  push({ galpiSheet: true });
  const hold = { depth, onBack };
  holds = [...holds, hold];
  return {
    release() {
      if (!holds.includes(hold)) return;           // the back key already took it
      const top = holds.at(-1) === hold && depth === hold.depth;
      holds = holds.filter((h) => h !== hold);
      if (unwindOwed && holds.length === 0) {         // back at S-01 meanwhile: one move over the window's entry and the flow's
        unwindOwed = false;
        if (depth <= 0) return;
        ignore += 1;
        window.history.go(-depth);
        return;
      }
      if (!top) return;                            // not the newest entry: leave it — a later press passes over it
      ignore += 1;
      window.history.back();
    },
  };
}

/** Tests only: start from nothing. */
export function forgetBackHolds(): void {
  depth = 0;
  holds = [];
  flowBack = null;
  ignore = 0;
  unwindOwed = false;
  window.removeEventListener("popstate", popped);
  listening = false;
}
