import { expect } from "@playwright/test";
import { test } from "./helpers";

test("home page responds", async ({ page }) => {
  const res = await page.goto("/");
  expect(res?.status()).toBe(200);
});
