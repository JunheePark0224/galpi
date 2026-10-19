import { expect } from "@playwright/test";
import { answerToClosedBook, named, reactToBookmarks, recordEvents, test } from "./helpers";

// PRD F-29 책장 효과음, DESIGN C-34 (10-19): 펼침 A on [책 펼치기], 넘김 2 on each page turn — never as the book shuts onto
// the back cover (A/B). The speaker sits on the book screens only; off is remembered (E-47 carries the state after the press).
test.use({ reducedMotion: "reduce" });

const SPEAKER = "책장 소리";

test("sounds on open and on each page turn, the speaker turns them off for good, and the back cover has no speaker", async ({ page }) => {
  const { events } = await recordEvents(page);
  // count the sounds: every source started on any AudioContext
  await page.addInitScript(() => {
    (window as unknown as { __sounds: number }).__sounds = 0;
    // oscillators start through AudioScheduledSourceNode; noise buffers have their own start on AudioBufferSourceNode
    for (const proto of [AudioScheduledSourceNode.prototype, AudioBufferSourceNode.prototype]) {
      const start = proto.start as (...a: unknown[]) => void;
      proto.start = function (this: AudioScheduledSourceNode, ...args: unknown[]) {
        (window as unknown as { __sounds: number }).__sounds++;
        return start.apply(this, args);
      };
    }
    try { localStorage.setItem("galpi.hint.firstGuide", "1"); } catch { /* the guide may show */ }
  });
  const sounds = () => page.evaluate(() => (window as unknown as { __sounds: number }).__sounds);
  await page.goto("/?ab=a");
  await answerToClosedBook(page);
  const speaker = page.getByRole("button", { name: SPEAKER });
  await expect(speaker).toHaveAttribute("aria-pressed", "true");
  expect(await sounds()).toBe(0);                                             // nothing before a tap

  await page.getByRole("button", { name: "책 펼치기" }).click();
  await expect.poll(sounds).toBeGreaterThan(0);                                // 펼침 A
  let heard = await sounds();
  await page.getByRole("button", { name: "다음 장" }).click();
  await expect.poll(sounds).toBeGreaterThan(heard);                            // 넘김 2
  heard = await sounds();
  await reactToBookmarks(page, ["패스"], 5);
  await expect.poll(sounds).toBeGreaterThan(heard);                            // a page turns to bookmark 2

  await speaker.click();
  await expect(speaker).toHaveAttribute("aria-pressed", "false");
  await expect.poll(() => named(events, "sound_toggle_clicked").length).toBe(1);
  expect(named(events, "sound_toggle_clicked")[0].props).toEqual({ is_sound_on: false });
  heard = await sounds();
  await page.getByRole("button", { name: "궁금해요", exact: true }).click();
  await expect(page.getByText("3 / 5")).toBeVisible();
  expect(await sounds()).toBe(heard);                                          // off: silent

  await page.reload();
  await expect(page.getByRole("button", { name: SPEAKER })).toHaveAttribute("aria-pressed", "false");   // remembered

  for (const n of [3, 4, 5]) {
    await expect(page.getByText(`${n} / 5`)).toBeVisible();
    await page.getByRole("button", { name: "패스", exact: true }).click();
  }
  await expect(page.getByRole("heading", { level: 1, name: "오늘 만난 책갈피" })).toBeVisible();
  await expect(page.getByRole("button", { name: SPEAKER })).toHaveCount(0);    // not on the back cover
});

test("with the sound on: every turn to a new bookmark sounds, the fifth reaction (the book shutting onto the back cover) does not", async ({ page }) => {
  await page.addInitScript(() => {
    (window as unknown as { __sounds: number }).__sounds = 0;
    for (const proto of [AudioScheduledSourceNode.prototype, AudioBufferSourceNode.prototype]) {
      const start = proto.start as (...a: unknown[]) => void;
      proto.start = function (this: AudioScheduledSourceNode, ...args: unknown[]) {
        (window as unknown as { __sounds: number }).__sounds++;
        return start.apply(this, args);
      };
    }
    try { localStorage.setItem("galpi.hint.firstGuide", "1"); } catch { /* the guide may show */ }
  });
  const sounds = () => page.evaluate(() => (window as unknown as { __sounds: number }).__sounds);
  await page.goto("/?ab=a");
  await answerToClosedBook(page);
  await page.getByRole("button", { name: "책 펼치기" }).click();
  await page.getByRole("button", { name: "다음 장" }).click();
  for (let n = 1; n <= 4; n++) {
    await expect(page.getByText(`${n} / 5`)).toBeVisible();
    const before = await sounds();
    await page.getByRole("button", { name: "패스", exact: true }).click();
    await expect.poll(sounds).toBeGreaterThan(before);                       // a page turns to bookmark n + 1
  }
  await expect(page.getByText("5 / 5")).toBeVisible();
  const before = await sounds();
  await page.getByRole("button", { name: "패스", exact: true }).click();
  await expect(page.getByRole("heading", { level: 1, name: "오늘 만난 책갈피" })).toBeVisible();
  await page.waitForTimeout(400);
  expect(await sounds()).toBe(before);                                        // the shutting book is silent (A/B scene)
});
