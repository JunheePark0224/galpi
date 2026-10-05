import { ART_KINDS, EMPTY_GROUND, isRare, tierOf, type ArtCombo, type ArtKind } from "@/lib/art/combine";
import type { PropsOf } from "@/lib/track/schema";
import type { LibraryError } from "./service";
import type { LibraryStore } from "./types";

/** One part a person has in their 도감 (collection row: kind + value). */
export interface OwnedPart { kind: ArtKind; value: string }

const key = (kind: ArtKind, value: string) => `${kind}:${value}`;

/**
 * 책갈피 꾸미기 (PRD F-13·F-21): may this bookmark's picture use this part? Yes when it is in the person's 도감, when it
 * is the bookmark's own first picture's part (kept before a login, so maybe never recorded), or the empty ground
 * ("none" — drawn, never collected). The screen and the server use this same rule.
 */
export function partAllowed(kind: ArtKind, value: string, original: ArtCombo, owned: ReadonlySet<string>): boolean {
  return (kind === "ground" && value === EMPTY_GROUND) || original[kind] === value || owned.has(key(kind, value));
}

export function ownedSet(parts: readonly OwnedPart[]): Set<string> {
  return new Set(parts.map((p) => key(p.kind, p.value)));
}

/** The kinds of `art` the person may not use (empty = every part is allowed). */
export function forbiddenKinds(art: ArtCombo, original: ArtCombo, owned: ReadonlySet<string>): ArtKind[] {
  return ART_KINDS.filter((kind) => !partAllowed(kind, art[kind], original, owned));
}

/** The kinds whose value differs between two pictures, in ART_KINDS order. */
export function changedKinds(before: ArtCombo, after: ArtCombo): ArtKind[] {
  return ART_KINDS.filter((kind) => before[kind] !== after[kind]);
}

/** Same four parts (rare follows from them). */
export function sameArt(a: ArtCombo, b: ArtCombo): boolean {
  return changedKinds(a, b).length === 0;
}

/**
 * E-38 `bookmark_decorated` (taxonomy v1.6) for a picture the server saved: the parts that differ from the picture before,
 * their new tiers (same order), the new picture as E-07 sends it (`rare` from its parts), and whether it is the first one.
 */
export function decoratedProps(bookId: string, before: ArtCombo, after: ArtCombo, original: ArtCombo): PropsOf<"bookmark_decorated"> {
  const parts = changedKinds(before, after);
  const art = { animal: after.animal, bg: after.bg, sky: after.sky, ground: after.ground };
  return {
    book_id: bookId,
    parts_changed: parts,
    tiers_changed: parts.map((kind) => tierOf(kind, after[kind]) ?? "common"),
    art: { ...art, rare: isRare(art) },
    is_reset: sameArt(after, original),
  };
}

type DecorateResult = { ok: true; art: ArtCombo } | { ok: false; error: LibraryError };

/**
 * Saves a new picture on one of the person's bookmarks. `art` is already a known picture (parseArt); `rare` is worked out
 * again here from its parts. `owned` reads the person's 도감 (their session — RLS). Refused: the book is not saved
 * (missing), its first picture is unknown — 0005 not applied (unavailable), a part outside the rule above (forbidden).
 */
export async function decorateBookmark(
  store: LibraryStore, owned: () => Promise<readonly OwnedPart[]>, isbn: string, art: ArtCombo,
): Promise<DecorateResult> {
  const row = (await store.saves()).find((s) => s.isbn === isbn);
  if (!row) return { ok: false, error: "missing" };
  if (!row.originalArt) return { ok: false, error: "unavailable" };
  if (forbiddenKinds(art, row.originalArt, ownedSet(await owned())).length > 0) return { ok: false, error: "forbidden" };
  const parts = { animal: art.animal, bg: art.bg, sky: art.sky, ground: art.ground };
  const next: ArtCombo = { ...parts, rare: isRare(parts) };
  return (await store.updateArt(isbn, next)) ? { ok: true, art: next } : { ok: false, error: "missing" };
}
