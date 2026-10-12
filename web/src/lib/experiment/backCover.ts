import { currentRound, ensureAnonId } from "@/lib/track/common";
import type { PropsOf } from "@/lib/track/schema";

/**
 * Back-cover experiment (10-12, report/README.md): A = today's 뒤표지 (the main button goes on to S-06); B = the same 뒤표지
 * where the 궁금해요 bookmarks stand out and open their book in a floating card. One person always sees one variant:
 * hash(experiment name + anonymous id) % 2 — no server, and the rule can be said in one sentence (원칙 2).
 */
export type BackCoverVariant = "A" | "B";
export const BACK_COVER_EXPERIMENT = "back_cover_pick";
/** localStorage key that pins a variant on this browser (screenshots, checking B on a phone). */
export const BACK_COVER_OVERRIDE = "galpi.exp.backCover";

/** FNV-1a (32-bit) of the experiment name and the id: stable across visits, about half and half across people. */
export function variantOf(anonId: string): BackCoverVariant {
  let h = 2166136261;
  for (const ch of `${BACK_COVER_EXPERIMENT}:${anonId}`) h = Math.imul(h ^ ch.charCodeAt(0), 16777619) >>> 0;
  return h % 2 === 0 ? "A" : "B";
}

export function backCoverVariant(): BackCoverVariant {
  try {
    const pinned = localStorage.getItem(BACK_COVER_OVERRIDE);
    if (pinned === "A" || pinned === "B") return pinned;
  } catch {
    // storage blocked: fall through to the hash
  }
  return variantOf(ensureAnonId());
}

/**
 * E-45 `experiment_exposed` (taxonomy v2.6): what to send when the 뒤표지 shuts — only with something 궁금해요, since with
 * none the two screens are the same. null = send nothing.
 */
export function backCoverExposure(variant: BackCoverVariant, curiousCount: number): PropsOf<"experiment_exposed"> | null {
  if (curiousCount <= 0) return null;
  return { experiment: BACK_COVER_EXPERIMENT, variant: variant === "B" ? "b" : "a" };
}

const PEEKED = "galpi.exp.peekedRound";
let peekedInMemory: number | null = null;   // storage blocked: remembered for this page load only

/**
 * B card: true the first time a 궁금해요 book opens in this analytics round (common `round`, sessionStorage) — E-09 then,
 * as entering S-06 does. Keyed on the round, not the draw: a draw id restarts after [처음으로], the round does not, and a
 * reload in the same round must not send E-09 again.
 */
export function firstPeekThisRound(): boolean {
  const round = currentRound();
  let last = peekedInMemory;
  try {
    const stored = window.sessionStorage.getItem(PEEKED);
    if (stored !== null) last = Number(stored);
  } catch { /* blocked */ }
  if (last === round) return false;
  peekedInMemory = round;
  try { window.sessionStorage.setItem(PEEKED, String(round)); } catch { /* blocked */ }
  return true;
}
