import { expect, test } from "@playwright/test";

test("design page shows tokens and buttons", async ({ page }) => {
  await page.goto("/design");
  await expect(page.getByRole("button", { name: "궁금해요" })).toBeVisible();
  const ink = await page.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue("--ink").trim());
  expect(ink.toUpperCase()).toBe("#2B2724");
});

test("content column is 430px and centered on laptop, full width on phone", async ({ page }, testInfo) => {
  await page.goto("/");
  const viewport = page.viewportSize();
  if (!viewport) throw new Error("viewport is not set");
  const rect = await page.locator(".column").evaluate((el) => {
    const r = el.getBoundingClientRect();
    return { left: r.left, width: r.width };
  });
  if (testInfo.project.name === "laptop") {
    expect(rect.width).toBe(430);
    expect(Math.round(rect.left)).toBe(Math.round((viewport.width - 430) / 2));
  } else {
    expect(rect.width).toBe(viewport.width);
  }
});

test("footer credits YES24", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByText("예스24와 무관한 개인 프로젝트")).toBeVisible();
});

test("frost and book tokens exist for bookmarks", async ({ page }) => {
  await page.goto("/design");
  const values = await page.evaluate(() => {
    const s = getComputedStyle(document.documentElement);
    return ["--frost-blur", "--frost-edge", "--radius-book", "--radius-bookmark"].map((k) => s.getPropertyValue(k).trim());
  });
  const [blur, edge, book, bookmark] = values;
  expect([blur, book, bookmark]).toEqual(["blur(3px) saturate(1.1)", "2px 10px 10px 2px", "10px 10px 0 0"]);
  // the production build minifies rgba(255, 255, 255, 0.8) to #fffc
  expect(edge).toMatch(/^1px solid (rgba\(255, 255, 255, 0\.8\)|#fffc)$/);
});

test("design page shows a bookmark with its reading label", async ({ page }) => {
  await page.goto("/design");
  await expect(page.getByRole("article", { name: /천천히 걷는 아침/ })).toBeVisible();
});
