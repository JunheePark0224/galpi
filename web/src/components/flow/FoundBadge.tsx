"use client";
import { useState } from "react";
import { highestTier } from "@/lib/art/combine";
import { KIND_WORDS, TIER_NAMES } from "@/lib/art/names";
import type { FoundItem } from "@/lib/collection/types";
import styles from "./FoundBadge.module.css";

/**
 * "처음 만난 동물!" — the words for the parts met for the first time: kinds joined in one line (동물·배경·소품, sky and
 * ground both 소품), the highest tier in front when it is 한정판 or 초판본 ("초판본 · 처음 만난 동물!").
 */
export function foundLabel(items: readonly FoundItem[]): string {
  const words = [...new Set(items.map((i) => KIND_WORDS[i.kind]))];
  const tier = highestTier(items.map((i) => i.tier));
  const head = tier === "common" ? "" : `${TIER_NAMES[tier]} · `;
  return `${head}처음 만난 ${words.join("·")}!`;
}

/**
 * 도감 v1 시안 ③ (user: not loud, gone after a moment): a small badge on the S-05 bookmark, about 2.5 s, then it fades.
 * Quieter for 일반판. The status region is there before the words arrive, so a screen reader hears them politely.
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
