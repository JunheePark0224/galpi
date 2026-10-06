import type { Book, Rng } from "@/lib/recommend";
import { ALL_SCOPE, inScope, type Challenge, type FarRule, type Scope } from "./types";

/**
 * Challenge rules v2 (10-05, docs/plans/2026-10-05-challenge-rules.md): a 배우기 challenge keeps the purpose — learning — and
 * steps into a field the person would not pick. These are the only genres it may go to (validateMap checks every
 * `entry=target` far rule); science is a field of learning here, in the challenge only. A 배우기 challenge also widens and
 * draws its 운명 1장 inside these genres, never into 시·에세이·소설·SF·추리·호러.
 */
export const LEARN_CHALLENGE_GENRES: readonly string[] = ["과학 교양", "인문", "역사", "예술·여행", "사회·시사"];

/** A genre of a `pick: one` list is a candidate when the catalogue has at least this many books of it (user, 10-05). */
export const LIST_MIN_BOOKS = 5;

/** The `from` label when the person chose no genre or topic (or no branch). */
export const NO_CHOICE_LABEL = { leaf: "이야기 · 장르 없음", target: "배우기 · 주제 없음", mixed: "섞어서" } as const;

/**
 * One genre of a list rule: the genres with at least LIST_MIN_BOOKS books in the catalogue, each with the same chance, by the
 * draw's rng (same seed → same genre). None has enough books → the whole list (a multi-genre target). The person's history
 * (saved books, earlier paths) is never looked at — the user's decision.
 */
export function pickGenre(to: Partial<Scope>, books: readonly Book[], rng: Rng): string[] {
  const list = to.genres ?? [];
  const at = rng();
  const enough = list.filter((g) => books.filter((b) => inScope(b, { ...ALL_SCOPE, ...to, genres: [g] })).length >= LIST_MIN_BOOKS);
  return enough.length ? [enough[Math.floor(at * enough.length)]] : [...list];
}

/** Provenance of a challenge draw: the person's own scope, where it went, the rule (1-based) and its reason (S-04). */
export function challengeOf(own: Scope, branch: "leaf" | "target" | "mixed", n: number, rule: FarRule, to: Scope): Challenge {
  const from = own.genres ?? own.topics ?? own.keywords ?? [NO_CHOICE_LABEL[branch]];
  return { from: [...from], to: [...(to.genres ?? [])], rule: { n, title: rule.title ?? null }, reason: rule.why ?? null };
}
