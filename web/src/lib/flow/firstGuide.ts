/** C-20 first-bookmark guide (10-02): shown once per browser, logged in or not. Same storage pattern as bookmarkPull.ts. */

export const FIRST_GUIDE_KEY = "galpi.hint.firstGuide";

// Storage can be blocked (private mode, in-app browsers): then the guide is shown once per page load instead.
let seenThisLoad = false;

export function hasSeenFirstGuide(): boolean {
  if (seenThisLoad) return true;
  try {
    return window.localStorage.getItem(FIRST_GUIDE_KEY) === "1";
  } catch {
    return false;
  }
}

export function markFirstGuideSeen(): void {
  seenThisLoad = true;
  try {
    window.localStorage.setItem(FIRST_GUIDE_KEY, "1");
  } catch {
    // remembered for this page load only
  }
}

/** S-10 "안내 다시 보기": the next first bookmark shows the guide again. */
export function resetFirstGuide(): void {
  seenThisLoad = false;
  try {
    window.localStorage.removeItem(FIRST_GUIDE_KEY);
  } catch {
    // nothing stored to remove
  }
}

/** Test seam: module state survives between tests. */
export function forgetFirstGuideForTests(): void {
  seenThisLoad = false;
}
