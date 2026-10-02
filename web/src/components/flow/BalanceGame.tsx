"use client";
import { useEffect, useRef } from "react";
import type { BalanceChoice } from "@/lib/recommend";
import { QUESTIONS } from "@/lib/flow/questions";
import { track } from "@/lib/track/client";
import frame from "@/components/BookmarkFrame.module.css";
import { HoldButton } from "./HoldButton";
import styles from "./BalanceGame.module.css";

interface Props {
  choices: readonly BalanceChoice[];
  /** The order the questions are shown in this pass (question indices — FlowState.order). */
  order: readonly number[];
  edit: boolean;
  onAnswer: (choice: BalanceChoice) => void;
}

/** A card tap this soon after a question appears is the tail of a double tap on the previous one, not an answer. */
export const TAP_GUARD_MS = 250;
/** PRD F-03 · balance-game.md 2절 (09-30): shown in the hold button while it is pressed. One place to change it. */
export const HOLD_HINT = "끌리는 쪽을 고를수록 더 잘 맞아요";

type Side = { side: "left" | "right"; choice: "A" | "B"; text: string };

/** C-07 card: the bookmark shape with the choice in the arched window instead of a picture. The whole card is the button. */
function ChoiceCard({ s, onChoose }: { s: Side; onChoose: (s: Side) => void }) {
  return (
    <button type="button" className={`${frame.frame} ${styles.card}`} data-side={s.side} onClick={() => onChoose(s)}>
      <span className={frame.string} aria-hidden="true" />
      <span className={`${frame.film} ${styles.film}`}>
        <span className={frame.hole} aria-hidden="true" />
        <span className={styles.window}>{s.text}</span>
        <span className={frame.stitch} aria-hidden="true" />
      </span>
    </button>
  );
}

/** S-02 🍃 (C-07): nine two-way questions in this pass's order (new every pass), tap to go on; sides stay with each question. */
export function BalanceGame({ choices, order, edit, onAnswer }: Props) {
  const i = Math.min(choices.length, QUESTIONS.length - 1);
  const q = QUESTIONS[order[i] ?? i];
  const position = i + 1;
  const shownAt = useRef(0);
  useEffect(() => { shownAt.current = performance.now(); }, [i]);
  const elapsed = () => Math.round(performance.now() - shownAt.current);

  const left: Side = q.aOnLeft ? { side: "left", choice: "A", text: q.a } : { side: "left", choice: "B", text: q.b };
  const right: Side = q.aOnLeft ? { side: "right", choice: "B", text: q.b } : { side: "right", choice: "A", text: q.a };

  const choose = (s: Side) => {
    if (elapsed() < TAP_GUARD_MS) return;
    track("balance_answered", { question_no: q.n, position, choice: s.choice, side: s.side, elapsed_ms: elapsed(), is_edit: edit });
    onAnswer(s.choice);
  };
  const unsure = () => {
    track("balance_answered", { question_no: q.n, position, choice: "unsure", side: null, elapsed_ms: elapsed(), is_edit: edit });
    onAnswer("unsure");
  };
  const cancelled = (heldMs: number) => track("unsure_hold_cancelled", { question_no: q.n, position, held_ms: heldMs, is_edit: edit });

  return (
    <section className={styles.game} aria-labelledby="balance-question">
      <ol className={styles.progress} aria-hidden="true">
        {QUESTIONS.map((question, k) => (
          <li
            key={question.n}
            className={styles.cell}
            data-state={k < choices.length ? (choices[k] === "unsure" ? "unsure" : "done") : k === i ? "now" : undefined}
          />
        ))}
      </ol>
      <p className={styles.count}>{`${i + 1} / ${QUESTIONS.length}`}</p>
      <h1 id="balance-question" className={styles.question}>{q.text}</h1>
      <div className={styles.pair}>
        <ChoiceCard s={left} onChoose={choose} />
        <span className={styles.vs} aria-hidden="true">vs</span>
        <ChoiceCard s={right} onChoose={choose} />
      </div>
      <HoldButton key={q.n} label="갈피를 못 잡겠어요" hint={HOLD_HINT} onHold={unsure} onCancel={cancelled} />
    </section>
  );
}
