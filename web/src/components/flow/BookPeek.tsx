"use client";
import { useEffect, useEffectEvent, useRef, useState } from "react";
import type { FoundRequest } from "@/lib/collection/meeting";
import type { PickView } from "@/lib/flow/state";
import { useBackToClose } from "@/lib/nav/useBackToClose";
import { ResultBook } from "./ResultBook";
import styles from "./BookPeek.module.css";

export const PEEK_CLOSE = "닫기";

interface Props {
  picks: readonly PickView[];
  /** which 궁금해요 book was pressed (index in `picks`) */
  start: number;
  meetingOf: (pick: PickView) => FoundRequest | undefined;
  /** each book the card shows — Flow sends the events (E-09 once per round, E-10 once per book) */
  onView: (index: number) => void;
  onClose: () => void;
  /** [다 봤어요] on the last book: the round is over (S-08), as after the last S-06 book */
  onDone: () => void;
}

/**
 * B (back-cover experiment, 10-12): a 궁금해요 bookmark pressed on the 뒤표지 opens its book here, over the blurred back
 * cover — the same S-06 card (ResultBook: cover, intro, 내 책갈피에 저장, 예스24), ‹ › and [다음 책] through the other
 * 궁금해요 books; [다 봤어요] on the last goes on to S-08; 닫기, Escape or the phone's back key return to the 뒤표지.
 */
export function BookPeek({ picks, start, meetingOf, onView, onClose, onDone }: Props) {
  const [at, setAt] = useState(start);
  const close = useRef<HTMLButtonElement>(null);
  const card = useRef<HTMLDivElement>(null);
  useBackToClose(onClose);
  const shut = useEffectEvent(onClose);
  useEffect(() => { onView(at); }, [at]);   // eslint-disable-line react-hooks/exhaustive-deps -- once per book shown
  // focus: 닫기 on open, back to what opened the card (the lit bookmark) on close
  useEffect(() => {
    const opener = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    close.current?.focus();
    return () => opener?.focus();
  }, []);
  // ‹ › and [다음 책] swap the book (ResultBook remounts), so the focused button goes — keep focus in the card
  const turned = useRef(false);
  useEffect(() => {
    if (turned.current) card.current?.focus();
    turned.current = true;
  }, [at]);
  // Escape closes the card unless a sheet opened inside it (login, guide) is on top; Tab stays inside the card
  useEffect(() => {
    const key = (e: KeyboardEvent) => {
      const box = card.current;
      if (!box || document.querySelectorAll('[aria-modal="true"]').length > 1) return;
      if (e.key === "Escape") { shut(); return; }
      if (e.key !== "Tab") return;
      const items = [...box.querySelectorAll<HTMLElement>("a[href], button:not([disabled]), [tabindex]:not([tabindex='-1'])")];
      if (items.length === 0) return;
      const [first, last] = [items[0], items[items.length - 1]];
      if (e.shiftKey && (document.activeElement === first || document.activeElement === box)) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    };
    window.addEventListener("keydown", key);
    return () => window.removeEventListener("keydown", key);
  }, []);
  const pick = picks[at];
  if (!pick) return null;
  const next = () => (at + 1 < picks.length ? setAt(at + 1) : onDone());
  return (
    <div className={styles.backdrop} role="dialog" aria-modal="true" aria-label="궁금해요 책 정보" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div ref={card} className={styles.card} tabIndex={-1}>
        <button ref={close} type="button" className={styles.close} onClick={onClose}>{PEEK_CLOSE}</button>
        <ResultBook key={pick.card.id} pick={pick} position={at + 1} total={picks.length} onNext={next}
          onPrev={() => setAt(Math.max(0, at - 1))} meeting={meetingOf(pick)} />
      </div>
    </div>
  );
}
