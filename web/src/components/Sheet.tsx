"use client";
import { useEffect, useId, useRef, type KeyboardEvent, type ReactNode } from "react";
import styles from "./Sheet.module.css";

const FOCUSABLE = "button:not([disabled]), a[href], input:not([disabled]), textarea:not([disabled])";

/**
 * stepKey: change it when the sheet shows a new step (S-09 bookmark front → pick a rod) — focus moves to that step's first control.
 * pinned (C-26 꾸미기, 10-07): the sheet keeps one height and does not scroll itself — its child lays out a part that stays
 * (the preview) and a part that scrolls (the list), and pads the bottom itself (the editor's footer).
 */
interface Props { title: string; onClose: () => void; children: ReactNode; stepKey?: string; pinned?: boolean }

/**
 * A sheet from the bottom over a dimmed page (S-07 C-12, S-09 bookmark front / rod picker). A modal dialog: focus goes to its
 * first control and stays inside (Tab wraps), Escape and a tap outside close it, focus returns to what opened it.
 * Rendered only while open — the parent decides.
 */
export function Sheet({ title, onClose, children, stepKey, pinned = false }: Props) {
  const titleId = useId();
  const box = useRef<HTMLDivElement>(null);
  const close = useRef(onClose);
  useEffect(() => { close.current = onClose; }, [onClose]);

  useEffect(() => {
    const opener = document.activeElement;
    box.current?.querySelector<HTMLElement>(FOCUSABLE)?.focus();
    return () => { if (opener instanceof HTMLElement && opener.isConnected) opener.focus(); };
  }, []);
  const firstStep = useRef(true);
  useEffect(() => {
    if (firstStep.current) {
      firstStep.current = false;
      return;
    }
    box.current?.querySelector<HTMLElement>(FOCUSABLE)?.focus();
  }, [stepKey]);

  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.key === "Escape") {
      e.preventDefault();
      close.current();
      return;
    }
    if (e.key !== "Tab" || !box.current) return;
    const items = [...box.current.querySelectorAll<HTMLElement>(FOCUSABLE)];
    if (items.length === 0) return;
    const first = items[0];
    const last = items[items.length - 1];
    if (e.shiftKey && document.activeElement === first) {
      e.preventDefault();
      last.focus();
    } else if (!e.shiftKey && document.activeElement === last) {
      e.preventDefault();
      first.focus();
    }
  };

  return (
    <div className={styles.layer}>
      <div className={styles.backdrop} data-testid="sheet-backdrop" onClick={() => close.current()} aria-hidden="true" />
      <div
        ref={box} className={styles.sheet} role="dialog" aria-modal="true" aria-labelledby={titleId} onKeyDown={onKeyDown}
        data-pinned={pinned ? "" : undefined}
      >
        <span className={styles.grab} aria-hidden="true" />
        <h2 id={titleId} className={styles.title}>{title}</h2>
        {children}
      </div>
    </div>
  );
}
