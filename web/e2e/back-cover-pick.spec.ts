import { expect } from "@playwright/test";
import { named, reactToBookmarks, recordEvents, specMismatches, test, toBookmarks } from "./helpers";

/**
 * Back-cover experiment B (10-12, PRD F-27, taxonomy v2.6): the 궁금해요 bookmarks on the 뒤표지 open their book in a card
 * over the blurred back cover, always from the first 궁금해요 book — no main button, a tip on the first one (once per browser), ‹ › through them,
 * [다 봤어요] on the last → S-08. E-45 variant "b", and the card sends E-09 once and E-10 per book as S-06 does.
 */
test("B: 궁금해요 bookmark on the 뒤표지 → floating book card → S-08", async ({ page }) => {
  await page.addInitScript(() => window.localStorage.setItem("galpi.exp.backCover", "B"));
  const { events } = await recordEvents(page);
  await toBookmarks(page);
  await reactToBookmarks(page, ["궁금해요", "패스", "궁금해요", "패스", "패스"], 5, true);

  await expect.poll(() => named(events, "experiment_exposed").map((e) => e.props)).toEqual([{ experiment: "back_cover_pick", variant: "b" }]);
  await expect(page.getByRole("button", { name: /권 책 정보 보기$/ })).toHaveCount(0);
  await expect(page.getByText("책갈피를 눌러 보세요", { exact: true })).toBeVisible();
  await expect(page.getByText("눌러서 책 정보 보기")).toBeVisible();
  const lit = page.getByRole("button", { name: /^『.+』 책 정보 보기$/ });
  await expect(lit).toHaveCount(2);

  // 10-12 (user): whichever lit bookmark is pressed, the card starts at the first 궁금해요 book — so the last one ends at [다 봤어요]
  await lit.nth(1).click();
  const card = page.getByRole("dialog", { name: "궁금해요 책 정보" });
  await expect(card.getByText("궁금해요 1 / 2")).toBeVisible();
  await expect.poll(() => named(events, "result_viewed").map((e) => e.props)).toEqual([{ curious_count: 2 }]);
  await expect.poll(() => named(events, "result_book_viewed").length).toBe(1);

  await expect(card.getByRole("button", { name: "닫기" })).toBeFocused();

  // Escape (or 닫기) → the 뒤표지 again, focus back on the bookmark that opened the card (the second one, pressed above —
  // the 10-12 change moved the press, not the focus rule), the tip gone for good; pressing again sends no second E-09
  await page.keyboard.press("Escape");
  await expect(lit.nth(1)).toBeFocused();
  await expect(card).toHaveCount(0);
  await expect(page.getByText("눌러서 책 정보 보기")).toHaveCount(0);
  await lit.first().click();
  await card.getByRole("button", { name: "다음 책" }).click();
  await expect(card.getByText("궁금해요 2 / 2")).toBeVisible();
  await expect.poll(() => named(events, "result_book_viewed").length).toBe(2);
  expect(named(events, "result_viewed")).toHaveLength(1);

  await card.getByRole("button", { name: "다 봤어요" }).click();
  await expect(page.getByRole("heading", { name: "다음 책갈피를 만나 볼까요?" })).toBeVisible();
  expect(specMismatches(events)).toEqual([]);
});
