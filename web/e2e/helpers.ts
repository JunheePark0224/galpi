import { expect, test as base, type Page } from "@playwright/test";
import { COMMON_KEYS, EVENT_SPEC, isEventName, type PropSpec } from "../src/lib/track/schema";

/** A stable pseudo address per test (from its id), so the API's per-address rate limit sees one visitor per test, as in production. */
function clientIp(testId: string): string {
  let h = 2166136261;
  for (const ch of testId) h = Math.imul(h ^ ch.charCodeAt(0), 16777619) >>> 0;
  return `10.${h & 255}.${(h >>> 8) & 255}.${((h >>> 16) & 254) + 1}`;
}

/** `test` whose requests carry x-forwarded-for like a proxy would; every spec imports this instead of @playwright/test's. */
export const test = base.extend({
  extraHTTPHeaders: async ({}, provide, testInfo) => {
    await provide({ "x-forwarded-for": clientIp(testInfo.testId) });
  },
});

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

/**
 * taxonomy 7-3 ③ — the P6 full check, on every run: each event posted to /api/track is in EVENT_SPEC, carries exactly
 * its spec props (Amplitude-only ones are added later, by the Amplitude path) and exactly COMMON_KEYS. [] = all match.
 */
export function specMismatches(events: Sent[]): string[] {
  const common = [...COMMON_KEYS].sort().join(",");
  return events.flatMap((e) => {
    if (!isEventName(e.name)) return [`${e.name}: not in EVENT_SPEC`];
    const spec: Readonly<Record<string, PropSpec>> = EVENT_SPEC[e.name];
    const want = Object.keys(spec).filter((k) => spec[k].only !== "amplitude").sort().join(",");
    const got = Object.keys(e.props).sort().join(",");
    const gotCommon = Object.keys(e.common).sort().join(",");
    return [
      ...(got === want ? [] : [`${e.name}: props [${got}], spec [${want}]`]),
      ...(gotCommon === common ? [] : [`${e.name}: common [${gotCommon}]`]),
    ];
  });
}

/** Reacts to bookmarks in order; each click waits until the bookmark has finished rising (buttons re-enable). */
export async function reactToBookmarks(page: Page, reactions: readonly ("궁금해요" | "패스")[], total = reactions.length) {
  for (let i = 0; i < reactions.length; i++) {
    await expect(page.getByText(`${i + 1} / ${total}`)).toBeVisible();
    await page.getByRole("button", { name: reactions[i], exact: true }).click();
  }
}
