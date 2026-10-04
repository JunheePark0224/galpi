"use client";
import { useRef } from "react";
import { Bookmark } from "@/components/Bookmark";
import type { LibraryBookmark } from "@/lib/library/types";
import { metLabel } from "./BookmarkSheet";
import styles from "./Library.module.css";
import { useHold, type Point } from "./useHold";

interface Props {
  bookmark: LibraryBookmark;
  /** Being dragged: this slot stays as a faded placeholder. */
  lifted: boolean;
  onOpen: () => void;
  onHold: (at: Point, box: DOMRect, pointerId: number) => void;
}

/**
 * One bookmark hanging on a rod (C-17): the S-06 bookmark as it was kept, small, with the day it was met. Tap → its
 * front, large (BookmarkSheet); hold 0.5 s → it follows the finger to a new place (useDrag). The name says the book (our
 * catalogue's title), never the rod's name.
 */
export function ShelfBookmark({ bookmark, lifted, onOpen, onHold }: Props) {
  const self = useRef<HTMLButtonElement>(null);
  const hold = useHold((at, pointerId) => { if (self.current) onHold(at, self.current.getBoundingClientRect(), pointerId); });
  return (
    <button
      ref={self}
      type="button"
      className={styles.hang}
      data-lifted={lifted ? "" : undefined}
      aria-label={`${bookmark.card.title} 책갈피`}
      {...hold.handlers}
      onClick={(e) => {
        const was = hold.wasHold();
        if (!was || e.detail === 0) onOpen();     // a keyboard press (detail 0) always opens, even right after a drag
      }}
    >
      <span className={styles.mini} aria-hidden="true">
        <Bookmark card={bookmark.card} art={bookmark.art} met={metLabel(bookmark.metOn)} moving />
      </span>
    </button>
  );
}
