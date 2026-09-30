import * as amplitude from "@amplitude/unified";
import { ensureAnonId } from "./common";
import type { CommonProps, EventName } from "./schema";

const KEY_MISSING = "Amplitude API key missing — analytics disabled";
/** Instructor's install check (wizard step 6): the load event carries this. We reuse `visit` instead of a new event name. */
const PROMPT_VERSION = "BA400.4";
const REPLAY_SAMPLE_RATE = 0.2;

let active = false;
let warned = false;

/**
 * Starts Amplitude once per page load. Without NEXT_PUBLIC_AMPLITUDE_API_KEY (local dev, E2E, Preview) it stays off.
 * deviceId is the Galpi anonymous id, so Supabase events.common.anon_id and Amplitude's device_id are the same person.
 * Options are the ones in @amplitude/unified's types: analytics = BrowserOptions, sessionReplay = SessionReplayOptions.
 */
export function startAmplitude(): void {
  if (active) return;
  const key = (process.env.NEXT_PUBLIC_AMPLITUDE_API_KEY ?? "").trim();
  if (!key) {
    if (!warned) {
      warned = true;
      console.warn(KEY_MISSING);
    }
    return;
  }
  try {
    active = true;
    amplitude
      .initAll(key, {
        analytics: { autocapture: true, deviceId: ensureAnonId() },
        // 'medium' masks every input field (the default, set explicitly so it is visible in code).
        sessionReplay: { sampleRate: REPLAY_SAMPLE_RATE, privacyConfig: { defaultMaskLevel: "medium" } },
      })
      .catch(() => { active = false; });
  } catch {
    active = false; // analytics must never break the page
  }
}

/** Same event name and props as the Supabase path, plus the common props the analysis needs. Never throws. */
export function sendToAmplitude(name: EventName, props: Record<string, unknown>, common: CommonProps | null): void {
  if (!active) return;
  try {
    const shared = common === null ? {} : {
      ...(common.entry === null ? {} : { entry: common.entry }),
      round: common.round,
      screen_version: common.screen_version,
      device: common.device,
      in_app_browser: common.in_app_browser,
      returning: common.returning,
    };
    amplitude.track(name, { ...shared, ...props, ...(name === "visit" ? { prompt_version: PROMPT_VERSION } : {}) });
  } catch {
    // Amplitude failing must not touch the Supabase path or the screen
  }
}
