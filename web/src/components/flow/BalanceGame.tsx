"use client";
import { useEffect, useRef } from "react";
import type { BalanceChoice } from "@/lib/recommend";
import { QUESTIONS } from "@/lib/flow/questions";
import { track } from "@/lib/track/client";
import { HoldButton } from "./HoldButton";
import styles from "./BalanceGame.module.css";

interface Props {
  choices: readonly BalanceChoice[];
  edit: boolean;
  onAnswer: (choice: BalanceChoice) => void;
}

type Side = { side: "left" | "right"; choice: "A" | "B"; text: string };

/** S-02 🍃 (C-07): nine two-way questions, tap to go on; the second question of each axis swaps sides. */
export function BalanceGame({ choices, edit, onAnswer }: Props) {
  const i = Math.min(choices.length, QUESTIONS.length - 1);
  const q = QUESTIONS[i];
  const shownAt = useRef(0);
  useEffect(() => { shownAt.current = performance.now(); }, [i]);
  const elapsed = () => Math.round(performance.now() - shownAt.current);

  const left: Side = q.aOnLeft ? { side: "left", choice: "A", text: q.a } : { side: "left", choice: "B", text: q.b };
  const right: Side = q.aOnLeft ? { side: "right", choice: "B", text: q.b } : { side: "right", choice: "A", text: q.a };

  const choose = (s: Side) => {
    track("balance_answered", { question: q.n, choice: s.choice, side: s.side, ms: elapsed(), edit });
    onAnswer(s.choice);
  };
  const unsure = () => {
    track("balance_answered", { question: q.n, choice: "unsure", side: null, ms: elapsed(), edit });
    onAnswer("unsure");
  };
  const cancelled = (heldMs: number) => track("unsure_hold_cancelled", { question: q.n, held_ms: heldMs, edit });

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
        <button type="button" className={styles.card} data-side="left" onClick={() => choose(left)}>{left.text}</button>
        <span className={styles.vs} aria-hidden="true">vs</span>
        <button type="button" className={styles.card} data-side="right" onClick={() => choose(right)}>{right.text}</button>
      </div>
      <HoldButton key={q.n} label="갈피를 못 잡겠어요" onHold={unsure} onCancel={cancelled} />
    </section>
  );
}
