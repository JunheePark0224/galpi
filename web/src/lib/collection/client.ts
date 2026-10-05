import { ART_KINDS, isCollectible, tierOf, type ArtKind } from "@/lib/art/combine";
import { libraryRequest } from "@/lib/library/client";
import { parseArt } from "@/lib/library/validate";
import type { FoundRequest } from "./meeting";
import { knownItems } from "./service";
import type { ArtTicket, CollectionItem, FoundItem } from "./types";

const isKind = (v: unknown): v is ArtKind => typeof v === "string" && (ART_KINDS as readonly string[]).includes(v);

/** The answer's new parts, kept only when they are parts we collect (the badge and E-36 trust nothing else — never "none"). */
export function parseFound(body: unknown): FoundItem[] {
  const list = (body as { found?: unknown } | null)?.found;
  if (!Array.isArray(list)) return [];
  return list.flatMap((x: { kind?: unknown; value?: unknown }) => {
    if (!isKind(x?.kind) || typeof x.value !== "string" || !isCollectible(x.kind, x.value)) return [];
    const tier = tierOf(x.kind, x.value);
    return tier ? [{ kind: x.kind, value: x.value, tier }] : [];
  });
}

/** S-05: bookmark `index` of a signed draw was shown to a logged-in person. The new parts, or [] (refused, offline, off). */
export async function reportMeeting(ticket: ArtTicket, index: number): Promise<FoundItem[]> {
  if (!ticket.sig) return [];
  const { seed, count, iat, sub, sig } = ticket;
  const answer = await libraryRequest("POST", "/api/collection/found", { seed, count, iat, sub, sig, index });
  return answer.ok ? parseFound(answer.body) : [];
}

/**
 * v1.7: a bookmark saved before logging in has just reached the account (lib/library/merge) — the 도감 records it now,
 * from its draw's ticket. The server takes it only for a logged-out draw of the last 7 days whose picture is that very
 * saved bookmark of this person (`kept`, `isbn`). The new parts, or [] (refused, offline, off).
 */
export async function reportKeptMeeting(meeting: FoundRequest, isbn: string): Promise<FoundItem[]> {
  const answer = await libraryRequest("POST", "/api/collection/found", { ...meeting, isbn, kept: true });
  return answer.ok ? parseFound(answer.body) : [];
}

export type CollectionLoad = { status: "ready"; items: CollectionItem[] } | { status: "login" } | { status: "error" };

/** The person's 도감 (GET /api/collection) — rows checked again here. */
export async function loadCollection(): Promise<CollectionLoad> {
  const answer = await libraryRequest("GET", "/api/collection");
  if (answer.status === 401) return { status: "login" };
  const list = (answer.body as { items?: unknown } | null)?.items;
  if (!answer.ok || !Array.isArray(list)) return { status: "error" };
  const items = list.flatMap((x: Record<string, unknown>): CollectionItem[] => {
    const art = parseArt(x?.firstArt);
    if (!art || !isKind(x.kind) || typeof x.value !== "string" || typeof x.firstMetAt !== "string") return [];
    return [{ kind: x.kind, value: x.value, firstMetAt: x.firstMetAt, firstArt: art, isNew: x.isNew === true }];
  });
  return { status: "ready", items: knownItems(items) };
}

/** NEW was shown once: clear it on the server (a failure only means NEW shows once more). */
export async function markCollectionSeen(): Promise<void> {
  await libraryRequest("POST", "/api/collection/seen");
}
