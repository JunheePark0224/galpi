import { describe, expect, it } from "vitest";
import { COMMON_KEYS, cutText, EVENT_NAMES, EVENT_SPEC, isEventName, parseCommon, type PropsOf } from "./schema";

describe("event schema", () => {
  it("lists the 25 taxonomy events in PRD order (E-04 removed, E-26 last)", () => {
    expect(EVENT_NAMES).toHaveLength(25);
    expect(EVENT_NAMES[0]).toBe("site_visited");
    expect(EVENT_NAMES[24]).toBe("goal_submitted");
    expect(EVENT_NAMES).not.toContain("visit");
  });

  it("accepts only known names, never inherited object keys", () => {
    expect(isEventName("bookmark_reacted")).toBe(true);
    expect(isEventName("drop_table")).toBe(false);
    expect(isEventName("constructor")).toBe(false);
    expect(isEventName("__proto__")).toBe(false);
    expect(isEventName(42)).toBe(false);
  });

  it("marks goal_text Supabase only and prompt_version Amplitude only (taxonomy 2-7)", () => {
    expect(EVENT_SPEC.free_goal_written.goal_text).toMatchObject({ only: "supabase", max: 30 });
    expect(EVENT_SPEC.site_visited.prompt_version).toMatchObject({ only: "amplitude" });
  });

  it("F-24: the missing phrase is Supabase only (≤20), its yes/no goes to both; E-18 from the first page has no book", () => {
    expect(EVENT_SPEC.free_goal_written.missing_text).toMatchObject({ only: "supabase", max: 20, nullable: true });
    expect(EVENT_SPEC.free_goal_written.has_missing).toEqual({ type: "boolean" });
    expect(EVENT_SPEC.goal_coverage_checked.understood.type).toEqual(["keyword", "topic", "missing", "none"]);
    expect(EVENT_SPEC.yes24_link_clicked.source.type).toContain("first_page");
    expect(EVENT_SPEC.yes24_link_clicked.book_id).toMatchObject({ nullable: true });
    expect(EVENT_SPEC.entry_selected.source.type).toEqual(["home", "first_page"]);
  });

  it("types the props of each event from the spec (checked by tsc)", () => {
    const shown: PropsOf<"bookmark_shown"> = {
      book_id: "9788998441012", position: 1, one_liner_style: "summary", pick_type: "random", art: { animal: "fox" },
    };
    const goal: PropsOf<"free_goal_written"> = {
      goal_text: "SQL", topic: "데이터 분석", keywords: ["SQL"], is_matched: true, method: "word", has_missing: false, missing_text: null,
    };
    const visit: PropsOf<"site_visited"> = {};
    // @ts-expect-error — `kind` is the old name of pick_type (taxonomy 4-4)
    const old: PropsOf<"bookmark_reacted"> = { book_id: "1", position: 1, reaction: "pass", pick_type: "random", one_liner_style: "summary", kind: "random" };
    // @ts-expect-error — entry_selected has no `entry` of its own (props.entry was removed; the entry is common)
    const entry: PropsOf<"entry_selected"> = { source: "home", entry: "leaf" };
    // @ts-expect-error — side is an enum: left, right or null
    const side: PropsOf<"balance_answered"> = { question_no: 1, choice: "A", side: "middle", elapsed_ms: 1, is_edit: false };
    expect([shown, goal, visit, old, entry, side]).toHaveLength(6);
  });
});

const good = { anon_id: "a", user_id: null, session_id: "s", round: 1, entry: null, screen_version: "v1",
  referrer: "", is_returning: false, device: "phone", is_in_app_browser: false };

describe("parseCommon", () => {
  it("returns exactly the COMMON_KEYS (taxonomy 3-1: Boolean names start with is_)", () => {
    expect(Object.keys(parseCommon(good) ?? {}).sort()).toEqual([...COMMON_KEYS].sort());
    expect(COMMON_KEYS).toContain("is_returning");
    expect(COMMON_KEYS).toContain("is_in_app_browser");
  });

  it("accepts a complete common block and returns only the known keys", () => {
    expect(parseCommon(good)).toEqual(good);
    expect(parseCommon({ ...good, entry: "leaf", user_id: "u1", round: 1000, device: "desktop" })).toMatchObject({ entry: "leaf", user_id: "u1" });
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
    ["device tablet", { device: "tablet" }],
    ["is_returning string", { is_returning: "false" }],
    ["is_in_app_browser 0", { is_in_app_browser: 0 }],
  ])("rejects %s", (_, patch) => expect(parseCommon({ ...good, ...patch })).toBeNull());

  it("cuts a referrer over 500 characters instead of rejecting it (ids stay strict)", () => {
    expect(parseCommon({ ...good, referrer: "x".repeat(900) })?.referrer).toBe("x".repeat(500));
  });

  it.each([
    ["499 + emoji (cut lands inside the pair)", "x".repeat(499) + "😀", "x".repeat(499)],
    ["498 + emoji (pair ends exactly at 500)", "x".repeat(498) + "😀", "x".repeat(498) + "😀"],
    ["500 + emoji", "x".repeat(500) + "😀", "x".repeat(500)],
    ["501 plain", "x".repeat(501), "x".repeat(500)],
  ])("never leaves half an emoji when cutting: %s", (_, input, expected) => {
    expect(cutText(input, 500)).toBe(expected);
    expect(parseCommon({ ...good, referrer: input })?.referrer).toBe(expected);
  });

  it("accepts the limits themselves", () => {
    expect(parseCommon({ ...good, anon_id: "x".repeat(200), referrer: "y".repeat(500), round: 0 })).not.toBeNull();
  });
});
