"use client";
import { useState, type ReactNode } from "react";
import { Button } from "@/components/Button";
import { Sheet } from "@/components/Sheet";
import styles from "./Library.module.css";

/** New copy (DESIGN C-17, 시안 `2026-10-04-v2/library-buttons-options.png` 오른쪽 — 10-04 user). */
export const CLEAR_ALL = "모두 제거";
export const CLEAR_CONFIRM = "모두 빼기";
export const CLEAR_KEEP = "그대로 두기";
export const clearTitle = (count: number) => `책갈피 ${count}개를 모두 뺄까요?`;
const CLEAR_FAILED = "모두 빼지 못했어요. 다시 해 주세요.";

/** New copy (DESIGN C-27, 10-07 user: "이 막대와 막대에 꽂힌 책갈피 n개를 지울까요?"). */
export const REMOVE_ROD = "막대 지우기";
export const REMOVE_ROD_CONFIRM = "지우기";
export const removeRodTitle = (count: number) => `이 막대와 막대에 꽂힌 책갈피 ${count}개를 지울까요?`;
const REMOVE_ROD_FAILED = "막대를 지우지 못했어요. 다시 해 주세요.";

interface ConfirmProps {
  title: string; body: ReactNode; confirm: string; failed: string; onConfirm: () => Promise<boolean>; onClose: () => void;
}

/**
 * A bulk loss asked once more (C-24 · C-27, like the bookmark sheet's [빼기]). The danger button waits for the server —
 * nothing leaves the screen before it says yes; a double press sends once. On failure the sheet stays, with the reason.
 */
function ConfirmSheet({ title, body, confirm, failed: failedText, onConfirm, onClose }: ConfirmProps) {
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);

  const run = async () => {
    if (busy) return;
    setBusy(true);
    setFailed(false);
    const ok = await onConfirm();
    setBusy(false);
    if (ok) onClose();
    else setFailed(true);
  };

  return (
    <Sheet title={title} onClose={onClose}>
      <p className={styles.clearBody}>{body}</p>
      <div className={styles.sheetActions}>
        <Button className={styles.danger} onClick={() => void run()} disabled={busy} aria-busy={busy || undefined}>{confirm}</Button>
        <Button variant="secondary" onClick={onClose}>{CLEAR_KEEP}</Button>
      </div>
      {failed && <p role="alert" className={styles.error}>{failedText}</p>}
    </Sheet>
  );
}

/** S-09 [모두 제거] (C-24): every bookmark; the rods and their names stay. */
export function ClearSheet({ count, onClear, onClose }: { count: number; onClear: () => Promise<boolean>; onClose: () => void }) {
  return (
    <ConfirmSheet
      title={clearTitle(count)} confirm={CLEAR_CONFIRM} failed={CLEAR_FAILED} onConfirm={onClear} onClose={onClose}
      body={<>빼면 되돌릴 수 없어요. 다시 꽂으려면 책을 다시 만나야 해요.<br />막대와 막대 이름은 그대로 남아요.</>}
    />
  );
}

/**
 * S-09 [막대 지우기] on a rod with bookmarks (C-27, 10-07): the rod and its `count` bookmarks. The rod's name is the
 * person's own words — not put in the title (it becomes the dialog's accessible name).
 */
export function RemoveRodSheet({ count, onRemove, onClose }: { count: number; onRemove: () => Promise<boolean>; onClose: () => void }) {
  return (
    <ConfirmSheet
      title={removeRodTitle(count)} confirm={REMOVE_ROD_CONFIRM} failed={REMOVE_ROD_FAILED} onConfirm={onRemove} onClose={onClose}
      body={<>지우면 되돌릴 수 없어요. 다시 꽂으려면 책을 다시 만나야 해요.<br />다른 막대와 책갈피는 그대로 남아요.</>}
    />
  );
}
