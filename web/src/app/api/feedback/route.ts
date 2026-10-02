import { after } from "next/server";
import { cleanLetter } from "@/lib/feedback/letter";
import { guardJson } from "@/lib/server/guard";
import { notifyFeedback } from "@/lib/server/notify";
import { cleanJson, TooDeepError } from "@/lib/server/sanitize";
import { parseProps } from "@/lib/track/props";
import { recordEvent } from "@/lib/track/record";
import { parseCommon } from "@/lib/track/schema";

/** 500 characters even if every one were escaped in JSON (\uXXXX = 6 bytes), plus the common block. */
const MAX_BYTES = 4_000;
/** A person writes one letter, maybe two; a script gets five a minute per address. */
const PER_MINUTE = 5;

const invalid = () => Response.json({ error: "invalid feedback" }, { status: 400 });

/**
 * POST /api/feedback { text, common } — PRD F-26 갈피 우체통. Stores E-31 `feedback_sent` in `events` through the same path
 * as /api/track (recordEvent: verified user_id), and only then answers 201 (the arrival notice goes out after the answer) — the screen says "잘 받았어요" on that answer
 * alone. Only a deliberate TRACK_STORE=off (local dev, E2E) answers 202 { stored: false } — accepted, not kept, no notice. A store
 * that is simply not configured (missing Supabase env) answers 503: the screen must not thank anyone for a lost letter.
 * The letter is never logged and never put in the notice.
 */
export async function POST(request: Request): Promise<Response> {
  const guarded = await guardJson(request, { route: "feedback", limit: PER_MINUTE, maxBytes: MAX_BYTES });
  if (!guarded.ok) return guarded.response;
  let body: unknown;
  try {
    body = cleanJson(guarded.body);
  } catch (err) {
    if (err instanceof TooDeepError) return invalid();
    throw err;
  }
  if (typeof body !== "object" || body === null || Array.isArray(body)) return invalid();
  const b = body as { text?: unknown; common?: unknown };
  const letter = cleanLetter(b.text);
  const common = parseCommon(b.common);
  if (!letter || !common) return invalid();

  const { props } = parseProps("feedback_sent", { feedback_text: letter, text_length: letter.length });
  let stored: boolean;
  try {
    stored = await recordEvent(request, { name: "feedback_sent", props, common });
  } catch (err) {
    console.error("feedback failed", (err as Error).message);
    return Response.json({ error: "store failed" }, { status: 500 });
  }
  if (!stored) {
    if (process.env.TRACK_STORE === "off") return Response.json({ stored: false }, { status: 202 });
    console.error("feedback failed", "store not configured");
    return Response.json({ error: "store unavailable" }, { status: 503 });
  }
  // After the answer (Next `after`): the notice never delays "잘 받았어요" and never fails the stored letter (it does not throw).
  after(async () => { await notifyFeedback(); });
  return Response.json({ stored: true }, { status: 201 });
}
