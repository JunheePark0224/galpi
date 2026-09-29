import { expect, test } from "@playwright/test";

test("home page responds", async ({ page }) => {
  const res = await page.goto("/");
  expect(res?.status()).toBe(200);
});
