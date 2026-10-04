import { ART_KINDS, TIERS, artsForDraw, tierOf, KIND_TIERS, type ArtKind, type Tier } from "@/lib/art/combine";
import type { CollectionItem, CollectionStore, FoundItem } from "./types";

/**
 * The bookmark `index` of the signed draw (seed, count) was shown: the server works the picture out again — never the
 * one a browser sends — and records its parts. Returns the parts met for the first time, with their tier.
 */
export async function recordMeeting(store: CollectionStore, ticket: { seed: number; count: number }, index: number): Promise<FoundItem[]> {
  const art = artsForDraw(ticket.count, ticket.seed)[index];
  const fresh = await store.record(art);
  return fresh.flatMap((p) => {
    const tier = tierOf(p.kind, p.value);
    return tier ? [{ kind: p.kind, value: p.value, tier }] : [];
  });
}

/** 도감 tabs: animals, backgrounds, props (sky and ground props share one tab). */
export const DEX_TABS = ["animal", "bg", "prop"] as const;
export type DexTab = (typeof DEX_TABS)[number];
const KINDS_OF: Record<DexTab, readonly ArtKind[]> = { animal: ["animal"], bg: ["bg"], prop: ["sky", "ground"] };

export interface DexCell { kind: ArtKind; value: string; tier: Tier; met: CollectionItem | null }
export interface DexSection { tier: Tier; cells: DexCell[]; found: number }

/** The cells of one tab, by tier (일반판 → 한정판 → 초판본), each with the person's row when they met it. */
export function dexSections(tab: DexTab, items: readonly CollectionItem[]): DexSection[] {
  const met = new Map(items.map((i) => [`${i.kind}:${i.value}`, i]));
  return TIERS.map((tier) => {
    const cells = KINDS_OF[tab].flatMap((kind) => KIND_TIERS[kind][tier].map((value) => ({ kind, value, tier, met: met.get(`${kind}:${value}`) ?? null })));
    return { tier, cells, found: cells.filter((c) => c.met).length };
  });
}

/** "동물 n / 16 · 배경 n / 11 · 소품 n / 16": found and total per tab. */
export function dexCounts(items: readonly CollectionItem[]): Record<DexTab, { found: number; total: number }> {
  const count = (tab: DexTab) => dexSections(tab, items).reduce(
    (acc, s) => ({ found: acc.found + s.found, total: acc.total + s.cells.length }), { found: 0, total: 0 },
  );
  return { animal: count("animal"), bg: count("bg"), prop: count("prop") };
}

/** Rows that name a part we draw (a value dropped from the lists later is left out, not shown broken). */
export function knownItems(items: readonly CollectionItem[]): CollectionItem[] {
  return items.filter((i) => ART_KINDS.includes(i.kind) && tierOf(i.kind, i.value) !== null);
}
