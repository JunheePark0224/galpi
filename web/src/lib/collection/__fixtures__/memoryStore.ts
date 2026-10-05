import { collectibleParts } from "@/lib/art/combine";
import type { CollectionItem, CollectionStore } from "../types";

/** In-memory CollectionStore for tests: one person's 도감, same rules as the table (one row per kind + value). */
export function memoryCollection(init: CollectionItem[] = [], now = () => "2026-10-05T03:00:00.000Z"): CollectionStore & { data: { items: CollectionItem[] } } {
  const data = { items: [...init] };
  return {
    data,
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
