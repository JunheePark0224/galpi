"use client";
import { useState } from "react";
import { BookmarkBack } from "@/components/BookmarkBack";
import { Button, LinkButton } from "@/components/Button";
import { Sheet } from "@/components/Sheet";
import { yes24SearchUrl } from "@/lib/books/detail";
import type { LibraryBookmark, LibraryShelf } from "@/lib/library/types";
import { track } from "@/lib/track/client";
import styles from "./Library.module.css";

/** New copy (DESIGN C-17 back face). */
export const MOVE_TO = "다른 막대로 옮기기";
export const PICK_SHELF = "어느 막대로 옮길까요?";
export const UNSAVE = "빼기";

/** "2026-10-01" → "2026. 10. 1." (DESIGN C-13 만난 날). */
export function metLabel(iso: string): string {
  const [y, m, d] = iso.split("-").map(Number);
  return `${y}. ${m}. ${d}.`;
}

type Mode = "back" | "pick" | "remove";
interface Props {
  bookmark: LibraryBookmark;
  shelfId: string;
  shelves: readonly LibraryShelf[];
  onMove: (shelfId: string) => Promise<boolean>;
  onRemove: () => Promise<boolean>;
  onClose: () => void;
}

/**
 * A bookmark of S-09 turned over (C-13): its back — 나온 이유 and 만난 날 as kept — with [예스24에서 보기] (E-18 library),
 * [다른 막대로 옮기기] (the way to move without holding — pick a rod; F-13) and [빼기] (asked once more).
 * Rod names are the person's words: shown as masked text only.
 */
export function BookmarkSheet({ bookmark, shelfId, shelves, onMove, onRemove, onClose }: Props) {
  const [mode, setMode] = useState<Mode>("back");
  const [failed, setFailed] = useState(false);
  const { card } = bookmark;

  const run = async (change: () => Promise<boolean>) => {
    setFailed(false);
    if (await change()) onClose();
    else setFailed(true);
  };

  if (mode === "pick") {
    return (
      <Sheet title={PICK_SHELF} onClose={onClose}>
        <ul className={styles.pickList}>
          {shelves.map((s) => (
            <li key={s.id}>
              <button type="button" className={styles.pick} disabled={s.id === shelfId} onClick={() => void run(() => onMove(s.id))}>
                <span data-amp-mask="">{s.name}</span>{s.id === shelfId ? " (지금)" : ""}
              </button>
            </li>
          ))}
        </ul>
        {failed && <p role="alert" className={styles.error}>옮기지 못했어요. 다시 해 주세요.</p>}
        <button type="button" className={styles.textButton} onClick={() => setMode("back")}>뒤로</button>
      </Sheet>
    );
  }

  return (
    <Sheet title={card.title} onClose={onClose}>
      <div className={styles.backFace}>
        <BookmarkBack card={card} reason={bookmark.reason} met={metLabel(bookmark.metOn)} moving />
      </div>
      {mode === "remove" ? (
        <div className={styles.sheetActions}>
          <p className={styles.confirm}>이 책갈피를 뺄까요? 빼면 다시 만나야 꽂을 수 있어요.</p>
          <Button onClick={() => void run(onRemove)}>{UNSAVE}</Button>
          <Button variant="secondary" onClick={() => setMode("back")}>그대로 두기</Button>
        </div>
      ) : (
        <div className={styles.sheetActions}>
          <LinkButton href={yes24SearchUrl(card.id)} onClick={() => track("yes24_link_clicked", { book_id: card.id, source: "library", pick_type: null })}>
            예스24에서 보기 ↗
          </LinkButton>
          {shelves.length > 1 && <Button variant="secondary" onClick={() => setMode("pick")}>{MOVE_TO}</Button>}
          <button type="button" className={styles.textButton} onClick={() => setMode("remove")}>{UNSAVE}</button>
        </div>
      )}
      {failed && <p role="alert" className={styles.error}>하지 못했어요. 다시 해 주세요.</p>}
    </Sheet>
  );
}
