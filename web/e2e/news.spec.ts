import { expect } from "@playwright/test";
import { named, recordEvents, test } from "./helpers";

// PRD F-28 갈피 소식통 (S-01 only), DESIGN C-33: beside the 갈피 우체통, a red dot until the newest week is opened.
test.use({ reducedMotion: "reduce" });

const MAILBOX = "갈피 우체통 — 써 보고 느낀 점을 넣어 주세요";
const NEWS = /^갈피 소식통 — 이번 주에 바뀐 것/;

test("the owl sits beside the mailbox, opens the weekly news, sends E-46 and loses its dot for good", async ({ page }) => {
  const { events } = await recordEvents(page);
  await page.goto("/");

  const mailbox = page.getByRole("button", { name: MAILBOX });
  const owl = page.getByRole("button", { name: NEWS });
  await expect(owl).toHaveAccessibleName("갈피 소식통 — 이번 주에 바뀐 것, 새 소식 있음");
  await expect(page.getByTestId("news-dot")).toBeVisible();

  // one quiet row: owl to the right of the mailbox, words on one baseline, both at least 44px to press
  const [m, o] = [await mailbox.boundingBox(), await owl.boundingBox()];
  expect(m && o).toBeTruthy();
  expect(o!.x).toBeGreaterThan(m!.x + m!.width - 1);
  expect(Math.abs(o!.y + o!.height - (m!.y + m!.height))).toBeLessThan(2);
  for (const box of [m!, o!]) {
    expect(box.width).toBeGreaterThanOrEqual(44);
    expect(box.height).toBeGreaterThanOrEqual(44);
  }

  await owl.click();
  const sheet = page.getByRole("dialog", { name: "갈피 소식통" });
  await expect(sheet).toBeVisible();
  await expect(sheet.getByRole("heading", { level: 3 }).first()).toContainText("새 소식");
  await expect(sheet.getByRole("heading", { level: 3 }).first()).toBeInViewport();
  await expect.poll(() => named(events, "news_opened").length).toBe(1);
  expect(named(events, "news_opened")[0].props).toEqual({ has_unseen: true, latest_week: expect.stringMatching(/^\d{4}-\d{2}-\d{2}$/) });

  await sheet.getByRole("button", { name: "닫기" }).click();
  await expect(sheet).toBeHidden();
  await expect(page.getByTestId("news-dot")).toHaveCount(0);

  await page.reload();
  await expect(page.getByRole("button", { name: NEWS })).toHaveAccessibleName("갈피 소식통 — 이번 주에 바뀐 것");
  await expect(page.getByTestId("news-dot")).toHaveCount(0);
});
