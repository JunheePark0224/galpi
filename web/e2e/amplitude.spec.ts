import { expect } from "@playwright/test";
import { START, test } from "./helpers";

test.use({ reducedMotion: "reduce" });

// The key exists only in Vercel Production, so local runs, E2E and Preview must never talk to Amplitude.
test("without an Amplitude key nothing is sent to amplitude.com, no SDK code is downloaded, and the app warns once per page load", async ({ page }) => {
  const hosts: string[] = [];
  const scripts: { url: string; text: Promise<string> }[] = [];
  const warnings: string[] = [];
  page.on("request", (req) => hosts.push(new URL(req.url()).hostname));
  page.on("response", (res) => { if (res.request().resourceType() === "script") scripts.push({ url: res.url(), text: res.text().catch(() => "") }); });   // text read at once: a full navigation (처음으로) drops earlier bodies
  let loads = 0;
  page.on("load", () => { loads += 1; });
  page.on("console", (msg) => { if (msg.type() === "warning") warnings.push(msg.text()); });

  await page.goto("/");
  await page.getByRole("button", { name: START }).click();
  await page.getByRole("link", { name: "처리방침" }).first().click();
  await expect(page.getByRole("heading", { level: 1, name: "개인정보 처리방침" })).toBeVisible();
  await page.getByRole("link", { name: "처음으로" }).click();
  await expect(page.getByRole("button", { name: START })).toBeVisible();   // 처음으로 opens S-01 afresh

  // the SDK is a separate chunk that only a keyed build ever requests; its code carries Amplitude's ingestion host
  expect(scripts.length).toBeGreaterThan(0);
  for (const script of scripts) expect(await script.text, script.url).not.toContain("api2.amplitude.com");
  expect(hosts.filter((h) => h.endsWith("amplitude.com"))).toEqual([]);
  expect(loads).toBe(2);                                    // / , then 처음으로 = a full navigation to /
  // the warning comes from an effect after the page shows, so the second one may land a moment after the last assertion
  await expect.poll(() => warnings.filter((w) => w.includes("Amplitude API key missing — analytics disabled")).length).toBe(loads);
});
