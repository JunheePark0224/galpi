import { expect, test, type Page } from "@playwright/test";
import { named, reactToBookmarks, recordEvents } from "./helpers";

test.use({ reducedMotion: "reduce" });

/** Keyboard hold (Enter) — same timer as touch; deterministic on both projects. */
async function holdUnsure(page: Page, ms: number) {
  await page.getByRole("button", { name: "갈피를 못 잡겠어요" }).focus();
  await page.keyboard.down("Enter");
  await page.waitForTimeout(ms);
  await page.keyboard.up("Enter");
}

/** Taps the left card from question `from` to 9, waiting for each question to appear. */
async function answerLeft(page: Page, from: number) {
  for (let q = from; q <= 9; q++) {
    await expect(page.getByText(`${q} / 9`)).toBeVisible();
    await page.locator('[data-side="left"]').click();
  }
}

test("🍃 nine answers (one held 못 잡겠어요) → book → five bookmarks", async ({ page }) => {
  const { events, statuses } = await recordEvents(page);
  await page.goto("/");
  await page.getByRole("button", { name: /그냥 한 권 만나고 싶어요/ }).click();
  await expect(page.getByRole("heading", { name: "책을 덮은 뒤, 남았으면 하는 건?" })).toBeVisible();
  await holdUnsure(page, 300);                                           // let go early: still question 1
  await expect(page.getByText("1 / 9")).toBeVisible();
  await holdUnsure(page, 1000);                                          // the 0.8s timer passes
  await answerLeft(page, 2);                                             // Q2–4 A, Q5–8 B (A sits right), Q9 A

  await page.getByRole("button", { name: "책 펼치기" }).click();
  await expect(page.getByText("당신의 책 취향")).toBeVisible();
  await expect(page.getByText("여운", { exact: true })).toBeVisible();   // temp: 못 잡겠어요 + B
  await expect(page.getByText("문장 · 몰입 둘 다 좋아요")).toBeVisible();
  await page.getByRole("button", { name: "다음 장" }).click();
  await reactToBookmarks(page, ["궁금해요", "패스", "패스", "궁금해요", "패스"]);
  await expect(page.getByRole("listitem")).toHaveCount(2);

  await expect.poll(() => named(events, "bookmark_reacted").length).toBe(5);
  const answers = named(events, "balance_answered");
  expect(answers).toHaveLength(9);
  expect(answers[0].props).toMatchObject({ question: 1, choice: "unsure", side: null, edit: false });
  expect(answers[4].props).toMatchObject({ question: 5, choice: "B", side: "left" });
  expect(answers.every((e) => typeof e.props.ms === "number")).toBe(true);
  const cancelled = named(events, "unsure_hold_cancelled");
  expect(cancelled).toHaveLength(1);
  expect(cancelled[0].props.question).toBe(1);
  expect(cancelled[0].props.held_ms as number).toBeGreaterThan(200);
  const shown = named(events, "bookmark_shown");
  expect(shown).toHaveLength(5);
  expect(shown.every((e) => e.common.entry === "leaf" && e.props.one_liner_style === "question")).toBe(true);
  expect(shown.every((e) => typeof (e.props.art as { animal?: string }).animal === "string")).toBe(true);
  await expect.poll(() => statuses.length).toBe(events.length);
  expect(statuses.every((s) => s === 202)).toBe(true);
});

test("🍃 a reload keeps the page and the entry/round of later events", async ({ page }) => {
  const { events } = await recordEvents(page);
  await page.goto("/");
  await page.getByRole("button", { name: /그냥 한 권 만나고 싶어요/ }).click();
  await answerLeft(page, 1);
  await page.getByRole("button", { name: "책 펼치기" }).click();
  await page.getByRole("button", { name: "다음 장" }).click();
  await reactToBookmarks(page, ["궁금해요"], 5);
  await expect(page.getByText("2 / 5")).toBeVisible();
  await expect(page.getByRole("button", { name: "궁금해요" })).toBeEnabled();
  const label = await page.getByRole("article").getAttribute("aria-label");

  await page.reload();
  await expect(page.getByText("2 / 5")).toBeVisible();
  await expect(page.getByRole("article")).toHaveAttribute("aria-label", label ?? "");
  await expect.poll(() => named(events, "visit").length).toBe(2);
  expect(named(events, "visit")[1].common).toMatchObject({ entry: "leaf", round: 1 });
  expect(named(events, "bookmark_shown")).toHaveLength(2);              // a reload is not a new showing
});
