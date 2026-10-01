/** C-16 helpers (S-06 책 속 책갈피): the one-time hint flag and the 만난 날 line of the bookmark back (C-13). */

export const PULL_HINT_KEY = "galpi.hint.pull";

// Storage can be blocked (private mode, in-app browsers): then the hint is shown once per page load instead.
let seenThisLoad = false;

/** True once the "책갈피를 꺼내 보세요" slip has been shown in this browser. */
export function hasSeenPullHint(): boolean {
  if (seenThisLoad) return true;
  try {
    return window.localStorage.getItem(PULL_HINT_KEY) === "1";
  } catch {
    return false;
  }
}

export function markPullHintSeen(): void {
  seenThisLoad = true;
  try {
    window.localStorage.setItem(PULL_HINT_KEY, "1");
  } catch {
    // remembered for this page load only
  }
}

/** Test seam: module state survives between tests. */
export function forgetPullHintForTests(): void {
  seenThisLoad = false;
}

/** "2026. 10. 1." — the visitor's local date (DESIGN C-13 "만난 날 YYYY. M. D."). */
export function metDate(d: Date): string {
  return `${d.getFullYear()}. ${d.getMonth() + 1}. ${d.getDate()}.`;
}
