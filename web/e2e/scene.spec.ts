import { expect, type Page } from "@playwright/test";
import { DATA_PATH } from "../src/lib/paths/__fixtures__/paths";
import { answerPath, START, test } from "./helpers";

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
const noSideScroll = (page: Page) => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth);
/** Real phone browsers show less than the screen: 375 × 548 = an iPhone SE in Safari, 375 × 559 in KakaoTalk, 360 × 620 an Android in KakaoTalk. */
const noSizeJump = (page: Page) => {
  const size = page.viewportSize();
  return page.evaluate((w) => window.innerWidth === w && document.documentElement.scrollWidth <= w, size?.width ?? 0);
};
async function expectOnScreen(page: Page, name: string) {
  const b = await page.getByRole("button", { name }).boundingBox();
  const viewport = page.viewportSize();
  if (!b || !viewport) throw new Error(`${name} has no box`);
  expect(b.y).toBeGreaterThanOrEqual(0);
  expect(b.y + b.height).toBeLessThanOrEqual(viewport.height);
  expect(b.x + b.width).toBeLessThanOrEqual(viewport.width);
}
const box = async (page: Page, selector: string) => {
  const b = await page.locator(selector).first().boundingBox();
  if (!b) throw new Error(`${selector} has no box`);
  return b;
};

/** The data path → S-03, checking each book step on the way to the first bookmark.
 *  `fit`: no page scroll at all. `scrollOk`: on a very short window the page may scroll vertically (the book has a floor),
 *  but never sideways. `buttons`: a short phone viewport — the footer may fall below the fold, the action buttons may not. */
async function walkTheBook(page: Page, mode: "fit" | "scrollOk" | "buttons" = "fit") {
  const scrollOk = mode === "scrollOk";
  const buttons = mode === "buttons";
  const fits = async () => (buttons ? noSizeJump(page) : scrollOk ? noSideScroll(page) : noPageScroll(page));
  await page.goto("/");
  await page.getByRole("button", { name: START }).click();
  await answerPath(page, DATA_PATH);

  const cover = page.getByRole("button", { name: "책 펼치기" });                  // S-03: the closed book
  await expect(page.getByText("눌러서 펼치기")).toBeVisible();
  const viewport = page.viewportSize();
  if (!viewport) throw new Error("viewport is not set");
  const closed = await cover.boundingBox();
  if (!closed) throw new Error("the closed cover has no box");
  expect(closed.height / closed.width).toBeGreaterThanOrEqual(1.35);              // a normal book, not a tall strip
  expect(closed.height / closed.width).toBeLessThanOrEqual(1.55);
  // and big (not on a very short window). Short phone browsers (548–620 tall) give some of it to the C-19 bookmark tips.
  if (!scrollOk) expect(closed.width).toBeGreaterThanOrEqual(Math.min(viewport.width, 430) * (buttons ? 0.6 : 0.7));
  expect(closed.y).toBeGreaterThanOrEqual(52);                                     // below the logo header
  // C-01 tap cue (10-02): the hint is on the cover itself, so it is on screen whenever the cover is
  const hint = await page.getByText("눌러서 펼치기").boundingBox();
  if (!hint) throw new Error("the hint has no box");
  expect(hint.y).toBeGreaterThanOrEqual(closed.y);
  expect(hint.y + hint.height).toBeLessThanOrEqual(closed.y + closed.height);
  expect(hint.y + hint.height).toBeLessThanOrEqual(viewport.height);
  expect(await fits()).toBe(true);

  await cover.click();                                                            // S-04
  await expect(page.getByRole("heading", { name: "당신이 고른 길" })).toBeVisible();
  await expect(page.getByRole("button", { name: "다음 장" })).toBeEnabled();
  expect(await fits()).toBe(true);
  if (buttons) await expectOnScreen(page, "다음 장");

  await page.getByRole("button", { name: "다음 장" }).click();                    // S-05
  await expect(page.getByText("1 / 5")).toBeVisible();
  await expect(page.getByRole("button", { name: "궁금해요" })).toBeEnabled();
  expect(await fits()).toBe(true);
  if (buttons) for (const name of ["패스", "궁금해요"]) await expectOnScreen(page, name);

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

for (const [width, height] of [[375, 548], [375, 559], [360, 620]]) {
  test(`a short phone viewport ${width} × ${height}: the buttons stay on screen and the bookmark stays in the book`, async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== "phone", "phone layout only");
    await page.setViewportSize({ width, height });
    await walkTheBook(page, "buttons");
    const card = await box(page, "article");
    const stage = await page.getByText("1 / 5").locator("xpath=..").boundingBox();
    if (!stage) throw new Error("the stage has no box");
    expect(card.y + card.height).toBeLessThanOrEqual(stage.y + stage.height);
    expect(card.x).toBeGreaterThanOrEqual(0);
    expect(card.x + card.width).toBeLessThanOrEqual(width);
  });
}

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

// Short laptop windows (1366 × 768 ≈ 650 tall, 1280 × 720 ≈ 600 tall): the bookmark must stay inside the book and off the buttons.
for (const [width, height] of [[1366, 650], [1280, 600]]) {
  test(`desktop ${width} × ${height}: the bookmark stays inside the book, clear of the buttons`, async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== "laptop", "desktop layout only");
    await page.setViewportSize({ width, height });
    await walkTheBook(page, "scrollOk");
    const card = await box(page, "article");
    const stage = await page.getByText("1 / 5").locator("xpath=..").boundingBox();   // the stage is exactly the book's box
    const pass = await page.getByRole("button", { name: "패스" }).boundingBox();
    const curious = await page.getByRole("button", { name: "궁금해요" }).boundingBox();
    if (!stage || !pass || !curious) throw new Error("layout boxes missing");
    expect(card.y + card.height).toBeLessThanOrEqual(stage.y + stage.height);
    for (const b of [pass, curious]) {
      const apart = card.y + card.height <= b.y || b.y + b.height <= card.y || card.x + card.width <= b.x || b.x + b.width <= card.x;
      expect(apart).toBe(true);
    }
    expect(await noSideScroll(page)).toBe(true);
  });
}

// A browser without :has() (Firefox < 121, Safari < 15.4) keeps the 430px column; the book must fit it, not be clipped by it.
// Chromium has :has(), so the test makes every stylesheet believe it does not: the one `@supports selector(:has(*))` test
// that guards the desktop sizes (BookScene.module.css) and the column release (globals.css) is rewritten to one that fails.
test("desktop without :has(): the book scene keeps the 430px column and the flow still completes", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "laptop", "desktop layout only");
  let rewritten = 0;
  await page.route(/\.css(\?.*)?$/, async (route) => {
    const response = await route.fetch();
    const css = await response.text();
    const legacy = css.replaceAll(/@supports\s+selector\(:has\(\*\)\)/g, () => { rewritten += 1; return "@supports (not (display: block))"; });
    await route.fulfill({ response, body: legacy });
  });
  await walkTheBook(page, "scrollOk");
  expect(rewritten).toBeGreaterThan(0);                                            // the switch really was in the served CSS
  const column = await box(page, ".column");
  expect(column.width).toBeLessThanOrEqual(430);
  const book = await box(page, "article");                                         // the bookmark on S-05 is inside the column
  expect(book.x).toBeGreaterThanOrEqual(column.x);
  expect(book.x + book.width).toBeLessThanOrEqual(column.x + column.width);
  const stage = await page.getByText("1 / 5").locator("xpath=..").boundingBox();   // and so is the whole book
  if (!stage) throw new Error("the stage has no box");
  expect(stage.x).toBeGreaterThanOrEqual(column.x);
  expect(stage.x + stage.width).toBeLessThanOrEqual(column.x + column.width);
});
