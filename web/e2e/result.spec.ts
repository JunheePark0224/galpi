import { expect, type Page } from "@playwright/test";
import { named, reactToBookmarks, recordEvents, specMismatches, test, type Sent } from "./helpers";

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

test("S-08 [다시 뽑기]: same answers, a new closed book, five unseen books, round + 1 (E-19)", async ({ page }) => {
  const { events } = await recordEvents(page);
  await mockBooks(page);
  await page.goto("/");
  await page.getByRole("button", { name: /그냥 한 권 만나고 싶어요/ }).click();
  for (let q = 1; q <= 9; q++) {
    await expect(page.getByText(`${q} / 9`)).toBeVisible();
    await page.waitForTimeout(300);                                          // BalanceGame's 250 ms tap guard
    await page.locator('[data-side="left"]').click();
  }
  await page.getByRole("button", { name: "책 펼치기" }).click();
  await page.getByRole("button", { name: "다음 장" }).click();
  await reactToBookmarks(page, ["패스", "패스", "패스", "패스", "패스"]);

  await expect(page.getByRole("heading", { name: "다음 책갈피를 만나 볼까요?" })).toBeVisible();   // 0 궁금해요 → S-08
  await page.getByRole("button", { name: "다시 뽑기" }).click();
  await expect(page.getByText("눌러서 펼치기")).toBeVisible();                                   // S-03 again
  await page.getByRole("button", { name: "책 펼치기" }).click();
  await expect(page.getByRole("button", { name: "한 번 고치기" })).toBeVisible();                // a new round's one edit
  await page.getByRole("button", { name: "다음 장" }).click();
  await reactToBookmarks(page, ["궁금해요", "패스", "패스", "패스", "패스"]);
  await expect(page.getByText("궁금해요 1 / 1")).toBeVisible();

  await expect.poll(() => named(events, "result_viewed").length).toBe(1);
  const shown = named(events, "bookmark_shown");
  const first = shown.filter((e) => e.common.round === 1).map((e) => e.props.book_id);
  const second = shown.filter((e) => e.common.round === 2).map((e) => e.props.book_id);
  expect(first).toHaveLength(5);
  expect(second).toHaveLength(5);
  expect(second.some((id) => first.includes(id))).toBe(false);                  // seen books stay out
  expect(named(events, "redraw_clicked").map((e) => [e.props, e.common.round, e.common.entry])).toEqual([[{ curious_count: 0 }, 1, "leaf"]]);
  expect(named(events, "book_opened").map((e) => e.common.round)).toEqual([1, 2]);
  expect(named(events, "balance_answered")).toHaveLength(9);                    // the answers were not asked again
  expect(named(events, "result_viewed")[0]).toMatchObject({ props: { curious_count: 1 }, common: { round: 2 } });
  expect(specMismatches(events)).toEqual([]);
});

/** Reacts 궁금해요 to the first two recommended bookmarks (their back says 나온 이유), 패스 to the rest. */
async function curiousAboutTwoRecommended(page: Page, events: Sent[]) {
  let curious = 0;
  for (let i = 1; i <= 5; i++) {
    await expect(page.getByText(`${i} / 5`)).toBeVisible();
    await expect.poll(() => named(events, "bookmark_shown").length).toBe(i);
    const shown = named(events, "bookmark_shown").at(-1)!;
    const want = shown.props.pick_type === "recommended" && curious < 2;
    if (want) curious += 1;
    await page.getByRole("button", { name: want ? "궁금해요" : "패스", exact: true }).click();
  }
}

test("S-06 C-16: the S-05 bookmark peeks out of the cover, pulls out, flips to 나온 이유, changes with [다음 책] (E-27·E-28)", async ({ page }) => {
  const { events } = await recordEvents(page);
  await mockBooks(page);
  await toBookmarks(page);
  await curiousAboutTwoRecommended(page, events);
  await expect(page.getByText("궁금해요 1 / 2")).toBeVisible();

  const curious = named(events, "bookmark_reacted").filter((e) => e.props.reaction === "curious");
  const artOf = (id: unknown) => named(events, "bookmark_shown").find((e) => e.props.book_id === id)!.props.art as { animal: string };
  const stage = page.locator("[data-pose]");
  const pull = page.getByRole("button", { name: "책갈피 꺼내기" });

  // In: the very bookmark of S-05, its top quarter above the cover, a 160 × 112 tap area and a one-time slip.
  await expect(stage).toHaveAttribute("data-pose", "in");
  await expect(stage.locator("image")).toHaveAttribute("href", `/animals/${artOf(curious[0].props.book_id).animal}.svg`);
  await expect(pull).toHaveAttribute("aria-expanded", "false");
  const tap = (await pull.boundingBox())!;
  expect(tap.width).toBeGreaterThanOrEqual(160);
  expect(tap.height).toBeGreaterThanOrEqual(112);
  await expect(page.getByText("책갈피를 꺼내 보세요")).toBeVisible();
  // Touch is tap only: a finger swipe that starts on the peek scrolls the page (fix round 1).
  expect(await pull.evaluate((el) => getComputedStyle(el).touchAction)).toBe("manipulation");

  // Out: in front of the book, the whole bookmark showing, still above the cover's bottom edge.
  await pull.click();
  await expect(pull).toHaveAttribute("aria-expanded", "true");                    // one name, the state says out
  await expect(page.getByText("책갈피를 꺼내 보세요")).toHaveCount(0);
  await expect(stage.getByRole("article").first()).toBeVisible();              // out, the front reads as a bookmark again
  const mark = (await stage.locator("[data-pull]").boundingBox())!;
  const cover = (await page.locator("[data-pose] > div").last().boundingBox())!;
  expect(mark.y + mark.height).toBeLessThanOrEqual(cover.y + cover.height + 1);
  // P5 (C-16): out, [내 책갈피에 꽂기] leads and YES24 steps down — one main button (login is on in E2E)
  await expect(page.getByRole("button", { name: "내 책갈피에 꽂기" })).toHaveAttribute("data-variant", "primary");
  await expect(page.getByRole("link", { name: "예스24에서 보기 ↗" })).toHaveAttribute("data-variant", "secondary");

  // Back: 나온 이유 and its items, 만난 날 today.
  await page.getByRole("button", { name: "뒷면 보기" }).click();
  const back = page.getByRole("article", { name: /책갈피 뒷면$/ });
  await expect(back).toContainText("나온 이유");
  await expect(back).toContainText("만난 날");
  await expect(back.getByRole("listitem").first()).toBeVisible();
  await expect(page.getByRole("status").filter({ hasText: "책갈피 뒷면" })).toContainText("나온 이유");
  await expect(page.getByRole("button", { name: "앞면 보기" })).toBeVisible();

  // Next book: a new bookmark, in again, no slip; the keyboard pulls it out too.
  await page.getByRole("button", { name: "다음 책" }).click();
  await expect(page.getByText("궁금해요 2 / 2")).toBeVisible();
  await expect(stage).toHaveAttribute("data-pose", "in");
  await expect(stage.locator("image")).toHaveAttribute("href", `/animals/${artOf(curious[1].props.book_id).animal}.svg`);
  await expect(page.getByText("책갈피를 꺼내 보세요")).toHaveCount(0);
  await pull.focus();
  await page.keyboard.press("Enter");
  await expect(pull).toHaveAttribute("aria-expanded", "true");
  await page.keyboard.press(" ");
  await expect(pull).toHaveAttribute("aria-expanded", "false");

  expect(named(events, "bookmark_pulled").map((e) => e.props)).toEqual(
    curious.map((e, i) => ({ book_id: e.props.book_id, position: i + 1, pick_type: "recommended" })),
  );
  expect(named(events, "bookmark_flipped").map((e) => e.props)).toEqual([{ book_id: curious[0].props.book_id, pick_type: "recommended" }]);
  expect(specMismatches(events)).toEqual([]);
});

for (const width of [320, 360, 412]) {
  test(`S-06 C-16 at ${width}px: nothing runs off the side, the bookmark stays in the cover, the slip reads`, async ({ page }) => {
    await page.setViewportSize({ width, height: 800 });
    const { events } = await recordEvents(page);
    await mockBooks(page);
    await toBookmarks(page);
    await curiousAboutTwoRecommended(page, events);
    await expect(page.getByText("궁금해요 1 / 2")).toBeVisible();
    const overflow = () => page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(await overflow()).toBeLessThanOrEqual(0);
    const slip = page.getByText("책갈피를 꺼내 보세요");
    await expect(slip).toBeVisible();
    expect(await slip.evaluate((el) => el.scrollWidth <= el.clientWidth)).toBe(true);   // no word cut or spilling
    const pull = page.locator("[data-pull]");
    const cover = page.locator("[data-pose] > div").last();
    const bottom = async () => {
      const [b, c] = [(await pull.boundingBox())!, (await cover.boundingBox())!];
      return c.y + c.height - (b.y + b.height);
    };
    expect(await bottom()).toBeGreaterThanOrEqual(0);                              // in: nothing below the cover
    await page.getByRole("button", { name: "책갈피 꺼내기" }).click();
    await expect(page.locator("[data-pose]")).toHaveAttribute("data-pose", "out");
    expect(await bottom()).toBeGreaterThanOrEqual(-1);                             // out: the swallowtail stays on the cover
    await page.getByRole("button", { name: "뒷면 보기" }).click();
    expect(await overflow()).toBeLessThanOrEqual(0);
  });
}
