import { expect, type Page } from "@playwright/test";
import { test } from "./helpers";

// Design pass: from S-03 on, the book fills the column and the whole scene fits the screen without page scroll.
test.use({ reducedMotion: "reduce" });

/** Neither way: a phone browser zooms the whole page out when something sticks out sideways, so compare with the set size. */
const noPageScroll = (page: Page) => {
  const size = page.viewportSize();
  return page.evaluate(({ w, h }) => {
    const doc = document.documentElement;
    return window.innerWidth === w && doc.scrollWidth <= w && doc.scrollHeight <= h;
  }, { w: size?.width ?? 0, h: size?.height ?? 0 });
};
const box = async (page: Page, selector: string) => {
  const b = await page.locator(selector).first().boundingBox();
  if (!b) throw new Error(`${selector} has no box`);
  return b;
};

/** 🎯 with one chip → S-03, checking each book step on the way to the first bookmark. */
async function walkTheBook(page: Page) {
  await page.goto("/");
  await page.getByRole("button", { name: /알고 싶은 게 있어요/ }).click();
  await page.getByRole("button", { name: "데이터 분석", exact: true }).click();
  await page.getByRole("button", { name: "책 펼치기" }).click();                  // S-02 submit

  const cover = page.getByRole("button", { name: "책 펼치기" });                  // S-03: the closed book
  await expect(page.getByText("눌러서 펼치기")).toBeVisible();
  const viewport = page.viewportSize();
  if (!viewport) throw new Error("viewport is not set");
  const closed = await cover.boundingBox();
  if (!closed) throw new Error("the closed cover has no box");
  expect(closed.height / closed.width).toBeGreaterThanOrEqual(1.35);              // a normal book, not a tall strip
  expect(closed.height / closed.width).toBeLessThanOrEqual(1.55);
  expect(closed.width).toBeGreaterThanOrEqual(Math.min(viewport.width, 430) * 0.7); // and big
  expect(closed.y).toBeGreaterThanOrEqual(52);                                     // below the logo header
  // controller ruling: the hint sits right under the cover, the pair is centred — not pushed toward the bottom of the screen
  const hint = await page.getByText("눌러서 펼치기").boundingBox();
  if (!hint) throw new Error("the hint has no box");
  const gap = hint.y - (closed.y + closed.height);
  expect(gap).toBeGreaterThanOrEqual(0);
  expect(gap).toBeLessThanOrEqual(40);
  expect(await noPageScroll(page)).toBe(true);

  await cover.click();                                                            // S-04
  await expect(page.getByRole("heading", { name: "당신이 찾는 책" })).toBeVisible();
  await expect(page.getByRole("button", { name: "다음 장" })).toBeEnabled();
  expect(await noPageScroll(page)).toBe(true);

  await page.getByRole("button", { name: "다음 장" }).click();                    // S-05
  await expect(page.getByText("1 / 5")).toBeVisible();
  await expect(page.getByRole("button", { name: "궁금해요" })).toBeEnabled();
  expect(await noPageScroll(page)).toBe(true);

  const column = await box(page, ".column");
  const bookmark = await box(page, "article");
  const folio = await page.getByText("1 / 5").boundingBox();
  const curious = await page.getByRole("button", { name: "궁금해요" }).boundingBox();
  // centred on the gutter = the middle of the column, between the two pages
  expect(Math.abs(bookmark.x + bookmark.width / 2 - (column.x + column.width / 2))).toBeLessThanOrEqual(2);
  // buttons below the book (the folio sits on the page's bottom edge)
  expect(curious?.y ?? 0).toBeGreaterThan((folio?.y ?? 0) + (folio?.height ?? 0));
  return { bookmark, viewport };
}

test("S-03 → S-05 fit a 375 × 667 phone with the bookmark in the gutter", async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 667 });
  const { bookmark } = await walkTheBook(page);
  expect(bookmark.width).toBeGreaterThanOrEqual(159);                              // the 160px frame, never smaller
});

test("on a tall screen the book and the bookmark grow", async ({ page }) => {
  const { bookmark, viewport } = await walkTheBook(page);                         // phone: Pixel 7 · laptop: 1440 × 900
  expect(viewport.height).toBeGreaterThanOrEqual(780);
  expect(bookmark.width).toBeGreaterThanOrEqual(160 * 1.25 - 1);
});

test("a 430 × 932 phone: the closed cover and its hint stay together", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "phone", "phone layout only");
  await page.setViewportSize({ width: 430, height: 932 });
  await walkTheBook(page);
});

test("desktop: the book scene leaves the 430px column, buttons stay a short row", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "laptop", "desktop layout only");
  const { viewport } = await walkTheBook(page);
  const folio = await page.getByText("1 / 5").boundingBox();                     // bottom right of the right-hand page
  expect((folio?.x ?? 0) + (folio?.width ?? 0) - viewport.width / 2).toBeGreaterThan(215);
  const pass = await page.getByRole("button", { name: "패스" }).boundingBox();
  const curious = await page.getByRole("button", { name: "궁금해요" }).boundingBox();
  expect((curious?.x ?? 0) + (curious?.width ?? 0) - (pass?.x ?? 0)).toBeLessThanOrEqual(480);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
});
