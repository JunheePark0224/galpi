import { expect, type Page } from "@playwright/test";
import { reactToBookmarks, test, toBookmarks } from "./helpers";

// C-21: the first S-06 book explains itself once per browser — the peeking bookmark, ‹ ›, 🔖 내 책갈피에 저장, [알겠어요] (10-02, v1.7).
const SHOTS = process.env.GUIDE_SHOTS;   // a folder: save screenshots there when set (manual design check)

async function toFirstResult(page: Page) {
  await page.addInitScript(() => { try { window.localStorage.removeItem("galpi.hint.resultGuide"); } catch { /* blocked */ } });
  // E2E has no YES24 key: synthetic detail, never real YES24 text.
  await page.route(/\/api\/books\/\d{13}$/, (route) => route.fulfill({
    json: { source: "yes24", cover: null, price: 14400, rating: 9.4, pages: 280, intro: "테스트를 위해 지어낸 소개예요.", link: "https://www.yes24.com/product/goods/1" },
  }));
  await toBookmarks(page);
  await reactToBookmarks(page, ["궁금해요", "패스", "궁금해요", "패스", "패스"]);
  await expect(page.getByText("궁금해요 1 / 2")).toBeVisible();
}
const guide = (page: Page) => page.getByRole("dialog", { name: "궁금해요 책 보는 법" });
const WORDS = ["① 책갈피를 누르면 꺼내져요 · 뒷면에 나온 이유", "② ‹ › 로 앞뒤 책을 봐요", "③ 🔖 내 책갈피에 저장해 두면 나중에 다시 볼 수 있어요"];

for (const [w, h] of [[375, 667], [320, 568], [1280, 800]] as const) {
  test(`${w}×${h}: the S-06 guide lights the bookmark, ‹ › and the save button with its words on screen, once`, async ({ page }, info) => {
    test.skip(w === 1280 && info.project.name !== "laptop", "a desktop window");
    test.skip(w !== 1280 && info.project.name !== "phone", "a phone window");
    await page.setViewportSize({ width: w, height: h });
    await toFirstResult(page);
    await expect(guide(page)).toBeVisible();
    await expect(page.getByRole("button", { name: "알겠어요" })).toBeFocused();
    if (SHOTS) await page.screenshot({ path: `${SHOTS}/s06-guide-${w}.png` });
    const boxes = [];
    for (const words of WORDS) {
      const box = (await page.getByText(words).boundingBox())!;
      expect(box.y >= 0 && box.y + box.height <= h && box.x >= 0 && box.x + box.width <= w, words).toBe(true);
      boxes.push(box);
    }
    const ok = (await page.getByRole("button", { name: "알겠어요" }).boundingBox())!;
    expect(ok.y + ok.height).toBeLessThanOrEqual(h);
    for (const [i, a] of [...boxes, ok].entries()) {                              // no two pills (or the button) overlap
      for (const b of [...boxes, ok].slice(i + 1)) {
        expect(a.y + a.height <= b.y || b.y + b.height <= a.y || a.x + a.width <= b.x || b.x + b.width <= a.x).toBe(true);
      }
    }
    await page.getByRole("button", { name: "알겠어요" }).click();
    await expect(guide(page)).toHaveCount(0);
    if (SHOTS) await page.screenshot({ path: `${SHOTS}/s06-${w}.png` });
    await page.getByRole("button", { name: "뒤 책 보기" }).click();
    await expect(page.getByText("궁금해요 2 / 2")).toBeVisible();
    await page.waitForTimeout(800);
    await expect(guide(page)).toHaveCount(0);                                  // only on the first S-06 book
    expect(await page.evaluate(() => window.localStorage.getItem("galpi.hint.resultGuide"))).toBe("1");   // remembered here
  });
}

test("Escape closes the S-06 guide, and the page works underneath", async ({ page }, info) => {
  test.skip(info.project.name !== "phone", "phone layout");
  await toFirstResult(page);
  await expect(guide(page)).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(guide(page)).toHaveCount(0);
  await page.getByRole("button", { name: "책갈피 꺼내기" }).click();
  await expect(page.getByRole("button", { name: "책갈피 꺼내기" })).toHaveAttribute("aria-expanded", "true");
});
