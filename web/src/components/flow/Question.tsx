"use client";
import { useEffect, useRef } from "react";
import type { AnswerChoice, QNode } from "@/lib/paths";
import frame from "@/components/BookmarkFrame.module.css";
import { HoldButton } from "./HoldButton";
import styles from "./Question.module.css";

/** A card tap this soon after a question appears is the tail of a double tap on the previous one, not an answer. */
export const TAP_GUARD_MS = 250;
/** PRD F-03 · DESIGN C-08: shown in the hold button while it is pressed. */
export const HOLD_HINT = "끌리는 쪽을 고를수록 더 잘 맞아요";
export const UNSURE = "갈피를 못 잡겠어요";
export const BACK = "이전 질문";

interface Props {
  node: QNode;
  onAnswer: (choice: AnswerChoice, elapsedMs: number) => void;
  onHoldCancel: (heldMs: number) => void;
  onBack: () => void;
}

/** C-07: the bookmark shape with the choice in the arched window instead of a picture. The whole card is the button. */
function ChoiceCard({ side, label, onChoose }: { side: "left" | "right"; label: string; onChoose: () => void }) {
  return (
    <button type="button" className={`${frame.frame} ${styles.card}`} data-side={side} onClick={onChoose}>
      <span className={frame.string} aria-hidden="true" />
      <span className={`${frame.film} ${styles.film}`}>
        <span className={frame.hole} aria-hidden="true" />
        <span className={styles.window}>{label}</span>
        <span className={frame.stitch} aria-hidden="true" />
      </span>
    </button>
  );
}

/**
 * S-02 (design 10절): one two-way question of the map — the balance-game cards, the hold button, [← 이전 질문] (C-23).
 * No path and no count while answering: S-04 shows them. Shows only; Flow sends the events. Flow remounts it per
 * question (key), so the tap guard and the hold start again.
 */
export function Question({ node, onAnswer, onHoldCancel, onBack }: Props) {
  const shownAt = useRef(0);
  useEffect(() => { shownAt.current = performance.now(); }, []);
  const elapsed = () => Math.round(performance.now() - shownAt.current);
  const choose = (choice: "A" | "B") => {
    const ms = elapsed();
    if (ms < TAP_GUARD_MS) return;
    onAnswer(choice, ms);
  };
  return (
    <section className={styles.game} aria-labelledby="question-text">
      <button type="button" className={styles.back} onClick={onBack}>
        <span aria-hidden="true">←</span> {BACK}
      </button>
      <h1 id="question-text" className={styles.question}>{node.question}</h1>
      <div className={styles.pair}>
        <ChoiceCard side="left" label={node.a.label} onChoose={() => choose("A")} />
        <span className={styles.vs} aria-hidden="true">vs</span>
        <ChoiceCard side="right" label={node.b.label} onChoose={() => choose("B")} />
      </div>
      <HoldButton label={UNSURE} hint={HOLD_HINT} onHold={() => onAnswer("unsure", elapsed())} onCancel={onHoldCancel} />
    </section>
  );
}
