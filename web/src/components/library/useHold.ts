"use client";
import { useEffect, useRef, type MouseEvent, type PointerEvent } from "react";

/** How long a still press on a bookmark lasts before it turns move mode on (11-05, user). */
export const HOLD_MS = 500;
/** A finger that travels this far is scrolling the row, not holding. */
export const HOLD_SLOP_PX = 8;

/**
 * S-09 outside move mode (PRD F-13, 11-05): a still press on a bookmark for HOLD_MS calls onHold — the parent turns move
 * mode on, as [책갈피 옮기기] does. Moving HOLD_SLOP_PX (the row scrolls), lifting early or the browser taking the pointer
 * cancels it, so a tap is still a tap and a swipe still scrolls. After a hold, `swallowClick()` is true once: the click
 * the lift makes must not also open the bookmark's sheet. Off: no handlers. The moves are watched on window by pointerId.
 */
export function useHold(enabled: boolean, onHold: () => void) {
  const stop = useRef<() => void>(() => {});
  const held = useRef(false);
  const latest = useRef(onHold);
  useEffect(() => { latest.current = onHold; }, [onHold]);
  useEffect(() => () => stop.current(), []);
  useEffect(() => { if (!enabled) stop.current(); }, [enabled]);

  const swallowClick = () => {
    const was = held.current;
    held.current = false;
    return was;
  };
  if (!enabled) return { handlers: {}, swallowClick };
  return {
    handlers: {
      onPointerDown: (e: PointerEvent<HTMLElement>) => {
        if (e.pointerType === "mouse" && e.button !== 0) return;
        stop.current();
        held.current = false;
        const from = { x: e.clientX, y: e.clientY };
        const id = e.pointerId;
        const timer = setTimeout(() => {
          stop.current();
          held.current = true;
          navigator.vibrate?.(15);
          latest.current();
        }, HOLD_MS);
        const move = (m: globalThis.PointerEvent) => {
          if (m.pointerId === id && Math.hypot(m.clientX - from.x, m.clientY - from.y) >= HOLD_SLOP_PX) stop.current();
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
      // a long press on a phone would open the browser's menu over the bookmark
      onContextMenu: (e: MouseEvent<HTMLElement>) => e.preventDefault(),
    },
    swallowClick,
  };
}
