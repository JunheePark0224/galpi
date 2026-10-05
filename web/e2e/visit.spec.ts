import { expect } from "@playwright/test";
import { test } from "./helpers";

test("sends exactly one site_visited event and the server accepts it", async ({ page }) => {
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
  expect(sent.name).toBe("site_visited");
  expect(sent.common.screen_version).toBe("v2");
  expect(sent.common.anon_id).toMatch(/^[0-9a-f-]{36}$/);
  expect(statuses[0]).toBe(202);
  // TRACK_STORE=off in playwright.config.ts: accepted but not stored.
  expect(payloads[0]).toEqual({ stored: false });
});

test("a launch link: the visit carries the first-touch utm tags, the address loses them, a reload keeps them (taxonomy v1.4)", async ({ page }) => {
  const bodies: { name: string; props: Record<string, unknown>; common: Record<string, unknown> }[] = [];
  await page.route("**/api/track", async (route) => {
    bodies.push(JSON.parse(route.request().postData() ?? "{}"));
    await route.fulfill({ status: 202, json: { stored: false } });
  });
  await page.goto("/?utm_source=Threads&utm_medium=social&utm_campaign=launch_1007&utm_content=post1");
  await expect.poll(() => bodies.filter((b) => b.name === "site_visited").length).toBe(1);
  const visit = bodies.find((b) => b.name === "site_visited")!;
  expect(visit.props).toEqual({ utm_source: "threads", utm_medium: "social", utm_campaign: "launch_1007" });
  expect(visit.common.referrer).toBe("");
  // Amplitude is off in E2E (no key), so the tags leave the address at once — every utm_* goes, nothing else changes
  await expect.poll(() => new URL(page.url()).search).toBe("");
  expect(new URL(page.url()).pathname).toBe("/");
  await expect(page.getByRole("button", { name: /갈피 잡으러 가기/ })).toBeVisible();

  await page.reload();
  await expect.poll(() => bodies.filter((b) => b.name === "site_visited").length).toBe(2);
  expect(bodies.filter((b) => b.name === "site_visited")[1].props).toEqual(visit.props);
});

test("an untagged visit sends three nulls and only the referrer's host", async ({ page }) => {
  const bodies: { name: string; props: Record<string, unknown>; common: Record<string, unknown> }[] = [];
  await page.route("**/api/track", async (route) => {
    bodies.push(JSON.parse(route.request().postData() ?? "{}"));
    await route.fulfill({ status: 202, json: { stored: false } });
  });
  await page.goto("/", { referer: "https://search.example/find?q=private+words" });
  await expect.poll(() => bodies.filter((b) => b.name === "site_visited").length).toBe(1);
  const visit = bodies.find((b) => b.name === "site_visited")!;
  expect(visit.props).toEqual({ utm_source: null, utm_medium: null, utm_campaign: null });
  expect(visit.common.referrer).toBe("search.example");
});
