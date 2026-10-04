"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import type { LibraryBookmark } from "@/lib/library/types";
import type { Point } from "./useHold";

/** Where a bookmark hangs or goes: a rod and its place among the rod's other bookmarks (0 = front). */
export interface Place { shelfId: string; index: number }

/** Near the screen's top or bottom (or a row's ends) the page (or the row) scrolls by itself while dragging. */
const EDGE_PX = 48;
/** Scroll per frame right at the edge; less further in. */
const SPEED_PX = 10;

export const samePlace = (a: Place | null, b: Place | null) => a?.shelfId === b?.shelfId && a?.index === b?.index;

/**
 * The place under a point: the rod whose section (`data-rod`) holds it, and the number of that rod's other slots
 * (`data-slot`, the dragged one left out) whose centre is left of it. null outside every rod.
 */
export function placeAt(root: ParentNode, at: Point, isbn: string): Place | null {
  for (const rod of root.querySelectorAll<HTMLElement>("[data-rod]")) {
    const box = rod.getBoundingClientRect();
    if (at.x < box.left || at.x > box.right || at.y < box.top || at.y > box.bottom) continue;
    const before = Array.from(rod.querySelectorAll<HTMLElement>("[data-slot]")).filter((slot) => {
      if (slot.dataset.slot === isbn) return false;
      const r = slot.getBoundingClientRect();
      return r.left + r.width / 2 < at.x;
    });
    return { shelfId: rod.dataset.rod ?? "", index: before.length };
  }
  return null;
}

/** How far to scroll this frame for a point `inside` px into an edge band (0 = outside the band). */
const speed = (inside: number) => (inside <= 0 ? 0 : Math.ceil(SPEED_PX * Math.min(inside, EDGE_PX) / EDGE_PX));

interface Live { bookmark: LibraryBookmark; from: Place; over: Place | null; point: Point; grab: Point }
export interface Dragging { bookmark: LibraryBookmark; from: Place; over: Place | null }

/** The floating copy sits where the bookmark was grabbed, under the pointer. */
function paint(ghost: HTMLElement | null, d: Live | null) {
  if (d && ghost) ghost.style.transform = `translate(${d.point.x - d.grab.x}px, ${d.point.y - d.grab.y}px)`;
}

/**
 * S-09 끌어서 옮기기 (PRD F-13, 10-04): after the hold, the bookmark follows the pointer (window listeners — the finger may
 * leave the bookmark) as a floating copy (`ghost`, moved by transform, not by React), the rod and place under it are
 * worked out from the rods' boxes, and the page / the row scroll by themselves near their edges. Release drops it there
 * (onDrop only when the place changed); outside every rod, Escape or a cancelled pointer put it back. While dragging, a
 * touch never pans the page (non-passive touchmove).
 */
export function useDrag(onDrop: (isbn: string, to: Place) => void) {
  const [drag, setDrag] = useState<Dragging | null>(null);
  const live = useRef<Live | null>(null);
  const ghost = useRef<HTMLElement | null>(null);
  const stop = useRef<() => void>(() => {});
  const latest = useRef(onDrop);
  useEffect(() => { latest.current = onDrop; }, [onDrop]);
  useEffect(() => () => stop.current(), []);

  const ghostRef = useCallback((el: HTMLElement | null) => {
    ghost.current = el;
    paint(el, live.current);
  }, []);

  const start = useCallback((bookmark: LibraryBookmark, from: Place, point: Point, box: DOMRect) => {
    stop.current();
    const d: Live = { bookmark, from, over: from, point, grab: { x: point.x - box.left, y: point.y - box.top } };
    live.current = d;
    setDrag({ bookmark, from, over: from });

    const place = () => {
      const over = placeAt(document, d.point, bookmark.isbn);
      if (samePlace(over, d.over)) return;
      d.over = over;
      setDrag({ bookmark, from, over });
    };
    const move = (e: PointerEvent) => {
      d.point = { x: e.clientX, y: e.clientY };
      paint(ghost.current, d);
      place();
    };
    let frame = 0;
    const scroll = () => {
      const { x, y } = d.point;
      const before = window.scrollY;
      window.scrollBy(0, speed(y - (window.innerHeight - EDGE_PX)) - speed(EDGE_PX - y));
      let moved = window.scrollY !== before;
      const row = d.over && document.querySelector<HTMLElement>(`[data-rod="${d.over.shelfId}"] [data-row]`);
      if (row) {
        const box = row.getBoundingClientRect();
        const left = row.scrollLeft;
        row.scrollLeft += speed(x - (box.right - EDGE_PX)) - speed(box.left + EDGE_PX - x);
        moved ||= row.scrollLeft !== left;
      }
      if (moved) place();
      frame = requestAnimationFrame(scroll);
    };
    const end = (drop: boolean) => {
      stop.current();
      if (drop && d.over && !samePlace(d.over, d.from)) latest.current(bookmark.isbn, d.over);
    };
    const up = () => end(true);
    const cancel = () => end(false);
    const key = (e: KeyboardEvent) => { if (e.key === "Escape") end(false); };
    const noPan = (e: TouchEvent) => e.preventDefault();

    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
    window.addEventListener("pointercancel", cancel);
    window.addEventListener("keydown", key);
    document.addEventListener("touchmove", noPan, { passive: false });
    frame = requestAnimationFrame(scroll);
    stop.current = () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
      window.removeEventListener("pointercancel", cancel);
      window.removeEventListener("keydown", key);
      document.removeEventListener("touchmove", noPan);
      cancelAnimationFrame(frame);
      stop.current = () => {};
      live.current = null;
      setDrag(null);
    };
  }, []);

  return { drag, start, ghostRef };
}
