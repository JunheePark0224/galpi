"use client";
import { Bookmark } from "@/components/Bookmark";
import type { LibraryBookmark } from "@/lib/library/types";
import styles from "./Library.module.css";
import { useHold } from "./useHold";

interface Props {
  bookmark: LibraryBookmark;
  held: boolean;
  onOpen: () => void;
  onHold: () => void;
}

/**
 * One bookmark hanging on a rod (C-17): the S-06 bookmark as it was kept, small. Tap → its back face (BookmarkSheet);
 * hold 0.5 s → picked up for moving. The name says the book (our catalogue's title), never the rod's name.
 */
export function ShelfBookmark({ bookmark, held, onOpen, onHold }: Props) {
  const hold = useHold(onHold);
  return (
    <button
      type="button"
      className={styles.hang}
      data-held={held ? "" : undefined}
      aria-pressed={held}
      aria-label={`${bookmark.card.title} 책갈피`}
      {...hold.handlers}
      onClick={() => { if (!hold.wasHold()) onOpen(); }}
    >
      <span className={styles.mini} aria-hidden="true">
        <Bookmark card={bookmark.card} art={bookmark.art} moving />
      </span>
    </button>
  );
}
