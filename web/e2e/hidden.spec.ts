import { expect } from "@playwright/test";
import { test } from "./helpers";

// `next start` here is not Vercel production, so /design still renders (design.spec.ts); the 404 is unit-tested.
test("robots.txt hides /design and /api/", async ({ request }) => {
  const txt = await (await request.get("/robots.txt")).text();
  expect(txt).toContain("Disallow: /design");
  expect(txt).toContain("Disallow: /api/");
});
