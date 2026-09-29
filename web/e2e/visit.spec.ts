import { expect, test } from "@playwright/test";

test("sends exactly one visit event and the server accepts it", async ({ page }) => {
  const bodies: string[] = [];
  const statuses: number[] = [];
  const payloads: unknown[] = [];
  // Chromium only exposes sendBeacon bodies to Playwright when the request is routed.
  await page.route("**/api/track", async (route) => {
    bodies.push(route.request().postData() ?? "");
    const res = await route.fetch();
    statuses.push(res.status());
    payloads.push(await res.json());
    await route.fulfill({ response: res });
  });
  await page.goto("/");
  await expect.poll(() => bodies.length).toBeGreaterThanOrEqual(1);
  await page.waitForTimeout(500);
  expect(bodies).toHaveLength(1);
  const sent = JSON.parse(bodies[0]);
  expect(sent.name).toBe("visit");
  expect(sent.common.screen_version).toBe("v1");
  expect(sent.common.anon_id).toMatch(/^[0-9a-f-]{36}$/);
  expect(statuses[0]).toBe(202);
  // TRACK_STORE=off in playwright.config.ts: accepted but not stored.
  expect(payloads[0]).toEqual({ stored: false });
});
