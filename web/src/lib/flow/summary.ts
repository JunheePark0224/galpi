import {
  AXES, AXIS_LABEL, EXHAUSTED_NOTICE, WAY_LABEL, coverageNotice, type AxisKey, type BalanceChoice, type Entry,
} from "@/lib/recommend";
import { TOPIC_CHIPS } from "@/lib/books/taxonomy";
import type { GoalMatch } from "@/lib/goal/match";
import { understoodOf } from "@/lib/goal/understood";
import type { DrawView } from "./state";
import { LEN_CHIPS, type TargetForm } from "./target";

/** target-chips.md 1절: an empty field means 상관없음. */
export const ANY = "상관없음";

export interface TasteLine { axis: AxisKey; text: string; strength: 0 | 1 | 2 }

/**
 * balance-game.md 2절 — built from the raw answers (question i and i + 4 share an axis), never from LeafAnswers:
 * same side twice → "확실히 X" (●●), one side + 못 잡겠어요 → "X" (●○), split or both unsure → "X · Y 둘 다 좋아요" (○○).
 */
export function tasteLines(choices: readonly BalanceChoice[]): TasteLine[] {
  return AXES.map((axis, i) => {
    const [a, b] = AXIS_LABEL[axis];
    const first = choices[i] ?? "unsure";
    const second = choices[i + 4] ?? "unsure";
    const word = (c: BalanceChoice) => (c === "A" ? a : b);
    if (first === second && first !== "unsure") return { axis, text: `확실히 ${word(first)}`, strength: 2 };
    if (first === "unsure" && second !== "unsure") return { axis, text: word(second), strength: 1 };
    if (second === "unsure" && first !== "unsure") return { axis, text: word(first), strength: 1 };
    return { axis, text: `${a} · ${b} 둘 다 좋아요`, strength: 0 };
  });
}

export function lengthWord(choice: BalanceChoice | undefined): string {
  if (choice === "A") return "얇게";
  if (choice === "B") return "두껍게";
  return ANY;
}

export function targetSummary(f: TargetForm, goal: GoalMatch | null): { label: string; value: string }[] {
  const what = goal ? `“${goal.text}”` : (TOPIC_CHIPS.find((c) => c.topic === f.topic)?.label ?? ANY);
  return [
    { label: "무엇을", value: what },
    { label: "분량", value: LEN_CHIPS.find((c) => c.value === f.len)?.label ?? ANY },
    { label: "읽는 방식", value: f.way ? WAY_LABEL[f.way] : ANY },
  ];
}

/**
 * F-24 ①+: target-chips.md 3절's honest count, as a line under the 이렇게 이해했어요 path — only when a keyword was
 * understood (①) and the draw is back. ② and ③ say what is missing in the block itself.
 */
export function coverageNote(entry: Entry | null, goal: GoalMatch | null, draw: DrawView | null): string | null {
  if (entry !== "target" || !goal || understoodOf(goal) !== "keyword" || !draw || draw.found === null) return null;
  return coverageNotice(draw.found, draw.keywords[0] ?? goal.keywords[0], goal.topic);
}

/**
 * C-14 slips on the first page: the exhausted note (book-pool.md ⑧, 🎯 only, or any empty draw) — never in the same round
 * as a coverage line.
 */
export function firstPageNotices(entry: Entry | null, goal: GoalMatch | null, draw: DrawView | null): string[] {
  if (coverageNote(entry, goal, draw)) return [];
  if (draw && (draw.picks.length === 0 || (entry === "target" && draw.exhausted))) return [EXHAUSTED_NOTICE];
  return [];
}

/** PRD E-22 buckets. */
export function coverageBucket(found: number): "0" | "1-3" | "4+" {
  if (found <= 0) return "0";
  return found < 4 ? "1-3" : "4+";
}

/** E-06 items for 🍃: question numbers whose answer changed. */
export function editedQuestions(before: readonly BalanceChoice[], after: readonly BalanceChoice[]): string[] {
  return after.flatMap((c, i) => (c !== before[i] ? [`q${i + 1}`] : []));
}

/** E-06 changed_items for 🎯: "topic" (the 무엇을 field — chosen topic before 입력 B, its text since), "len", "way". */
export function editedTargetFields(before: TargetForm, after: TargetForm): string[] {
  const what = before.topic !== after.topic || (before.free === null) !== (after.free === null)
    || (before.free ?? "").trim() !== (after.free ?? "").trim();
  return [
    ...(what ? ["topic"] : []),
    ...(before.len !== after.len ? ["len"] : []),
    ...(before.way !== after.way ? ["way"] : []),
  ];
}
