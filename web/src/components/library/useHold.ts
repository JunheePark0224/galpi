"use client";
import { useEffect, useRef, type MouseEvent, type PointerEvent } from "react";

/** PRD F-13: 꾹(0.5초) 누르면 들린다 — and then follows the finger (10-04). */
export const HOLD_MS = 500;
/** More movement than this while pressing is a sideways scroll of the rod, not a hold. */
const SLOP_PX = 10;

export interface Point { x: number; y: number }

/**
 * Press and hold for HOLD_MS to pick a bookmark up (S-09 옮기기); onHold gets where the pointer is then, so the drag can
 * start from it. Taps stay taps; a finger that moves (the rod scrolls sideways — the browser's own scroll) or a cancelled
 * pointer never holds. The click that the browser sends after a hold's release is reported by wasHold() so the caller can
 * skip it. No context menu while pressing.
 */
export function useHold(onHold: (at: Point) => void) {
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const from = useRef<Point | null>(null);
  const at = useRef<Point>({ x: 0, y: 0 });
  const held = useRef(false);
  const latest = useRef(onHold);
  useEffect(() => { latest.current = onHold; }, [onHold]);
  useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);

  const stop = () => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
    from.current = null;
  };

  const handlers = {
    onPointerDown: (e: PointerEvent<HTMLElement>) => {
      held.current = false;
      if (e.pointerType === "mouse" && e.button !== 0) return;
      stop();
      from.current = { x: e.clientX, y: e.clientY };
      at.current = from.current;
      timer.current = setTimeout(() => {
        timer.current = null;
        held.current = true;
        latest.current(at.current);
      }, HOLD_MS);
    },
    onPointerMove: (e: PointerEvent<HTMLElement>) => {
      if (!from.current) return;
      at.current = { x: e.clientX, y: e.clientY };
      if (Math.hypot(e.clientX - from.current.x, e.clientY - from.current.y) > SLOP_PX) stop();
    },
    onPointerUp: stop,
    onPointerCancel: stop,
    onPointerLeave: stop,
    onContextMenu: (e: MouseEvent<HTMLElement>) => e.preventDefault(),
  };

  /** true once, for the click right after a hold. */
  const wasHold = (): boolean => {
    const was = held.current;
    held.current = false;
    return was;
  };

  return { handlers, wasHold };
}
