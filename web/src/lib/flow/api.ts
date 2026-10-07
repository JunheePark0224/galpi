import { artsForDraw } from "@/lib/art/combine";
import { MAX_SEEN } from "@/lib/books/request";
import type { PathDrawResponse } from "@/lib/books/types";
import type { DrawView, FlowState } from "./state";

/**
 * Body for POST /api/books/draw (checked strictly on the server — a finished path of the question map). `seen` is every
 * book to leave out: the books kept in this browser before logging in (10-07, `saved` — never drawn again) and this tab's
 * shown books (F-05), once each, at most MAX_SEEN (the server's cap): the saved ones first, then the newest shown.
 * A logged-in person's 내 책갈피 is not sent — the server takes it from the session.
 */
export function drawBody(s: Pick<FlowState, "answers" | "seen">, saved: readonly string[] = []): Record<string, unknown> {
  const keep = saved.slice(0, MAX_SEEN);
  const kept = new Set(keep);
  const shown = s.seen.filter((id) => !kept.has(id));
  const room = MAX_SEEN - keep.length;
  return { answers: s.answers, seen: [...keep, ...(room > 0 ? shown.slice(-room) : [])] };
}

export async function requestDraw(body: Record<string, unknown>): Promise<PathDrawResponse> {
  const res = await fetch("/api/books/draw", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`draw failed: ${res.status}`);
  return (await res.json()) as PathDrawResponse;
}

/**
 * Pictures, once per draw (PRD F-08: random each time; P5 saves the combo). 도감 v1: from the server's seed (`res.art`),
 * so the server can work the same pictures out again; `fallbackSeed` only for an answer without one (nothing recorded).
 */
export function toDrawView(res: PathDrawResponse, fallbackSeed: number): DrawView {
  // v3: a ticket names the draw's books — one that does not match these picks is not this draw's (nothing recorded)
  const ticket = res.art && res.art.count === res.picks.length && Array.isArray(res.art.isbns)
    && res.art.isbns.every((isbn, i) => isbn === res.picks[i]?.card.id) && res.art.isbns.length === res.picks.length ? res.art : null;
  const arts = artsForDraw(res.picks.length, ticket?.seed ?? fallbackSeed);
  return {
    picks: res.picks.map((p, i) => ({ card: p.card, kind: p.kind, art: arts[i], reason: p.reason })),
    exhausted: res.exhausted,
    path: res.path,
    ticket: ticket?.sig ? ticket : null,
    challenge: res.challenge ?? null,
    label: res.label ?? { chips: [], challenge: false },
  };
}
