import { expect, type Page } from "@playwright/test";
import { test, toClosedBook } from "./helpers";

// DESIGN C-19: five bookmark tips stand out of the closed book (S-03) — under the header, the cover + hint still on screen.

const tips = (page: Page) => page.locator("[data-tip]");

/** Top of the highest tip (films, strings and knots — not the strings' oversized svg boxes), bottom of the header. */
async function tipTopAndHeader(page: Page) {
  const tipTop = await page.locator("[data-cover-peeks] path, [data-cover-peeks] circle, [data-tip] > div").evaluateAll((els) =>
    Math.min(...els.map((el) => el.getBoundingClientRect().top)));
  const header = await page.locator("header").first().boundingBox();
  if (!header) throw new Error("no header");
  return { tipTop, headerBottom: header.y + header.height };
}

test.describe("reduced motion", () => {
  test.use({ reducedMotion: "reduce" });

  for (const [w, h] of [[375, 548], [375, 667], [320, 568]] as const) {
    test(`S-03 ${w}×${h}: five tips below the header, cover and hint on screen, no sideways scroll`, async ({ page }) => {
      await page.setViewportSize({ width: w, height: h });
      await toClosedBook(page);
      await expect(tips(page)).toHaveCount(5);
      const { tipTop, headerBottom } = await tipTopAndHeader(page);
      expect(tipTop).toBeGreaterThanOrEqual(headerBottom);
      const hint = await page.getByText("눌러서 펼치기").boundingBox();
      expect(hint && hint.y + hint.height).toBeLessThanOrEqual(h);
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
      // the five stand side by side, none hidden behind another: centres at least 85% of a tip's width apart
      const boxes = await tips(page).evaluateAll((els) => els.map((el) => el.getBoundingClientRect()).map((r) => ({ c: r.left + r.width / 2, w: r.width })));
      const sorted = [...boxes].sort((a, b) => a.c - b.c);
      for (let i = 1; i < sorted.length; i++) expect(sorted[i].c - sorted[i - 1].c).toBeGreaterThanOrEqual(sorted[i].w * 0.85);
    });
  }

  test("S-03 desktop 1280×800: tips below the header, the hint on screen", async ({ page }, info) => {
    test.skip(info.project.name !== "laptop", "a desktop window");
    await page.setViewportSize({ width: 1280, height: 800 });
    await toClosedBook(page);
    await expect(tips(page)).toHaveCount(5);
    const { tipTop, headerBottom } = await tipTopAndHeader(page);
    expect(tipTop).toBeGreaterThanOrEqual(headerBottom);
    const hint = await page.getByText("눌러서 펼치기").boundingBox();
    expect(hint && hint.y + hint.height).toBeLessThanOrEqual(800);
  });

  test("reduced motion: the tips are in place from the start (no rise, frost on)", async ({ page }) => {
    await toClosedBook(page);
    await expect(tips(page)).toHaveCount(5);
    expect(await page.locator("[data-tip][data-moving]").count()).toBe(0);
    const first = await tips(page).first().boundingBox();
    await page.waitForTimeout(400);
    expect(await tips(page).first().boundingBox()).toEqual(first);
  });
});

test("the tips rise one after another (no frost blur while moving), then settle", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await toClosedBook(page);
  await expect(tips(page)).toHaveCount(5);
  await expect(page.locator("[data-tip][data-moving]")).toHaveCount(0, { timeout: 3000 });
});

test("opening the book fades the tips out", async ({ page }) => {
  await toClosedBook(page);
  await page.getByRole("button", { name: "책 펼치기" }).click();
  await expect(page.getByRole("heading", { name: "당신이 고른 길" })).toBeVisible();
  for (const layer of await page.locator("[data-cover-peeks]").all()) await expect(layer).toHaveAttribute("data-open", "");
});
