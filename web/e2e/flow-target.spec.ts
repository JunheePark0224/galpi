import { expect } from "@playwright/test";
import { named, reactToBookmarks, recordEvents, test } from "./helpers";

// Motion and CSS shorten to fades under reduced motion — same flow, faster run. Books: BOOKS_SOURCE=sample.
test.use({ reducedMotion: "reduce" });

test("🎯 chips → book → first page → five bookmarks → curious list", async ({ page }, testInfo) => {
  const { events, statuses } = await recordEvents(page);
  await page.goto("/");
  await page.getByRole("button", { name: /알고 싶은 게 있어요/ }).click();
  await page.getByRole("button", { name: "데이터 분석", exact: true }).click();
  await page.getByRole("button", { name: "얇게", exact: true }).click();
  await page.getByRole("button", { name: "따라 하며 실습 (바로 써먹기)" }).click();
  await page.getByRole("button", { name: "책 펼치기" }).click();          // S-02 submit

  await expect(page.getByText("눌러서 펼치기")).toBeVisible();
  await page.getByRole("button", { name: "책 펼치기" }).click();          // S-03: the closed book
  await expect(page.getByRole("heading", { name: "당신이 찾는 책" })).toBeVisible();
  await expect(page.getByText("조건에 딱 맞는 책은 여기까지예요")).toBeVisible();  // sample: 데이터 분석 has 5 books
  await page.getByRole("button", { name: "다음 장" }).click();

  await expect(page.getByText("1 / 5")).toBeVisible();
  if (testInfo.project.name === "laptop") {
    const column = await page.locator(".column").boundingBox();
    const bookmark = await page.getByRole("article").boundingBox();
    if (!column || !bookmark) throw new Error("layout boxes missing");
    expect(column.width).toBe(430);
    expect(bookmark.x).toBeGreaterThanOrEqual(column.x);
    expect(bookmark.x + bookmark.width).toBeLessThanOrEqual(column.x + column.width);
  }
  await reactToBookmarks(page, ["궁금해요", "패스", "궁금해요", "패스", "궁금해요"]);

  await expect(page.getByRole("heading", { name: "궁금해요 책" })).toBeVisible();
  await expect(page.getByRole("listitem")).toHaveCount(3);
  await page.getByRole("button", { name: "처음으로" }).click();
  await expect(page.getByRole("button", { name: /그냥 한 권 만나고 싶어요/ })).toBeVisible();

  await expect.poll(() => named(events, "home_clicked").length).toBe(1);
  expect(named(events, "visit")).toHaveLength(1);
  expect(named(events, "entry_selected").map((e) => e.props)).toEqual([{ entry: "target" }]);
  expect(named(events, "chip_selected").map((e) => [e.props.question, e.props.value])).toEqual([["topic", "데이터 분석"], ["len", "thin"], ["way", "실습"]]);
  expect(named(events, "book_opened")).toHaveLength(1);
  const shown = named(events, "bookmark_shown");
  expect(shown).toHaveLength(5);
  expect(new Set(shown.map((e) => e.props.book_id)).size).toBe(5);
  expect(shown.filter((e) => e.props.kind === "random")).toHaveLength(1);
  expect(shown.every((e) => e.common.entry === "target" && e.common.round === 1 && e.props.one_liner_style === "summary")).toBe(true);
  expect(shown.map((e) => e.props.index)).toEqual([1, 2, 3, 4, 5]);
  expect(named(events, "bookmark_reacted").map((e) => e.props.reaction)).toEqual(["curious", "pass", "curious", "pass", "curious"]);
  expect(named(events, "home_clicked")[0]).toMatchObject({ props: { curious: 3 }, common: { entry: "target" } });
  await expect.poll(() => statuses.length).toBe(events.length);
  expect(statuses.every((s) => s === 202)).toBe(true);
});

test("🎯 written goal → honest count → one edit → five bookmarks", async ({ page }) => {
  const { events } = await recordEvents(page);
  await page.goto("/");
  await page.getByRole("button", { name: /알고 싶은 게 있어요/ }).click();
  await page.getByRole("button", { name: "책 펼치기" }).click();          // nothing chosen yet
  // getByText, not getByRole("alert"): Next adds its own empty role="alert" route announcer.
  await expect(page.getByText("보기 하나를 고르거나 직접 써 주세요")).toBeVisible();
  await page.getByRole("button", { name: "직접 쓰기" }).click();
  await page.getByRole("textbox", { name: "직접 쓰기" }).fill("SQL 공부");
  await page.getByRole("button", { name: "책 펼치기" }).click();
  await page.getByRole("button", { name: "책 펼치기" }).click();          // open the book

  const notice = "SQL 책은 아직 2권이에요. 나머지는 가까운 '데이터 분석' 책이에요";
  await expect(page.getByText(notice)).toBeVisible();
  await expect(page.getByText("조건에 딱 맞는 책은 여기까지예요")).toHaveCount(0);

  await page.getByRole("button", { name: "한 번 고치기" }).click();
  await expect(page.getByRole("textbox", { name: "직접 쓰기" })).toHaveValue("SQL 공부");
  await page.getByRole("button", { name: "얇게", exact: true }).click();
  await page.getByRole("button", { name: "책 펼치기" }).click();          // straight back to the open book
  await expect(page.getByText(notice)).toBeVisible();
  await expect(page.getByRole("button", { name: "한 번 고치기" })).toHaveCount(0);
  await page.getByRole("button", { name: "다음 장" }).click();
  await reactToBookmarks(page, ["패스", "패스", "패스", "패스", "패스"]);
  await expect(page.getByRole("heading", { name: "궁금해요 책" })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "처음으로" })).toBeVisible();

  await expect.poll(() => named(events, "bookmark_reacted").length).toBe(5);
  expect(named(events, "goal_free_written").map((e) => e.props)).toEqual([
    { text: "SQL 공부", topic: "데이터 분석", keywords: ["SQL"], matched: true, method: "word" },
    { text: "SQL 공부", topic: "데이터 분석", keywords: ["SQL"], matched: true, method: "word" },
  ]);
  expect(named(events, "goal_coverage")[0].props).toEqual({ bucket: "1-3", found: 2 });
  expect(named(events, "first_page_edited").map((e) => e.props)).toEqual([{ entry: "target", items: ["len"] }]);
  expect(named(events, "chip_selected").map((e) => [e.props.value, e.props.edit])).toEqual([["direct", false], ["thin", true]]);
});

test("🎯 a 30-character goal with no spaces wraps inside the first page", async ({ page }) => {
  const long = "가나다라마바사아자차".repeat(3);
  await page.goto("/");
  await page.getByRole("button", { name: /알고 싶은 게 있어요/ }).click();
  await page.getByRole("button", { name: "직접 쓰기" }).click();
  await page.getByRole("textbox", { name: "직접 쓰기" }).fill(long);
  await page.getByRole("button", { name: "책 펼치기" }).click();
  await page.getByRole("button", { name: "책 펼치기" }).click();
  await expect(page.getByRole("heading", { name: "당신이 찾는 책" })).toBeVisible();
  const goal = page.locator("dd", { hasText: long });
  await expect(goal).toBeVisible();

  const overflow = await goal.evaluate((dd) => {
    let el: HTMLElement | null = dd.parentElement;
    while (el && getComputedStyle(el).overflowY !== "auto") el = el.parentElement;
    return el ? { scroll: el.scrollWidth, client: el.clientWidth } : null;
  });
  expect(overflow).not.toBeNull();
  expect(overflow?.scroll).toBeLessThanOrEqual(overflow?.client ?? 0);
});
