import { expect } from "@playwright/test";
import { START, test } from "./helpers";

// 10-14 iPhone (iOS Safari) report: a tap on 갈피를 못 잡겠어요 did nothing — it is a hold. A quick tap now leaves the tap
// hint in the button for 2 s. Taps (touch), WebKit on an iPhone profile.
test.use({ reducedMotion: "reduce" });

test("a tap on 갈피를 못 잡겠어요 shows the tap hint in the button, then the label again", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: START }).tap();
  const unsure = page.getByRole("button", { name: "갈피를 못 잡겠어요" });
  await unsure.tap();
  await expect(unsure).toHaveAttribute("data-nudge", "");
  await expect(page.getByRole("status").filter({ hasText: "끌리는 쪽을 골라 주세요 · 모르겠으면 꾹" })).toHaveCount(1);
  await page.screenshot({ path: "test-results/ios-tap-hint.png" });
  await expect(unsure).not.toHaveAttribute("data-nudge", "", { timeout: 4000 });
  const box = await unsure.boundingBox();
  expect(box?.height ?? 0).toBeGreaterThanOrEqual(44);
});
