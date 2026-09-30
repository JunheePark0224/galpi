import { describe, expect, it } from "vitest";
import robots from "./robots";

describe("robots", () => {
  it("allows the site but not /design or /api/", () => {
    expect(robots().rules).toEqual({ userAgent: "*", allow: "/", disallow: ["/design", "/api/"] });
  });
});
