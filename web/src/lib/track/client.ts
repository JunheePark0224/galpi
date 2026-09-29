import { commonProps } from "./common";
import type { EventName } from "./schema";

export function track(name: EventName, props: Record<string, unknown> = {}): void {
  try {
    const body = JSON.stringify({ name, props, common: commonProps() });
    const blob = new Blob([body], { type: "application/json" });
    if (!navigator.sendBeacon?.("/api/track", blob)) {
      void fetch("/api/track", { method: "POST", body, headers: { "Content-Type": "application/json" }, keepalive: true });
    }
  } catch {
    // tracking must never break the page
  }
}
