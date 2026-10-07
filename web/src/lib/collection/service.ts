import { DEX_TIERS, TIERS, artsForDraw, isCollectible, tierOf, type ArtKind, type Tier } from "@/lib/art/combine";
import type { CollectionItem, CollectionStore, FoundItem } from "./types";

/**
 * The bookmark `index` of the signed draw (seed, count) was shown: the server works the picture out again — never the
 * one a browser sends — and records its collectible parts (not the empty ground). Returns the parts met for the first
 * time, with their tier.
 */
export async function recordMeeting(store: CollectionStore, ticket: { seed: number; count: number }, index: number): Promise<FoundItem[]> {
  const art = artsForDraw(ticket.count, ticket.seed)[index];
  const fresh = await store.record(art);
  return fresh.flatMap((p) => {
    const tier = isCollectible(p.kind, p.value) ? tierOf(p.kind, p.value) : null;
    return tier ? [{ kind: p.kind, value: p.value, tier }] : [];
  });
}

/** 도감 tabs: animals, backgrounds, props (the ground props — 10-07 A: there are no sky props). */
export const DEX_TABS = ["animal", "bg", "prop"] as const;
export type DexTab = (typeof DEX_TABS)[number];
const KINDS_OF: Record<DexTab, readonly ArtKind[]> = { animal: ["animal"], bg: ["bg"], prop: ["ground"] };

export interface DexCell { kind: ArtKind; value: string; tier: Tier; met: CollectionItem | null }
export interface DexSection { tier: Tier; cells: DexCell[]; found: number }

/** The cells of one tab, by tier (일반판 → 한정판 → 초판본), each with the person's row when they met it. */
export function dexSections(tab: DexTab, items: readonly CollectionItem[]): DexSection[] {
  const met = new Map(items.map((i) => [`${i.kind}:${i.value}`, i]));
  return TIERS.map((tier) => {
    const cells = KINDS_OF[tab].flatMap((kind) => DEX_TIERS[kind][tier].map((value) => ({ kind, value, tier, met: met.get(`${kind}:${value}`) ?? null })));
    return { tier, cells, found: cells.filter((c) => c.met).length };
  });
}

/** "동물 n / 16 · 배경 n / 12 · 소품 n / 6": found and total per tab. */
export function dexCounts(items: readonly CollectionItem[]): Record<DexTab, { found: number; total: number }> {
  const count = (tab: DexTab) => dexSections(tab, items).reduce(
    (acc, s) => ({ found: acc.found + s.found, total: acc.total + s.cells.length }), { found: 0, total: 0 },
  );
  return { animal: count("animal"), bg: count("bg"), prop: count("prop") };
}

/**
 * Rows that name a part we collect: a value dropped from the lists later is left out (not shown broken), and so are the
 * "none" ground rows recorded before the 10-05 fix and any sky row from before 10-07 A (0008 deletes those for launch).
 */
export function knownItems(items: readonly CollectionItem[]): CollectionItem[] {
  return items.filter((i) => isCollectible(i.kind, i.value));
}
