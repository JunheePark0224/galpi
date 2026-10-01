import { WAY_LABEL, type Tag, type TargetAnswers, type Way } from "@/lib/recommend";
import { TOPIC_CHIPS, type Topic } from "@/lib/books/taxonomy";
import type { GoalMatch } from "@/lib/goal/match";
import type { PropsOf } from "@/lib/track/schema";

export type LenChoice = "thin" | "normal" | "thick";

/** S-02 🎯 inputs. free !== null means 직접 쓰기 (then topic is null). Empty optional fields mean 상관없음. */
export interface TargetForm { topic: Topic | null; free: string | null; len: LenChoice | null; way: Way | null }

export const EMPTY_FORM: TargetForm = { topic: null, free: null, len: null, way: null };

/** docs/target-chips.md 1절 — labels verbatim. */
export const LEN_CHIPS: readonly { value: LenChoice; label: string; tag: Tag }[] = [
  { value: "thin", label: "얇게", tag: 1 },
  { value: "normal", label: "보통", tag: 0 },
  { value: "thick", label: "두꺼워도 좋아요", tag: -1 },
];
export const WAY_CHIPS: readonly { value: Way; label: string }[] = [
  { value: "개념", label: WAY_LABEL.개념 },
  { value: "실습", label: `${WAY_LABEL.실습} (바로 써먹기)` },
  { value: "사례", label: WAY_LABEL.사례 },
];
export const FREE_PLACEHOLDER = "SQL, 엑셀 함수, 번아웃, 발표 준비 …";

export function formReady(f: TargetForm): boolean {
  return f.free !== null ? f.free.trim().length > 0 : f.topic !== null;
}

export function targetAnswersFrom(f: TargetForm, goal: GoalMatch | null): TargetAnswers {
  return {
    topic: goal?.topic ?? f.topic ?? TOPIC_CHIPS[0].topic,
    way: f.way,
    len: LEN_CHIPS.find((c) => c.value === f.len)?.tag ?? 0,
    keywords: goal?.keywords ?? [],
  };
}

/** E-26 goal_submitted: the 🎯 form passed its check. topic = the chosen key, or the one the written goal matched. */
export function goalSubmittedProps(f: TargetForm, goal: GoalMatch | null, isEdit: boolean): PropsOf<"goal_submitted"> {
  return { topic: targetAnswersFrom(f, goal).topic, is_free_text: f.free !== null, len: f.len, way: f.way, is_edit: isEdit };
}
