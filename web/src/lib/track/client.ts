import { sendToAmplitude } from "./amplitude";
import { commonProps } from "./common";
import type { CommonProps, EventName } from "./schema";

/** Supabase path (via /api/track). Unchanged; returns the common props it used so Amplitude gets the same ones. */
function sendToSupabase(name: EventName, props: Record<string, unknown>): CommonProps | null {
  try {
    const common = commonProps();
    const body = JSON.stringify({ name, props, common });
    const blob = new Blob([body], { type: "application/json" });
    if (!navigator.sendBeacon?.("/api/track", blob)) {
      void fetch("/api/track", { method: "POST", body, headers: { "Content-Type": "application/json" }, keepalive: true }).catch(() => {});
    }
    return common;
  } catch {
    return null; // tracking must never break the page
  }
}

export function track(name: EventName, props: Record<string, unknown> = {}): void {
  const common = sendToSupabase(name, props);
  try {
    sendToAmplitude(name, props, common);
  } catch {
    // second destination: its failure never reaches the page or the first one
  }
}
