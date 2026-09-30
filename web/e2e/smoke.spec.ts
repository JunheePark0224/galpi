import { expect } from "@playwright/test";
import { test } from "./helpers";

test("home page responds", async ({ page }) => {
  const res = await page.goto("/");
  expect(res?.status()).toBe(200);
});

test("opts out of forced dark mode (no dark theme by design)", async ({ page }) => {
  await page.goto("/");
  await expect(page.locator('meta[name="color-scheme"]')).toHaveAttribute("content", "only light");
  const scheme = await page.evaluate(() => getComputedStyle(document.documentElement).colorScheme);
  expect(scheme.split(" ").sort()).toEqual(["light", "only"]); // browsers serialise it as "light only"
});
