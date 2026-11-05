import { expect } from "@playwright/test";
import { named, recordEvents, test } from "./helpers";

// PRD F-30 책갈피 구경 (S-01 → S-13), DESIGN C-35. e2e has no Supabase: the maker's shelf is answered here.
test.use({ reducedMotion: "reduce" });

const PEEK = "책갈피 구경 — 갈피를 만든 사람의 책갈피함";
const ISBN = "9790000000001";   // in books.sample.json
const ART = { animal: "rabbit", bg: "aurora", ground: "grass", rare: true };
const VIEW = {
  shelves: [{ name: "첫 막대", bookmarks: [{ art: ART, metOn: "2026-10-17", card: {
    id: ISBN, entry: "leaf", title: "구경할 책", author: "저자", genre: "사회·시사", field: null, oneLiner: "한 줄 소개예요", oneLinerStyle: "summary",
  } }] }],
  count: 1,
};

test("the third quiet button opens the maker's shelf, a bookmark large, YES24, and back to start a round", async ({ page }) => {
  const { events } = await recordEvents(page);
  await page.route("**/api/maker-shelf", (route) => route.fulfill({ json: VIEW }));
  await page.goto("/");

  const peek = page.getByRole("button", { name: PEEK });
  const owl = page.getByRole("button", { name: /^갈피 소식통/ });
  await expect(page.getByTestId("news-dot")).toBeVisible();   // the browser render is in (S-01 is drawn again after hydration)
  await expect(peek).toBeVisible();
  const boxes = async () => [await owl.boundingBox(), await peek.boundingBox()] as const;
  await expect.poll(async () => (await boxes()).every(Boolean)).toBe(true);
  const [o, p] = await boxes();
  expect(p!.x).toBeGreaterThan(o!.x + o!.width - 1);                      // right of the owl, one row
  expect(Math.abs(p!.y + p!.height - (o!.y + o!.height))).toBeLessThan(2);

  await peek.click();
  const sheet = page.getByRole("dialog", { name: "갈피를 만든 사람의 책갈피함" });
  await expect(sheet.getByText("갈피를 만든 사람이 직접 뽑아 모은 책갈피예요 · 1권")).toBeVisible();
  await expect.poll(() => named(events, "maker_shelf_opened").length).toBe(1);

  await sheet.getByRole("button", { name: "구경할 책 책갈피" }).click();
  await expect(sheet.getByText("2026. 10. 17. 만남").first()).toBeVisible();
  await expect.poll(() => named(events, "maker_bookmark_viewed").length).toBe(1);
  expect(named(events, "maker_bookmark_viewed")[0].props).toEqual({ book_id: ISBN });
  const yes24 = sheet.getByRole("link", { name: /예스24에서 보기/ });
  await expect(yes24).toHaveAttribute("href", new RegExp(ISBN));
  await expect(yes24).toHaveAttribute("target", "_blank");

  await sheet.getByRole("button", { name: "나도 책갈피 모으러 가기" }).click();
  await expect(sheet).toBeHidden();
  await expect(page.getByRole("button", { name: PEEK })).toBeHidden();      // the round started: S-01 is gone
  await expect.poll(() => named(events, "entry_selected").length).toBe(1);
  expect(named(events, "entry_selected")[0].props).toEqual({ source: "maker_shelf" });
});

test("says so quietly when the shelf cannot load", async ({ page }) => {
  await page.route("**/api/maker-shelf", (route) => route.fulfill({ status: 503, json: { error: "unavailable" } }));
  await page.goto("/");
  await page.getByRole("button", { name: PEEK }).click();
  const sheet = page.getByRole("dialog", { name: "갈피를 만든 사람의 책갈피함" });
  await expect(sheet.getByText("지금은 책갈피함을 불러올 수 없어요")).toBeVisible();
  await sheet.getByRole("button", { name: "닫기" }).click();
  await expect(sheet).toBeHidden();
});
