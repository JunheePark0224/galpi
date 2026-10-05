import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { artsForDraw, newArtSeed, type ArtCombo } from "@/lib/art/combine";
import { parseFoundRequest } from "@/lib/collection/meeting";
import { supabaseCollection } from "@/lib/collection/supabaseStore";
import { signingSecret, verifyTicket } from "@/lib/collection/ticket";
import { CollectionUnavailable } from "@/lib/collection/types";

/** A picture the server chose (no proof of which bookmark this was): never the one the browser sent. */
const serverPicture = (): ArtCombo => artsForDraw(1, newArtSeed())[0];

/**
 * The picture a new bookmark is saved with (F-12, v1.7.1 security review — the browser's art is never trusted while
 * signing is on). `ticket`: the draw's signed ticket (v3) and the bookmark's place in it, from S-06 or a guest bookmark.
 * - signing off (production without the secret): the sent picture, as before.
 * - no ticket (a guest bookmark kept before this fix): a picture the server chose.
 * - a ticket that holds — this server's signature, `isbns[index]` is this book, the draw was this person's (sub) or
 *   logged out (sub null — then claimed for this person, 0007; another person's claim does not hold): the bookmark's own
 *   picture, worked out from the seed. No age limit: an honest person saving later never loses their picture.
 * - one that does not hold: the bookmark is still saved (nothing is lost), with a picture the server chose.
 * null: the ticket is not a ticket at all (a broken body — 400).
 */
export async function savedArt(
  sent: ArtCombo, ticket: unknown, isbn: string, who: { db: SupabaseClient; userId: string },
): Promise<ArtCombo | null> {
  const secret = signingSecret();
  if (!secret) return sent;
  if (ticket === undefined) return serverPicture();
  const proof = parseFoundRequest(ticket);
  if (!proof) return null;
  if (!verifyTicket(proof, secret) || proof.isbns[proof.index] !== isbn) return serverPicture();
  if (proof.sub !== null && proof.sub !== who.userId) return serverPicture();
  const drawn = artsForDraw(proof.count, proof.seed)[proof.index];
  if (proof.sub !== null) return drawn;
  try {
    const mine = await supabaseCollection(who.db, null, who.userId).claimKept({ seed: proof.seed, iat: proof.iat, index: proof.index });
    return mine ? drawn : serverPicture();
  } catch (err) {
    if (err instanceof CollectionUnavailable) return drawn;      // 0007 not applied yet: the signature still proves the picture
    throw err;
  }
}
