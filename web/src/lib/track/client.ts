import { sendToAmplitude } from "./amplitude";
import { commonProps } from "./common";
import type { CommonProps, EventName, PropsOf } from "./schema";

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

/** One call per event (taxonomy 2-7 SDK). `props` must match EVENT_SPEC[name]: tsc checks every call site. */
export function track<N extends EventName>(name: N, props: PropsOf<N>): void {
  const own = props as Record<string, unknown>;
  const common = sendToSupabase(name, own);
  try {
    sendToAmplitude(name, own, common);
  } catch {
    // second destination: its failure never reaches the page or the first one
  }
}
