import { expect, type Page } from "@playwright/test";
import { named, recordEvents, specMismatches, test } from "./helpers";

// PRD F-24 "이렇게 이해했어요" (mockup C′). The classifier is faked in the page (E2E has no Anthropic key); books: BOOKS_SOURCE=sample.
test.use({ reducedMotion: "reduce" });

const FIELD = { name: "무엇을 알고 싶어요" } as const;
/** F24_SHOTS=<dir>: also save a screenshot of each first page (phone project only) — for the design review, not an assertion. */
const SHOTS = process.env.F24_SHOTS;

interface Fake { topic: string; keywords: string[]; matched: boolean; missing: string | null }

/** window.open is stubbed in the page: the test reads what would have opened (and nothing leaves for the real YES24). */
async function stubOpen(page: Page) {
  await page.addInitScript(() => {
    const w = window as Window & { __opened?: unknown[][] };
    w.__opened = [];
    w.open = (...args: unknown[]) => { w.__opened?.push(args); return null; };
  });
}
const opened = (page: Page) => page.evaluate(() => (window as Window & { __opened?: unknown[][] }).__opened ?? []);

/**
 * C1 (review): the visitor's phrase must never sit in a DOM attribute (Amplitude autocapture sends hrefs unmasked, Session
 * Replay records attributes), and its visible text must be inside a data-amp-mask. Returns what breaks either rule.
 */
const leaks = (page: Page, phrase: string) => page.evaluate((p) => {
  const out: string[] = [];
  for (const el of document.querySelectorAll("*")) {
    for (const a of el.attributes) if (a.value.includes(p)) out.push(`${el.tagName}[${a.name}]`);
  }
  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  for (let n = walker.nextNode(); n; n = walker.nextNode()) {
    if (n.textContent?.includes(p) && !n.parentElement?.closest("[data-amp-mask]")) out.push(`text outside mask: ${n.textContent}`);
  }
  return out;
}, phrase);

/** S-01 → 🎯 → write `text` → the classifier answers `fake` → open the book. Counts draw requests. */
async function openWith(page: Page, text: string, fake: Fake, method: "llm" | "word" = "llm"): Promise<{ draws: () => number }> {
  let draws = 0;
  await stubOpen(page);
  await page.route("**/api/goal/classify", (route) => route.fulfill({ json: { text, ...fake, method } }));
  await page.route("**/api/books/draw", (route) => { draws += 1; return route.continue(); });
  await page.goto("/");
  await page.getByRole("button", { name: /알고 싶은 게 있어요/ }).click();
  await page.getByRole("textbox", FIELD).fill(text);
  await page.getByRole("button", { name: "책 펼치기" }).click();
  await expect(page.getByText("눌러서 펼치기")).toBeVisible();
  await page.getByRole("button", { name: "책 펼치기" }).click();
  await expect(page.getByRole("heading", { name: "당신이 찾는 책" })).toBeVisible();
  return { draws: () => draws };
}

async function shot(page: Page, name: string, project: string) {
  if (SHOTS && project === "phone") await page.screenshot({ path: `${SHOTS}/${name}.png` });
}

test("F-24 ①: topic and keyword — the path under 무엇을, then the usual edit and next page", async ({ page }, testInfo) => {
  const { events } = await recordEvents(page);
  await openWith(page, "회귀분석 처음", { topic: "통계", keywords: ["회귀분석"], matched: true, missing: null });
  const block = page.getByRole("region", { name: "이렇게 이해했어요" });
  await expect(block).toContainText("이렇게 이해했어요");
  await expect(block).toContainText("데이터·통계 › 통계 › 회귀분석으로 찾았어요");
  await expect(block.locator("[data-last]")).toHaveText("회귀분석으로");
  await expect(page.getByRole("button", { name: "한 번 고치기" })).toBeVisible();
  await expect(page.getByRole("button", { name: "다음 장" })).toBeEnabled();
  await shot(page, "f24-1-keyword", testInfo.project.name);

  await expect.poll(() => named(events, "goal_coverage_checked").length).toBe(1);
  expect(named(events, "goal_coverage_checked")[0].props).toMatchObject({ understood: "keyword" });
  expect(named(events, "free_goal_written")[0].props).toMatchObject({ has_missing: false, missing_text: null });
  expect(specMismatches(events)).toEqual([]);
});

test("F-24 ②: the missing thing, similar books, and a YES24 search for that phrase only", async ({ page }, testInfo) => {
  const { events } = await recordEvents(page);
  const note = "SQL 윈도우 함수 고급";
  await openWith(page, note, { topic: "데이터 분석", keywords: [], matched: true, missing: "윈도우 함수" });
  const block = page.getByRole("region", { name: "이렇게 이해했어요" });
  await expect(block).toContainText("데이터·통계 › 데이터 분석 › 윈도우 함수 · 아직 없어요");
  await expect(block).not.toContainText("찾았어요");
  await expect(block).toContainText("비슷한 '데이터 분석' 책을 펼칠게요");
  await expect(block.getByRole("link")).toHaveCount(0);                        // a button: no href carries the phrase
  const find = page.getByRole("button", { name: "예스24에서 '윈도우 함수' 찾기" });   // the ↗ is aria-hidden
  await expect(find).toBeVisible();
  await expect(find).toHaveText("예스24에서 '윈도우 함수' 찾기 ↗");
  expect((await find.boundingBox())?.height).toBeGreaterThanOrEqual(44);     // a real tap target
  expect(await leaks(page, "윈도우")).toEqual([]);
  await shot(page, "f24-2-missing", testInfo.project.name);

  await find.click();
  const calls = await opened(page);
  expect(calls).toHaveLength(1);
  const url = new URL(String(calls[0][0]));
  expect(url.host).toBe("www.yes24.com");
  expect(url.searchParams.get("query")).toBe("윈도우 함수");
  expect(url.href).not.toContain(encodeURIComponent(note));                   // never the whole note
  expect(calls[0].slice(1)).toEqual(["_blank", "noopener,noreferrer"]);
  expect(await leaks(page, "윈도우")).toEqual([]);
  await page.getByRole("button", { name: "다음 장" }).click();                 // similar books still follow
  await expect(page.getByRole("article")).toBeVisible();

  await expect.poll(() => named(events, "yes24_link_clicked").length).toBe(1);
  expect(named(events, "yes24_link_clicked")[0].props).toEqual({ book_id: null, source: "first_page", pick_type: null });
  expect(named(events, "goal_coverage_checked")[0].props).toMatchObject({ understood: "missing" });
  expect(named(events, "free_goal_written")[0].props).toMatchObject({ has_missing: true, missing_text: "윈도우 함수" });
  expect(specMismatches(events)).toEqual([]);
});

test("F-24 ③: no topic — no draw and no bookmarks; YES24, 다른 말로 쓰기, 🍃 그냥 한 권", async ({ page }, testInfo) => {
  const { events } = await recordEvents(page);
  const { draws } = await openWith(page, "캠핑 장비 고르기", { topic: "습관·집중", keywords: [], matched: false, missing: "캠핑 장비" });
  await expect(page.getByRole("region", { name: "이렇게 이해했어요" })).toContainText("아직 갈피가 다루지 않는 주제예요");
  await expect(page.getByText("›")).toHaveCount(0);
  await expect(page.getByText(/아직 이 주제 책이 없어요/)).toHaveCount(0);
  await expect(page.getByRole("button", { name: "다음 장" })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "한 번 고치기" })).toHaveCount(0);
  const yes24 = page.getByRole("button", { name: "예스24에서 찾기" });
  await expect(yes24).toHaveAttribute("data-variant", "primary");
  await expect(yes24).toHaveText("예스24에서 찾기 ↗");
  expect(await leaks(page, "캠핑")).toEqual([]);
  await expect(page.getByRole("button", { name: "다른 말로 쓰기" })).toBeVisible();
  await expect(page.getByRole("button", { name: "🍃 그냥 한 권" })).toBeVisible();
  // the buttons stay on screen and side by side under the full-width YES24 button
  const [y, rewrite, leaf] = await Promise.all([yes24.boundingBox(), page.getByRole("button", { name: "다른 말로 쓰기" }).boundingBox(),
    page.getByRole("button", { name: "🍃 그냥 한 권" }).boundingBox()]);
  if (!y || !rewrite || !leaf) throw new Error("buttons missing");
  expect(rewrite.y).toBeGreaterThan(y.y);
  expect(Math.abs(rewrite.y - leaf.y)).toBeLessThan(2);
  expect(leaf.y + leaf.height).toBeLessThanOrEqual(page.viewportSize()?.height ?? 0);
  await shot(page, "f24-3-none", testInfo.project.name);

  await yes24.click();
  const calls = await opened(page);
  expect(calls.map((c) => new URL(String(c[0])).searchParams.get("query"))).toEqual(["캠핑 장비"]);
  expect(calls[0].slice(1)).toEqual(["_blank", "noopener,noreferrer"]);
  await expect(page.getByRole("article")).toHaveCount(0);                       // no bookmark ever
  expect(draws()).toBe(0);

  await page.getByRole("button", { name: "🍃 그냥 한 권" }).click();
  await expect(page.getByText("1 / 9")).toBeVisible();                         // the 🍃 game (questions in a new order each pass)

  await expect.poll(() => named(events, "entry_selected").length).toBe(2);
  expect(named(events, "entry_selected").map((e) => [e.props, e.common.entry, e.common.round]))
    .toEqual([[{ source: "home" }, "target", 1], [{ source: "first_page" }, "leaf", 2]]);   // taxonomy 3-1a: a new round
  expect(named(events, "goal_coverage_checked").map((e) => e.props)).toEqual([{ coverage_bucket: "0", found_count: 0, understood: "none" }]);
  expect(named(events, "free_goal_written")[0].props).toMatchObject({ is_matched: false, has_missing: true, missing_text: "캠핑 장비" });
  expect(named(events, "yes24_link_clicked").map((e) => e.props)).toEqual([{ book_id: null, source: "first_page", pick_type: null }]);
  expect(specMismatches(events)).toEqual([]);
});

test("F-24 ③ → 다른 말로 쓰기: back to S-02 once, and a topic of ours opens the usual first page", async ({ page }) => {
  const { events } = await recordEvents(page);
  await openWith(page, "캠핑 장비 고르기", { topic: "습관·집중", keywords: [], matched: false, missing: "캠핑 장비" });
  await page.unroute("**/api/goal/classify");
  await page.route("**/api/goal/classify", (route) => route.fulfill({
    json: { text: "SQL 공부", topic: "데이터 분석", keywords: ["SQL"], matched: true, missing: null, method: "llm" },
  }));
  await page.getByRole("button", { name: "다른 말로 쓰기" }).click();
  await expect(page.getByRole("textbox", FIELD)).toHaveValue("캠핑 장비 고르기");
  await page.getByRole("textbox", FIELD).fill("SQL 공부");
  await page.getByRole("button", { name: "책 펼치기" }).click();                  // straight back to the open book
  await expect(page.getByRole("region", { name: "이렇게 이해했어요" })).toContainText("데이터·통계 › 데이터 분석 › SQL로 찾았어요");
  await expect(page.getByRole("button", { name: "한 번 고치기" })).toHaveCount(0);  // the one edit is used
  await expect(page.getByRole("button", { name: "다음 장" })).toBeEnabled();

  await expect.poll(() => named(events, "goal_coverage_checked").length).toBe(2);
  expect(named(events, "goal_coverage_checked").map((e) => e.props.understood)).toEqual(["none", "keyword"]);
  expect(named(events, "first_page_edited").map((e) => e.props)).toEqual([{ changed_items: ["topic"] }]);
  expect(specMismatches(events)).toEqual([]);
});

test("F-24 ③ on a short phone (375 × 548): the three exits stay on screen", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "phone", "phone layout");
  await page.setViewportSize({ width: 375, height: 548 });
  await openWith(page, "캠핑 장비 고르기", { topic: "습관·집중", keywords: [], matched: false, missing: "캠핑 장비" });
  for (const name of ["다른 말로 쓰기", "🍃 그냥 한 권"]) {
    const box = await page.getByRole("button", { name }).boundingBox();
    expect(box && box.y + box.height, name).toBeLessThanOrEqual(548);
  }
  const yes24 = await page.getByRole("button", { name: "예스24에서 찾기" }).boundingBox();
  expect(yes24?.height).toBeGreaterThanOrEqual(44);
});

test("F-24: a word-match miss is not ③ — the nearest topic's books, the old honest line, E-22 nearest", async ({ page }) => {
  const { events } = await recordEvents(page);
  // e.g. the LLM timed out and the server's word matching found nothing: it cannot tell, so it never says "not our topic"
  const { draws } = await openWith(page, "발표 준비", { topic: "데이터 분석", keywords: [], matched: false, missing: null }, "word");
  const block = page.getByRole("region", { name: "이렇게 이해했어요" });
  await expect(block).toContainText("아직 이 주제 책이 없어요. 가장 가까운 '데이터 분석' 책을 펼칠게요");
  await expect(page.getByText("아직 갈피가 다루지 않는 주제예요")).toHaveCount(0);
  await expect(page.getByRole("button", { name: "예스24에서 찾기" })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "다시 쓰기" })).toBeVisible();
  await page.getByRole("button", { name: "다음 장" }).click();
  await expect(page.getByRole("article")).toBeVisible();
  expect(draws()).toBe(1);

  await expect.poll(() => named(events, "goal_coverage_checked").length).toBe(1);
  expect(named(events, "goal_coverage_checked")[0].props).toEqual({ coverage_bucket: "0", found_count: 0, understood: "nearest" });
  expect(named(events, "free_goal_written")[0].props).toMatchObject({ is_matched: false, method: "word", has_missing: false, missing_text: null });
  expect(specMismatches(events)).toEqual([]);
});
