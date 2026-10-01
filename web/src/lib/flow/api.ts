import { artsForDraw } from "@/lib/art/combine";
import { TOPICS } from "@/lib/books/taxonomy";
import type { DrawResponse, Vocab } from "@/lib/books/types";
import { GOAL_MAX, matchGoal, type GoalMatch } from "@/lib/goal/match";
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
    picks: res.picks.map((p, i) => ({ card: p.card, kind: p.kind, art: arts[i], reason: p.reason })),
    exhausted: res.exhausted,
    found: res.found,
    keywords: res.keywords,
  };
}

/** The server stops waiting for Claude at 3 s (target-chips 3절); the browser allows a little more for the trip. */
export const CLASSIFY_WAIT_MS = 5000;

function isGoalMatch(x: unknown): x is GoalMatch {
  if (typeof x !== "object" || x === null) return false;
  const g = x as Record<string, unknown>;
  return typeof g.topic === "string" && (TOPICS as readonly string[]).includes(g.topic)
    && Array.isArray(g.keywords) && g.keywords.every((k) => typeof k === "string")
    && typeof g.matched === "boolean" && (g.method === "llm" || g.method === "word");
}

/**
 * 직접 쓰기 → our topic and keywords: POST /api/goal/classify (Claude Haiku there, word matching without a key).
 * Offline, refused or too slow → the same word matching right here. Never throws.
 */
export async function classifyGoal(text: string, vocab: Vocab): Promise<GoalMatch> {
  const trimmed = text.trim().slice(0, GOAL_MAX);
  try {
    const res = await fetch("/api/goal/classify", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text: trimmed }),
      signal: AbortSignal.timeout(CLASSIFY_WAIT_MS),
    });
    if (res.ok) {
      const goal: unknown = await res.json();
      if (isGoalMatch(goal)) return { ...goal, text: trimmed };
    }
  } catch {
    // offline or timed out: fall through
  }
  return matchGoal(trimmed, vocab);
}
