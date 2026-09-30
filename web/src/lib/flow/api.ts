import { artsForDraw } from "@/lib/art/combine";
import type { DrawResponse } from "@/lib/books/types";
import type { DrawView, FlowState } from "./state";
import { targetAnswersFrom } from "./target";

/** Body for POST /api/books/draw (checked strictly on the server). */
export function drawBody(s: FlowState): Record<string, unknown> {
  if (s.entry === "leaf") return { entry: "leaf", choices: s.choices, seen: s.seen };
  return { entry: "target", answers: targetAnswersFrom(s.form, s.goal), seen: s.seen };
}

export async function requestDraw(body: Record<string, unknown>): Promise<DrawResponse> {
  const res = await fetch("/api/books/draw", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`draw failed: ${res.status}`);
  return (await res.json()) as DrawResponse;
}

/** Pictures are drawn in the browser, once per draw (PRD F-08: random each time; P5 saves the combo). */
export function toDrawView(res: DrawResponse, artSeed: number): DrawView {
  const arts = artsForDraw(res.picks.length, artSeed);
  return {
    picks: res.picks.map((p, i) => ({ card: p.card, kind: p.kind, art: arts[i] })),
    exhausted: res.exhausted,
    found: res.found,
    keywords: res.keywords,
  };
}
