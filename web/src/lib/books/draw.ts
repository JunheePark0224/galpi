import { applyChallenge, drawForPath, pathReason, pathSummary, QUESTION_MAP, walkPath, type Answer, type QuestionMap } from "@/lib/paths";
import type { Rng } from "@/lib/recommend";
import { toBook, toCard } from "./catalog";
import type { CatalogBook, PathDrawResponse } from "./types";

/**
 * v2: answers of the question map → five bookmarks (lib/paths drawForPath). The answers must be a finished path —
 * parseDrawRequest checks that before this runs. Reasons come from the scope the books were drawn from (after the
 * challenge flip) and the person's mood.
 */
export function drawPath(answers: Answer[], seen: ReadonlySet<string>, rng: Rng, books: CatalogBook[], map: QuestionMap = QUESTION_MAP): PathDrawResponse {
  const walked = walkPath(map, answers);
  const res = drawForPath(books.map(toBook), map, walked, { seen, rng });
  const drawnFrom = applyChallenge(map, walked);
  const byId = new Map(books.map((b) => [b.isbn, b]));
  return {
    picks: res.picks.map((p) => ({ card: toCard(byId.get(p.book.id) as CatalogBook), kind: p.kind, reason: pathReason(p.book, drawnFrom) })),
    exhausted: res.exhausted,
    widened: res.widened || res.widenedScope,
    path: pathSummary(map, answers),
  };
}
