/**
 * Once-per-browser guides: C-20 on the first S-05 bookmark, C-21 on the first S-06 book (10-02). Shown once per browser,
 * logged in or not. Storage can be blocked (private mode, in-app browsers): then a guide shows once per page load instead.
 */

export const FIRST_GUIDE_KEY = "galpi.hint.firstGuide";
export const RESULT_GUIDE_KEY = "galpi.hint.resultGuide";
export const LIBRARY_GUIDE_KEY = "galpi.hint.libraryGuide";

export interface GuideFlag {
  hasSeen: () => boolean;
  markSeen: () => void;
  /** S-10 "책갈피 보는 법 다시 보기": the guide shows again next time. */
  reset: () => void;
  /** Test seam: module state survives between tests. */
  forgetForTests: () => void;
}

function guideFlag(key: string): GuideFlag {
  let seenThisLoad = false;
  return {
    hasSeen() {
      if (seenThisLoad) return true;
      try {
        return window.localStorage.getItem(key) === "1";
      } catch {
        return false;
      }
    },
    markSeen() {
      seenThisLoad = true;
      try {
        window.localStorage.setItem(key, "1");
      } catch {
        // remembered for this page load only
      }
    },
    reset() {
      seenThisLoad = false;
      try {
        window.localStorage.removeItem(key);
      } catch {
        // nothing stored to remove
      }
    },
    forgetForTests() {
      seenThisLoad = false;
    },
  };
}

/** C-20, the first S-05 bookmark. */
export const firstGuide = guideFlag(FIRST_GUIDE_KEY);
/** C-21, the first S-06 book. */
export const resultGuide = guideFlag(RESULT_GUIDE_KEY);
/** C-22, the first visit to S-09 내 책갈피. */
export const libraryGuide = guideFlag(LIBRARY_GUIDE_KEY);

export const hasSeenFirstGuide = firstGuide.hasSeen;
export const markFirstGuideSeen = firstGuide.markSeen;
export const resetFirstGuide = firstGuide.reset;
export const forgetFirstGuideForTests = firstGuide.forgetForTests;

/** S-10 "책갈피 보는 법 다시 보기": every guide shows again. */
export function resetGuides(): void {
  firstGuide.reset();
  resultGuide.reset();
  libraryGuide.reset();
}
