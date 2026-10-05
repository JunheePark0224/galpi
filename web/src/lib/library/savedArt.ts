import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { artsForDraw, newArtSeed, type ArtCombo } from "@/lib/art/combine";
import { parseFoundRequest } from "@/lib/collection/meeting";
import { recordMeeting } from "@/lib/collection/service";
import { collectionWriter, supabaseCollection } from "@/lib/collection/supabaseStore";
import { signingSecret, verifyTicket } from "@/lib/collection/ticket";
import { CollectionUnavailable, type FoundItem } from "@/lib/collection/types";

/** A picture the server chose (no proof of which bookmark this was): never the one the browser sent. */
const serverPicture = (): ArtCombo => artsForDraw(1, newArtSeed())[0];

/** The picture to store, and the 도감 parts recorded for it now (new ones — for E-36). */
export interface SavedArt { art: ArtCombo; found: FoundItem[] }
const only = (art: ArtCombo): SavedArt => ({ art, found: [] });

/**
 * The picture a new bookmark is saved with (F-12, v1.7.1 security review — the browser's art is never trusted while
 * signing is on). `ticket`: the draw's signed ticket (v3) and the bookmark's place in it, from S-06 or a guest bookmark.
 * - signing off (production without the secret): the sent picture, as before.
 * - no ticket (a guest bookmark kept before this fix): a picture the server chose.
 * - a ticket that holds — this server's signature, `isbns[index]` is this book, the draw was this person's (sub) or
 *   logged out (sub null — then claimed for this person, 0007; another person's claim does not hold): the bookmark's own
 *   picture, worked out from the seed. No age limit: an honest person saving later never loses their picture. A logged-out
 *   draw's parts are recorded in the 도감 here too (S-05 recorded the person's own draws) — not while 0007 is missing.
 * - one that does not hold: the bookmark is still saved (nothing is lost), with a picture the server chose.
 * null: the ticket is not a ticket at all (a broken body — 400).
 */
export async function savedArt(
  sent: ArtCombo, ticket: unknown, isbn: string, who: { db: SupabaseClient; userId: string },
): Promise<SavedArt | null> {
  const secret = signingSecret();
  if (!secret) return only(sent);
  if (ticket === undefined) return only(serverPicture());
  const proof = parseFoundRequest(ticket);
  if (!proof) return null;
  if (!verifyTicket(proof, secret) || proof.isbns[proof.index] !== isbn) return only(serverPicture());
  if (proof.sub !== null && proof.sub !== who.userId) return only(serverPicture());
  const drawn = artsForDraw(proof.count, proof.seed)[proof.index];
  if (proof.sub !== null) return only(drawn);
  const dex = supabaseCollection(who.db, collectionWriter(), who.userId);
  let mine: boolean;
  try {
    mine = await dex.claimKept({ seed: proof.seed, iat: proof.iat, index: proof.index });
  } catch (err) {
    if (err instanceof CollectionUnavailable) return only(drawn);   // 0007 not applied: the signature proves the picture, no 도감
    throw err;
  }
  if (!mine) return only(serverPicture());
  if (!collectionWriter()) return only(drawn);                         // no service key: the 도감 waits (merge retries /found)
  return { art: drawn, found: await recordMeeting(dex, proof, proof.index) };
}
