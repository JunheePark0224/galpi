import { expect } from "@playwright/test";
import { test } from "./helpers";

// `next start` here is not Vercel production, so /design still renders (design.spec.ts); the 404 is unit-tested.
test("robots.txt hides /design and /api/", async ({ request }) => {
  const txt = await (await request.get("/robots.txt")).text();
  expect(txt).toContain("Disallow: /design");
  expect(txt).toContain("Disallow: /api/");
});

test("every route carries the security headers and no X-Powered-By", async ({ request }) => {
  for (const path of ["/", "/privacy", "/robots.txt", "/no-such-page"]) {
    const h = (await request.get(path)).headers();
    expect(h["x-content-type-options"], path).toBe("nosniff");
    expect(h["referrer-policy"], path).toBe("strict-origin-when-cross-origin");
    expect(h["x-frame-options"], path).toBe("DENY");
    expect(h["content-security-policy"], path).toBe("frame-ancestors 'none'");
    expect(h["x-powered-by"], path).toBeUndefined();
  }
  const api = await request.post("/api/track", { data: {} });
  expect(api.headers()["x-content-type-options"]).toBe("nosniff");
});
