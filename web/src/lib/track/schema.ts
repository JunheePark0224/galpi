export const EVENT_NAMES = [
  "visit", "entry_selected", "chip_selected", "book_opened", "first_page_edited",
  "bookmark_shown", "bookmark_reacted", "result_viewed", "result_book_viewed", "save_clicked",
  "login_prompt_shown", "login_started", "login_completed", "book_saved", "book_unsaved",
  "library_viewed", "yes24_clicked", "redraw_clicked", "home_clicked", "goal_free_written",
  "goal_coverage", "description_expanded", "balance_answered", "unsure_hold_cancelled",
] as const;

export type EventName = (typeof EVENT_NAMES)[number];

export interface CommonProps {
  anon_id: string;
  user_id: string | null;
  session_id: string;
  round: number;
  entry: "leaf" | "target" | null;
  screen_version: string;
  referrer: string;
  returning: boolean;
  device: "phone" | "desktop";
  in_app_browser: boolean;
}

const NAMES = new Set<string>(EVENT_NAMES);
export function isEventName(x: unknown): x is EventName {
  return typeof x === "string" && NAMES.has(x);
}

export const SCREEN_VERSION = "v1";

const MAX_ID = 200;
const MAX_REFERRER = 500;
const MAX_ROUND = 1000;

const text = (x: unknown, max: number, min = 0): x is string => typeof x === "string" && x.length >= min && x.length <= max;

/** Strict check of the common block sent with every event. Returns a fresh object with the known keys only. */
export function parseCommon(x: unknown): CommonProps | null {
  if (typeof x !== "object" || x === null || Array.isArray(x)) return null;
  const c = x as Record<string, unknown>;
  const { anon_id, user_id, session_id, round, entry, screen_version, referrer, returning, device, in_app_browser } = c;
  if (!text(anon_id, MAX_ID, 1) || !text(session_id, MAX_ID, 1) || !text(screen_version, MAX_ID, 1)) return null;
  if (user_id !== null && !text(user_id, MAX_ID)) return null;
  if (typeof referrer !== "string") return null;
  if (typeof round !== "number" || !Number.isInteger(round) || round < 0 || round > MAX_ROUND) return null;
  if (entry !== null && entry !== "leaf" && entry !== "target") return null;
  if (device !== "phone" && device !== "desktop") return null;
  if (typeof returning !== "boolean" || typeof in_app_browser !== "boolean") return null;
  // referrer comes from the visitor's browser and may be a long URL: keep the event, cut the value.
  return { anon_id, user_id, session_id, round, entry, screen_version, referrer: referrer.slice(0, MAX_REFERRER), returning, device, in_app_browser };
}
