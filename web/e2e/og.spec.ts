import { expect } from "@playwright/test";
import { test } from "./helpers";

// Link preview card (10-05): the home page tells LinkedIn, Threads, Instagram and KakaoTalk what to show.
test("home carries the link preview card (og + twitter)", async ({ page, request }) => {
  await page.goto("/");
  const og = page.locator('meta[property="og:image"]').first();
  await expect(og).toHaveAttribute("content", /\/opengraph-image\.png/);
  await expect(page.locator('meta[property="og:title"]')).toHaveAttribute("content", "갈피");
  await expect(page.locator('meta[property="og:description"]')).toHaveAttribute("content", /갈피가 안 잡힐 때/);
  await expect(page.locator('meta[name="twitter:card"]')).toHaveAttribute("content", "summary_large_image");
  const img = await request.get(new URL(await og.getAttribute("content") ?? "").pathname);
  expect(img.status()).toBe(200);
  expect(img.headers()["content-type"]).toContain("image/png");
});
