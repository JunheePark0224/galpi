import {
  drawBookmarks, leafAnswersFrom, leafScore, maxPossibleLeaf, maxPossibleTarget, reasonLine, targetScore, LEAF_PARAMS, TARGET_PARAMS,
  type BalanceChoice, type DrawResult, type LeafAnswers, type Rng, type TargetAnswers,
} from "@/lib/recommend";
import { applyChallenge, drawForPath, pathReason, pathSummary, QUESTION_MAP, walkPath, type Answer, type QuestionMap } from "@/lib/paths";
import { toBook, toCard } from "./catalog";
import { FIELD_OF_TOPIC, type Topic } from "./taxonomy";
import type { CatalogBook, DrawResponse, PathDrawResponse } from "./types";

function respond(
  res: DrawResult, pool: CatalogBook[], answers: LeafAnswers | TargetAnswers, extra: Pick<DrawResponse, "found" | "keywords">,
): DrawResponse {
  const byId = new Map(pool.map((b) => [b.isbn, b]));
  return {
    picks: res.picks.map((p) => ({ card: toCard(byId.get(p.book.id) as CatalogBook), kind: p.kind, reason: reasonLine(p.book, answers) })),
    exhausted: res.exhausted,
    widened: res.widened,
    ...extra,
  };
}

/** 🍃: balance answers → axis scores; the random slot comes from every 🍃 book (book-pool.md ⑦). */
export function drawLeaf(choices: BalanceChoice[], seen: ReadonlySet<string>, rng: Rng, books: CatalogBook[]): DrawResponse {
  const pool = books.filter((b) => b.entry === "leaf");
  const answers = leafAnswersFrom(choices);
  const res = drawBookmarks(
    pool.map(toBook),
    { score: (b) => (b.entry === "leaf" ? leafScore(b, answers) : null), maxPossible: maxPossibleLeaf(answers) },
    { ...LEAF_PARAMS, seen, rng, inRandomPool: (b) => b.entry === "leaf" },
  );
  return respond(res, pool, answers, { found: null, keywords: [] });
}

/** 🎯: topic is required; keywords no book in the topic has are dropped before scoring; the random slot stays in the field. */
export function drawTarget(answers: TargetAnswers, seen: ReadonlySet<string>, rng: Rng, books: CatalogBook[]): DrawResponse {
  const pool = books.filter((b) => b.entry === "target");
  const inTopic = pool.filter((b) => b.topic === answers.topic);
  const keywords = answers.keywords.filter((k) => inTopic.some((b) => b.keywords.includes(k)));
  const scored: TargetAnswers = { ...answers, keywords };
  const field = FIELD_OF_TOPIC[answers.topic as Topic];
  const res = drawBookmarks(
    pool.map(toBook),
    { score: (b) => (b.entry === "target" ? targetScore(b, scored) : null), maxPossible: maxPossibleTarget(scored) },
    { ...TARGET_PARAMS, seen, rng, inRandomPool: (b) => b.entry === "target" && b.field === field },
  );
  const found = answers.keywords.length
    ? inTopic.filter((b) => b.keywords.some((k) => keywords.includes(k))).length
    : inTopic.length;
  return respond(res, pool, scored, { found, keywords });
}

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
