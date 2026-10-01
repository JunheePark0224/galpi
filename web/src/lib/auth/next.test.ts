import { describe, expect, it } from "vitest";
import { LOGIN_PARAMS, readLoginMark, safeNext, withLoginMark } from "./next";

describe("safeNext — where /auth/callback may send someone back (same site only)", () => {
  it("keeps a path on this site with its query", () => {
    expect(safeNext("/")).toBe("/");
    expect(safeNext("/library?x=1")).toBe("/library?x=1");
  });

  it("refuses anything that could leave the site, and falls back to the start", () => {
    for (const bad of ["https://evil.example/", "//evil.example", "/\\evil.example", "/x/..\\..\\/evil.example", "evil", "", null, undefined, "javascript:alert(1)", "/%2F%2Fevil.example"]) {
      expect(safeNext(bad), String(bad)).toBe("/");
    }
  });

  it("drops the hash, an earlier login mark and very long values", () => {
    expect(safeNext("/a#b")).toBe("/a");
    expect(safeNext("/?login=kakao&first=1&y=2")).toBe("/?y=2");
    expect(safeNext(`/${"a".repeat(600)}`)).toBe("/");
  });
});

describe("login mark — /auth/callback tells the page it came back from logging in (E-14 once)", () => {
  it("adds and reads the provider and first-login flag", () => {
    const url = withLoginMark("/?y=2", "kakao", true);
    expect(url).toBe("/?y=2&login=kakao&first=1");
    expect(readLoginMark(new URL(url, "http://x").searchParams)).toEqual({ provider: "kakao", first: true });
    expect(readLoginMark(new URL(withLoginMark("/", "google", false), "http://x").searchParams)).toEqual({ provider: "google", first: false });
  });

  it("marks a failed login without a provider", () => {
    expect(withLoginMark("/library", null, false)).toBe("/library?login=failed");
    expect(readLoginMark(new URLSearchParams("login=failed"))).toEqual({ provider: null, first: false });
  });

  it("reads nothing when there is no mark or an unknown provider", () => {
    expect(readLoginMark(new URLSearchParams("y=2"))).toBeNull();
    expect(readLoginMark(new URLSearchParams("login=naver"))).toBeNull();
    expect(LOGIN_PARAMS).toEqual(["login", "first"]);
  });
});
