"use client";
import { useState, useSyncExternalStore } from "react";
import { Button } from "@/components/Button";
import { readAnonId } from "@/lib/track/common";
import styles from "./AnonIdView.module.css";

export const NO_RECORD = "아직 기록이 없어요";
export const COPY_FAILED = "복사하지 못했어요. 번호를 길게 눌러 복사해 주세요";

const subscribe = () => () => {};

type CopyState = "idle" | "done" | "failed";

/** Shows this browser's anonymous id, read-only: it never creates one (a visitor who left no record stays that way). */
export function AnonIdView() {
  // Server snapshot is null (no localStorage there); the client reads the stored id without ever creating one.
  const id = useSyncExternalStore(subscribe, readAnonId, () => null);
  const [copy, setCopy] = useState<CopyState>("idle");

  const onCopy = async () => {
    if (!id) return;
    try {
      await navigator.clipboard.writeText(id);
      setCopy("done");
    } catch {
      // no clipboard (some in-app browsers) or permission denied
      setCopy("failed");
    }
  };

  if (!id) return <p className={styles.none}>{NO_RECORD}</p>;

  return (
    <div className={styles.wrap}>
      <div className={styles.row}>
        <code className={styles.id}>{id}</code>
        <Button variant="secondary" className={styles.copy} onClick={onCopy}>
          {copy === "done" ? "복사했어요" : "복사"}
        </Button>
      </div>
      {copy === "failed" && <p className={styles.note} role="status">{COPY_FAILED}</p>}
    </div>
  );
}
