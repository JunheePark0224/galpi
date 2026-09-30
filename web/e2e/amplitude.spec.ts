import { expect } from "@playwright/test";
import { test } from "./helpers";

test.use({ reducedMotion: "reduce" });

// The key exists only in Vercel Production, so local runs, E2E and Preview must never talk to Amplitude.
test("without an Amplitude key nothing is sent to amplitude.com and the app warns once", async ({ page }) => {
  const hosts: string[] = [];
  const warnings: string[] = [];
  page.on("request", (req) => hosts.push(new URL(req.url()).hostname));
  page.on("console", (msg) => { if (msg.type() === "warning") warnings.push(msg.text()); });

  await page.goto("/");
  await page.getByRole("button", { name: /알고 싶은 게 있어요/ }).click();
  await page.getByRole("link", { name: "처리방침" }).first().click();
  await expect(page.getByRole("heading", { level: 1, name: "개인정보 처리방침" })).toBeVisible();
  await page.getByRole("link", { name: "처음으로" }).click();
  await expect(page.getByRole("heading", { name: "알고 싶은 게 있어요" })).toBeVisible();

  expect(hosts.filter((h) => h.endsWith("amplitude.com"))).toEqual([]);
  expect(warnings.filter((w) => w.includes("Amplitude API key missing — analytics disabled"))).toHaveLength(1);
});
