import { expect, type Page } from "@playwright/test";
import { named, reactToBookmarks, recordEvents, specMismatches, test } from "./helpers";

// S-06 with a mocked /api/books/<isbn> (E2E has no YES24 key): synthetic text, never real YES24 text.
test.use({ reducedMotion: "reduce" });

const INTRO = `${"첫 문장은 테스트를 위해 지어낸 소개예요".repeat(3)}. ${"둘째 문장도 지어낸 글이에요".repeat(4)}. 마지막 문장.`;
const detailFor = (isbn: string) => ({
  source: "yes24", cover: null, price: 14400, rating: 9.4, pages: 280, intro: INTRO,
  link: `https://www.yes24.com/product/goods/${isbn.slice(-6)}`,
});

/** Every book's detail answers from here; the YES24 tab a link opens never leaves the test. */
async function mockBooks(page: Page): Promise<string[]> {
  const asked: string[] = [];
  await page.route(/\/api\/books\/\d{13}$/, async (route) => {
    const isbn = new URL(route.request().url()).pathname.split("/").pop() as string;
    asked.push(isbn);
    await route.fulfill({ json: detailFor(isbn) });
  });
  await page.context().route("https://www.yes24.com/**", (route) => route.fulfill({ contentType: "text/html", body: "<title>YES24</title>" }));
  return asked;
}

async function toBookmarks(page: Page) {
  await page.goto("/");
  await page.getByRole("button", { name: /알고 싶은 게 있어요/ }).click();
  await page.getByRole("button", { name: "데이터 분석", exact: true }).click();
  await page.getByRole("button", { name: "책 펼치기" }).click();
  await page.getByRole("button", { name: "책 펼치기" }).click();
  await page.getByRole("button", { name: "다음 장" }).click();
}

test("S-06 shows each 궁금해요 book with YES24 facts, folds the intro, links out (E-09·E-10·E-23·E-18)", async ({ page }) => {
  const { events } = await recordEvents(page);
  const asked = await mockBooks(page);
  await toBookmarks(page);
  await reactToBookmarks(page, ["궁금해요", "패스", "궁금해요", "패스", "패스"]);

  await expect(page.getByText("궁금해요 1 / 2")).toBeVisible();
  await expect(page.getByText("★ 9.4 · 14,400원 · 280쪽")).toBeVisible();
  await expect(page.getByRole("heading", { level: 2, name: "책 소개 · 예스24" })).toBeVisible();
  await expect(page.getByText("정보 제공: 예스24", { exact: true })).toBeVisible();   // the footer says it too
  await expect(page.getByText("마지막 문장.")).toHaveCount(0);                 // folded at a sentence end
  await page.getByRole("button", { name: "더 보기" }).click();
  await expect(page.getByText(INTRO)).toBeVisible();

  const [tab] = await Promise.all([page.waitForEvent("popup"), page.getByRole("link", { name: "예스24에서 보기 ↗" }).click()]);
  await expect(tab).toHaveTitle("YES24");
  await tab.close();

  await page.getByRole("button", { name: "다음 책" }).click();
  await expect(page.getByText("궁금해요 2 / 2")).toBeVisible();
  await expect(page.getByRole("button", { name: "더 보기" })).toBeVisible();    // the next book starts folded
  await page.getByRole("button", { name: "다 봤어요" }).click();

  const curious = named(events, "bookmark_reacted").filter((e) => e.props.reaction === "curious");
  const ids = curious.map((e) => e.props.book_id as string);
  expect(new Set(asked)).toEqual(new Set(ids));                                 // both fetched (ahead), nothing else
  await expect.poll(() => named(events, "result_book_viewed").length).toBe(2);
  expect(named(events, "result_viewed").map((e) => e.props)).toEqual([{ curious_count: 2 }]);
  expect(named(events, "result_book_viewed").map((e) => e.props)).toEqual(
    curious.map((e, i) => ({ book_id: e.props.book_id, position: i + 1, pick_type: e.props.pick_type })),
  );
  expect(named(events, "description_expanded").map((e) => e.props)).toEqual([{ book_id: ids[0], pick_type: curious[0].props.pick_type }]);
  expect(named(events, "yes24_link_clicked").map((e) => e.props)).toEqual([{ book_id: ids[0], source: "result", pick_type: curious[0].props.pick_type }]);
  expect(specMismatches(events)).toEqual([]);
});

test("S-06 survives a reload on the second book without sending its view again", async ({ page }) => {
  const { events } = await recordEvents(page);
  await mockBooks(page);
  await toBookmarks(page);
  await reactToBookmarks(page, ["궁금해요", "궁금해요", "패스", "패스", "패스"]);
  await page.getByRole("button", { name: "다음 책" }).click();
  await expect(page.getByText("궁금해요 2 / 2")).toBeVisible();
  await expect.poll(() => named(events, "result_book_viewed").length).toBe(2);

  await page.reload();
  await expect(page.getByText("궁금해요 2 / 2")).toBeVisible();
  await expect(page.getByText("★ 9.4 · 14,400원 · 280쪽")).toBeVisible();
  await expect.poll(() => named(events, "site_visited").length).toBe(2);
  expect(named(events, "result_book_viewed")).toHaveLength(2);
});
