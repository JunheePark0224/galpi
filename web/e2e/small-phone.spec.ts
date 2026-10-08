import { expect, type Page } from "@playwright/test";
import { test, toClosedBook } from "./helpers";

// Launch sweep (docs/launch-sweep.md, 10-05): the small-phone layout fixes, each held by an assertion here.
// 320 × 568 = iPhone SE (1st) / small Android; 375 × 559 ≈ a 375 × 667 phone inside KakaoTalk's or Instagram's browser.
test.use({ reducedMotion: "reduce", isMobile: true, hasTouch: true });

/** S-04 with the ten-question data path (7 path rows + 1 mood row — the longest summary the fixtures draw). */
async function toFirstPage(page: Page) {
  await toClosedBook(page);
  await page.getByRole("button", { name: "책 펼치기" }).click();
  await expect(page.getByRole("button", { name: "다음 장" })).toBeEnabled();
}

/** The S-04 summary page: how far its content runs past its own box (0 = all on the page, nothing in its scroll). */
const pageOverflow = (page: Page) => page.locator("section[aria-labelledby='path-mood']").evaluate((mood) => {
  const box = mood.parentElement as HTMLElement;
  return box.scrollHeight - box.clientHeight;
});

for (const [w, h] of [[320, 568], [375, 559]] as const) {
  test.describe(`${w} × ${h}`, () => {
    test.use({ viewport: { width: w, height: h } });

    test("S-04: every path and mood line is on the page — the last mood line is not hidden in the page's scroll", async ({ page }, info) => {
      test.skip(info.project.name !== "phone", "one viewport is set here; the phone project is enough");
      await toFirstPage(page);
      await expect(page.getByRole("heading", { name: "기분" })).toBeVisible();
      expect(await pageOverflow(page)).toBeLessThanOrEqual(0);
      const lastMood = page.locator("section[aria-labelledby='path-mood'] li").last();
      await expect(lastMood).toBeInViewport({ ratio: 1 });
    });

    test("S-04: [← 질문으로 돌아가기] and [다음 장] share one row, both on screen and at least 44px", async ({ page }, info) => {
      test.skip(info.project.name !== "phone", "one viewport is set here; the phone project is enough");
      await toFirstPage(page);
      const back = await page.getByRole("button", { name: /질문으로 돌아가기/ }).boundingBox();
      const next = await page.getByRole("button", { name: "다음 장" }).boundingBox();
      expect(back && next).toBeTruthy();
      expect(Math.abs(back!.y - next!.y)).toBeLessThan(1);                 // one row
      expect(next!.x).toBeGreaterThan(back!.x + back!.width);
      expect(next!.y + next!.height).toBeLessThanOrEqual(h);              // [다음 장] above the fold
      for (const b of [back!, next!]) {
        expect(b.height).toBeGreaterThanOrEqual(44);
        expect(b.width).toBeGreaterThanOrEqual(44);
      }
      expect(await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)).toBe(0);
    });
  });
}

test.describe("320 × 568 footer", () => {
  test.use({ viewport: { width: 320, height: 568 } });

  test("[처리방침] stays one word on one line and is a 44px target", async ({ page }, info) => {
    test.skip(info.project.name !== "phone", "one viewport is set here; the phone project is enough");
    await page.goto("/privacy");
    const link = page.getByRole("contentinfo").getByRole("link", { name: "처리방침" });
    const box = await link.boundingBox();
    expect(box!.height).toBeGreaterThanOrEqual(44);
    expect(box!.width).toBeGreaterThanOrEqual(44);
    // one line: the text's own line boxes (not the padded box) — two rects would mean "처 / 리방침"
    expect(await link.evaluate((a) => {
      const range = document.createRange();
      range.selectNodeContents(a);
      return new Set([...range.getClientRects()].map((r) => Math.round(r.top))).size;
    })).toBe(1);
  });
});
