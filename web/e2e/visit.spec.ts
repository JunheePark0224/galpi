import { expect, test } from "@playwright/test";

test("opening the home page sends one visit event", async ({ page }) => {
  const bodies: string[] = [];
  // Chromium only exposes sendBeacon bodies to Playwright when the request is routed.
  await page.route("**/api/track", async (route) => {
    bodies.push(route.request().postData() ?? "");
    await route.continue();
  });
  await page.goto("/");
  await expect.poll(() => bodies.length).toBeGreaterThanOrEqual(1);
  const sent = JSON.parse(bodies[0]);
  expect(sent.name).toBe("visit");
  expect(sent.common.screen_version).toBe("v1");
  expect(sent.common.anon_id).toMatch(/^[0-9a-f-]{36}$/);
});
