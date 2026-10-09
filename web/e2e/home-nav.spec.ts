import { expect, type Page } from "@playwright/test";
import { DATA_PATH } from "../src/lib/paths/__fixtures__/paths";
import { answerPath, named, recordEvents, specMismatches, START, test } from "./helpers";

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
  await answerPath(page, DATA_PATH.slice(0, 2));
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

// The header's [처음으로] beside the account place (10-09, D안 — mockups/2026-10-09-home-button-right.png).
const headerHome = (page: Page) => page.locator("header").getByRole("link", { name: "처음으로" });

test("header [처음으로]: hidden at S-01, mid-flow it goes straight home in place (E-20 header, new round)", async ({ page }) => {
  const { events } = await recordEvents(page);
  await page.goto("/");
  await expectHome(page);
  await expect(headerHome(page)).toHaveCount(0);
  await page.getByRole("button", { name: START }).click();
  await answerPath(page, DATA_PATH.slice(0, 2));
  const visits = named(events, "site_visited").length;
  const box = await headerHome(page).boundingBox();
  expect(box?.height ?? 0).toBeGreaterThanOrEqual(44);
  await headerHome(page).click();
  await expectHome(page);                                     // no confirmation
  await expect(headerHome(page)).toHaveCount(0);
  await expect.poll(() => named(events, "home_clicked").length).toBe(1);
  expect(named(events, "home_clicked")[0]).toMatchObject({ props: { curious_count: 0, source: "header" }, common: { round: 1 } });
  expect(named(events, "site_visited")).toHaveLength(visits); // in place — no page load
  await page.getByRole("button", { name: START }).click();
  await expect.poll(() => named(events, "entry_selected").length).toBe(2);
  expect(named(events, "entry_selected")[1].common).toMatchObject({ round: 2, entry: null, mode: null });
  expect(specMismatches(events)).toEqual([]);
});

test("header [처음으로] on another page is a plain link to S-01", async ({ page }) => {
  await page.goto("/privacy");
  await headerHome(page).click();
  await expect(page).toHaveURL(/\/$/);
  await expectHome(page);
});

test.describe("320 × 568: [처음으로] and [내 책갈피 10] fit the header on one line", () => {
  test.use({ viewport: { width: 320, height: 568 } });
  test("no overflow, one row", async ({ page }) => {
    await page.route("**/api/me", (route) => route.fulfill({ json: { enabled: true, loggedIn: true, id: "e2e-user", count: 10, login: null } }));
    await startPath(page);
    const account = page.locator("header").getByRole("link", { name: "내 책갈피 10개" });
    await expect(account).toBeVisible();
    const [a, b] = [await headerHome(page).boundingBox(), await account.boundingBox()];
    expect(Math.abs((a?.y ?? 0) - (b?.y ?? 99))).toBeLessThan(2);
    expect((a?.x ?? 0) + (a?.width ?? 0)).toBeLessThanOrEqual(b?.x ?? 0);
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(320);
    await page.locator("header").screenshot({ path: "test-results/header-320.png" });
  });
});
