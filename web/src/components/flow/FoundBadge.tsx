"use client";
import { useState } from "react";
import { ART_KINDS, TIER_RANK, highestTier } from "@/lib/art/combine";
import { TIER_NAMES, partName } from "@/lib/art/names";
import type { FoundItem } from "@/lib/collection/types";
import styles from "./FoundBadge.module.css";

/** At most this many parts are named; past it (or past MAX_CHARS) the rarest is named and the rest counted ("외 2개"). */
const MAX_NAMED = 2;
/** One line on a 320px phone: 22 characters of the 13px badge stay under about 270px. */
export const MAX_CHARS = 22;

/** Rarest first (초판본 → 한정판 → 일반판), then 동물 · 배경 · 하늘 · 땅. */
export function rarestFirst(items: readonly FoundItem[]): FoundItem[] {
  const order = (i: FoundItem) => TIER_RANK[i.tier] * -10 + ART_KINDS.indexOf(i.kind);
  return [...items].sort((a, b) => order(a) - order(b));
}

/** "여우", "한정판 무지개", "초판본 청룡" — the tier only when it is above 일반판, and only on that part. */
function partWords(item: FoundItem): string {
  const name = partName(item.kind, item.value);
  return item.tier === "common" ? name : `${TIER_NAMES[item.tier]} ${name}`;
}

/**
 * "처음 만난 여우 · 한정판 무지개!" — each new part by name, its tier in front only when it is 한정판 or 초판본 (10-05 fix:
 * the highest tier no longer stands in front of everything, so a common animal never reads as 한정판). More than two parts,
 * or a line too long for a small phone: the rarest one and "외 n개" ("처음 만난 초판본 청룡 외 3개!").
 */
export function foundLabel(items: readonly FoundItem[]): string {
  const sorted = rarestFirst(items);
  if (sorted.length === 0) return "";
  const named = `처음 만난 ${sorted.map(partWords).join(" · ")}!`;
  if (sorted.length === 1 || (sorted.length <= MAX_NAMED && named.length <= MAX_CHARS)) return named;
  return `처음 만난 ${partWords(sorted[0])} 외 ${sorted.length - 1}개!`;
}

/**
 * 도감 v1 시안 ③ (user: not loud, gone after a moment): a small badge on the S-05 bookmark, about 2.5 s, then it fades.
 * Its colour follows the rarest new part; quieter when every new part is 일반판. The status region is there before the
 * words arrive, so a screen reader hears them politely.
 */
export function FoundBadge({ items }: { items: readonly FoundItem[] | null }) {
  const [gone, setGone] = useState(false);
  const show = items && items.length > 0 && !gone;
  return (
    <div className={styles.region} role="status">
      {show && (
        <p className={styles.badge} data-tier={highestTier(items.map((i) => i.tier))} onAnimationEnd={() => setGone(true)}>
          {foundLabel(items)}
        </p>
      )}
    </div>
  );
}
