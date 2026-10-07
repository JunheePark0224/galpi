import { expect, type Page } from "@playwright/test";
import { named, recordEvents, specMismatches, test } from "./helpers";

// 책갈피 꾸미기 (PRD F-13·F-21, plans/2026-10-05-decorate.md). No real Supabase: /api/me, the rods, the 도감 and the
// decorate route are answered here as in library.spec.ts / collection.spec.ts — the server's own check (403 for a part
// outside the 도감) is covered by src/app/api/library/saves/art/route.test.ts.
// DECORATE_SHOTS=<folder> also saves the 375-wide phone screenshots (impl-sheet.png, impl-editor.png, impl-saved.png).
const SHOTS = process.env.DECORATE_SHOTS;
test.use({ reducedMotion: "reduce" });

const ISBN = "9790000000001";
const TITLE = "물고기는 존재하지 않는다";
const FIRST = { animal: "cat", bg: "peach", sky: "moon", ground: "none", rare: false };
const ROD_A = "11111111-1111-4111-8111-111111111111";
const ROD_B = "22222222-2222-4222-8222-222222222222";
const item = (kind: string, value: string) => ({ kind, value, firstMetAt: "2026-10-05T01:00:00.000Z", firstArt: { ...FIRST, [kind]: value }, isNew: false });
/** 도감: 고양이 · 곰 · 여우 · 부엉이 (일반판), 레서판다 · 수달 (한정판), 백호 (초판본); 배경 밤 · 벚꽃 언덕; 하늘 무지개. */
const DEX = [
  item("animal", "cat"), item("animal", "bear"), item("animal", "fox"), item("animal", "owl"), item("animal", "redpanda"),
  item("animal", "otter"), item("animal", "whitetiger"), item("bg", "night"), item("bg", "cherry"), item("sky", "rainbow"),
];

interface Fake { art: typeof FIRST; patches: unknown[]; rods: number }

async function fake(page: Page, lib: Fake) {
  await page.route("**/api/me", (route) => route.fulfill({ json: { enabled: true, loggedIn: true, id: "e2e-user", count: 1, login: null } }));
  await page.route("**/api/library", (route) => {
    const bookmark = {
      isbn: ISBN, art: lib.art, originalArt: FIRST, reason: { label: "나온 이유", items: ["따뜻함"] }, metOn: "2026-10-04",
      card: { id: ISBN, entry: "leaf", title: TITLE, author: "룰루 밀러", genre: "에세이", field: null, oneLiner: "오래된 도감 속 물고기가 사라지면 삶의 의미는 어디에 남을까요?", oneLinerStyle: "question" },
    };
    const shelves = [{ id: ROD_A, name: "첫 막대", position: 0, bookmarks: [bookmark] }];
    if (lib.rods > 1) shelves.push({ id: ROD_B, name: "둘째", position: 1, bookmarks: [] });
    return route.fulfill({ json: { shelves, count: 1, animals: 1 } });
  });
  await page.route("**/api/collection", (route) => route.fulfill({ json: { items: DEX } }));
  await page.route("**/api/library/saves/art", (route) => {
    const body = route.request().postDataJSON() as { isbn: string; art: typeof FIRST };
    lib.patches.push(body);
    lib.art = body.art;
    return route.fulfill({ json: { ok: true, art: body.art } });
  });
}

async function phone(page: Page) {
  if (SHOTS) await page.setViewportSize({ width: 375, height: 812 });
}

/** The small bookmark on the rod: which animal it draws. */
const rodAnimal = (page: Page) => page.getByRole("button", { name: `${TITLE} 책갈피` }).locator("image").getAttribute("href");

test("sheet → [꾸미기] → pick a collected animal → [이대로 꽂기]: the rod's bookmark updates, the note shows (E-38)", async ({ page }) => {
  await phone(page);
  const lib: Fake = { art: FIRST, patches: [], rods: 2 };
  await fake(page, lib);
  const { events } = await recordEvents(page);

  await page.goto("/library");
  await expect.poll(() => rodAnimal(page)).toBe("/animals/cat.svg");
  await page.getByRole("button", { name: `${TITLE} 책갈피` }).click();
  const sheet = page.getByRole("dialog", { name: TITLE });

  // 시안 C: [예스24에서 보기] on top, then [🎨 꾸미기] [↔ 옮기기] in one row of equal width, then a small [빼기]
  const decorate = sheet.getByRole("button", { name: "책갈피 꾸미기" });
  const move = sheet.getByRole("button", { name: "다른 막대로 옮기기" });
  const [d, m, y] = [await decorate.boundingBox(), await move.boundingBox(), await sheet.getByRole("link", { name: /예스24에서 보기/ }).boundingBox()];
  expect(d && m && y).toBeTruthy();
  expect(Math.abs(d!.y - m!.y)).toBeLessThan(2);
  expect(Math.abs(d!.width - m!.width)).toBeLessThan(2);
  expect(d!.y).toBeGreaterThan(y!.y);
  for (const box of [d!, m!, y!, (await sheet.getByRole("button", { name: "빼기" }).boundingBox())!]) expect(box.height).toBeGreaterThanOrEqual(44);
  if (SHOTS) await page.screenshot({ path: `${SHOTS}/impl-sheet.png` });

  await decorate.click();
  const editor = page.getByRole("dialog", { name: "책갈피 꾸미기" });
  await expect(editor.getByRole("button", { name: "동물" })).toBeFocused();
  await expect(editor.getByRole("button", { name: "고양이, 일반판" })).toHaveAttribute("aria-pressed", "true");
  await editor.getByRole("button", { name: "레서판다, 한정판" }).click();
  await expect(editor.getByRole("button", { name: "레서판다, 한정판" })).toHaveAttribute("aria-pressed", "true");
  await editor.getByRole("button", { name: "하늘 소품" }).click();
  await editor.getByRole("button", { name: "무지개, 한정판" }).click();
  await editor.getByRole("button", { name: "배경" }).click();
  await editor.getByRole("button", { name: "벚꽃 언덕, 한정판" }).click();
  await editor.getByRole("button", { name: "동물" }).click();
  // 10-07: only the parts scroll — the preview, the tabs and the footer stay in view
  const save = editor.getByRole("button", { name: "이대로 꽂기" });
  await expect(save).toBeInViewport();
  const parts = editor.locator("[data-parts]");
  await parts.evaluate((el) => el.scrollTo(0, (el.scrollHeight - el.clientHeight) / 2));
  await expect(editor.locator("svg").first()).toBeInViewport({ ratio: 0.99 });             // the preview's window
  await expect(editor.getByRole("button", { name: "동물" })).toBeInViewport({ ratio: 0.99 });
  await expect(save).toBeInViewport({ ratio: 0.99 });
  if (SHOTS) await page.screenshot({ path: `${SHOTS}/impl-editor.png` });

  await save.click();
  await expect(page.getByRole("dialog", { name: TITLE })).toBeVisible();
  await expect(page.getByRole("status").filter({ hasText: "새 그림으로 꽂았어요" })).toBeVisible();
  await expect(page.getByRole("button", { name: "책갈피 꾸미기" })).toBeFocused();
  await expect.poll(() => rodAnimal(page)).toBe("/animals/redpanda.svg");
  const art = { animal: "redpanda", bg: "cherry", sky: "rainbow", ground: "none", rare: true };
  expect(lib.patches).toEqual([{ isbn: ISBN, art }]);
  if (SHOTS) await page.screenshot({ path: `${SHOTS}/impl-saved.png` });

  await expect.poll(() => named(events, "bookmark_decorated").map((e) => e.props)).toEqual([
    { book_id: ISBN, parts_changed: ["animal", "bg", "sky"], tiers_changed: ["limited", "limited", "limited"], art, is_reset: false },
  ]);
  expect(specMismatches(events)).toEqual([]);
});

for (const size of [{ width: 375, height: 667 }, { width: 320, height: 568 }]) {
  test(`on a ${size.width}×${size.height} phone the preview, the tabs and the buttons stay in view; a pick shows at once (10-07)`, async ({ page }) => {
    await page.setViewportSize(size);
    await fake(page, { art: FIRST, patches: [], rods: 1 });
    await page.goto("/library");
    await page.getByRole("button", { name: `${TITLE} 책갈피` }).click();
    await page.getByRole("dialog", { name: TITLE }).getByRole("button", { name: "책갈피 꾸미기" }).click();
    const editor = page.getByRole("dialog", { name: "책갈피 꾸미기" });
    const parts = editor.locator("[data-parts]");
    const otter = editor.getByRole("button", { name: "수달, 한정판" });
    await otter.scrollIntoViewIfNeeded();
    await otter.click();
    const preview = editor.locator("svg").first();
    await expect(preview.locator("image")).toHaveAttribute("href", "/animals/otter.svg");
    await parts.evaluate((el) => el.scrollTo(0, el.scrollHeight));
    for (const pinned of [preview, editor.getByRole("button", { name: "땅 소품" }), editor.getByRole("button", { name: "이대로 꽂기" }), editor.getByRole("button", { name: "처음 그림으로" })]) {
      await expect(pinned).toBeInViewport({ ratio: 0.99 });
    }
    const [list, footer] = [await parts.boundingBox(), await editor.getByRole("button", { name: "이대로 꽂기" }).boundingBox()];
    expect(list!.height).toBeGreaterThanOrEqual(60);                           // a row of parts or more
    expect(list!.y + list!.height).toBeLessThanOrEqual(footer!.y);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    if (SHOTS && size.width === 320) await page.screenshot({ path: `${SHOTS}/impl-editor-320.png` });
  });
}

test("a locked cell cannot be picked; [처음 그림으로] goes back to the first picture (E-38 is_reset)", async ({ page }) => {
  const lib: Fake = { art: { ...FIRST, animal: "otter", rare: true }, patches: [], rods: 1 };
  await fake(page, lib);
  const { events } = await recordEvents(page);

  await page.goto("/library");
  await page.getByRole("button", { name: `${TITLE} 책갈피` }).click();
  const sheet = page.getByRole("dialog", { name: TITLE });
  await expect(sheet.getByRole("button", { name: "다른 막대로 옮기기" })).toHaveCount(0);   // one rod: 꾸미기 alone
  await sheet.getByRole("button", { name: "책갈피 꾸미기" }).click();

  const editor = page.getByRole("dialog", { name: "책갈피 꾸미기" });
  const dragon = editor.getByRole("button", { name: "청룡, 잠김" });
  await expect(dragon).toBeDisabled();
  await dragon.click({ force: true });
  await expect(editor.getByRole("button", { name: "수달, 한정판" })).toHaveAttribute("aria-pressed", "true");
  await expect(editor.getByRole("button", { name: "이대로 꽂기" })).toBeDisabled();

  await editor.getByRole("button", { name: "처음 그림으로" }).click();
  await expect(editor.getByRole("button", { name: "고양이, 일반판" })).toHaveAttribute("aria-pressed", "true");
  await editor.getByRole("button", { name: "이대로 꽂기" }).click();
  await expect.poll(() => rodAnimal(page)).toBe("/animals/cat.svg");
  expect(lib.patches).toEqual([{ isbn: ISBN, art: FIRST }]);
  await expect.poll(() => named(events, "bookmark_decorated").map((e) => e.props)).toEqual([
    { book_id: ISBN, parts_changed: ["animal"], tiers_changed: ["common"], art: FIRST, is_reset: true },
  ]);
  expect(specMismatches(events)).toEqual([]);
});
