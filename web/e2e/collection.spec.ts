import { expect, type Page } from "@playwright/test";
import { SQL_PATH } from "../src/lib/paths/__fixtures__/paths";
import { named, recordEvents, specMismatches, test, toBookmarks } from "./helpers";

// 도감 v1 (PRD F-21, plans/2026-10-05-collection-dex.md). No real Supabase: /api/me and the 도감 routes are answered here
// as in library.spec.ts — except the last test, which asks the real server to check a real (and a tampered) ticket.
// DEX_SHOTS=<folder> also saves the 375-wide phone screenshots of the plan (impl-*.png).
const SHOTS = process.env.DEX_SHOTS;
/** A draw seed whose first picture is 초판본 (주작 · 은하수 · 무지개 · 버섯) — lib/art/combine artsForDraw(5, 7349)[0]. */
const FIRST_EDITION_SEED = 7349;

const OTTER = { animal: "otter", bg: "leaf", sky: "cloud", ground: "grass", rare: true };
const TIGER = { animal: "whitetiger", bg: "night", sky: "moon", ground: "grass", rare: true };
const row = (kind: string, value: string, art: object, isNew = false) => ({ kind, value, firstMetAt: "2026-10-05T01:00:00.000Z", firstArt: art, isNew });
const ITEMS = [
  row("animal", "cat", { ...OTTER, animal: "cat", rare: false }), row("animal", "fox", { ...OTTER, animal: "fox", rare: false }),
  row("animal", "owl", { ...OTTER, animal: "owl", bg: "night", rare: false }), row("animal", "otter", OTTER, true),
  row("animal", "whitetiger", TIGER, true), row("bg", "leaf", OTTER), row("bg", "night", TIGER), row("sky", "cloud", OTTER),
  row("ground", "grass", OTTER),
];

async function phone(page: Page) {
  if (SHOTS) await page.setViewportSize({ width: 375, height: 812 });
}

async function account(page: Page, loggedIn: boolean) {
  await page.route("**/api/me", (route) => route.fulfill({ json: { enabled: true, loggedIn, id: loggedIn ? "e2e-user" : null, count: 0, login: null } }));
}

test("logged out: the 도감 shows every cell as a silhouette and asks for a login — nothing is recorded (E-37)", async ({ page }) => {
  await phone(page);
  await account(page, false);
  const collection: string[] = [];
  await page.route("**/api/collection**", (route) => { collection.push(route.request().url()); return route.fulfill({ status: 401, json: {} }); });
  const { events } = await recordEvents(page);

  await page.goto("/library");
  await expect(page.getByRole("heading", { level: 1, name: "도감" })).toBeVisible();
  await expect(page.getByText("로그인하면 만난 책갈피가 도감에 모여요")).toBeVisible();
  await expect(page.getByText("동물 0 / 16 · 배경 0 / 11 · 소품 0 / 16")).toBeVisible();
  await expect(page.getByText("아직 만나지 않은 동물")).toHaveCount(16);
  await expect(page.getByText("책과는 상관없이 뽑혀요. 돈으로 뽑는 기능은 없어요.")).toBeAttached();
  if (SHOTS) await page.screenshot({ path: `${SHOTS}/impl-dex-loggedout.png` });
  await page.getByRole("button", { name: "로그인하고 모으기" }).click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await expect.poll(() => named(events, "collection_viewed").map((e) => e.props)).toEqual([{ collected_count: 0, is_logged_in: false }]);

  // the first bookmarks while logged out: no 도감 request, no badge
  await toBookmarks(page);
  await expect(page.getByText("1 / 5")).toBeVisible();
  await page.waitForTimeout(800);
  await expect(page.getByRole("status").filter({ hasText: "처음 만난" })).toHaveCount(0);
  expect(collection).toEqual([]);
  expect(specMismatches(events)).toEqual([]);
});

test("logged in: [막대 | 도감] opens the 도감 — counts, tiers, NEW once, silhouettes, the odds (E-37)", async ({ page }) => {
  await phone(page);
  await account(page, true);
  await page.route("**/api/library", (route) => route.fulfill({ json: { shelves: [{ id: "11111111-1111-4111-8111-111111111111", name: "첫 막대", position: 0, bookmarks: [] }], count: 0, animals: 0 } }));
  await page.route("**/api/collection", (route) => route.fulfill({ json: { items: ITEMS } }));
  const seen: string[] = [];
  await page.route("**/api/collection/seen", (route) => { seen.push(route.request().method()); return route.fulfill({ json: { ok: true, seen: 2 } }); });
  const { events } = await recordEvents(page);

  await page.goto("/library");
  await expect(page.getByRole("heading", { level: 1, name: "내 책갈피" })).toBeVisible();
  await expect(page.getByRole("button", { name: "막대", exact: true })).toHaveAttribute("aria-pressed", "true");
  await page.getByRole("button", { name: "도감", exact: true }).click();
  await expect(page.getByText("동물 5 / 16 · 배경 2 / 11 · 소품 2 / 16")).toBeVisible();
  const first = page.getByRole("region", { name: "동물 초판본" });
  await expect(first.getByRole("heading")).toHaveText(/초판본\s*1 \/ 4/);
  await expect(first.getByText("백호")).toBeVisible();
  await expect(first.getByText("NEW")).toBeVisible();
  await expect(page.getByRole("region", { name: "동물 한정판" }).getByText("수달")).toBeVisible();
  await expect(page.getByRole("region", { name: "동물 일반판" }).getByText("아직 만나지 않은 동물")).toHaveCount(4);
  await expect.poll(() => seen).toEqual(["POST"]);
  await expect.poll(() => named(events, "collection_viewed").map((e) => e.props)).toEqual([{ collected_count: 9, is_logged_in: true }]);
  if (SHOTS) await page.screenshot({ path: `${SHOTS}/impl-dex.png` });

  await page.getByRole("button", { name: "소품", exact: true }).click();
  await expect(page.getByRole("button", { name: "소품", exact: true })).toHaveAttribute("aria-pressed", "true");
  await expect(page.getByRole("region", { name: "소품 일반판" }).getByText("구름")).toBeVisible();
  await page.getByRole("button", { name: "막대", exact: true }).click();
  await expect(page.getByText("0개 · 동물 0종")).toBeVisible();
  expect(specMismatches(events)).toEqual([]);
});

test("logged in on S-05: the shown bookmark is reported with its signed ticket, the badge shows, then fades (E-36)", async ({ page }) => {
  await phone(page);
  await account(page, true);
  let ticket: { seed: number; count: number; sig: string } | null = null;
  await page.route("**/api/books/draw", async (route) => {
    const res = await route.fetch();
    const body = await res.json();
    // the 초판본 seed, so the picture matches the parts this mock calls new (the found route below is mocked too)
    ticket = { ...body.art, seed: FIRST_EDITION_SEED };
    await route.fulfill({ response: res, json: { ...body, art: ticket } });
  });
  const reports: { seed: number; count: number; sig: string; index: number }[] = [];
  await page.route("**/api/collection/found", (route) => {
    reports.push(route.request().postDataJSON());
    const found = reports.length === 1 ? [{ kind: "animal", value: "redbird" }, { kind: "sky", value: "rainbow" }] : [];
    return route.fulfill({ json: { ok: true, found } });
  });
  const { events } = await recordEvents(page);

  await toBookmarks(page);
  const badge = page.getByText("초판본 · 처음 만난 동물·소품!");
  await expect(badge).toBeVisible();
  if (SHOTS) {
    await page.waitForTimeout(500);                                         // fully in (it fades in for 0.3 s)
    await page.screenshot({ path: `${SHOTS}/impl-badge.png` });
  }
  await expect(badge).toBeHidden({ timeout: 5000 });                       // about 2.5 s, then gone
  expect(ticket).not.toBeNull();
  expect(reports[0]).toEqual({ seed: ticket!.seed, count: 5, sig: ticket!.sig, index: 0 });
  await expect.poll(() => named(events, "collection_item_found").map((e) => e.props)).toEqual([
    { part_kind: "animal", part_value: "redbird", tier: "first_edition" },
    { part_kind: "sky", part_value: "rainbow", tier: "limited" },
  ]);

  await page.getByRole("button", { name: "패스", exact: true }).click();
  await expect(page.getByText("2 / 5")).toBeVisible();
  await expect.poll(() => reports.map((r) => r.index)).toEqual([0, 1]);
  await expect(page.getByText(/처음 만난/)).toHaveCount(0);                  // nothing new on the second: no badge
  expect(specMismatches(events)).toEqual([]);
});

test("a 초판본 bookmark on S-05 wears the gold rim and its effects", async ({ page }) => {
  await phone(page);
  await account(page, false);
  await page.route("**/api/books/draw", async (route) => {
    const res = await route.fetch();
    const body = await res.json();
    await route.fulfill({ response: res, json: { ...body, art: { ...body.art, seed: FIRST_EDITION_SEED } } });
  });
  await toBookmarks(page);
  const art = page.getByRole("article").locator("svg[data-tier]").first();
  await expect(art).toHaveAttribute("data-tier", "first_edition");
  await expect(page.getByRole("button", { name: "궁금해요" })).toBeEnabled();     // landed: the full effects are on
  await expect(art.locator("[data-part=rim]")).toHaveCount(1);
  await expect(art.locator("image")).toHaveAttribute("href", "/animals/redbird.svg");
  await page.waitForTimeout(900);
  if (SHOTS) await page.screenshot({ path: `${SHOTS}/impl-first-edition.png` });
});

test("the server records nothing for a tampered ticket (403) and asks a login for a real one (401)", async ({ request, baseURL }) => {
  const headers = { origin: baseURL!, "content-type": "application/json" };
  const draw = await request.post("/api/books/draw", { headers, data: { answers: SQL_PATH } });
  expect(draw.status()).toBe(200);
  const { art } = await draw.json();
  expect(art).toMatchObject({ count: 5, sig: expect.stringMatching(/^[A-Za-z0-9_-]{43}$/) });

  const found = (body: object) => request.post("/api/collection/found", { headers, data: body });
  expect((await found({ ...art, seed: (art.seed + 1) % 2 ** 32, index: 0 })).status()).toBe(403);
  expect((await found({ ...art, count: 6, index: 5 })).status()).toBe(403);
  expect((await found({ ...art, index: 7 })).status()).toBe(400);
  expect((await found({ ...art, index: 0 })).status()).toBe(401);           // signed and untouched, but nobody logged in
});
