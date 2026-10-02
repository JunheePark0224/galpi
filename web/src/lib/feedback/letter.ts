import { FEEDBACK_MAX } from "@/lib/track/schema";

export { FEEDBACK_MAX };

/**
 * PRD F-26: the letter as it is kept — trimmed, 1–FEEDBACK_MAX UTF-16 units (the same count as the textarea's maxLength).
 * null when there is nothing to send or it is too long. The browser and /api/feedback use this one rule.
 */
export function cleanLetter(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const letter = raw.trim();
  return letter.length >= 1 && letter.length <= FEEDBACK_MAX ? letter : null;
}
