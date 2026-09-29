import { describe, expect, it } from "vitest";
import { EVENT_NAMES, isEventName } from "./schema";

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
