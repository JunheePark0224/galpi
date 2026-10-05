"use client";
import { useState } from "react";
import { Button } from "@/components/Button";
import { openLoginSheet } from "@/lib/account/store";
import type { GuestSave } from "@/lib/library/guest";
import { pressUnkeep } from "@/lib/library/keep";
import { FIRST_SHELF_NAME } from "@/lib/library/service";
import type { LibraryBookmark, LibraryShelf } from "@/lib/library/types";
import { BookmarkSheet } from "./BookmarkSheet";
import { LoggedOutDex } from "./Dex";
import styles from "./Library.module.css";
import { Shelf } from "./Shelf";

/** Copy of S-09 로그인 전 (v1.7, plans/2026-10-05-guest-keep.md). */
export const GUEST_NOTE_TITLE = "지금은 이 브라우저에만 저장돼 있어요";
export const GUEST_NOTE_BODY = "로그인하면 사라지지 않고 휴대폰·PC 어디서나 이어져요. 막대로 정리하고, 도감을 모으고, 책갈피를 꾸밀 수도 있어요.";
export const GUEST_LOGIN = "로그인하고 지키기";
export const GUEST_FOOT = "브라우저 기록을 지우면 임시 책갈피도 사라져요";
const GUEST_ROD = "guest";
const nothing = async () => false;

/**
 * S-09 before a login, with bookmarks kept in this browser (DESIGN S-09 v1.7, 시안 ③): "내 책갈피" → a note that they
 * live in this browser only and what a login adds, with [로그인하고 지키기] (S-07, E-12 library) → the first rod with
 * them, drawn as for a logged-in person but only to look at: a tap opens the front large (BookmarkSheet with one rod and no
 * first picture — only [예스24에서 보기] and [빼기]) → a small line on clearing browser data → the logged-out 도감 as before.
 */
export function GuestLibrary({ saves }: { saves: readonly GuestSave[] }) {
  const [open, setOpen] = useState<string | null>(null);
  const bookmarks: LibraryBookmark[] = saves.map(({ isbn, art, reason, metOn, card }) => ({ isbn, art, reason, metOn, card }));
  const shelf: LibraryShelf = { id: GUEST_ROD, name: FIRST_SHELF_NAME, position: 0, bookmarks };
  const opened = bookmarks.find((b) => b.isbn === open);

  return (
    <div className={styles.page}>
      <h1 className={styles.title}>내 책갈피</h1>
      <section className={styles.guestNote} aria-labelledby="guest-note">
        <p id="guest-note" className={styles.guestNoteTitle}>{GUEST_NOTE_TITLE}</p>
        <p className={styles.guestNoteBody}>{GUEST_NOTE_BODY}</p>
        <Button onClick={() => openLoginSheet("library")}>{GUEST_LOGIN}</Button>
      </section>
      <Shelf
        shelf={shelf} moving={false} fixed dragged={null} gap={null}
        onOpen={(b) => setOpen(b.isbn)} onPick={() => {}} onRename={nothing} onRemove={() => {}}
      />
      <p className={styles.guestFoot}>{GUEST_FOOT}</p>
      <h2 className={styles.guestDex}>도감</h2>
      <LoggedOutDex />
      {opened && (
        <BookmarkSheet
          bookmark={opened} shelfId={GUEST_ROD} shelves={[shelf]}
          onMove={nothing} onRemove={() => pressUnkeep(opened.isbn, false)} onDecorate={nothing} onClose={() => setOpen(null)}
        />
      )}
    </div>
  );
}
