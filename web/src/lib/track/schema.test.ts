import { describe, expect, it } from "vitest";
import { COMMON_KEYS, cutText, EVENT_NAMES, EVENT_SPEC, isEventName, isOwnRouteEvent, OWN_ROUTE_EVENTS, parseCommon, referrerHost, type PropsOf } from "./schema";

describe("event schema", () => {
  it("lists the 33 live taxonomy events in PRD order (v1.0: six removed, E-32 · E-25 · E-33 · E-34 after E-02; v1.2: E-35; v1.3: E-36 · E-37; v1.6: E-38; v1.7: E-39; v1.8: E-40; v2.0: E-41~E-44 last)", () => {
    expect(EVENT_NAMES).toHaveLength(37);
    expect(EVENT_NAMES.slice(0, 6)).toEqual(["site_visited", "entry_selected", "question_answered", "unsure_hold_cancelled", "question_back_clicked", "path_completed"]);
    expect(EVENT_NAMES.slice(-15)).toEqual(["bookmark_pulled", "bookmark_flipped", "shelf_created", "bookmark_moved", "feedback_sent", "library_cleared", "collection_item_found", "collection_viewed", "bookmark_decorated", "guest_saves_merged", "shelf_removed",
      "back_cover_shown", "share_clicked", "share_page_viewed", "share_page_started"]);
    for (const gone of ["visit", "balance_answered", "chip_selected", "goal_submitted", "free_goal_written", "goal_coverage_checked", "first_page_edited"]) {
      expect(EVENT_NAMES).not.toContain(gone);
    }
  });

  it("accepts only known names, never inherited object keys", () => {
    expect(isEventName("bookmark_reacted")).toBe(true);
    expect(isEventName("drop_table")).toBe(false);
    expect(isEventName("constructor")).toBe(false);
    expect(isEventName("__proto__")).toBe(false);
    expect(isEventName(42)).toBe(false);
  });

  it("marks feedback_text Supabase only and prompt_version Amplitude only (taxonomy 2-7)", () => {
    expect(EVENT_SPEC.site_visited.prompt_version).toMatchObject({ only: "amplitude" });
    expect(EVENT_SPEC.feedback_sent.feedback_text).toMatchObject({ only: "supabase", max: 500 });
  });

  it("names E-31 as the one event its own route stores (taxonomy 2-7, v0.10)", () => {
    expect(OWN_ROUTE_EVENTS).toEqual(["feedback_sent"]);
    expect(isOwnRouteEvent("feedback_sent")).toBe(true);
    expect(isOwnRouteEvent("site_visited")).toBe(false);
  });

  it("v1.0: the question events and the extra home source; old first_page values stay readable", () => {
    expect(EVENT_SPEC.question_answered.kind.type).toEqual(["narrow", "mood"]);
    expect(EVENT_SPEC.question_back_clicked.source.type).toEqual(["question", "first_page"]);
    expect(EVENT_SPEC.home_clicked.source.type).toEqual(["first_page", "end", "question"]);
    expect(EVENT_SPEC.path_completed.scope_id).toEqual({ type: "string" });
    expect(EVENT_SPEC.yes24_link_clicked.source.type).toContain("first_page");
    expect(EVENT_SPEC.entry_selected.source.type).toEqual(["home", "first_page"]);
  });

  it("types the props of each event from the spec (checked by tsc)", () => {
    const shown: PropsOf<"bookmark_shown"> = {
      book_id: "9788998441012", position: 1, one_liner_style: "summary", pick_type: "random", art: { animal: "fox" },
      challenge_rule: 19, challenge_genre: "과학 교양",
    };
    const answered: PropsOf<"question_answered"> = { node_id: "start", kind: "narrow", choice: "unsure", depth: 1, position: 1, elapsed_ms: 900 };
    const visit: PropsOf<"site_visited"> = { utm_source: "threads", utm_medium: "social", utm_campaign: null };
    // @ts-expect-error — the visit always carries the three utm tags (null when the address had none, taxonomy v1.4)
    const bare: PropsOf<"site_visited"> = {};
    // @ts-expect-error — `kind` is the old name of pick_type (taxonomy 4-4)
    const old: PropsOf<"bookmark_reacted"> = { book_id: "1", position: 1, reaction: "pass", pick_type: "random", one_liner_style: "summary", kind: "random" };
    // @ts-expect-error — entry_selected has no `entry` of its own (props.entry was removed; the entry is common)
    const entry: PropsOf<"entry_selected"> = { source: "home", entry: "leaf" };
    // @ts-expect-error — kind is an enum: narrow or mood
    const side: PropsOf<"question_answered"> = { node_id: "start", kind: "both", choice: "A", depth: 1, position: 1, elapsed_ms: 1 };
    const decorated: PropsOf<"bookmark_decorated"> = {
      book_id: "9788998441012", parts_changed: ["animal", "ground"], tiers_changed: ["limited", "common"],
      art: { animal: "otter", bg: "night", ground: "none", rare: true }, is_reset: false,
    };
    // @ts-expect-error — parts_changed is a list of the three part kinds (E-38, v1.6)
    const oneKind: PropsOf<"bookmark_decorated"> = { book_id: "1", parts_changed: "animal", tiers_changed: [], art: {}, is_reset: false };
    expect([shown, answered, visit, bare, old, entry, side, decorated, oneKind]).toHaveLength(9);
  });
});

const good = { anon_id: "a", user_id: null, session_id: "s", round: 1, entry: null, mode: null, screen_version: "v2",
  referrer: "", is_returning: false, device: "phone", is_in_app_browser: false };

describe("parseCommon", () => {
  it("returns exactly the COMMON_KEYS (taxonomy 3-1: Boolean names start with is_)", () => {
    expect(Object.keys(parseCommon(good) ?? {}).sort()).toEqual([...COMMON_KEYS].sort());
    expect(COMMON_KEYS).toContain("is_returning");
    expect(COMMON_KEYS).toContain("is_in_app_browser");
  });

  it("accepts a complete common block and returns only the known keys", () => {
    expect(parseCommon(good)).toEqual(good);
    expect(parseCommon({ ...good, entry: "leaf", mode: "challenge", user_id: "u1", round: 1000, device: "desktop" })).toMatchObject({ entry: "leaf", mode: "challenge", user_id: "u1" });
    expect(parseCommon({ ...good, extra: "x" })).toEqual(good);
  });

  it.each([
    ["not an object", 1], ["null", null], ["an array", [good]],
  ])("rejects %s", (_, x) => expect(parseCommon(x)).toBeNull());

  it.each(Object.keys(good))("rejects a missing %s", (key) => {
    const rest: Record<string, unknown> = { ...good };
    delete rest[key];
    expect(parseCommon(rest)).toBeNull();
  });

  it.each([
    ["anon_id number", { anon_id: 1 }],
    ["empty anon_id", { anon_id: "" }],
    ["anon_id over 200", { anon_id: "x".repeat(201) }],
    ["session_id over 200", { session_id: "x".repeat(201) }],
    ["screen_version over 200", { screen_version: "x".repeat(201) }],
    ["user_id over 200", { user_id: "x".repeat(201) }],
    ["user_id undefined", { user_id: undefined }],
    ["referrer number", { referrer: 1 }],
    ["round 0.5", { round: 0.5 }],
    ["round -1", { round: -1 }],
    ["round 1001", { round: 1001 }],
    ["round string", { round: "1" }],
    ["entry unknown", { entry: "shelf" }],
    ["entry undefined", { entry: undefined }],
    ["mode unknown", { mode: "both" }],
    ["mode undefined", { mode: undefined }],
    ["device tablet", { device: "tablet" }],
    ["is_returning string", { is_returning: "false" }],
    ["is_in_app_browser 0", { is_in_app_browser: 0 }],
  ])("rejects %s", (_, patch) => expect(parseCommon({ ...good, ...patch })).toBeNull());

  it.each([
    ["499 + emoji (cut lands inside the pair)", "x".repeat(499) + "😀", "x".repeat(499)],
    ["498 + emoji (pair ends exactly at 500)", "x".repeat(498) + "😀", "x".repeat(498) + "😀"],
    ["500 + emoji", "x".repeat(500) + "😀", "x".repeat(500)],
    ["501 plain", "x".repeat(501), "x".repeat(500)],
  ])("never leaves half an emoji when cutting: %s", (_, input, expected) => {
    expect(cutText(input, 500)).toBe(expected);
  });

  it.each([
    ["a search address", "https://www.Google.com/search?q=%EB%82%B4+%EC%9D%B4%EB%A6%84", "www.google.com"],
    ["the Instagram link shim", "https://l.instagram.com/?u=https%3A%2F%2Fgalpi.example%2F&e=AT0", "l.instagram.com"],
    ["a port and a path", "http://localhost:3217/privacy#top", "localhost"],
    ["an app referrer", "android-app://com.linkedin.android/", "com.linkedin.android"],
    ["a host already cut", "lnkd.in", "lnkd.in"],
    ["empty (in-app browsers, typed address)", "", ""],
    ["about:blank", "about:blank", ""],
    ["an IPv6 literal", "http://[::1]/", ""],
    ["junk", "not a url at all", ""],
    ["a host over 253 characters", "a".repeat(254), ""],
  ])("keeps only the referrer's host (taxonomy v1.4): %s", (_, input, expected) => {
    expect(referrerHost(input)).toBe(expected);
    expect(parseCommon({ ...good, referrer: input })?.referrer).toBe(expected);
  });

  it("accepts the limits themselves", () => {
    expect(parseCommon({ ...good, anon_id: "x".repeat(200), referrer: "y".repeat(253), round: 0 })?.referrer).toBe("y".repeat(253));
  });
});
