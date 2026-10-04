"use client";
import { useId, useState, type FormEvent } from "react";
import { SHELF_NAME_MAX } from "@/lib/library/validate";
import type { LibraryBookmark, LibraryShelf } from "@/lib/library/types";
import styles from "./Library.module.css";
import { ShelfBookmark } from "./ShelfBookmark";
import type { Point } from "./useHold";

export const EMPTY_SHELF = "아직 비어 있어요";

interface Props {
  shelf: LibraryShelf;
  /** The bookmark being dragged (its slot stays faded), if any. */
  dragged: string | null;
  /** Where the dragged bookmark would land on this rod (a dashed gap), or null. */
  gap: number | null;
  onOpen: (bookmark: LibraryBookmark) => void;
  onHold: (bookmark: LibraryBookmark, index: number, at: Point, box: DOMRect) => void;
  onRename: (name: string) => Promise<boolean>;
  onRemove: () => void;
}

/**
 * C-17 rod: its name (the person's own words — shown as text only, masked in replays, never put in an attribute), a
 * leather rod, and the bookmarks hanging from it in a row that scrolls sideways. While a bookmark is dragged over it, a
 * dashed gap opens where it would land (`data-rod` / `data-slot` are what useDrag measures).
 */
export function Shelf({ shelf, dragged, gap, onOpen, onHold, onRename, onRemove }: Props) {
  const nameId = useId();
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(shelf.name);
  const [badName, setBadName] = useState(false);

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

  const gapSlot = <li key="gap" className={styles.gap} aria-hidden="true" />;
  const others = shelf.bookmarks.filter((b) => b.isbn !== dragged);     // the gap's index counts these
  const hung = shelf.bookmarks.flatMap((b, i) => {
    const slot = (
      <li key={b.isbn} className={styles.slot} data-slot={b.isbn}>
        <ShelfBookmark bookmark={b} lifted={dragged === b.isbn} onOpen={() => onOpen(b)} onHold={(at, box) => onHold(b, i, at, box)} />
      </li>
    );
    return gap !== null && b.isbn !== dragged && others.indexOf(b) === gap ? [gapSlot, slot] : [slot];
  });
  const slots = gap !== null && gap >= others.length ? [...hung, gapSlot] : hung;

  return (
    <section className={styles.shelf} data-rod={shelf.id}>
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
      {slots.length === 0 ? (
        <div className={styles.empty}>
          <p>{EMPTY_SHELF}</p>
          {shelf.position > 0 && <button type="button" className={styles.textButton} aria-describedby={nameId} onClick={onRemove}>막대 치우기</button>}
        </div>
      ) : (
        <ul className={styles.row} aria-labelledby={nameId} data-row="">
          {slots}
        </ul>
      )}
    </section>
  );
}
