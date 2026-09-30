import { afterEach, describe, expect, it, vi } from "vitest";
import DesignPage from "./page";

describe("/design", () => {
  afterEach(() => vi.unstubAllEnvs());

  it("renders outside production (local, previews)", () => {
    vi.stubEnv("VERCEL_ENV", "preview");
    expect(() => DesignPage()).not.toThrow();
    vi.stubEnv("VERCEL_ENV", "");
    expect(() => DesignPage()).not.toThrow();
  });

  it("is a 404 in production", () => {
    vi.stubEnv("VERCEL_ENV", "production");
    expect(() => DesignPage()).toThrow(/NEXT_HTTP_ERROR_FALLBACK;404/);
  });
});
