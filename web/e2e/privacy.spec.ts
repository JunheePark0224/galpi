import { expect } from "@playwright/test";
import { test } from "./helpers";

test.use({ reducedMotion: "reduce" });

test("🎯 input → 처리방침 link → /privacy → 처음으로", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: /알고 싶은 게 있어요/ }).click();
  await page.getByRole("link", { name: "처리방침" }).first().click();

  await expect(page).toHaveURL(/\/privacy$/);
  await expect(page.getByRole("heading", { level: 1, name: "개인정보 처리방침" })).toBeVisible();
  await expect(page.getByText("수집일로부터 1년이 지나면 자동으로 지워져요.")).toBeVisible();
  await expect(page.getByRole("table").getByRole("row")).toHaveCount(11);   // header + 10 (P5: login, Google email, 내 책갈피; F-26: 갈피 우체통)
  // the home visit already created this browser's id; /privacy only shows it
  const stored = await page.evaluate(() => localStorage.getItem("galpi.anon"));
  expect(stored).toMatch(/^[0-9a-f-]{36}$/);
  await expect(page.getByText(stored ?? "")).toBeVisible();

  await page.getByRole("link", { name: "처음으로" }).click();
  await expect(page).toHaveURL(/\/$/);
  // 처음으로 is a fresh open: S-01, not the 🎯 input screen it left
  await expect(page.getByRole("button", { name: /알고 싶은 게 있어요/ })).toBeVisible();
  await expect(page.getByRole("button", { name: /그냥 한 권 만나고 싶어요/ })).toBeVisible();
});

test("a first visit straight to /privacy records nothing and creates no id", async ({ page }) => {
  await page.goto("/privacy");
  await expect(page.getByText("아직 기록이 없어요")).toBeVisible();
  expect(await page.evaluate(() => localStorage.getItem("galpi.anon"))).toBeNull();
  // nothing stored by the site — the only key is the one the shared fixture sets (C-20 guide marked as seen)
  expect(await page.evaluate(() => Object.keys(localStorage).filter((k) => k !== "galpi.hint.firstGuide"))).toEqual([]);
});

test("footer links to the policy from the home page", async ({ page }) => {
  await page.goto("/");
  const link = page.locator("footer").getByRole("link", { name: "처리방침" });
  await expect(link).toHaveAttribute("href", "/privacy");
  await link.click();
  await expect(page.getByRole("heading", { level: 1, name: "개인정보 처리방침" })).toBeVisible();
});

test("shows the stored anonymous id and offers copy", async ({ page, context }) => {
  await context.grantPermissions(["clipboard-read", "clipboard-write"]).catch(() => undefined);
  await page.addInitScript(() => localStorage.setItem("galpi.anon", "22222222-2222-4222-8222-222222222222"));
  await page.goto("/privacy");
  await expect(page.getByText("22222222-2222-4222-8222-222222222222")).toBeVisible();
  const copy = page.getByRole("button", { name: "복사", exact: true });
  const box = await copy.boundingBox();
  expect(box?.height ?? 0).toBeGreaterThanOrEqual(44);
  await copy.click();
  await expect(page.getByRole("button", { name: /복사했어요|복사하지 못했어요/ }).or(page.getByText("복사하지 못했어요. 번호를 길게 눌러 복사해 주세요"))).toBeVisible();
});
