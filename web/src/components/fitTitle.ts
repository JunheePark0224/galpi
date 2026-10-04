import { useLayoutEffect, type RefObject } from "react";

/** T-04: nothing under 12px. */
export const MIN_TITLE_PX = 12;
/** Glyphs reach a pixel or two past the last line box; a hidden line would be 13px or more. */
export const FIT_SLACK_PX = 4;

interface Box { style: { fontSize: string }; dataset: DOMStringMap; scrollHeight: number; clientHeight: number }

/**
 * C-02 / C-13 title (10-04): the whole title shows. Two lines first, stepping the size down 1px at a time to 12px; a title
 * that still does not fit gets a third line at 13 → 12px (`data-lines="3"`: the stylesheet tightens the lines and the
 * card's gaps to pay for it), only past that does the clamp end it in "…". Starts from the stylesheet size (`base`).
 */
export function fitTitle(el: Box, base: number, min = MIN_TITLE_PX): { lines: 2 | 3; px: number } {
  const fits = () => el.scrollHeight <= el.clientHeight + FIT_SLACK_PX;
  el.dataset.lines = "2";
  for (let px = base; px >= min; px -= 1) {
    el.style.fontSize = `${px}px`;
    if (fits()) return { lines: 2, px };
  }
  el.dataset.lines = "3";
  for (let px = min + 1; px >= min; px -= 1) {
    el.style.fontSize = `${px}px`;
    if (fits()) return { lines: 3, px };
  }
  return { lines: 3, px: min };
}

/** Fits after mount and again once the web fonts have loaded (they change the widths). */
export function useFitTitle(ref: RefObject<HTMLElement | null>, text: string) {
  useLayoutEffect(() => {
    const run = () => {
      const el = ref.current;
      if (!el?.isConnected) return;
      el.style.fontSize = "";
      delete el.dataset.lines;
      fitTitle(el, parseFloat(getComputedStyle(el).fontSize));
    };
    run();
    document.fonts?.ready.then(run);
  }, [ref, text]);
}
