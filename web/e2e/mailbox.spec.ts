import { expect } from "@playwright/test";
import { named, recordEvents, START, test } from "./helpers";

// PRD F-26 갈피 우체통 (S-01 only). TRACK_STORE=off: /api/feedback answers 202 { stored: false } and sends no notice.
test.use({ reducedMotion: "reduce" });

const MAILBOX = "갈피 우체통 — 써 보고 느낀 점을 넣어 주세요";
const LETTER = "책갈피 동물이 귀여워요. 결과 화면은 조금 길어요";

test("open the mailbox, write, send, see thanks — stored by /api/feedback, never through /api/track", async ({ page }) => {
  const { events } = await recordEvents(page);
  const posted: { text: string; common: Record<string, unknown> }[] = [];
  const statuses: number[] = [];
  await page.route("**/api/feedback", async (route) => {
    posted.push(JSON.parse(route.request().postData() ?? "{}"));
    const res = await route.fetch();
    statuses.push(res.status());
    await route.fulfill({ response: res });
  });
  await page.goto("/");

  const mailbox = page.getByRole("button", { name: MAILBOX });
  await expect(mailbox).toBeVisible();
  await mailbox.click();
  const sheet = page.getByRole("dialog", { name: "갈피 우체통" });
  await expect(sheet).toBeVisible();

  await sheet.getByRole("button", { name: "넣기" }).click();                     // empty: a message, nothing sent
  await expect(sheet.getByRole("alert")).toHaveText("느낀 점을 한 줄이라도 적어 주세요.");
  expect(posted).toHaveLength(0);

  const field = sheet.getByLabel("써 보고 느낀 점");
  await field.fill(LETTER);
  await expect(sheet.getByText(`${LETTER.length} / 500`)).toBeVisible();
  await sheet.getByRole("button", { name: "넣기" }).click();

  await expect(sheet.getByTestId("mailbox-thanks")).toContainText("고마워요, 잘 받았어요");
  await expect(sheet.getByTestId("mailbox-thanks")).toBeFocused();
  await expect(sheet.getByText("하나하나 읽어 볼게요.")).toBeVisible();
  expect(posted).toEqual([{ text: LETTER, common: expect.objectContaining({ anon_id: expect.any(String) }) }]);
  expect(statuses).toEqual([202]);
  expect(named(events, "feedback_sent")).toHaveLength(0);                       // E-31 has its own route
  expect(JSON.stringify(events)).not.toContain(LETTER);

  await sheet.getByRole("button", { name: "닫기" }).click();
  await expect(sheet).toBeHidden();
  await expect(mailbox).toBeFocused();
});

test("a failed send keeps the letter and says so", async ({ page }) => {
  await page.route("**/api/feedback", (route) => route.fulfill({ status: 500, json: { error: "store failed" } }));
  await page.goto("/");
  await page.getByRole("button", { name: MAILBOX }).click();
  const sheet = page.getByRole("dialog", { name: "갈피 우체통" });
  await sheet.getByLabel("써 보고 느낀 점").fill(LETTER);
  await sheet.getByRole("button", { name: "넣기" }).click();
  await expect(sheet.getByRole("alert")).toHaveText("보내지 못했어요. 잘 안 되면 잠시 뒤에 다시 해 주세요.");
  await expect(sheet.getByLabel("써 보고 느낀 점")).toHaveValue(LETTER);
});

test("the mailbox sits below the entry, smaller and fainter, with a 44px tap target", async ({ page }) => {
  await page.goto("/");
  const entry = page.getByRole("button", { name: START });
  const mailbox = page.getByRole("button", { name: MAILBOX });
  await expect(entry).toBeVisible();
  await expect(mailbox).toBeVisible();
  // the server's S-01 is swapped for the browser's (FlowRoot) right after load — measure once both boxes are there
  const boxes = async () => [await entry.boundingBox(), await mailbox.boundingBox()] as const;
  await expect.poll(async () => (await boxes()).every(Boolean)).toBe(true);
  const [e, m] = await boxes();
  if (!e || !m) throw new Error("not laid out");
  expect(m.y).toBeGreaterThan(e.y + e.height);
  expect(m.width).toBeLessThan(e.width / 2);
  expect(m.height).toBeGreaterThanOrEqual(44);
  expect(m.width).toBeGreaterThanOrEqual(44);
  // only the drawing is faded; the words keep full ink-muted for contrast
  expect(await mailbox.evaluate((el) => Number(getComputedStyle(el).opacity))).toBe(1);
  expect(await mailbox.locator("svg").evaluate((el) => Number(getComputedStyle(el).opacity))).toBeLessThan(1);
});
