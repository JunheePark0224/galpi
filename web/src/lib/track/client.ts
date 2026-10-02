import { sendToAmplitude } from "./amplitude";
import { commonProps, nextRound } from "./common";
import { isOwnRouteEvent, ROUND_ENDING_EVENTS, type CommonProps, type EventName, type OwnRouteEvent, type PropsOf } from "./schema";

const ENDS_ROUND: ReadonlySet<EventName> = new Set(ROUND_ENDING_EVENTS);

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

/**
 * One call per event (taxonomy 2-7 SDK). `props` must match EVENT_SPEC[name]: tsc checks every call site.
 * After [다시 뽑기] / [처음으로] the round moves on, once both copies have the old one (taxonomy 3-1a).
 * Events stored by their own route (OWN_ROUTE_EVENTS — E-31) cannot be sent here: use trackStored after that route said yes.
 */
export function track<N extends Exclude<EventName, OwnRouteEvent>>(name: N, props: PropsOf<N>): void {
  if (isOwnRouteEvent(name)) return;   // also at run time: E-31 has one way in, and its letter never takes this path
  const own = props as Record<string, unknown>;
  const common = sendToSupabase(name, own);
  try {
    sendToAmplitude(name, own, common);
  } catch {
    // second destination: its failure never reaches the page or the first one
  }
  if (ENDS_ROUND.has(name)) nextRound();
}

/**
 * taxonomy 2-7 (v0.10): for an event its own route has already stored (E-31 via /api/feedback) — only the Amplitude copy,
 * with the same common props the route stored. Supabase-only props (the letter) are dropped on the way, as for track().
 */
export function trackStored<N extends OwnRouteEvent>(name: N, props: PropsOf<N>, common: CommonProps): void {
  if (!isOwnRouteEvent(name)) return;   // every other event goes through track(), Supabase first
  try {
    sendToAmplitude(name, props as Record<string, unknown>, common);
  } catch {
    // Amplitude failing must not touch the screen
  }
}
