import { expect, type Page } from "@playwright/test";

export interface Sent { name: string; props: Record<string, unknown>; common: Record<string, unknown> }

/** Records every track() call and the server's answer (TRACK_STORE=off: accepted, never stored). */
export async function recordEvents(page: Page): Promise<{ events: Sent[]; statuses: number[] }> {
  const events: Sent[] = [];
  const statuses: number[] = [];
  // Chromium only exposes sendBeacon bodies to Playwright when the request is routed.
  await page.route("**/api/track", async (route) => {
    events.push(JSON.parse(route.request().postData() ?? "{}") as Sent);
    try {
      const res = await route.fetch();
      statuses.push(res.status());
      await route.fulfill({ response: res });
    } catch {
      // the test ended while this event was still in flight — callers wait for statuses before asserting them
    }
  });
  return { events, statuses };
}

export const named = (events: Sent[], name: string) => events.filter((e) => e.name === name);

/** Reacts to bookmarks in order; each click waits until the bookmark has finished rising (buttons re-enable). */
export async function reactToBookmarks(page: Page, reactions: readonly ("궁금해요" | "패스")[], total = reactions.length) {
  for (let i = 0; i < reactions.length; i++) {
    await expect(page.getByText(`${i + 1} / ${total}`)).toBeVisible();
    await page.getByRole("button", { name: reactions[i], exact: true }).click();
  }
}
