import type { Topic } from "@/lib/books/taxonomy";
import { GOAL_MAX, type GoalMatch } from "@/lib/goal/match";

/** An S-02 🎯 example chip: tapping it fills the 무엇을 field with `text`; sent untouched it means `topic` + `keywords`. */
export interface ExampleChip { readonly text: string; readonly topic: Topic; readonly keywords: readonly string[] }

/**
 * PRD F-02 / context 10-01 (입력 B안): six fixed examples under the field. Each is decided here — no Claude call — and its
 * keywords come from the topic's closed list in vocab.json. Which six to show may later follow the data (F-02).
 */
export const EXAMPLE_CHIPS: readonly ExampleChip[] = [
  { text: "돈 관리", topic: "돈 관리·투자", keywords: [] },
  { text: "취업 준비", topic: "취업·커리어", keywords: ["자소서·면접"] },
  { text: "불안할 때", topic: "마음 돌보기", keywords: [] },
  { text: "데이터 분석", topic: "데이터 분석", keywords: [] },
  { text: "AI 잘 쓰기", topic: "AI 활용", keywords: [] },
  { text: "글 잘 쓰기", topic: "글쓰기", keywords: [] },
];

/** The examples whose topic is active (lib/books/active.ts) — a chip for a topic with too few books is never shown. */
export function shownExamples(active: readonly Topic[]): ExampleChip[] {
  return EXAMPLE_CHIPS.filter((c) => active.includes(c.topic));
}

/** The fixed match when `text` is exactly a shown example (spaces at the ends aside); anything else is a written goal → null. */
export function exampleGoal(text: string, active: readonly Topic[]): GoalMatch | null {
  const trimmed = text.trim().slice(0, GOAL_MAX);
  const chip = shownExamples(active).find((c) => c.text === trimmed);
  return chip ? { text: chip.text, topic: chip.topic, keywords: [...chip.keywords], matched: true, missing: null, method: "example" } : null;
}
