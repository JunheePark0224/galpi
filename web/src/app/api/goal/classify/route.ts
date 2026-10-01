import vocab from "@/data/vocab.json";
import type { Vocab } from "@/lib/books/types";
import { GOAL_MAX, matchGoal } from "@/lib/goal/match";
import { guardJson, takeDailyBudget } from "@/lib/server/guard";
import { classifyWithClaude } from "@/lib/server/llm";

const MAX_BYTES = 1_000;          // {"text": 30 characters} with room to spare
const PER_MINUTE = 10;            // one per [책 펼치기]; the one edit makes two
const LLM_CALLS_PER_DAY = 300;    // per instance, UTC day; ~US$0.0018 a call → about US$0.55 a day at most per instance

/**
 * POST /api/goal/classify { text } → GoalMatch (target-chips 3절). Claude Haiku sorts the note into our list when
 * ANTHROPIC_API_KEY is set; no key, a failure, 3 seconds or a used-up daily budget → the same word matching the browser used
 * in P3 (method "word").
 * The note itself is never logged.
 */
export async function POST(request: Request): Promise<Response> {
  const guarded = await guardJson(request, { route: "classify", limit: PER_MINUTE, maxBytes: MAX_BYTES });
  if (!guarded.ok) return guarded.response;
  const body = guarded.body as { text?: unknown } | null;
  const text = typeof body?.text === "string" ? body.text.trim() : "";
  if (!text || text.length > GOAL_MAX) return Response.json({ error: "invalid goal" }, { status: 400 });

  const apiKey = process.env.ANTHROPIC_API_KEY?.trim();
  if (apiKey) {
    if (takeDailyBudget("classify-llm", LLM_CALLS_PER_DAY)) {
      const result = await classifyWithClaude(text, vocab as Vocab, { apiKey });
      if (result.ok) return Response.json(result.goal);
      console.warn("classify: fell back to word matching", result.reason);
    } else {
      console.warn("classify: fell back to word matching", "budget");
    }
  }
  return Response.json(matchGoal(text, vocab as Vocab));
}
