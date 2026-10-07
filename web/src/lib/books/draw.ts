import { drawForPath, pathReason, pathSummary, QUESTION_MAP, walkPath, type Answer, type QuestionMap } from "@/lib/paths";
import type { Rng } from "@/lib/recommend";
import { shareLabel } from "@/lib/share/label";
import { toBook, toCard } from "./catalog";
import type { CatalogBook, PathDrawResponse } from "./types";

/**
 * v2: answers of the question map → five bookmarks (lib/paths drawForPath). The answers must be a finished path —
 * parseDrawRequest checks that before this runs. Reasons come from the walk the books were drawn for (after the challenge
 * flip: its far scope and mood).
 */
export function drawPath(answers: Answer[], seen: ReadonlySet<string>, rng: Rng, books: CatalogBook[], map: QuestionMap = QUESTION_MAP): PathDrawResponse {
  const walked = walkPath(map, answers);
  const all = books.map(toBook);
  const res = drawForPath(all, map, walked, { seen, rng });
  const byId = new Map(books.map((b) => [b.isbn, b]));
  return {
    picks: res.picks.map((p) => ({ card: toCard(byId.get(p.book.id) as CatalogBook), kind: p.kind, reason: pathReason(p.book, res.drawnFrom) })),
    exhausted: res.exhausted,
    widened: res.widened || res.widenedScope,
    path: pathSummary(map, answers),
    challenge: res.drawnFrom.challenge ?? null,
    // F-27 (10-07): the 뒤표지 label — worked out here, where the tags are (the browser gets no tags)
    label: shareLabel(map, answers, res.picks.map((p) => p.book)),
  };
}
