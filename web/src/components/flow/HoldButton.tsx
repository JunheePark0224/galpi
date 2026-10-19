"use client";
import { useEffect, useId, useRef, useState, type KeyboardEvent, type PointerEvent } from "react";
import styles from "./HoldButton.module.css";

/** DESIGN T-06 hold: the timer decides when it passes; the gauge only shows it (a janky frame cannot delay it). */
export const HOLD_MS = 800;
/** 10-14: a release this quick was a tap, not a hold the person gave up on — it leaves the tap hint for TAP_HINT_MS. */
export const TAP_MS = 300;
export const TAP_HINT_MS = 2000;
const HOLD_KEYS = new Set(["Enter", " "]);

interface Props {
  label: string;
  /** C-08 (09-30): faint text shown in place of the label while pressing. */
  hint?: string;
  /** 10-14: shown in the same box for TAP_HINT_MS after a quick tap (the hold hint flashes for only ~0.1 s there). */
  tapHint?: string;
  /** C-23 (10-19): this was the answer before going back — a ✓ in the button, the words read as its description. */
  chosenNote?: string;
  onHold: () => void;
  onCancel: (heldMs: number) => void;
}

/**
 * C-08 — "갈피를 못 잡겠어요": press and hold for 0.8s (pointer, Enter or Space). While pressing, the label gives way to the
 * faint hint in the same box (both are laid out on top of each other, so nothing moves). The name stays the label; the hint
 * is announced once per hold through a polite status line.
 */
export function HoldButton({ label, hint, tapHint, chosenNote, onHold, onCancel }: Props) {
  const chosenId = useId();
  const [holding, setHolding] = useState(false);
  const [nudge, setNudge] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const nudgeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const startedAt = useRef(0);

  useEffect(() => () => {
    if (timer.current) clearTimeout(timer.current);
    if (nudgeTimer.current) clearTimeout(nudgeTimer.current);
  }, []);

  const start = () => {
    if (timer.current) return;
    if (nudgeTimer.current) clearTimeout(nudgeTimer.current);
    nudgeTimer.current = null;
    setNudge(false);
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
    const held = Math.round(performance.now() - startedAt.current);
    onCancel(held);
    if (tapHint && held < TAP_MS) {
      setNudge(true);
      nudgeTimer.current = setTimeout(() => {
        nudgeTimer.current = null;
        setNudge(false);
      }, TAP_HINT_MS);
    }
  };

  const onPointerDown = (e: PointerEvent<HTMLButtonElement>) => {
    if (e.button !== 0) return;       // right / middle click is not a hold (touch and left click are button 0)
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
    <>
      <button
        type="button"
        className={styles.hold}
        aria-label={label}
        aria-describedby={chosenNote ? chosenId : undefined}
        data-chosen={chosenNote ? "" : undefined}
        data-holding={holding ? "" : undefined}
        data-nudge={nudge ? "" : undefined}
        onPointerDown={onPointerDown}
        onPointerUp={stop}
        onPointerCancel={stop}
        onPointerLeave={stop}
        onContextMenu={(e) => e.preventDefault()}
        onKeyDown={onKeyDown}
        onKeyUp={onKeyUp}
      >
        <span className={styles.gauge} aria-hidden="true" />
        <span className={styles.texts} aria-hidden="true">
          <span className={styles.label}>{label}</span>
          {hint && <span className={styles.hint}>{hint}</span>}
          {tapHint && <span className={styles.tapHint}>{tapHint}</span>}
        </span>
        {chosenNote && <span className={styles.check} aria-hidden="true">✓</span>}
      </button>
      {chosenNote && <span id={chosenId} className={styles.srOnly}>{chosenNote}</span>}
      {(hint || tapHint) && <span className={styles.announce} role="status">{holding ? hint ?? "" : nudge ? tapHint : ""}</span>}
    </>
  );
}
