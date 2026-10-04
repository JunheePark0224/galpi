import { expect, type Page } from "@playwright/test";
import { SQL_PATH } from "../src/lib/paths/__fixtures__/paths";
import { answerPath, named, recordEvents, START, test } from "./helpers";

test.use({ reducedMotion: "reduce" });

async function startPath(page: Page) {
  await page.goto("/");
  await page.getByRole("button", { name: START }).click();
  await expect(page.getByRole("heading", { level: 1, name: "오늘은 어느 쪽으로 걸어 볼까요?" })).toBeVisible();
}

async function expectHome(page: Page) {
  await expect(page.getByRole("button", { name: START })).toBeVisible();
}

const round = (page: Page) => page.evaluate(() => sessionStorage.getItem("galpi.round"));

test("a reload resumes mid-flow, but opening the address again starts at S-01 in a new round", async ({ page }) => {
  await startPath(page);

  await page.reload();
  await expect(page.getByRole("heading", { level: 1, name: "오늘은 어느 쪽으로 걸어 볼까요?" })).toBeVisible();
  expect(await round(page)).toBeNull();                       // still round 1

  await page.goto("/");                                       // typed address / opened link
  await expectHome(page);
  expect(await round(page)).toBe("2");                        // the unfinished round is left behind
});

test("the visit of a fresh open mid-flow is the new game's (round + 1, no branch or route); a reload keeps both", async ({ page }) => {
  const { events } = await recordEvents(page);
  await startPath(page);
  await answerPath(page, SQL_PATH.slice(0, 2));
  await expect.poll(() => named(events, "site_visited").length).toBe(1);
  await page.reload();
  await expect.poll(() => named(events, "site_visited").length).toBe(2);
  expect(named(events, "site_visited")[1].common).toMatchObject({ round: 1, entry: "target", mode: "normal" });
  await page.goto("/");
  await expect.poll(() => named(events, "site_visited").length).toBe(3);
  expect(named(events, "site_visited")[2].common).toMatchObject({ round: 2, entry: null, mode: null });
});

test("the header logo returns to S-01 from mid-flow", async ({ page }) => {
  await startPath(page);
  const logo = page.getByRole("link", { name: "갈피 처음 화면" });
  const box = await logo.boundingBox();
  expect(box?.height ?? 0).toBeGreaterThanOrEqual(44);
  await logo.click();
  await expect(page).toHaveURL(/\/$/);
  await expectHome(page);
});

test("the header logo works on /privacy too", async ({ page }) => {
  await page.goto("/privacy");
  await page.getByRole("link", { name: "갈피 처음 화면" }).click();
  await expect(page).toHaveURL(/\/$/);
  await expectHome(page);
});

test("coming back from /privacy with the browser's back button resumes the flow", async ({ page }) => {
  await startPath(page);
  await page.locator("footer").getByRole("link", { name: "처리방침" }).click();
  await expect(page).toHaveURL(/\/privacy$/);
  await page.goBack();
  await expect(page.getByRole("heading", { level: 1, name: "오늘은 어느 쪽으로 걸어 볼까요?" })).toBeVisible();
});

test("the books already shown stay excluded after a fresh open", async ({ page }) => {
  await startPath(page);
  await page.evaluate(() => {
    const raw = JSON.parse(sessionStorage.getItem("galpi.flow") ?? "{}");
    raw.state.seen = ["9780000000001"];
    sessionStorage.setItem("galpi.flow", JSON.stringify(raw));
  });
  await page.goto("/");
  await expectHome(page);
  const seen = await page.evaluate(() => JSON.parse(sessionStorage.getItem("galpi.flow") ?? "{}").state?.seen);
  expect(seen).toEqual(["9780000000001"]);
});
