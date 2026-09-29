import { expect, test } from "@playwright/test";

test("design page shows tokens and buttons", async ({ page }) => {
  await page.goto("/design");
  await expect(page.getByRole("button", { name: "궁금해요" })).toBeVisible();
  const ink = await page.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue("--ink").trim());
  expect(ink.toUpperCase()).toBe("#2B2724");
});

test("content column is at most 430px wide", async ({ page }) => {
  await page.goto("/");
  const width = await page.locator(".column").evaluate((el) => el.getBoundingClientRect().width);
  expect(width).toBeLessThanOrEqual(430);
});

test("footer credits YES24", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByText("예스24와 무관한 개인 프로젝트")).toBeVisible();
});
