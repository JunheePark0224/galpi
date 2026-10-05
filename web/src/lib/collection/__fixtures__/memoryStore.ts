import { collectibleParts } from "@/lib/art/combine";
import type { CollectionItem, CollectionStore } from "../types";

/** Kept claims shared by every person's store in a test, like the table (0007): seed:iat:index → who holds it. */
export type ClaimTable = Map<string, string>;

/**
 * In-memory CollectionStore for tests: one person's 도감, same rules as the table (one row per kind + value). `claims`
 * stands in for collection_kept_claims across people (0007 — one person per bookmark of a draw).
 */
export function memoryCollection(
  init: CollectionItem[] = [], now = () => "2026-10-05T03:00:00.000Z", who: { userId: string; claims: ClaimTable } = { userId: "me", claims: new Map() },
): CollectionStore & { data: { items: CollectionItem[] } } {
  const data = { items: [...init] };
  return {
    data,
    claimKept: async ({ seed, iat, index }) => {
      const key = `${seed}:${iat}:${index}`;
      const holder = who.claims.get(key);
      if (holder === undefined) who.claims.set(key, who.userId);
      return (holder ?? who.userId) === who.userId;
    },
    items: async () => [...data.items],
    record: async (art) => {
      const fresh = collectibleParts(art).filter((p) => !data.items.some((i) => i.kind === p.kind && i.value === p.value));
      data.items = [...data.items, ...fresh.map((p) => ({ ...p, firstMetAt: now(), firstArt: art, isNew: true }))];
      return fresh;
    },
    markSeen: async () => {
      const changed = data.items.filter((i) => i.isNew).length;
      data.items = data.items.map((i) => ({ ...i, isNew: false }));
      return changed;
    },
  };
}
