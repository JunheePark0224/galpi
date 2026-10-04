import type { Provider } from "@/lib/auth/next";
import { ensureAnonId } from "./common";
import { forAmplitude } from "./props";
import type { CommonProps, EventName } from "./schema";

type Sdk = typeof import("@amplitude/unified");
/** Name, props, and when it happened (ms) — a queued event keeps its own time (taxonomy 2-7 b). */
type Waiting = readonly [EventName, Record<string, unknown>, { time: number }];

const KEY_MISSING = "Amplitude API key missing — analytics disabled";
/** Instructor's install check (wizard step 6): `site_visited` carries this (EVENT_SPEC: prompt_version, Amplitude only). */
const PROMPT_VERSION = "BA400.4";
const REPLAY_SAMPLE_RATE = 0.2;
/** The SDK is ~120 KB gzip: load it when the browser is idle, and no later than this after the page asked for it. */
const IDLE_TIMEOUT_MS = 2000;
const NO_IDLE_API_DELAY_MS = 2000; // Safari has no requestIdleCallback
/**
 * Events that happen before the SDK has arrived — even before startAmplitude ran (taxonomy 2-7 a) — wait here.
 * Bounded; only when a key exists; the Supabase copy is never affected.
 */
const MAX_WAITING = 50;

let started = false;   // the load was scheduled: happens once per page load, never undone (no second initAll after a failure)
let warned = false;
let failed = false;    // loading or init broke: stop sending
let sdk: Sdk | null = null;
let waiting: Waiting[] = [];
/** A login (or logout) that happened before the SDK arrived — applied first, so the waiting events carry the person. */
let identity: { userId: string | null; provider?: Provider } | null = null;

function whenIdle(run: () => void): void {
  if (typeof window.requestIdleCallback === "function") window.requestIdleCallback(run, { timeout: IDLE_TIMEOUT_MS });
  else setTimeout(run, NO_IDLE_API_DELAY_MS);
}

const apiKey = (): string => (process.env.NEXT_PUBLIC_AMPLITUDE_API_KEY ?? "").trim();

function applyIdentity(loaded: Sdk, who: { userId: string | null; provider?: Provider }): void {
  try {
    loaded.setUserId(who.userId ?? undefined);
    if (who.userId && who.provider) loaded.identify(new loaded.Identify().set("login_provider", who.provider));
  } catch {
    // Amplitude failing must not touch the Supabase path or the screen
  }
}

function give(loaded: Sdk, [name, props, options]: Waiting): void {
  try {
    loaded.track(name, props, options);
  } catch {
    // Amplitude failing must not touch the Supabase path or the screen
  }
}

async function load(key: string): Promise<void> {
  try {
    const loaded = await import("@amplitude/unified");
    // Options are the ones in @amplitude/unified's types: analytics = BrowserOptions, sessionReplay = SessionReplayOptions,
    // engagement = the Guides & Surveys plugin (skip: true loads none of its code).
    const initialising = loaded.initAll(key, {
      analytics: { autocapture: true, deviceId: ensureAnonId() },
      // 'medium' masks every input field (the default, set explicitly so it is visible in code).
      sessionReplay: { sampleRate: REPLAY_SAMPLE_RATE, privacyConfig: { defaultMaskLevel: "medium" } },
      engagement: { skip: true },
    });
    // The SDK queues events itself until its init finishes, so hand over the waiting ones now.
    sdk = loaded;
    if (identity) applyIdentity(loaded, identity);
    identity = null;
    const pending = waiting;
    waiting = [];
    pending.forEach((event) => give(loaded, event));
    await initialising;
  } catch {
    failed = true;   // analytics must never break the page
    sdk = null;
    waiting = [];
  }
}

/**
 * Starts Amplitude once per page load. Without NEXT_PUBLIC_AMPLITUDE_API_KEY (local dev, E2E, Preview) it stays off
 * and the SDK is never requested. With a key, the SDK is imported when the browser is idle.
 * deviceId is the Galpi anonymous id, so Supabase events.common.anon_id and Amplitude's device_id are the same person.
 */
export function startAmplitude(): void {
  if (started) return;
  const key = apiKey();
  if (!key) {
    if (!warned) {
      warned = true;
      console.warn(KEY_MISSING);
    }
    return;
  }
  started = true;
  whenIdle(() => void load(key));
}

/** Same event name and props as the Supabase path minus Supabase-only ones, plus the common props the analysis needs. Never throws. */
export function sendToAmplitude(name: EventName, props: Record<string, unknown>, common: CommonProps | null): void {
  if (failed || !apiKey()) return;   // no key: Amplitude is off and nothing is kept
  try {
    const shared = common === null ? {} : {
      ...(common.entry === null ? {} : { entry: common.entry }),
      ...(common.mode === null ? {} : { mode: common.mode }),
      round: common.round,
      screen_version: common.screen_version,
      device: common.device,
      is_in_app_browser: common.is_in_app_browser,
      is_returning: common.is_returning,
    };
    const own = { ...forAmplitude(name, props), ...(name === "site_visited" ? { prompt_version: PROMPT_VERSION } : {}) };
    const event: Waiting = [name, { ...shared, ...own }, { time: Date.now() }];
    if (sdk) give(sdk, event);
    else if (waiting.length < MAX_WAITING) waiting.push(event);
  } catch {
    // building the event must not touch the Supabase path or the screen
  }
}

/**
 * taxonomy 3-2: after login (E-14) the person's Supabase id joins their device_id, and `login_provider` is the one user
 * property; on logout the id is cleared so later events on this device are not filed under them. Never a name or email.
 */
export function setAmplitudeUser(userId: string | null, provider?: Provider): void {
  if (failed || !apiKey()) return;
  if (sdk) applyIdentity(sdk, { userId, provider });
  else identity = { userId, provider };
}

