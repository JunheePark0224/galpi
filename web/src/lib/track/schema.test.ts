import { describe, expect, it } from "vitest";
import { EVENT_NAMES, isEventName, parseCommon } from "./schema";

describe("event schema", () => {
  it("lists the 24 PRD events in order (E-04 removed)", () => {
    expect(EVENT_NAMES).toHaveLength(24);
    expect(EVENT_NAMES[0]).toBe("visit");
    expect(EVENT_NAMES[23]).toBe("unsure_hold_cancelled");
  });

  it("accepts only known names", () => {
    expect(isEventName("bookmark_reacted")).toBe(true);
    expect(isEventName("drop_table")).toBe(false);
    expect(isEventName(42)).toBe(false);
  });
});

const good = { anon_id: "a", user_id: null, session_id: "s", round: 1, entry: null, screen_version: "v1",
  referrer: "", returning: false, device: "phone", in_app_browser: false };

describe("parseCommon", () => {
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
    ["returning string", { returning: "false" }],
    ["in_app_browser 0", { in_app_browser: 0 }],
  ])("rejects %s", (_, patch) => expect(parseCommon({ ...good, ...patch })).toBeNull());

  it("cuts a referrer over 500 characters instead of rejecting it (ids stay strict)", () => {
    expect(parseCommon({ ...good, referrer: "x".repeat(900) })?.referrer).toBe("x".repeat(500));
  });

  it("accepts the limits themselves", () => {
    expect(parseCommon({ ...good, anon_id: "x".repeat(200), referrer: "y".repeat(500), round: 0 })).not.toBeNull();
  });
});
