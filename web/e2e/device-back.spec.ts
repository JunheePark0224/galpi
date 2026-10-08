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

test("the bookmarks hold — a note, then a second press within 3 s goes to S-01", async ({ page }) => {
  await toBookmarks(page);
  await expect(page.getByText(`1 / 5`)).toBeVisible();
  await page.goBack();
  await expect(page.getByRole("status").filter({ hasText: "책갈피는 되돌릴 수 없어요" })).toBeVisible();
  await expect(page.getByText(`1 / 5`)).toBeVisible();                   // still on the bookmark
  await page.goBack();
  await expect(page.getByRole("button", { name: START })).toBeVisible();
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
