"use client";
import { useState } from "react";
import { Button } from "@/components/Button";
import { Sheet } from "@/components/Sheet";
import styles from "./Library.module.css";

/** New copy (DESIGN C-17, 시안 `2026-10-04-v2/library-buttons-options.png` 오른쪽 — 10-04 user). */
export const CLEAR_ALL = "모두 제거";
export const CLEAR_CONFIRM = "모두 빼기";
export const CLEAR_KEEP = "그대로 두기";
export const clearTitle = (count: number) => `책갈피 ${count}개를 모두 뺄까요?`;
const CLEAR_FAILED = "모두 빼지 못했어요. 다시 해 주세요.";

interface Props { count: number; onClear: () => Promise<boolean>; onClose: () => void }

/**
 * S-09 [모두 제거], asked once more (like the sheet's [빼기]). [모두 빼기] waits for the server — nothing leaves the screen
 * before it says yes; a double press sends once. On failure the sheet stays, with the reason.
 */
export function ClearSheet({ count, onClear, onClose }: Props) {
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);

  const clear = async () => {
    if (busy) return;
    setBusy(true);
    setFailed(false);
    const ok = await onClear();
    setBusy(false);
    if (ok) onClose();
    else setFailed(true);
  };

  return (
    <Sheet title={clearTitle(count)} onClose={onClose}>
      <p className={styles.clearBody}>
        빼면 되돌릴 수 없어요. 다시 꽂으려면 책을 다시 만나야 해요.<br />
        막대와 막대 이름은 그대로 남아요.
      </p>
      <div className={styles.sheetActions}>
        <Button className={styles.danger} onClick={() => void clear()} disabled={busy} aria-busy={busy || undefined}>{CLEAR_CONFIRM}</Button>
        <Button variant="secondary" onClick={onClose}>{CLEAR_KEEP}</Button>
      </div>
      {failed && <p role="alert" className={styles.error}>{CLEAR_FAILED}</p>}
    </Sheet>
  );
}
