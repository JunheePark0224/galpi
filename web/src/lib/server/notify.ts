import { takeDailyBudget } from "./guard";

/**
 * PRD F-26: a notice to the operator that a 갈피 우체통 letter arrived — the time only, NEVER the letter or any id
 * (the letter stays in Supabase events, taxonomy 6-3e). Sent through Resend's HTTP API.
 */

const RESEND_URL = "https://api.resend.com/emails";
const FROM = "갈피 <onboarding@resend.dev>";
const SUBJECT = "[갈피] 피드백이 도착했어요";
const TIMEOUT_MS = 3_000;
/** Per instance and UTC day, so a script cannot burn the mail quota (the letters themselves are still stored). */
export const NOTICES_PER_DAY = 50;

export type NoticeResult = "sent" | "skipped" | "capped" | "failed";

/** "2026-10-03 14:05" in Korea time, whatever the server's own zone. */
export function kstStamp(at: Date): string {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat("en-CA", {
      timeZone: "Asia/Seoul", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23",
    }).formatToParts(at).map((p) => [p.type, p.value]),
  );
  return `${parts.year}-${parts.month}-${parts.day} ${parts.hour}:${parts.minute}`;
}

export const noticeText = (at: Date): string =>
  `${kstStamp(at)} (KST)에 피드백이 도착했어요. Supabase events에서 feedback_sent를 확인하세요.`;

/**
 * Sends the notice. Never throws and never logs a value of the key, the address or the letter: a missing setting → "skipped"
 * (a warning naming what is missing), the daily cap → "capped", a refusal, network error or 3 s timeout → "failed".
 */
export async function notifyFeedback(at: Date = new Date()): Promise<NoticeResult> {
  const key = process.env.RESEND_API_KEY?.trim();
  const to = process.env.FEEDBACK_NOTIFY_TO?.trim();
  if (!key || !to) {
    console.warn("feedback notice skipped: RESEND_API_KEY or FEEDBACK_NOTIFY_TO is not set");
    return "skipped";
  }
  if (!takeDailyBudget("feedback-notice", NOTICES_PER_DAY)) {
    console.warn("feedback notice skipped: daily cap reached");
    return "capped";
  }
  const abort = new AbortController();
  const timer = setTimeout(() => abort.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(RESEND_URL, {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({ from: FROM, to: [to], subject: SUBJECT, text: noticeText(at) }),
      signal: abort.signal,
    });
    if (res.ok) return "sent";
    console.warn("feedback notice failed", res.status);
    return "failed";
  } catch (err) {
    console.warn("feedback notice failed", err instanceof Error ? err.name : "error");
    return "failed";
  } finally {
    clearTimeout(timer);
  }
}
