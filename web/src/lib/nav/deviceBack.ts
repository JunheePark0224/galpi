/**
 * The phone's back key inside the one-page flow (10-08, plans/2026-10-08-device-back.md). The address never changes
 * between steps, so the browser has nothing to go back to and leaves the site.
 *
 * The flow keeps one marked history entry (`galpiBack`) while it is past S-01 — `guardFlow(true)` adds it only when the
 * current entry has no mark, so a reload, a restored tab or a page visited in between never stack a second one, and
 * `guardFlow(false)` takes it back when the flow returns to S-01 some other way ([처음으로]). The back key leaves the marked
 * entry; the flow's handler (`setFlowBack`) then moves one step and guards again.
 * An open window (a sheet) holds an entry of its own above it (`holdBack`); the back key closes the newest one first.
 * Each new entry copies the current history state, so Next's router state (__NA) rides along and a back press restores
 * the same page instead of reloading it (app-router.js onPopState).
 */
export interface BackHold {
  /** closed some other way: take the entry back (no handler runs) */
  release(): void;
}

let holds: { onBack: () => void }[] = [];
let flowBack: (() => void) | null = null;
let ignore = 0;
let listening = false;

const marked = () => Boolean((window.history.state as { galpiBack?: boolean } | null)?.galpiBack);

function popped(): void {
  if (ignore > 0) {
    ignore -= 1;           // an entry this module took back itself
    return;
  }
  const sheet = holds.pop();
  if (sheet) {
    sheet.onBack();
    return;
  }
  if (marked()) return;    // still on a marked entry (a window's stray one): nothing of the flow's was left
  flowBack?.();
}

function listen(): void {
  if (listening) return;
  window.addEventListener("popstate", popped);
  listening = true;
}

/** The flow's back-key handler; returns the unregister (call it when the flow goes away). */
export function setFlowBack(onBack: () => void): () => void {
  listen();
  flowBack = onBack;
  return () => { if (flowBack === onBack) flowBack = null; };
}

/** on: hold the flow's marked entry (once); off: take it back when the flow is at S-01 again and no window is open. */
export function guardFlow(on: boolean): void {
  listen();
  if (on && !marked()) {
    window.history.pushState({ ...(window.history.state ?? {}), galpiBack: true }, "");
  } else if (!on && marked() && holds.length === 0) {
    ignore += 1;
    window.history.back();
  }
}

export function holdBack(onBack: () => void): BackHold {
  listen();
  const hold = { onBack };
  holds.push(hold);
  window.history.pushState({ ...(window.history.state ?? {}), galpiBack: true, galpiSheet: holds.length }, "");
  return {
    release() {
      const at = holds.indexOf(hold);
      if (at < 0) return;                          // the back key already took it
      const top = at === holds.length - 1;
      holds = holds.filter((h) => h !== hold);
      if (!top) return;                            // not the newest entry: leave it — a later press passes over it
      ignore += 1;
      window.history.back();
    },
  };
}

/** Tests only: start from nothing. */
export function forgetBackHolds(): void {
  holds = [];
  flowBack = null;
  ignore = 0;
  window.removeEventListener("popstate", popped);
  listening = false;
}
