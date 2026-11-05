"use client";
import { useEffect, useRef, type MouseEvent, type PointerEvent } from "react";
import type { Point } from "./useDrag";
import { HOLD_SLOP_PX } from "./useHold";

/** In move mode a press becomes a drag after this much movement — less is still a tap (which does nothing there). */
export const PICK_PX = 4;
/**
 * 11-05 (user): a finger in move mode lifts a bookmark only after this still press — moving sooner (past HOLD_SLOP_PX) is a
 * swipe that scrolls the row. A mouse still lifts at once (PICK_PX).
 */
export const PICK_HOLD_MS = 250;

/**
 * S-09 move mode (PRD F-13, 10-04 — [책갈피 옮기기]): a mouse press on a bookmark picks it up as soon as the pointer has
 * moved PICK_PX, with no hold. A finger (11-05) picks it up after a still press of PICK_HOLD_MS — a finger that moves
 * sooner is scrolling the row (bookmarks keep `touch-action: pan-x pan-y`), and the browser's pointercancel ends it too;
 * once up, useDrag's touchmove blocker keeps the page from panning. onPick gets where the press began (so the floating copy sits where it was grabbed) and which
 * pointer it is (the drag follows only that one). The moves are watched on window, filtered by pointerId, so a quick
 * finger that leaves the bookmark still counts. Off (outside move mode) it adds no handlers at all: a tap is a tap and a
 * swipe is the browser's scroll. No context menu while in move mode.
 */
export function usePickUp(enabled: boolean, onPick: (from: Point, pointerId: number) => void) {
  const stop = useRef<() => void>(() => {});
  const latest = useRef(onPick);
  useEffect(() => { latest.current = onPick; }, [onPick]);
  useEffect(() => () => stop.current(), []);
  useEffect(() => { if (!enabled) stop.current(); }, [enabled]);

  if (!enabled) return {};
  return {
    onPointerDown: (e: PointerEvent<HTMLElement>) => {
      if (e.pointerType === "mouse" && e.button !== 0) return;
      stop.current();
      const from = { x: e.clientX, y: e.clientY };
      const id = e.pointerId;
      const finger = e.pointerType === "touch";
      const timer = finger ? setTimeout(() => { stop.current(); latest.current(from, id); }, PICK_HOLD_MS) : undefined;
      const move = (m: globalThis.PointerEvent) => {
        if (m.pointerId !== id) return;
        const far = Math.hypot(m.clientX - from.x, m.clientY - from.y);
        if (finger) {
          if (far >= HOLD_SLOP_PX) stop.current();     // a swipe: let the row scroll
          return;
        }
        if (far < PICK_PX) return;
        stop.current();
        latest.current(from, id);
      };
      const end = (m: globalThis.PointerEvent) => { if (m.pointerId === id) stop.current(); };
      window.addEventListener("pointermove", move);
      window.addEventListener("pointerup", end);
      window.addEventListener("pointercancel", end);
      stop.current = () => {
        clearTimeout(timer);
        window.removeEventListener("pointermove", move);
        window.removeEventListener("pointerup", end);
        window.removeEventListener("pointercancel", end);
        stop.current = () => {};
      };
    },
    onContextMenu: (e: MouseEvent<HTMLElement>) => e.preventDefault(),
  };
}
