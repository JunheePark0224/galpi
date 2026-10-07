import { expect } from "@playwright/test";
import { named, reactToBookmarks, recordEvents, specMismatches, START, test, toBookmarks } from "./helpers";

/**
 * F-27 (10-07): after the fifth bookmark the S-11 뒤표지 — today's bookmarks on the back cover, the 내가 고른 길 label,
 * [공유하기] (here: no share sheet, so the link is copied) — and the S-12 page a shared link opens, with its link-preview
 * image, [나도 갈피 잡기] back to S-01. E-41 · E-42 · E-43 · E-44. `?mine=1` is the sharer's own page, handed over from
 * KakaoTalk's in-app browser (10-07): [공유하기] first, no E-43.
 */
test("뒤표지 → share a link → the shared page → 나도 갈피 잡기", async ({ page }) => {
  await page.addInitScript(() => {
    Object.defineProperty(navigator, "share", { value: undefined, configurable: true });
    const copied: string[] = [];
    Object.defineProperty(navigator, "clipboard", { value: { writeText: async (t: string) => { copied.push(t); } }, configurable: true });
    (window as unknown as { copied: string[] }).copied = copied;
  });
  const { events } = await recordEvents(page);
  await toBookmarks(page);
  await reactToBookmarks(page, ["궁금해요", "패스", "패스", "패스", "패스"], 5, true);

  const back = page.locator("section", { has: page.getByRole("heading", { level: 1, name: "오늘 만난 책갈피" }) });
  await expect(back.locator("article")).toHaveCount(5);
  await expect(back.getByRole("group", { name: "내가 고른 길" })).toBeVisible();
  await expect.poll(() => named(events, "back_cover_shown").length).toBe(1);
  expect(named(events, "back_cover_shown")[0].props).toMatchObject({ curious_count: 1 });
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflow).toBeLessThanOrEqual(0);

  await page.getByRole("button", { name: "공유하기" }).click();
  await expect(page.getByRole("status").filter({ hasText: "링크를 복사했어요" })).toBeVisible();
  const [link] = await page.evaluate(() => (window as unknown as { copied: string[] }).copied);
  expect(link).toMatch(/\/s\/1~[0-9a-zA-Z.~]+$/);
  await expect.poll(() => named(events, "share_clicked").map((e) => e.props.method)).toEqual(["copy"]);
  await expect(page.getByRole("link", { name: "이미지 저장" })).toHaveCount(0);

  // the S-11 main button goes on to the 궁금해요 book
  await page.getByRole("button", { name: "궁금해요 1권 책 정보 보기" }).click();
  await expect(page.getByText("궁금해요 1 / 1")).toBeVisible();

  // the link someone else opens
  const path = new URL(link).pathname;
  await page.goto(path);
  await expect(page.getByRole("heading", { level: 1, name: "누군가 갈피에서 만난 책갈피" })).toBeVisible();
  await expect(page.locator("article")).toHaveCount(5);
  const og = await page.locator('meta[property="og:image"]').getAttribute("content");
  expect(og).toContain(`${path}/opengraph-image`);
  await expect.poll(() => named(events, "share_page_viewed").length).toBe(1);
  await page.getByRole("button", { name: "나도 갈피 잡기" }).click();
  await expect(page.getByRole("button", { name: START })).toBeVisible();
  expect(named(events, "share_page_started")).toHaveLength(1);

  // the sharer's own back cover, opened in the phone's browser from KakaoTalk
  await page.goto(`${path}?mine=1`);
  await expect(page.getByRole("heading", { level: 1, name: "오늘 만난 책갈피" })).toBeVisible();
  await expect(page.getByRole("button", { name: "공유하기" })).toHaveAttribute("data-variant", "primary");
  await expect(page.getByRole("button", { name: "나도 갈피 잡기" })).toHaveCount(0);
  await page.getByRole("button", { name: "공유하기" }).click();
  await expect.poll(() => named(events, "share_clicked").length).toBe(2);
  expect(named(events, "share_page_viewed")).toHaveLength(1);
  expect(specMismatches(events)).toEqual([]);
});

test("a share link that does not read goes to the first page", async ({ page }) => {
  await page.goto("/s/not-a-code");
  await expect(page).toHaveURL(/\/$/);
  await expect(page.getByRole("button", { name: START })).toBeVisible();
});
