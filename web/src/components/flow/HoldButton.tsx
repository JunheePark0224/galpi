"use client";
import { useEffect, useRef, useState, type KeyboardEvent, type PointerEvent } from "react";
import styles from "./HoldButton.module.css";

/** DESIGN T-06 hold: the timer decides when it passes; the gauge only shows it (a janky frame cannot delay it). */
export const HOLD_MS = 800;
const HOLD_KEYS = new Set(["Enter", " "]);

interface Props {
  label: string;
  onHold: () => void;
  onCancel: (heldMs: number) => void;
}

/** C-08 — "갈피를 못 잡겠어요": press and hold for 0.8s (pointer, Enter or Space). */
export function HoldButton({ label, onHold, onCancel }: Props) {
  const [holding, setHolding] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const startedAt = useRef(0);

  useEffect(() => () => {
    if (timer.current) clearTimeout(timer.current);
  }, []);

  const start = () => {
    if (timer.current) return;
    startedAt.current = performance.now();
    setHolding(true);
    timer.current = setTimeout(() => {
      timer.current = null;
      setHolding(false);
      onHold();
    }, HOLD_MS);
  };

  const stop = () => {
    if (!timer.current) return;
    clearTimeout(timer.current);
    timer.current = null;
    setHolding(false);
    onCancel(Math.round(performance.now() - startedAt.current));
  };

  const onPointerDown = (e: PointerEvent<HTMLButtonElement>) => {
    try {
      e.currentTarget.setPointerCapture(e.pointerId);
    } catch {
      // synthetic pointer (tests) — capture is only a nicety
    }
    start();
  };
  const onKeyDown = (e: KeyboardEvent<HTMLButtonElement>) => {
    if (!HOLD_KEYS.has(e.key)) return;
    e.preventDefault();               // no click on Enter keydown
    if (!e.repeat) start();
  };
  const onKeyUp = (e: KeyboardEvent<HTMLButtonElement>) => {
    if (HOLD_KEYS.has(e.key)) stop();
  };

  return (
    <button
      type="button"
      className={styles.hold}
      data-holding={holding ? "" : undefined}
      onPointerDown={onPointerDown}
      onPointerUp={stop}
      onPointerCancel={stop}
      onPointerLeave={stop}
      onContextMenu={(e) => e.preventDefault()}
      onKeyDown={onKeyDown}
      onKeyUp={onKeyUp}
    >
      <span className={styles.gauge} aria-hidden="true" />
      <span className={styles.label}>{label}</span>
    </button>
  );
}
