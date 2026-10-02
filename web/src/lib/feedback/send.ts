import { trackStored } from "@/lib/track/client";
import { commonProps } from "@/lib/track/common";
import { cleanLetter } from "./letter";

/** Long enough for the save plus the 3 s notice on the server; then the screen says it could not send. */
const TIMEOUT_MS = 12_000;

/**
 * PRD F-26: posts the letter to /api/feedback and resolves true only on a 2xx — the save is confirmed before the screen
 * thanks anyone (the route answers 2xx only when stored, or 202 under a deliberate TRACK_STORE=off; a missing store is 503). Then E-31's Amplitude copy goes out with the same common props (the letter itself is Supabase only).
 * Never throws; never logs the letter.
 */
export async function sendFeedback(text: string): Promise<boolean> {
  const letter = cleanLetter(text);
  if (!letter) return false;
  try {
    const common = commonProps();
    const res = await fetch("/api/feedback", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text: letter, common }),
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    if (!res.ok) return false;
    trackStored("feedback_sent", { feedback_text: letter, text_length: letter.length }, common);
    return true;
  } catch {
    return false;
  }
}
