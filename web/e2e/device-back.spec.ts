import { expect, type Page } from "@playwright/test";
import built from "../src/data/question-map.json";
import { SQL_PATH } from "../src/lib/paths/__fixtures__/paths";
import type { QuestionMap } from "../src/lib/paths/types";
import { answerPath, named, reactToBookmarks, recordEvents, specMismatches, START, test, toBookmarks, toClosedBook } from "./helpers";

/**
 * The phone's back key (10-08, plans/2026-10-08-device-back.md): one step back inside the flow instead of leaving the site.
 * page.goBack() is the browser's back — what the key does on a phone.
 */
const MAP = built as QuestionMap;
const question = (page: Page, i: number) =>
  page.getByRole("heading", { level: 1, name: MAP.nodes[SQL_PATH[i].node].question, exact: true });

test("questions: back goes to the previous question, then from the first one to S-01 (E-33 · E-20 device_back)", async ({ page }) => {
  const { events } = await recordEvents(page);
  await page.goto("/");
  await page.getByRole("button", { name: START }).click();
  await answerPath(page, SQL_PATH.slice(0, 2));
  await expect(question(page, 2)).toBeVisible();
  await page.goBack();
  await expect(question(page, 1)).toBeVisible();
  await expect(page).toHaveURL(/\/$/);                                  // still on the site
  await page.goBack();
  await expect(question(page, 0)).toBeVisible();
  await page.goBack();
  await expect(page.getByRole("button", { name: START })).toBeVisible();
  await expect.poll(() => named(events, "question_back_clicked").map((e) => e.props.source)).toEqual(["device_back", "device_back"]);
  await expect.poll(() => named(events, "home_clicked").map((e) => e.props.source)).toEqual(["device_back"]);
  expect(specMismatches(events)).toEqual([]);
});

test("the closed book: back goes to the last question", async ({ page }) => {
  await toClosedBook(page);
  await page.goBack();
  await expect(question(page, SQL_PATH.length - 1)).toBeVisible();
});

test("the bookmarks hold — a note with [처음으로], which goes to S-01 (E-20 device_back)", async ({ page }) => {
  const { events } = await recordEvents(page);
  await toBookmarks(page);
  await expect(page.getByText(`1 / 5`)).toBeVisible();
  await page.goBack();
  const note = page.getByRole("status").filter({ hasText: "책갈피는 되돌릴 수 없어요" });
  await expect(note).toBeVisible();
  await expect(page.getByText(`1 / 5`)).toBeVisible();                   // still on the bookmark
  await note.getByRole("button", { name: "처음으로" }).click();
  await expect(page.getByRole("button", { name: START })).toBeVisible();
  await expect.poll(() => named(events, "home_clicked").map((e) => e.props.source)).toEqual(["device_back"]);
});

/**
 * Chrome skips back over history entries a page adds without a user tap (10-08: on a phone the second back press left
 * the site). Playwright's goBack does not apply that rule, so this checks the cause: every entry is added in a tap.
 */
test("every history entry is added during a tap; back, a tap, back again stays in the flow", async ({ page }) => {
  await page.addInitScript(() => {
    // true = an entry added with no tap since the last history move — the kind Chrome skips over
    const pushes: boolean[] = [];
    let moved = false;
    (window as unknown as { pushes: boolean[] }).pushes = pushes;
    window.addEventListener("popstate", () => { moved = true; }, true);
    for (const type of ["pointerdown", "keydown", "click"]) window.addEventListener(type, () => { moved = false; }, true);
    const push = history.pushState.bind(history);
    history.pushState = (data, unused, url) => {
      const st = data as { galpiDepth?: number; galpiBack?: boolean } | null;   // galpiBack: the first version's mark
      if (st?.galpiDepth !== undefined || st?.galpiBack) pushes.push(moved);
      return push(data, unused, url);
    };
  });
  await page.goto("/privacy");
  await page.goto("/");
  await page.getByRole("button", { name: START }).click();
  await answerPath(page, SQL_PATH.slice(0, 2));
  await page.goBack();
  await expect(question(page, 1)).toBeVisible();
  await answerPath(page, SQL_PATH.slice(1, 2));
  await expect(question(page, 2)).toBeVisible();
  await page.goBack();
  await expect(question(page, 1)).toBeVisible();
  await page.goBack();
  await expect(question(page, 0)).toBeVisible();
  const pushes = await page.evaluate(() => (window as unknown as { pushes: boolean[] }).pushes);
  expect(pushes.length).toBeGreaterThan(0);
  expect(pushes.filter(Boolean)).toEqual([]);   // none added after a back move without a tap in between
});

test("the share sheet closes with back; the 궁금해요 book goes back to the 뒤표지", async ({ page }) => {
  await toBookmarks(page);
  await reactToBookmarks(page, ["궁금해요", "패스", "패스", "패스", "패스"], 5, true);
  await page.getByRole("button", { name: "결과 공유하기" }).click();
  await expect(page.getByRole("dialog", { name: "결과 공유하기" })).toBeVisible();
  await page.goBack();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(page.getByRole("button", { name: "궁금해요 1권 책 정보 보기" })).toBeVisible();
  await page.getByRole("button", { name: "궁금해요 1권 책 정보 보기" }).click();
  await expect(page.getByText("궁금해요 1 / 1")).toBeVisible();
  await page.goBack();
  await expect(page.getByRole("button", { name: "궁금해요 1권 책 정보 보기" })).toBeVisible();
});

test("after [처음으로] on the last screen, back leaves the site — no dead press", async ({ page }) => {
  await page.goto("/privacy");
  await toBookmarks(page);
  await reactToBookmarks(page, ["패스", "패스", "패스", "패스", "패스"], 5);
  await page.getByRole("button", { name: "처음으로" }).click();
  await expect(page.getByRole("button", { name: START })).toBeVisible();
  await page.waitForTimeout(300);
  await page.goBack();
  await expect(page).toHaveURL(/\/privacy$/);
});

test("reloaded mid-path, back still goes to the previous question (one mark, not two)", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: START }).click();
  await answerPath(page, SQL_PATH.slice(0, 2));
  await expect(question(page, 2)).toBeVisible();
  await page.reload();
  await expect(question(page, 2)).toBeVisible();
  await page.waitForTimeout(300);
  await page.goBack();
  await expect(question(page, 1)).toBeVisible();
  await page.goBack();
  await expect(question(page, 0)).toBeVisible();
});
