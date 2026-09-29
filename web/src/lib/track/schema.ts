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
