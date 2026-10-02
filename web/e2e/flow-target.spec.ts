import { expect } from "@playwright/test";
import { named, reactToBookmarks, recordEvents, specMismatches, test } from "./helpers";

// Motion and CSS shorten to fades under reduced motion — same flow, faster run. Books: BOOKS_SOURCE=sample.
test.use({ reducedMotion: "reduce" });

const FIELD = { name: "무엇을 알고 싶어요" } as const;

test("🎯 example chip → book → first page → five bookmarks → 궁금해요 books one by one → the end", async ({ page }, testInfo) => {
  const { events, statuses } = await recordEvents(page);
  let classifyAsked = 0;
  await page.route("**/api/goal/classify", (route) => { classifyAsked += 1; return route.continue(); });
  await page.goto("/");
  await page.getByRole("button", { name: /알고 싶은 게 있어요/ }).click();
  await page.getByRole("button", { name: "데이터 분석", exact: true }).click();     // an example chip fills the field
  await expect(page.getByRole("textbox", FIELD)).toHaveValue("데이터 분석");
  await page.getByRole("button", { name: "얇게", exact: true }).click();
  await page.getByRole("button", { name: "따라 하며 실습 (바로 써먹기)" }).click();
  await page.getByRole("button", { name: "책 펼치기" }).click();          // S-02 submit

  await expect(page.getByText("눌러서 펼치기")).toBeVisible();
  await page.getByRole("button", { name: "책 펼치기" }).click();          // S-03: the closed book
  await expect(page.getByRole("heading", { name: "당신이 찾는 책" })).toBeVisible();
  await expect(page.getByText("조건에 딱 맞는 책은 여기까지예요")).toBeVisible();  // sample: 데이터 분석 has 5 books
  await expect(page.getByText("→ 데이터 분석으로 찾았어요")).toBeVisible();        // F-24: an untouched example — one short line
  await expect(page.getByText("이렇게 이해했어요")).toHaveCount(0);
  await page.getByRole("button", { name: "다음 장" }).click();

  await expect(page.getByText("1 / 5")).toBeVisible();
  if (testInfo.project.name === "laptop") {
    // DESIGN T-04b (09-30): on a desktop the book scene leaves the 430px column — the bookmark stays on screen, no sideways scroll
    const column = await page.locator(".column").boundingBox();
    const bookmark = await page.getByRole("article").boundingBox();
    if (!column || !bookmark) throw new Error("layout boxes missing");
    expect(column.width).toBeGreaterThan(430);
    expect(bookmark.x).toBeGreaterThanOrEqual(0);
    expect(bookmark.x + bookmark.width).toBeLessThanOrEqual(1440);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  }
  await reactToBookmarks(page, ["궁금해요", "패스", "궁금해요", "패스", "궁금해요"]);

  // S-06 with no book keys (E2E): the empty detail — our own cover, a note, and still a YES24 link (no 나온 이유 line since 10-01)
  await expect(page.getByText("궁금해요 1 / 3")).toBeVisible();
  await expect(page.getByText("책 소개를 불러오지 못했어요")).toBeVisible();
  await expect(page.getByText(/^(나온 이유|이 책은)$/)).toHaveCount(0);
  if (testInfo.project.name === "laptop") expect((await page.locator(".column").boundingBox())?.width).toBe(430);  // back in the column
  await page.getByRole("button", { name: "다음 책" }).click();
  await page.getByRole("button", { name: "다음 책" }).click();
  await expect(page.getByText("궁금해요 3 / 3")).toBeVisible();
  await page.getByRole("button", { name: "다 봤어요" }).click();
  await expect(page.getByRole("heading", { name: "다음 책갈피를 만나 볼까요?" })).toBeVisible();   // S-08
  await page.getByRole("button", { name: "처음으로" }).click();
  await page.getByRole("button", { name: /그냥 한 권 만나고 싶어요/ }).click();   // a new round in the same tab
  await expect(page.getByText("1 / 9")).toBeVisible();                         // the 🍃 game (questions in a new order each pass)

  await expect.poll(() => named(events, "entry_selected").length).toBe(2);
  expect(named(events, "site_visited")).toHaveLength(1);
  // taxonomy 3-1a: home_clicked carries the round it ends, the restart is round 2
  expect(named(events, "entry_selected").map((e) => [e.props, e.common.entry, e.common.round]))
    .toEqual([[{ source: "home" }, "target", 1], [{ source: "home" }, "leaf", 2]]);
  expect(named(events, "home_clicked")[0].common.round).toBe(1);
  expect(named(events, "chip_selected").map((e) => [e.props.chip_type, e.props.chip_value])).toEqual([["example", "데이터 분석"], ["len", "thin"], ["way", "실습"]]);
  expect(named(events, "goal_submitted").map((e) => e.props)).toEqual([
    { topic: "데이터 분석", is_free_text: false, len: "thin", way: "실습", is_edit: false },
  ]);
  // an untouched example is matched from its fixed table: no sorting request, and no E-21 / E-22 (not the visitor's own words)
  expect(classifyAsked).toBe(0);
  expect(named(events, "free_goal_written")).toHaveLength(0);
  expect(named(events, "goal_coverage_checked")).toHaveLength(0);
  expect(named(events, "book_opened")).toHaveLength(1);
  const shown = named(events, "bookmark_shown");
  expect(shown).toHaveLength(5);
  expect(new Set(shown.map((e) => e.props.book_id)).size).toBe(5);
  expect(shown.filter((e) => e.props.pick_type === "random")).toHaveLength(1);
  expect(shown.every((e) => e.common.entry === "target" && e.common.round === 1 && e.props.one_liner_style === "summary")).toBe(true);
  expect(shown.map((e) => e.props.position)).toEqual([1, 2, 3, 4, 5]);
  const reacted = named(events, "bookmark_reacted");
  expect(reacted.map((e) => e.props.reaction)).toEqual(["curious", "pass", "curious", "pass", "curious"]);
  expect(reacted.every((e) => e.props.one_liner_style === "summary")).toBe(true);
  expect(named(events, "result_viewed").map((e) => e.props)).toEqual([{ curious_count: 3 }]);
  const curiousIds = reacted.filter((e) => e.props.reaction === "curious").map((e) => e.props.book_id);
  expect(named(events, "result_book_viewed").map((e) => [e.props.book_id, e.props.position])).toEqual(curiousIds.map((id, i) => [id, i + 1]));
  expect(named(events, "home_clicked")[0]).toMatchObject({ props: { curious_count: 3, source: "end" }, common: { entry: "target" } });
  await expect.poll(() => statuses.length).toBe(events.length);
  expect(statuses.every((s) => s === 202)).toBe(true);
  expect(specMismatches(events)).toEqual([]);
});

test("🎯 written goal → honest count → one edit → five bookmarks", async ({ page }) => {
  const { events } = await recordEvents(page);
  await page.goto("/");
  await page.getByRole("button", { name: /알고 싶은 게 있어요/ }).click();
  await page.getByRole("button", { name: "책 펼치기" }).click();          // nothing chosen yet
  // getByText, not getByRole("alert"): Next adds its own empty role="alert" route announcer.
  await expect(page.getByText("보기 하나를 고르거나 직접 써 주세요")).toBeVisible();
  await page.getByRole("textbox", FIELD).fill("SQL 공부");
  await page.getByRole("button", { name: "책 펼치기" }).click();
  await page.getByRole("button", { name: "책 펼치기" }).click();          // open the book

  const notice = "SQL 책은 아직 2권이에요. 나머지는 가까운 '데이터 분석' 책이에요";
  await expect(page.getByText(notice)).toBeVisible();
  // F-24 ①+ (word matching): the path to the keyword, the count right under it
  await expect(page.getByRole("region", { name: "이렇게 이해했어요" })).toContainText("데이터·통계 › 데이터 분석 › SQL로 찾았어요");
  await expect(page.getByText("조건에 딱 맞는 책은 여기까지예요")).toHaveCount(0);

  await page.getByRole("button", { name: "한 번 고치기" }).click();
  await expect(page.getByRole("textbox", FIELD)).toHaveValue("SQL 공부");
  await page.getByRole("button", { name: "얇게", exact: true }).click();
  await page.getByRole("button", { name: "책 펼치기" }).click();          // straight back to the open book
  await expect(page.getByText(notice)).toBeVisible();
  await expect(page.getByRole("button", { name: "한 번 고치기" })).toHaveCount(0);
  await page.getByRole("button", { name: "다음 장" }).click();
  await reactToBookmarks(page, ["패스", "패스", "패스", "패스", "패스"]);
  await expect(page.getByText(/궁금해요 \d \/ \d/)).toHaveCount(0);           // nothing 궁금해요: straight to S-08
  await expect(page.getByRole("button", { name: "처음으로" })).toBeVisible();

  await expect.poll(() => named(events, "bookmark_reacted").length).toBe(5);
  expect(named(events, "free_goal_written").map((e) => e.props)).toEqual([
    { goal_text: "SQL 공부", topic: "데이터 분석", keywords: ["SQL"], is_matched: true, method: "word", has_missing: false, missing_text: null },
    { goal_text: "SQL 공부", topic: "데이터 분석", keywords: ["SQL"], is_matched: true, method: "word", has_missing: false, missing_text: null },
  ]);
  expect(named(events, "goal_submitted").map((e) => e.props)).toEqual([
    { topic: "데이터 분석", is_free_text: true, len: null, way: null, is_edit: false },
    { topic: "데이터 분석", is_free_text: true, len: "thin", way: null, is_edit: true },
  ]);
  expect(named(events, "goal_coverage_checked")[0].props).toEqual({ coverage_bucket: "1-3", found_count: 2, understood: "keyword" });
  expect(named(events, "first_page_edited").map((e) => e.props)).toEqual([{ changed_items: ["len"] }]);
  expect(named(events, "chip_selected").map((e) => [e.props.chip_value, e.props.is_edit])).toEqual([["thin", true]]);
  expect(specMismatches(events)).toEqual([]);
});

test("🎯 a 30-character goal with no spaces wraps inside the first page", async ({ page }) => {
  const long = "가나다라마바사아자차".repeat(3);
  await page.goto("/");
  await page.getByRole("button", { name: /알고 싶은 게 있어요/ }).click();
  await page.getByRole("textbox", FIELD).fill(long);
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

test("🎯 a written goal sorted by the LLM: the button waits, the topic comes from the answer, E-21 says llm", async ({ page }) => {
  const { events } = await recordEvents(page);
  let release: () => void = () => {};
  const answered = new Promise<void>((resolve) => { release = resolve; });
  await page.route("**/api/goal/classify", async (route) => {
    expect(route.request().postDataJSON()).toEqual({ text: "번아웃이 와요" });
    await answered;
    await route.fulfill({ json: { text: "번아웃이 와요", topic: "습관·집중", keywords: [], matched: true, method: "llm" } });
  });
  await page.goto("/");
  await page.getByRole("button", { name: /알고 싶은 게 있어요/ }).click();
  await page.getByRole("textbox", FIELD).fill("번아웃이 와요");
  await page.getByRole("button", { name: "책 펼치기" }).click();
  await expect(page.getByRole("button", { name: "책 펼치기" })).toBeDisabled();      // sorting: no second submit
  release();
  await expect(page.getByText("눌러서 펼치기")).toBeVisible();

  await expect.poll(() => named(events, "free_goal_written").length).toBe(1);
  expect(named(events, "free_goal_written")[0].props).toEqual({
    goal_text: "번아웃이 와요", topic: "습관·집중", keywords: [], is_matched: true, method: "llm", has_missing: false, missing_text: null,
  });
  expect(named(events, "goal_submitted")[0].props).toMatchObject({ topic: "습관·집중", is_free_text: true });
  expect(specMismatches(events)).toEqual([]);
});

test("🎯 the classifier failing never blocks the flow: the browser matches words itself", async ({ page }) => {
  const { events } = await recordEvents(page);
  await page.route("**/api/goal/classify", (route) => route.fulfill({ status: 500, json: { error: "boom" } }));
  await page.goto("/");
  await page.getByRole("button", { name: /알고 싶은 게 있어요/ }).click();
  await page.getByRole("textbox", FIELD).fill("SQL 공부");
  await page.getByRole("button", { name: "책 펼치기" }).click();
  await expect(page.getByText("눌러서 펼치기")).toBeVisible();
  await expect.poll(() => named(events, "free_goal_written").length).toBe(1);
  expect(named(events, "free_goal_written")[0].props).toMatchObject({ topic: "데이터 분석", keywords: ["SQL"], method: "word" });
});

test("🎯 an example chip the visitor edits becomes their own words: sorted, E-21, is_free_text true", async ({ page }) => {
  const { events } = await recordEvents(page);
  await page.goto("/");
  await page.getByRole("button", { name: /알고 싶은 게 있어요/ }).click();
  await page.getByRole("button", { name: "AI 잘 쓰기", exact: true }).click();
  const field = page.getByRole("textbox", FIELD);
  await expect(field).toHaveValue("AI 잘 쓰기");
  await field.fill("AI 잘 쓰기 처음");
  await expect(page.getByRole("button", { name: "AI 잘 쓰기", exact: true })).toHaveAttribute("aria-pressed", "false");
  await field.press("Enter");                                              // Enter sends, like [책 펼치기]
  await expect(page.getByText("눌러서 펼치기")).toBeVisible();

  await expect.poll(() => named(events, "free_goal_written").length).toBe(1);
  expect(named(events, "free_goal_written")[0].props).toMatchObject({ goal_text: "AI 잘 쓰기 처음", topic: "AI 활용" });
  expect(named(events, "goal_submitted")[0].props).toMatchObject({ topic: "AI 활용", is_free_text: true });
  expect(named(events, "chip_selected").map((e) => [e.props.chip_type, e.props.chip_value])).toEqual([["example", "AI 잘 쓰기"]]);
  expect(specMismatches(events)).toEqual([]);
});
