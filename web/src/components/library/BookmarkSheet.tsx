"use client";
import { useEffect, useRef, useState } from "react";
import { Bookmark } from "@/components/Bookmark";
import { Button, LinkButton } from "@/components/Button";
import { Sheet } from "@/components/Sheet";
import type { ArtCombo } from "@/lib/art/combine";
import { yes24SearchUrl } from "@/lib/books/detail";
import type { LibraryBookmark, LibraryShelf } from "@/lib/library/types";
import { track } from "@/lib/track/client";
import { DECORATE_TITLE, DecorateEditor } from "./DecorateEditor";
import styles from "./Library.module.css";

/** New copy (DESIGN C-13·C-17). The sheet's buttons (시안 button-options.png C, 10-05): [🎨 꾸미기] [↔ 옮기기]. */
export const MOVE_TO = "다른 막대로 옮기기";
export const PICK_SHELF = "어느 막대로 옮길까요?";
export const UNSAVE = "빼기";
export const DECORATE = "꾸미기";
export const MOVE = "옮기기";
export const DECORATED = "새 그림으로 꽂았어요";
const NOTE_MS = 2500;

/** "2026-10-01" → "2026. 10. 1." (DESIGN C-13 만난 날). */
export function metLabel(iso: string): string {
  const [y, m, d] = iso.split("-").map(Number);
  return `${y}. ${m}. ${d}.`;
}

type Mode = "front" | "pick" | "remove" | "decorate";
interface Props {
  bookmark: LibraryBookmark;
  shelfId: string;
  shelves: readonly LibraryShelf[];
  onMove: (shelfId: string) => Promise<boolean>;
  onRemove: () => Promise<boolean>;
  /** 꾸미기: saves the new picture (true when the server took it) — the rod and this front follow from the view. */
  onDecorate: (art: ArtCombo) => Promise<boolean>;
  onClose: () => void;
}

/** A label with its emoji kept out of the button's name (the name says it). */
const Glyph = ({ children }: { children: string }) => <span className={styles.glyph} aria-hidden="true">{children}</span>;

/**
 * A bookmark of S-09 opened (C-13, 10-04): its front, large, with the day it was met — no back face here — and
 * [예스24에서 보기] (E-18 library, the one main button); under it one row (시안 C, 10-05): [🎨 꾸미기] (C-26 editor — only
 * once the first picture is known, 0005) in the library's leather and [↔ 옮기기] (= 다른 막대로 옮기기, the way to move
 * without dragging — pick a rod, it goes to the front; F-13; only with two rods or more); then a small [빼기] (asked once
 * more). After a save the front shows the new picture and "새 그림으로 꽂았어요" for a moment; focus goes back to [꾸미기].
 * Rod names are the person's words: shown as masked text only.
 */
export function BookmarkSheet({ bookmark, shelfId, shelves, onMove, onRemove, onDecorate, onClose }: Props) {
  const [mode, setMode] = useState<Mode>("front");
  const [failed, setFailed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  const decorateButton = useRef<HTMLButtonElement>(null);
  const backFromEditor = useRef(false);
  const { card, originalArt } = bookmark;

  // leaving the editor: focus back on [꾸미기] (after the Sheet moved it to the step's first control — parent effects run last)
  useEffect(() => {
    if (mode !== "front" || !backFromEditor.current) return;
    backFromEditor.current = false;
    decorateButton.current?.focus();
  }, [mode]);

  useEffect(() => {
    if (!note) return;
    const timer = setTimeout(() => setNote(null), NOTE_MS);
    return () => clearTimeout(timer);
  }, [note]);

  const leaveEditor = () => {
    backFromEditor.current = true;
    setMode("front");
  };

  const run = async (change: () => Promise<boolean>) => {
    if (busy) return;                   // one change at a time — a quick double press does not move or remove twice
    setBusy(true);
    setFailed(false);
    const ok = await change();
    setBusy(false);
    if (ok) onClose();
    else setFailed(true);
  };

  if (mode === "pick") {
    return (
      <Sheet title={PICK_SHELF} onClose={onClose} stepKey="pick">
        <ul className={styles.pickList}>
          {shelves.map((s) => (
            <li key={s.id}>
              <button type="button" className={styles.pick} disabled={s.id === shelfId || busy} onClick={() => void run(() => onMove(s.id))}>
                <span data-amp-mask="">{s.name}</span>{s.id === shelfId ? " (지금)" : ""}
              </button>
            </li>
          ))}
        </ul>
        {failed && <p role="alert" className={styles.error}>옮기지 못했어요. 다시 해 주세요.</p>}
        <button type="button" className={styles.textButton} onClick={() => setMode("front")}>뒤로</button>
      </Sheet>
    );
  }

  if (mode === "decorate" && originalArt) {
    return (
      <Sheet title={DECORATE_TITLE} onClose={leaveEditor} stepKey="decorate" pinned>
        <DecorateEditor
          bookmark={{ ...bookmark, originalArt }} met={metLabel(bookmark.metOn)} onBack={leaveEditor}
          onSave={async (art) => {
            const ok = await onDecorate(art);
            if (ok) {
              setNote(DECORATED);
              leaveEditor();
            }
            return ok;
          }}
        />
      </Sheet>
    );
  }

  const canMove = shelves.length > 1;
  const canDecorate = !!originalArt;
  return (
    <Sheet title={card.title} onClose={onClose} stepKey={mode}>
      <div className={styles.frontFace}>
        <span className={styles.big}>
          <Bookmark card={card} art={bookmark.art} met={metLabel(bookmark.metOn)} moving />
        </span>
      </div>
      {mode === "remove" ? (
        <div className={styles.sheetActions}>
          <p className={styles.confirm}>이 책갈피를 뺄까요? 빼면 다시 만나야 꽂을 수 있어요.</p>
          <Button onClick={() => void run(onRemove)} disabled={busy}>{UNSAVE}</Button>
          <Button variant="secondary" onClick={() => setMode("front")}>그대로 두기</Button>
        </div>
      ) : (
        <div className={styles.sheetActions}>
          <LinkButton href={yes24SearchUrl(card.id)} onClick={() => track("yes24_link_clicked", { book_id: card.id, source: "library", pick_type: null })}>
            예스24에서 보기 ↗
          </LinkButton>
          {(canDecorate || canMove) && (
            <div className={styles.sheetRow}>
              {canDecorate && (
                <button
                  ref={decorateButton} type="button" className={styles.decorate} aria-label={`책갈피 ${DECORATE}`}
                  onClick={() => setMode("decorate")}
                >
                  <Glyph>🎨</Glyph>{DECORATE}
                </button>
              )}
              {canMove && (
                <Button variant="secondary" className={styles.sheetMove} aria-label={MOVE_TO} onClick={() => setMode("pick")}>
                  <Glyph>↔</Glyph>{MOVE}
                </Button>
              )}
            </div>
          )}
          <button type="button" className={`${styles.textButton} ${styles.unsave}`} onClick={() => setMode("remove")}>{UNSAVE}</button>
        </div>
      )}
      {failed && <p role="alert" className={styles.error}>하지 못했어요. 다시 해 주세요.</p>}
      <p className={styles.sheetNote} role="status" data-shown={note ? "" : undefined}>{note ?? ""}</p>
    </Sheet>
  );
}
