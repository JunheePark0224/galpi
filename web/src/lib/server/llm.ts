import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import type { Vocab } from "@/lib/books/types";
import { CLASSIFY_MODEL, CLASSIFY_TIMEOUT_MS, classifySchema, classifySystemPrompt, parseClassification } from "@/lib/goal/classify";
import type { GoalMatch } from "@/lib/goal/match";

export type FallbackReason = "timeout" | "error" | "refusal" | "invalid";
export type ClassifyResult = { ok: true; goal: GoalMatch } | { ok: false; reason: FallbackReason };

const TIMED_OUT = Symbol("timeout");

/**
 * One Claude Haiku call, no retries, cut at `timeoutMs` (target-chips 3절). Sends the note and our list only — no ids,
 * no other records (privacy 6-3b). Never throws: the caller falls back to word matching on any `ok: false`.
 */
export async function classifyWithClaude(
  text: string, vocab: Vocab, opts: { apiKey: string; timeoutMs?: number; client?: Anthropic },
): Promise<ClassifyResult> {
  const timeoutMs = opts.timeoutMs ?? CLASSIFY_TIMEOUT_MS;
  const client = opts.client ?? new Anthropic({ apiKey: opts.apiKey, maxRetries: 0, timeout: timeoutMs });
  const controller = new AbortController();
  let timer: ReturnType<typeof setTimeout> | undefined;
  const late = new Promise<typeof TIMED_OUT>((resolve) => {
    timer = setTimeout(() => {
      controller.abort();
      resolve(TIMED_OUT);
    }, timeoutMs);
  });
  try {
    const call = client.messages.create(
      {
        model: CLASSIFY_MODEL,
        max_tokens: 256,
        system: classifySystemPrompt(vocab),
        messages: [{ role: "user", content: `<note>${text}</note>` }],
        output_config: { format: { type: "json_schema", schema: classifySchema(vocab) } },
      },
      { signal: controller.signal },
    );
    call.catch(() => {});                  // after a timeout the aborted call rejects with nobody listening
    const message = await Promise.race([call, late]);
    if (message === TIMED_OUT) return { ok: false, reason: "timeout" };
    if (message.stop_reason !== "end_turn") return { ok: false, reason: message.stop_reason === "refusal" ? "refusal" : "invalid" };
    const block = message.content.find((b) => b.type === "text");
    const goal = block ? parseClassification(block.text, text, vocab) : null;
    return goal ? { ok: true, goal } : { ok: false, reason: "invalid" };
  } catch {
    return { ok: false, reason: controller.signal.aborted ? "timeout" : "error" };
  } finally {
    clearTimeout(timer);
  }
}
