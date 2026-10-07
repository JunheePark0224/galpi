import { ANIMALS, BACKGROUNDS, EMPTY_GROUND, GROUND_PROPS, isRare, type ArtCombo } from "@/lib/art/combine";
import type { Reason } from "@/lib/recommend";

/** PRD F-13: a rod's name, the person's own words — at most this many characters (DB check matches, 0003). */
export const SHELF_NAME_MAX = 12;
/** The ground prop that left the lists (10-07 A — it became the 여름밤 background). */
const RETIRED_GROUND = "firefly";
const REASON_LABELS = ["나온 이유", "이 책은"] as const;
const REASON_ITEMS_MAX = 5;
const REASON_ITEM_MAX = 40;

const isRecord = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null && !Array.isArray(v);
const oneOf = <T extends string>(list: readonly T[], v: unknown): v is T => typeof v === "string" && (list as readonly string[]).includes(v);

/**
 * The saved picture (D-05), rebuilt from known parts only — never the object the browser sent. 도감 v1: the 한정판·초판본
 * values are known parts too, and `rare` is worked out from the parts (an old picture saved before them stays valid — its
 * parts are all 일반판 and its `rare` was false). 10-07 A (three parts): any other key — the old `sky` prop — is dropped,
 * and the retired ground "firefly" (now the 여름밤 background) reads as the empty ground, so a picture a browser kept
 * from before still opens.
 */
export function parseArt(v: unknown): ArtCombo | null {
  if (!isRecord(v)) return null;
  const { animal, bg, rare } = v;
  const ground = v.ground === RETIRED_GROUND ? EMPTY_GROUND : v.ground;
  if (!oneOf(ANIMALS, animal) || !oneOf(Object.keys(BACKGROUNDS) as (keyof typeof BACKGROUNDS)[], bg)
    || !oneOf(GROUND_PROPS, ground) || (rare !== undefined && typeof rare !== "boolean")) return null;
  const parts = { animal, bg, ground };
  return { ...parts, rare: isRare(parts) };
}

/** 나온 이유 at the time of saving (S-06 back face): our label, a few short plain items. */
export function parseReason(v: unknown): Reason | null {
  if (!isRecord(v) || !oneOf(REASON_LABELS, v.label) || !Array.isArray(v.items) || v.items.length > REASON_ITEMS_MAX) return null;
  const items: string[] = [];
  for (const item of v.items) {
    if (typeof item !== "string" || item.length > REASON_ITEM_MAX || /[<>]/.test(item)) return null;
    items.push(item);
  }
  return { label: v.label, items };
}

/** 만난 날 — a real calendar date, not after today (both Korean dates). */
export function parseMetOn(v: unknown, today: string): string | null {
  if (typeof v !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(v) || v > today) return null;
  const d = new Date(`${v}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === v ? v : null;
}

/**
 * A rod name as stored: control and invisible format characters and angle brackets out, spaces joined, trimmed.
 * null when empty or longer than SHELF_NAME_MAX characters (code points, so an emoji counts once).
 */
export function cleanShelfName(v: unknown): string | null {
  if (typeof v !== "string") return null;
  const name = v.normalize("NFC").replace(/[\p{Cc}\p{Cf}<>]/gu, "").replace(/\s+/g, " ").trim();
  if (!name || [...name].length > SHELF_NAME_MAX) return null;
  return name;
}
