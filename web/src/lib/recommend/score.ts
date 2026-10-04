import { lengthTag } from "./length";
import { AXES, type LeafAnswers, type LeafBook, type TargetAnswers, type TargetBook } from "./types";

export function leafScore(b: LeafBook, a: LeafAnswers): number {
  let s = a.len * lengthTag(b.pages);
  for (const axis of AXES) s += a[axis] * b.axes[axis];
  return s;
}

export function maxPossibleLeaf(a: LeafAnswers): number {
  return AXES.reduce((sum, axis) => sum + Math.abs(a[axis]), Math.abs(a.len));
}

export function lengthPoints(pages: number, len: TargetAnswers["len"]): number {
  if (len === 1) return pages <= 250 ? 2 : pages >= 400 ? -1 : 0;   // 얇게
  if (len === -1) return pages >= 300 ? 1 : 0;                        // 두꺼워도 좋아요
  return 0;                                                            // 보통 / 고르지 않음
}

export function targetScore(b: TargetBook, a: TargetAnswers): number | null {
  if (b.topic !== a.topic) return null;
  let s = 3 * a.keywords.filter((k) => b.keywords.includes(k)).length;
  if (a.way && b.way === a.way) s += 2;
  return s + lengthPoints(b.pages, a.len);
}

export function maxPossibleTarget(a: TargetAnswers): number {
  return 3 * a.keywords.length + (a.way ? 2 : 0) + (a.len === 1 ? 2 : a.len === -1 ? 1 : 0);
}
