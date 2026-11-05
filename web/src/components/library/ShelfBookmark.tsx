"use client";
import { useRef } from "react";
import { Bookmark } from "@/components/Bookmark";
import type { LibraryBookmark } from "@/lib/library/types";
import { metLabel } from "./BookmarkSheet";
import styles from "./Library.module.css";
import type { Point } from "./useDrag";
import { useHold } from "./useHold";
import { usePickUp } from "./usePickUp";

interface Props {
  bookmark: LibraryBookmark;
  /** Move mode ([책갈피 옮기기], 10-04): a press that moves picks it up, a tap does nothing. */
  moving: boolean;
  /** Being dragged: this slot stays as a faded placeholder. */
  lifted: boolean;
  onOpen: () => void;
  onPick: (at: Point, box: DOMRect, pointerId: number) => void;
  /** Outside move mode, a still press of HOLD_MS (11-05): the parent turns move mode on. None (a rod to look at only): no hold. */
  onHold?: () => void;
}

/**
 * One bookmark hanging on a rod (C-17): the S-06 bookmark as it was kept, small, with the day it was met. Tap → its
 * front, large (BookmarkSheet). In move mode a tap does nothing and a press that moves 4 px picks it up (useDrag); a
 * keyboard press (Enter / Space, `detail` 0) still opens it, so the sheet's [다른 막대로 옮기기] stays reachable. The name
 * says the book (our catalogue's title), never the rod's name.
 */
export function ShelfBookmark({ bookmark, moving, lifted, onOpen, onPick, onHold }: Props) {
  const self = useRef<HTMLButtonElement>(null);
  const pick = usePickUp(moving, (at, pointerId) => { if (self.current) onPick(at, self.current.getBoundingClientRect(), pointerId); });
  const hold = useHold(!moving && !!onHold, () => onHold?.());
  return (
    <button
      ref={self}
      type="button"
      className={styles.hang}
      data-lifted={lifted ? "" : undefined}
      aria-label={`${bookmark.card.title} 책갈피`}
      {...(moving ? pick : hold.handlers)}
      onClick={(e) => {
        if (hold.swallowClick()) return;      // the lift after a hold: move mode is on, not the sheet
        if (!moving || e.detail === 0) onOpen();
      }}
    >
      <span className={styles.mini} aria-hidden="true">
        <Bookmark card={bookmark.card} art={bookmark.art} met={metLabel(bookmark.metOn)} moving />
      </span>
    </button>
  );
}
