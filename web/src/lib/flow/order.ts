import type { BalanceChoice, Rng } from "@/lib/recommend";
import { QUESTIONS } from "./questions";

/** Question indices (0-based: QUESTIONS[i] is question i + 1) in the table's order — flows saved before 10-02, tests. */
export const IDENTITY_ORDER: readonly number[] = QUESTIONS.map((_, i) => i);

/** Questions 1–4 and 5–8 ask the same four axes (balance-game.md 2절); 9 (분량) has no pair. */
const sameAxis = (a: number, b: number) => a < 8 && b < 8 && a % 4 === b % 4;
const MAX_TRIES = 200;

/**
 * The order the nine questions are shown in, new every pass (PRD F-03, 10-02): a shuffle where the two questions of an
 * axis never come one right after the other (balance-game.md 2절 — so the second answer does not just copy the first).
 * Sides stay with each question (5–8 put A on the right), so the two of an axis still differ in sides.
 */
export function questionOrder(rng: Rng): number[] {
  for (let t = 0; t < MAX_TRIES; t++) {
    const order = [...IDENTITY_ORDER];
    for (let i = order.length - 1; i > 0; i--) {
      const j = Math.floor(rng() * (i + 1));
      [order[i], order[j]] = [order[j], order[i]];
    }
    if (order.every((q, k) => k === 0 || !sameAxis(order[k - 1], q))) return order;
  }
  return [0, 1, 2, 3, 8, 4, 5, 6, 7];   // never reached in practice (most shuffles pass); still a valid order
}

/** Answers given in `order` → answers by question number (what scoring, the first page and E-06 read). */
export function inQuestionOrder(order: readonly number[], shown: readonly BalanceChoice[]): BalanceChoice[] {
  const byQuestion: BalanceChoice[] = [...IDENTITY_ORDER.map(() => "unsure" as BalanceChoice)];
  order.forEach((question, k) => { if (k < shown.length) byQuestion[question] = shown[k]; });
  return byQuestion;
}
