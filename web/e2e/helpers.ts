import { expect, test as base, type Page } from "@playwright/test";
import { COMMON_KEYS, EVENT_SPEC, isEventName, type PropSpec } from "../src/lib/track/schema";
import built from "../src/data/question-map.json";
import { SQL_PATH } from "../src/lib/paths/__fixtures__/paths";
import type { Answer, QuestionMap } from "../src/lib/paths/types";

const MAP = built as QuestionMap;
/** S-01's one entry (PRD F-01 v2). */
export const START = "갈피 잡으러 가기";
/** Question.tsx ignores card taps in the first 250 ms of a question (a double tap must not answer the next one). */
const TAP_GUARD_MS = 250;

/** The card label for an answer, or null for 갈피를 못 잡겠어요 (the hold). */
export function labelOf(a: Answer): string | null {
  const n = MAP.nodes[a.node];
  return a.choice === "unsure" ? null : a.choice === "A" ? n.a.label : n.b.label;
}

/** Keyboard hold (Enter) — same timer as touch; deterministic on both projects. */
export async function holdUnsure(page: Page, ms = 1000) {
  await page.getByRole("button", { name: "갈피를 못 잡겠어요" }).focus();
  await page.keyboard.down("Enter");
  await page.waitForTimeout(ms);
  await page.keyboard.up("Enter");
}

/** Answers each question as it comes: waits for its heading, then taps the card (or holds 못 잡겠어요). */
export async function answerPath(page: Page, answers: readonly Answer[]) {
  for (const a of answers) {
    await expect(page.getByRole("heading", { level: 1, name: MAP.nodes[a.node].question, exact: true })).toBeVisible();
    const label = labelOf(a);
    if (label === null) {
      await holdUnsure(page);
      continue;
    }
    await page.waitForTimeout(TAP_GUARD_MS + 50);
    await page.getByRole("button", { name: label, exact: true }).click();
  }
}

/** From S-01 already on screen: [갈피 잡으러 가기] → the path → S-03 (the closed book). */
export async function answerToClosedBook(page: Page, answers: readonly Answer[] = SQL_PATH) {
  await page.getByRole("button", { name: START }).click();
  await answerPath(page, answers);
  await expect(page.getByText("눌러서 펼치기")).toBeVisible();
}

export async function toClosedBook(page: Page, answers: readonly Answer[] = SQL_PATH) {
  await page.goto("/");
  await answerToClosedBook(page, answers);
}

/** … → open the book (S-04) → [다음 장] (S-05, the first bookmark). */
export async function toBookmarks(page: Page, answers: readonly Answer[] = SQL_PATH) {
  await toClosedBook(page, answers);
  await page.getByRole("button", { name: "책 펼치기" }).click();
  await page.getByRole("button", { name: "다음 장" }).click();
}

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
  // C-20 · C-21: the S-05 and S-06 guides are marked as seen, so specs reach the reactions and the S-06 buttons;
  // first-guide.spec and result-guide.spec remove their mark.
  page: async ({ page }, provide) => {
    await page.addInitScript(() => {
      try {
        window.localStorage.setItem("galpi.hint.firstGuide", "1");
        window.localStorage.setItem("galpi.hint.resultGuide", "1");
        window.localStorage.setItem("galpi.hint.libraryGuide", "1");
      } catch { /* blocked */ }
    });
    await provide(page);
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
/**
 * React to the bookmarks in turn. After the last one the S-11 뒤표지 shows (F-27, 10-07); unless `stayOnBack`, its main
 * button is pressed so the round goes on to S-06 / S-08 as before.
 */
export async function reactToBookmarks(page: Page, reactions: readonly ("궁금해요" | "패스")[], total = reactions.length, stayOnBack = false) {
  for (let i = 0; i < reactions.length; i++) {
    await expect(page.getByText(`${i + 1} / ${total}`)).toBeVisible();
    await page.getByRole("button", { name: reactions[i], exact: true }).click();
  }
  if (reactions.length < total) return;
  await expect(page.getByRole("heading", { level: 1, name: "오늘 만난 책갈피" })).toBeVisible();
  if (stayOnBack) return;
  const curious = reactions.filter((r) => r === "궁금해요").length;
  await page.getByRole("button", { name: curious > 0 ? `궁금해요 ${curious}권 책 정보 보기` : "다음 책갈피 만나기" }).click();
}
