import { artsForDraw } from "@/lib/art/combine";
import type { PathDrawResponse } from "@/lib/books/types";
import type { DrawView, FlowState } from "./state";

/** Body for POST /api/books/draw (checked strictly on the server — a finished path of the question map). */
export function drawBody(s: Pick<FlowState, "answers" | "seen">): Record<string, unknown> {
  return { answers: s.answers, seen: s.seen };
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
  const ticket = res.art && res.art.count === res.picks.length ? res.art : null;
  const arts = artsForDraw(res.picks.length, ticket?.seed ?? fallbackSeed);
  return {
    picks: res.picks.map((p, i) => ({ card: p.card, kind: p.kind, art: arts[i], reason: p.reason })),
    exhausted: res.exhausted,
    path: res.path,
    ticket: ticket?.sig ? ticket : null,
  };
}
