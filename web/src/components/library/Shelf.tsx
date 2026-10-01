"use client";
import { useId, useState, type FormEvent } from "react";
import { SHELF_NAME_MAX } from "@/lib/library/validate";
import type { LibraryBookmark, LibraryShelf } from "@/lib/library/types";
import styles from "./Library.module.css";
import { ShelfBookmark } from "./ShelfBookmark";

export const EMPTY_SHELF = "아직 비어 있어요";
export const DROP_HERE = "여기를 누르면 옮겨져요";

interface Props {
  shelf: LibraryShelf;
  heldIsbn: string | null;
  heldFrom: string | null;
  onOpen: (bookmark: LibraryBookmark) => void;
  onHold: (bookmark: LibraryBookmark) => void;
  onDrop: () => void;
  onRename: (name: string) => Promise<boolean>;
  onRemove: () => void;
}

/**
 * C-17 rod: its name (the person's own words — shown as text only, masked in replays, never put in an attribute), a
 * leather rod, and the bookmarks hanging from it in a row that scrolls sideways. While a bookmark is held, every other
 * rod is one big "여기를 누르면 옮겨져요" button.
 */
export function Shelf({ shelf, heldIsbn, heldFrom, onOpen, onHold, onDrop, onRename, onRemove }: Props) {
  const nameId = useId();
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(shelf.name);
  const [badName, setBadName] = useState(false);
  const dropTarget = heldIsbn !== null && heldFrom !== shelf.id;

  const save = async (e: FormEvent) => {
    e.preventDefault();
    if (!draft.trim()) {
      setBadName(true);
      return;
    }
    const ok = await onRename(draft);
    setBadName(!ok);
    if (ok) setEditing(false);
  };

  return (
    <section className={styles.shelf} data-drop={dropTarget ? "" : undefined}>
      {editing ? (
        <form className={styles.rename} onSubmit={(e) => void save(e)}>
          <input
            className={styles.nameInput} value={draft} maxLength={SHELF_NAME_MAX} autoFocus data-amp-mask=""
            aria-label="막대 이름" aria-invalid={badName} onChange={(e) => setDraft(e.target.value)}
          />
          <button type="submit" className={styles.textButton}>저장</button>
          <button type="button" className={styles.textButton} onClick={() => { setEditing(false); setDraft(shelf.name); setBadName(false); }}>취소</button>
          {badName && <p role="alert" className={styles.error}>{`이름은 1~${SHELF_NAME_MAX}자로 적어 주세요`}</p>}
        </form>
      ) : (
        <div className={styles.shelfHead}>
          <h2 id={nameId} className={styles.shelfName} data-amp-mask="">{shelf.name}</h2>
          <button type="button" className={styles.iconButton} aria-label="막대 이름 고치기" onClick={() => { setDraft(shelf.name); setEditing(true); }}>✎</button>
        </div>
      )}
      <div className={styles.rod} aria-hidden="true" />
      {dropTarget ? (
        <button type="button" className={styles.drop} aria-describedby={nameId} onClick={onDrop}>{DROP_HERE}</button>
      ) : shelf.bookmarks.length === 0 ? (
        <div className={styles.empty}>
          <p>{EMPTY_SHELF}</p>
          {shelf.position > 0 && <button type="button" className={styles.textButton} aria-describedby={nameId} onClick={onRemove}>막대 치우기</button>}
        </div>
      ) : (
        <ul className={styles.row} aria-labelledby={nameId}>
          {shelf.bookmarks.map((b) => (
            <li key={b.isbn} className={styles.slot}>
              <ShelfBookmark bookmark={b} held={heldIsbn === b.isbn} onOpen={() => onOpen(b)} onHold={() => onHold(b)} />
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
