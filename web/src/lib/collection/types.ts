import type { ArtCombo, ArtKind, Tier } from "@/lib/art/combine";

/**
 * 도감 v1: the server's seed for one draw's pictures (artsForDraw(count, seed)) and its HMAC signature over seed and count.
 * `sig` is null when the server has no signing secret in production — the pictures still show, nothing is recorded.
 */
export interface ArtTicket { seed: number; count: number; sig: string | null }

/** One part met for the first time — what /api/collection/found returns and E-36 sends (no personal data). */
export interface FoundItem { kind: ArtKind; value: string; tier: Tier }

/** One row of the person's 도감: the part, when it was first met, the whole picture it was met in, NEW until seen. */
export interface CollectionItem { kind: ArtKind; value: string; firstMetAt: string; firstArt: ArtCombo; isNew: boolean }

/**
 * The person's 도감 rows (Supabase in production — reads with their session under RLS, writes by the server only;
 * memory in tests). Methods act for that one person only.
 */
export interface CollectionStore {
  items(): Promise<CollectionItem[]>;
  /** Records the picture's four parts; the ones already met stay as they were. Returns the parts that were new. */
  record(art: ArtCombo): Promise<{ kind: ArtKind; value: string }[]>;
  /** Clears NEW on every row (the 도감 was seen). How many rows changed. */
  markSeen(): Promise<number>;
}

/** The table is not there yet (the migration was not applied): the 도감 says it cannot load, the site goes on. */
export class CollectionUnavailable extends Error {
  constructor() {
    super("collection table is missing");
    this.name = "CollectionUnavailable";
  }
}
