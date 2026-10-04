import { useLayoutEffect, type RefObject } from "react";

/** T-04: nothing under 12px. */
export const MIN_TITLE_PX = 12;

interface Box { style: { fontSize: string }; scrollHeight: number; clientHeight: number }

/**
 * A long title steps its size down (1px at a time, to 12px) until it fits its line clamp; past that the clamp ends it in "…".
 * Starts from the size the stylesheet gives (`base`), so a larger text setting is kept for every title that fits.
 */
export function fitTitle(el: Box, base: number): number {
  for (let px = base; px >= MIN_TITLE_PX; px -= 1) {
    el.style.fontSize = `${px}px`;
    if (el.scrollHeight <= el.clientHeight + 1) return px;
  }
  return MIN_TITLE_PX;
}

/** C-02 / C-13 title (10-04): fits after mount and again once the web fonts have loaded (they change the widths). */
export function useFitTitle(ref: RefObject<HTMLElement | null>, text: string) {
  useLayoutEffect(() => {
    const run = () => {
      const el = ref.current;
      if (!el?.isConnected) return;
      el.style.fontSize = "";
      fitTitle(el, parseFloat(getComputedStyle(el).fontSize));
    };
    run();
    document.fonts?.ready.then(run);
  }, [ref, text]);
}
