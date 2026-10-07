/**
 * Event names and props — the code copy of docs/taxonomy.md (the source) and docs/taxonomy.csv (its machine copy).
 * Change all three in one commit (taxonomy 7-1); src/lib/track/taxonomy.test.ts fails when they drift.
 */

/** "string" | "number" | "boolean" | "object", or the allowed values of an enum (null in the list = nullable). */
export type PropType = "string" | "number" | "boolean" | "object" | readonly (string | null)[];

export interface PropSpec {
  readonly type: PropType;
  /** csv Array = TRUE: a list of `type` values. */
  readonly array?: true;
  /** A non-enum value that may be null (csv Value Example lists `null`). */
  readonly nullable?: true;
  /** csv Note "Supabase only" / "Amplitude only" (taxonomy 2-7): sent to that destination alone. */
  readonly only?: "supabase" | "amplitude";
  /** Longest string the server keeps (UTF-16 units). */
  readonly max?: number;
}

const BOOK_ID = { type: "string" } as const;
const POSITION = { type: "number" } as const;
const NODE_ID = { type: "string" } as const;
const DEPTH = { type: "number" } as const;
const PICK_TYPE = { type: ["recommended", "random"] } as const;
const ONE_LINER_STYLE = { type: ["summary", "question"] } as const;
const CURIOUS_COUNT = { type: "number" } as const;
const PROVIDER = { type: ["kakao", "google"] } as const;
/** E-31: the longest 갈피 우체통 letter (UTF-16 units, after trimming) — the textarea, /api/feedback and the spec share it. */
export const FEEDBACK_MAX = 500;
/** E-01 (v1.4): the longest utm value kept — the browser turns anything longer (or with other characters) into null. */
export const UTM_MAX = 40;
/** E-01 (v1.4): a link tag from the address of the visit that started the session (first touch), Supabase only. */
const UTM = { type: "string", nullable: true, only: "supabase", max: UTM_MAX } as const;

/** Every live and planned event (taxonomy 4-1), in PRD order. Props are the event's own; common props are separate. */
export const EVENT_SPEC = {
  site_visited: { prompt_version: { type: "string", only: "amplitude" }, utm_source: UTM, utm_medium: UTM, utm_campaign: UTM },
  entry_selected: { source: { type: ["home", "first_page"] } },
  question_answered: {
    node_id: NODE_ID,
    kind: { type: ["narrow", "mood"] },
    choice: { type: ["A", "B", "unsure"] },
    depth: DEPTH,
    position: POSITION,
    elapsed_ms: { type: "number" },
  },
  unsure_hold_cancelled: { node_id: NODE_ID, depth: DEPTH, held_ms: { type: "number" } },
  question_back_clicked: { node_id: NODE_ID, depth: DEPTH, source: { type: ["question", "first_page"] } },
  path_completed: { scope_id: { type: "string" }, depth: DEPTH, unsure_count: { type: "number" } },
  book_opened: {},
  // v1.5: the draw's challenge provenance rides on the first event that follows the server's answer (null off the challenge route)
  bookmark_shown: {
    book_id: BOOK_ID, position: POSITION, one_liner_style: ONE_LINER_STYLE, pick_type: PICK_TYPE, art: { type: "object" },
    challenge_rule: { type: "number", nullable: true },
    challenge_genre: { type: "string", nullable: true },
  },
  bookmark_reacted: {
    book_id: BOOK_ID, position: POSITION, reaction: { type: ["pass", "curious"] }, pick_type: PICK_TYPE, one_liner_style: ONE_LINER_STYLE,
  },
  result_viewed: { curious_count: CURIOUS_COUNT },
  result_book_viewed: { book_id: BOOK_ID, position: POSITION, pick_type: PICK_TYPE },
  save_clicked: { book_id: BOOK_ID, is_logged_in: { type: "boolean" } },
  // v1.7: "library" = S-09 로그인 전 내 책갈피 [로그인하고 지키기]
  login_prompt_shown: { source: { type: ["save", "header", "library"] } },
  login_started: { provider: PROVIDER },
  login_completed: { provider: PROVIDER, is_first_login: { type: "boolean" } },
  // v1.7: storage — this browser (logged out) or the account; is_auto_save is always false from v1.7 (no auto keep)
  book_saved: { book_id: BOOK_ID, is_auto_save: { type: "boolean" }, storage: { type: ["browser", "account"] } },
  book_unsaved: { book_id: BOOK_ID },
  library_viewed: { saved_count: { type: "number" } },
  yes24_link_clicked: {
    book_id: { type: "string", nullable: true },
    source: { type: ["result", "library", "first_page"] },
    pick_type: { type: [null, "recommended", "random"] },
  },
  redraw_clicked: { curious_count: CURIOUS_COUNT },
  home_clicked: { curious_count: CURIOUS_COUNT, source: { type: ["first_page", "end", "question"] } },
  description_expanded: { book_id: BOOK_ID, pick_type: PICK_TYPE },
  bookmark_pulled: { book_id: BOOK_ID, position: POSITION, pick_type: PICK_TYPE },
  bookmark_flipped: { book_id: BOOK_ID, pick_type: PICK_TYPE },
  shelf_created: { shelf_count: { type: "number" } },
  // v1.1: "hold" is no longer sent (old tabs and records only)
  bookmark_moved: { book_id: BOOK_ID, method: { type: ["drag", "menu", "hold"] }, is_same_shelf: { type: "boolean" } },
  feedback_sent: {
    feedback_text: { type: "string", only: "supabase", max: FEEDBACK_MAX },
    text_length: { type: "number" },
  },
  // v1.2: S-09 [모두 제거] after the server took them — one event, never E-16 per book
  library_cleared: { removed_count: { type: "number" } },
  // v1.3 도감: a part the server recorded for the first time (logged in only), and opening the 도감
  collection_item_found: {
    part_kind: { type: ["animal", "bg", "ground"] },
    part_value: { type: "string" },   // a collectible value — never the empty ground "none" (taxonomy v1.4.1)
    tier: { type: ["common", "limited", "first_edition"] },
  },
  collection_viewed: { collected_count: { type: "number" }, is_logged_in: { type: "boolean" } },
  // v1.6 책갈피 꾸미기: a new picture the server saved — which parts changed, their new tiers, the new picture, back to the first?
  bookmark_decorated: {
    book_id: BOOK_ID,
    parts_changed: { type: ["animal", "bg", "ground"], array: true },
    tiers_changed: { type: ["common", "limited", "first_edition"], array: true },
    art: { type: "object" },
    is_reset: { type: "boolean" },
  },
  // v1.7: the bookmarks kept in this browser before logging in, moved to the account — once per attempt
  guest_saves_merged: { guest_count: { type: "number" }, merged_count: { type: "number" } },
  // v1.8: S-09 [막대 지우기] after the server took the rod and its bookmarks — one event, never E-16 per book
  shelf_removed: { removed_count: { type: "number" } },
  // v2.0 (F-27): S-11 뒤표지, its share sheet (v2.2), and the S-12 page a shared link opens
  back_cover_shown: { curious_count: CURIOUS_COUNT, label_count: { type: "number" } },
  share_clicked: { method: { type: ["native", "copy", "image", "save_image"] }, label_count: { type: "number" } },
  share_page_viewed: { label_count: { type: "number" } },
  share_page_started: {},
} as const satisfies Record<string, Readonly<Record<string, PropSpec>>>;

type Spec = typeof EVENT_SPEC;
export type EventName = keyof Spec;
export const EVENT_NAMES = Object.keys(EVENT_SPEC) as EventName[];

type BaseOf<T> = T extends "string" ? string
  : T extends "number" ? number
  : T extends "boolean" ? boolean
  : T extends "object" ? object
  : T extends readonly (infer V)[] ? V
  : never;
type ValueOf<P> = P extends { type: infer T }
  ? P extends { array: true } ? BaseOf<T>[] : BaseOf<T> | (P extends { nullable: true } ? null : never)
  : never;
type Sent<N extends EventName> = { [K in keyof Spec[N] as Spec[N][K] extends { only: "amplitude" } ? never : K]: ValueOf<Spec[N][K]> };

/** What a screen passes to track(name, props). Amplitude-only props are added by the Amplitude path, never by callers. */
export type PropsOf<N extends EventName> = keyof Sent<N> extends never ? Record<string, never> : Sent<N>;

/**
 * taxonomy 3-1a: sending one of these ends the round (판) — the event itself carries the old round, the next event round + 1.
 * home_clicked is live; redraw_clicked gets its [다시 뽑기] button in P4 and needs nothing more than its track() call.
 */
export const ROUND_ENDING_EVENTS = ["redraw_clicked", "home_clicked"] as const satisfies readonly EventName[];

/**
 * taxonomy 2-7 (v0.10): events whose Supabase copy is written by their own route (E-31 → /api/feedback, which must confirm
 * the save before the screen says thanks). /api/track refuses them; the browser sends only their Amplitude copy (trackStored).
 */
export const OWN_ROUTE_EVENTS = ["feedback_sent"] as const satisfies readonly EventName[];
export type OwnRouteEvent = (typeof OWN_ROUTE_EVENTS)[number];
const OWN_ROUTE: ReadonlySet<string> = new Set(OWN_ROUTE_EVENTS);
export const isOwnRouteEvent = (name: EventName): name is OwnRouteEvent => OWN_ROUTE.has(name);

/** Own keys only: "constructor" or "__proto__" are not event names. */
export function isEventName(x: unknown): x is EventName {
  return typeof x === "string" && Object.prototype.hasOwnProperty.call(EVENT_SPEC, x);
}

export interface CommonProps {
  anon_id: string;
  user_id: string | null;
  session_id: string;
  round: number;
  entry: "leaf" | "target" | null;
  mode: "normal" | "challenge" | null;
  screen_version: string;
  referrer: string;
  is_returning: boolean;
  device: "phone" | "desktop";
  is_in_app_browser: boolean;
}

/** taxonomy.md 3-1 — the csv `*` rows. parseCommon returns exactly these keys. */
export const COMMON_KEYS = [
  "anon_id", "user_id", "session_id", "round", "entry", "mode", "screen_version", "referrer", "is_returning", "device", "is_in_app_browser",
] as const satisfies readonly (keyof CommonProps)[];

export const SCREEN_VERSION = "v2";

const MAX_ID = 200;
const MAX_ROUND = 1000;
/** Longest DNS name. */
const MAX_HOST = 253;
const HOST = /^[a-z0-9-]+(\.[a-z0-9-]+)*$/;

/**
 * taxonomy v1.4 (6-2): `referrer` keeps the host only (`l.instagram.com`), never the path or query — a search address can
 * carry personal words. Accepts a full URL (document.referrer, or an older page still open) or a host already cut; anything
 * else (about:blank, an IP in brackets, junk) is "" like an empty referrer.
 */
export function referrerHost(raw: string): string {
  if (raw === "") return "";
  let host: string;
  try {
    host = new URL(raw).hostname;
  } catch {
    host = raw.trim();
  }
  host = host.toLowerCase();
  return host.length <= MAX_HOST && HOST.test(host) ? host : "";
}

/** Cuts to at most `max` UTF-16 units without leaving half of an emoji (a trailing high surrogate is dropped). */
export function cutText(s: string, max: number): string {
  const cut = s.slice(0, max);
  return /[\uD800-\uDBFF]$/.test(cut) ? cut.slice(0, -1) : cut;
}

const text = (x: unknown, max: number, min = 0): x is string => typeof x === "string" && x.length >= min && x.length <= max;

/** Strict check of the common block sent with every event. Returns a fresh object with the known keys only. */
export function parseCommon(x: unknown): CommonProps | null {
  if (typeof x !== "object" || x === null || Array.isArray(x)) return null;
  const c = x as Record<string, unknown>;
  const { anon_id, user_id, session_id, round, entry, mode, screen_version, referrer, is_returning, device, is_in_app_browser } = c;
  if (!text(anon_id, MAX_ID, 1) || !text(session_id, MAX_ID, 1) || !text(screen_version, MAX_ID, 1)) return null;
  if (user_id !== null && !text(user_id, MAX_ID)) return null;
  if (typeof referrer !== "string") return null;
  if (typeof round !== "number" || !Number.isInteger(round) || round < 0 || round > MAX_ROUND) return null;
  if (entry !== null && entry !== "leaf" && entry !== "target") return null;
  if (mode !== null && mode !== "normal" && mode !== "challenge") return null;
  if (device !== "phone" && device !== "desktop") return null;
  if (typeof is_returning !== "boolean" || typeof is_in_app_browser !== "boolean") return null;
  // referrer comes from the visitor's browser: keep the event, keep the host only (an older page may still send a full URL).
  return {
    anon_id, user_id, session_id, round, entry, mode, screen_version, referrer: referrerHost(referrer), is_returning, device, is_in_app_browser,
  };
}
