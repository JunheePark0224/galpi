import { expect, type Page } from "@playwright/test";
import { reactToBookmarks, test, toBookmarks } from "./helpers";

// C-20: the first bookmark explains itself once per browser — three lit parts, words, [알겠어요] (10-02).
const SHOTS = process.env.GUIDE_SHOTS;   // a folder: save screenshots there when set (manual design check)

async function toFirstBookmark(page: Page) {
  await page.addInitScript(() => { try { window.localStorage.removeItem("galpi.hint.firstGuide"); } catch { /* blocked */ } });
  await toBookmarks(page);
}
const guide = (page: Page) => page.getByRole("dialog", { name: "책갈피 보는 법" });

for (const [w, h] of [[375, 667], [320, 568], [1280, 800]] as const) {
  test(`${w}×${h}: the guide lights title, one-liner and reactions with its words on screen, once`, async ({ page }, info) => {
    test.skip(w === 1280 && info.project.name !== "laptop", "a desktop window");
    test.skip(w !== 1280 && info.project.name !== "phone", "a phone window");
    await page.setViewportSize({ width: w, height: h });
    await toFirstBookmark(page);
    await expect(guide(page)).toBeVisible();
    await expect(page.getByRole("button", { name: "알겠어요" })).toBeFocused();
    for (const words of ["① 위는 제목, 아래는 저자", "② 이 한 줄이 책의 첫인상이에요", "③ 끌리면 궁금해요, 아니면 패스"]) {
      const box = await page.getByText(words).boundingBox();
      expect(box && box.y >= 0 && box.y + box.height <= h && box.x >= 0 && box.x + box.width <= w).toBe(true);
    }
    if (SHOTS) await page.screenshot({ path: `${SHOTS}/guide-${w}.png` });
    await page.getByRole("button", { name: "알겠어요" }).click();
    await expect(guide(page)).toHaveCount(0);
    await reactToBookmarks(page, ["패스"], 5);
    await expect(page.getByText("2 / 5")).toBeVisible();
    await expect(guide(page)).toHaveCount(0);                                  // only on the first bookmark
    expect(await page.evaluate(() => window.localStorage.getItem("galpi.hint.firstGuide"))).toBe("1");   // remembered here
  });
}

test("Escape closes the guide", async ({ page }, info) => {
  test.skip(info.project.name !== "phone", "phone layout");
  await toFirstBookmark(page);
  await expect(guide(page)).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(guide(page)).toHaveCount(0);
  await expect(page.getByRole("button", { name: "궁금해요" })).toBeEnabled();
});
