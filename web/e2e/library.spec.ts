import { expect, type Locator, type Page } from "@playwright/test";
import { PART_NAMES } from "../src/lib/art/names";
import { answerToClosedBook, named, reactToBookmarks, recordEvents, specMismatches, test } from "./helpers";

// P5 (PRD F-11·F-12·F-13). No real Kakao / Google: the build has a made-up Supabase address (playwright.config), the
// leave-for-login navigation to it is answered here as if the login came back, and the 내 책갈피 routes answer from a
// little in-memory library. Real login is checked by hand (plan Task 9).
test.use({ reducedMotion: "reduce" });

const SUPABASE = "http://supabase.e2e.invalid";
const ART = { animal: "fox", bg: "night", sky: "moon", ground: "books", rare: false };

interface Saved { isbn: string; shelfId: string; title: string }
interface FakeLibrary {
  loggedIn: boolean; justLoggedIn?: string; shelves: { id: string; name: string; position: number }[]; saved: Saved[]; posts: unknown[]; moves?: unknown[];
  clears?: unknown[]; rodDeletes?: unknown[];
}

const ROD_A = "11111111-1111-4111-8111-111111111111";
const ROD_B = "22222222-2222-4222-8222-222222222222";
const ROD_C = "33333333-3333-4333-8333-333333333333";

const card = (s: Saved) => ({ id: s.isbn, entry: "leaf", title: s.title, author: "지어낸 저자", genre: "한국 소설", field: null, oneLiner: "지어낸 한 줄이에요", oneLinerStyle: "question" });

/** The person, their rods and bookmarks, and every route that reads or changes them. */
async function fakeAccount(page: Page, lib: FakeLibrary) {
  await page.route("**/api/me", (route) => {
    const login = lib.justLoggedIn ? { provider: lib.justLoggedIn, first: true } : null;   // /auth/callback's proof, once
    lib.justLoggedIn = undefined;
    return route.fulfill({ json: { enabled: true, loggedIn: lib.loggedIn, id: lib.loggedIn ? "e2e-user" : null, count: lib.saved.length, login } });
  });
  await page.route("**/api/library", (route) => {
    if (!lib.loggedIn) return route.fulfill({ status: 401, json: { error: "login needed" } });
    const shelves = [...lib.shelves].sort((a, b) => a.position - b.position).map((s) => ({
      ...s,
      bookmarks: lib.saved.filter((b) => b.shelfId === s.id).map((b) => ({
        isbn: b.isbn, art: ART, reason: { label: "나온 이유", items: ["따뜻함"] }, metOn: "2026-10-01", card: card(b),
      })),
    }));
    return route.fulfill({ json: { shelves, count: lib.saved.length, animals: lib.saved.length ? 1 : 0 } });
  });
  await page.route("**/api/library/saves", async (route) => {
    const body = route.request().postDataJSON() as { isbn: string; shelfId?: string; index?: number };
    const method = route.request().method();
    if (method === "POST") {
      lib.posts.push(body);
      if (lib.shelves.length === 0) lib.shelves.push({ id: ROD_A, name: "첫 막대", position: 0 });
      const saved = !lib.saved.some((s) => s.isbn === body.isbn);
      if (saved) lib.saved.unshift({ isbn: body.isbn, shelfId: ROD_A, title: "꽂은 책" });
      return route.fulfill({ json: { ok: true, shelfId: ROD_A, saved } });
    }
    if (method === "PATCH") {               // at `index` of the rod's other bookmarks, or its front (service.moveBookmark)
      lib.moves?.push(body);
      const moving = lib.saved.find((s) => s.isbn === body.isbn);
      const rest = lib.saved.filter((s) => s.isbn !== body.isbn);
      const on = rest.filter((s) => s.shelfId === body.shelfId);
      const at = Math.min(body.index ?? 0, on.length);
      if (moving) lib.saved = [...rest.filter((s) => s.shelfId !== body.shelfId), ...on.slice(0, at), { ...moving, shelfId: body.shelfId as string }, ...on.slice(at)];
    }
    if (method === "DELETE") lib.saved = lib.saved.filter((s) => s.isbn !== body.isbn);
    return route.fulfill({ json: { ok: true } });
  });
  await page.route("**/api/library/saves/all", (route) => {   // [모두 제거]: every bookmark, the rods stay
    lib.clears?.push(route.request().postDataJSON());
    const removed = lib.saved.length;
    lib.saved = [];
    return route.fulfill({ json: { ok: true, removed } });
  });
  await page.route("**/api/library/shelves", (route) => {
    if (route.request().method() === "DELETE") {             // [막대 지우기]: the rod, and its bookmarks when asked
      const body = route.request().postDataJSON() as { id: string; withBookmarks?: true };
      lib.rodDeletes?.push(body);
      const on = lib.saved.filter((s) => s.shelfId === body.id);
      if (on.length > 0 && !body.withBookmarks) return route.fulfill({ status: 409, json: { error: "not_empty" } });
      lib.saved = lib.saved.filter((s) => s.shelfId !== body.id);
      lib.shelves = lib.shelves.filter((s) => s.id !== body.id);
      return route.fulfill({ json: body.withBookmarks ? { ok: true, removed: on.length } : { ok: true } });
    }
    const body = route.request().postDataJSON() as { name: string };
    const shelf = { id: ROD_C, name: body.name.trim(), position: lib.shelves.length };
    lib.shelves.push(shelf);
    return route.fulfill({ status: 201, json: { ok: true, shelf } });
  });
  // Kakao / Google login: Supabase's authorize address sends the person straight back as /auth/callback would.
  await page.context().route(`${SUPABASE}/**`, (route) => {
    const url = new URL(route.request().url());
    if (url.pathname.endsWith("/logout")) return route.fulfill({ status: 204 });
    const back = new URL(url.searchParams.get("redirect_to") ?? "/", "http://x");
    const next = back.searchParams.get("next") ?? "/";
    lib.loggedIn = true;
    lib.justLoggedIn = url.searchParams.get("provider") ?? undefined;
    const sep = next.includes("?") ? "&" : "?";
    return route.fulfill({ status: 302, headers: { location: `${back.origin}${next}${sep}login=${url.searchParams.get("provider")}&first=1` } });
  });
}

async function mockBooks(page: Page) {
  await page.route(/\/api\/books\/\d{13}$/, (route) => route.fulfill({
    json: { source: "yes24", cover: null, price: 14400, rating: 9.4, pages: 280, intro: "테스트를 위해 지어낸 소개예요.", link: "https://www.yes24.com/product/goods/1" },
  }));
}

async function toFirstResult(page: Page) {
  await answerToClosedBook(page);
  await page.getByRole("button", { name: "책 펼치기" }).click();
  await page.getByRole("button", { name: "다음 장" }).click();
  await reactToBookmarks(page, ["궁금해요", "패스", "궁금해요", "패스", "패스"]);
  await expect(page.getByText("궁금해요 1 / 2")).toBeVisible();
}

const SAVE = "내 책갈피에 저장";
const SAVED = "내 책갈피에 저장했어요";
const SHOTS = process.env.KEEP_SHOTS;   // a folder: save 375px screenshots there when set (manual design check)

test("logged out: 저장 keeps it in this browser — header 내 책갈피 1 → /library shows it with the note → 빼기 (E-11·15·16)", async ({ page }) => {
  const lib: FakeLibrary = { loggedIn: false, shelves: [], saved: [], posts: [] };
  await fakeAccount(page, lib);
  await mockBooks(page);
  const { events } = await recordEvents(page);
  if (SHOTS) await page.setViewportSize({ width: 375, height: 812 });

  await page.goto("/");
  await expect(page.getByRole("banner").getByRole("button", { name: "로그인" })).toBeVisible();   // header (F-11)
  await toFirstResult(page);
  const title = await page.locator("#result-title").innerText();
  if (SHOTS) await page.screenshot({ path: `${SHOTS}/s06-before.png`, fullPage: true });

  // v1.7: one press saves — no login sheet; the bookmark stays in, YES24 stays the one main button
  await expect(page.getByRole("link", { name: /예스24에서 보기/ })).toHaveAttribute("data-variant", "primary");
  await page.getByRole("button", { name: SAVE }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(page.getByRole("button", { name: SAVED })).toBeVisible();
  await expect(page.getByRole("status").filter({ hasText: "내 책갈피에 저장했어요 · 보러 가기 →" })).toBeVisible();
  await expect(page.getByRole("button", { name: "책갈피 꺼내기" })).toHaveAttribute("aria-expanded", "false");
  const header = page.getByRole("banner").getByRole("link", { name: "내 책갈피 1개" });
  await expect(header).toBeVisible();
  // the toast sits under the header link it points to, and never over the S-06 buttons (YES24 stays reachable)
  const toastBox = (await page.getByRole("status").filter({ hasText: "보러 가기" }).boundingBox())!;
  const headerBox = (await header.boundingBox())!;
  expect(toastBox.y).toBeGreaterThanOrEqual(headerBox.y + headerBox.height - 1);
  for (const target of [page.getByRole("button", { name: "다음 책" }), page.getByRole("link", { name: /예스24에서 보기/ }), page.getByRole("button", { name: SAVED })]) {
    const b = (await target.boundingBox())!;
    expect(toastBox.y + toastBox.height <= b.y || b.y + b.height <= toastBox.y).toBe(true);
  }
  if (SHOTS) await page.screenshot({ path: `${SHOTS}/s06-after.png`, fullPage: true });
  expect(lib.posts).toEqual([]);                                                                   // nothing sent

  // 내 책갈피 before a login: the note, the bookmark on the first rod, the logged-out 도감 below
  await header.click();
  await expect(page).toHaveURL(/\/library$/);
  await expect(page.getByRole("heading", { level: 1, name: "내 책갈피" })).toBeVisible();
  await expect(page.getByText("지금은 이 브라우저에만 저장돼 있어요")).toBeVisible();
  await expect(page.getByRole("button", { name: "로그인하고 지키기" })).toBeVisible();
  await expect(page.getByText("브라우저 기록을 지우면 임시 책갈피도 사라져요")).toBeVisible();
  await expect(page.getByRole("heading", { level: 2, name: "도감" })).toBeVisible();
  const bookmark = page.getByRole("list", { name: "첫 막대" }).getByRole("button", { name: `${title} 책갈피` });
  await expect(bookmark).toBeVisible();
  await expect(page.getByRole("button", { name: "막대 이름 고치기" })).toHaveCount(0);
  if (SHOTS) await page.screenshot({ path: `${SHOTS}/s09-guest.png`, fullPage: true });

  // the front, large: YES24 and 빼기 only → out, the header back to [로그인], the page as before
  await bookmark.click();
  const sheet = page.getByRole("dialog", { name: title });
  await expect(sheet.getByRole("link", { name: /예스24에서 보기/ })).toBeVisible();
  await expect(sheet.getByRole("button", { name: /꾸미기|옮기기/ })).toHaveCount(0);
  await sheet.getByRole("button", { name: "빼기" }).click();
  await page.getByRole("dialog").getByRole("button", { name: "빼기" }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(page.getByRole("heading", { level: 1, name: "도감" })).toBeVisible();
  await expect(page.getByRole("banner").getByRole("button", { name: "로그인" })).toBeVisible();
  expect(await page.evaluate(() => window.localStorage.getItem("galpi.guestSaves"))).toBeNull();

  const bookId = named(events, "save_clicked")[0]?.props.book_id;
  expect(named(events, "save_clicked").map((e) => e.props)).toEqual([{ book_id: bookId, is_logged_in: false }]);
  expect(named(events, "book_saved").map((e) => e.props)).toEqual([{ book_id: bookId, is_auto_save: false, storage: "browser" }]);
  expect(named(events, "login_prompt_shown")).toEqual([]);
  await expect.poll(() => named(events, "book_unsaved").map((e) => e.props)).toEqual([{ book_id: bookId }]);
  expect(specMismatches(events)).toEqual([]);
});

test("logged out: saved in this browser → [로그인하고 지키기] → Kakao → moved to the account once, into the 도감 too (E-12 library · 13 · 14 · 36 · 39)", async ({ page }) => {
  const lib: FakeLibrary = { loggedIn: false, shelves: [], saved: [], posts: [] };
  await fakeAccount(page, lib);
  await mockBooks(page);
  const { events } = await recordEvents(page);
  // the 도감 routes (no real Supabase): /found records the kept bookmark's animal, as the server would from its ticket
  const kept: Record<string, { art: { animal: string }; meeting: Record<string, unknown> }> = {};
  const reports: Record<string, unknown>[] = [];
  const dex: { kind: string; value: string; firstMetAt: string; firstArt: object; isNew: boolean }[] = [];
  await page.route("**/api/collection/found", (route) => {
    const body = route.request().postDataJSON() as { isbn: string };
    reports.push(body);
    const art = kept[body.isbn]?.art as { animal: string; bg: string; sky: string; ground: string; rare: boolean };
    const fresh = !!art && !dex.some((d) => d.value === art.animal);
    if (fresh) dex.push({ kind: "animal", value: art.animal, firstMetAt: "2026-10-05T01:00:00.000Z", firstArt: art, isNew: true });
    return route.fulfill({ json: { ok: true, found: fresh ? [{ kind: "animal", value: art.animal }] : [] } });
  });
  await page.route("**/api/collection", (route) => route.fulfill({ json: { items: dex } }));
  await page.route("**/api/collection/seen", (route) => route.fulfill({ json: { ok: true, cleared: 0 } }));

  await page.goto("/");
  await toFirstResult(page);
  await page.getByRole("button", { name: SAVE }).click();
  await page.getByRole("button", { name: "다음 책" }).click();
  await expect(page.getByText("궁금해요 2 / 2")).toBeVisible();
  await page.getByRole("button", { name: SAVE }).click();
  await expect(page.getByRole("banner").getByRole("link", { name: "내 책갈피 2개" })).toBeVisible();

  await page.goto("/library");
  // each saved bookmark keeps its draw's signed ticket (a logged-out draw) and its place in it
  const stored = await page.evaluate(() => JSON.parse(window.localStorage.getItem("galpi.guestSaves") ?? "null"));
  for (const item of stored.items) {
    expect(item.meeting).toEqual(expect.objectContaining({ sub: null, sig: expect.stringMatching(/^[A-Za-z0-9_-]{43}$/) }));
    kept[item.isbn] = { art: item.art, meeting: item.meeting };
  }
  await page.getByRole("button", { name: "로그인하고 지키기" }).click();
  const sheet = page.getByRole("dialog", { name: "로그인하고 내 책갈피를 지켜요" });
  await expect(sheet.getByRole("link", { name: "개인정보 처리방침" })).toHaveAttribute("href", "/privacy");   // PHASES P5
  await sheet.getByRole("button", { name: "카카오로 계속하기" }).click();

  // back from the login on 내 책갈피: both bookmarks in the account, the rods drawn from it, this browser emptied
  await expect(page.getByRole("button", { name: "책갈피 옮기기" })).toBeVisible();
  await expect(page.getByText("2개 · 동물 1종")).toBeVisible();
  await expect(page.getByRole("banner").getByRole("link", { name: "내 책갈피 2개" })).toBeVisible();
  expect(new URL(page.url()).search).toBe("");                                                   // the login mark is gone
  expect(lib.posts).toHaveLength(2);
  expect(await page.evaluate(() => window.localStorage.getItem("galpi.guestSaves"))).toBeNull();

  await expect.poll(() => named(events, "guest_saves_merged").map((e) => e.props)).toEqual([{ guest_count: 2, merged_count: 2 }]);
  // …and into the 도감: each reported with its ticket, the bookmark's isbn and `kept`; E-36 for the new animal
  expect(reports).toEqual(Object.entries(kept).reverse().map(([isbn, k]) => ({ ...k.meeting, isbn, kept: true })));
  const animal = Object.values(kept).at(-1)!.art.animal;
  expect(named(events, "collection_item_found").map((e) => e.props.part_value)).toContain(animal);
  await page.getByRole("button", { name: "도감" }).click();
  await expect(page.getByText(PART_NAMES.animal[animal], { exact: true })).toBeVisible();
  expect(named(events, "book_saved").map((e) => e.props.storage)).toEqual(["browser", "browser"]);   // no E-15 again on the move
  expect(named(events, "login_prompt_shown").map((e) => e.props)).toEqual([{ source: "library" }]);
  expect(named(events, "login_started").map((e) => e.props)).toEqual([{ provider: "kakao" }]);
  expect(named(events, "login_completed").map((e) => e.props)).toEqual([{ provider: "kakao", is_first_login: true }]);
  expect(specMismatches(events)).toEqual([]);
});

test("logged in: 저장 keeps at once, no pull first (E-11 → E-15 account, no E-27); pressed again it comes out (E-16)", async ({ page }) => {
  const lib: FakeLibrary = { loggedIn: true, shelves: [], saved: [], posts: [] };
  await fakeAccount(page, lib);
  await mockBooks(page);
  const { events } = await recordEvents(page);
  await page.goto("/");
  await expect(page.getByRole("banner").getByRole("link", { name: "내 책갈피 0개" })).toBeVisible();
  await toFirstResult(page);
  await page.getByRole("button", { name: SAVE }).click();
  await expect(page.getByRole("button", { name: SAVED })).toBeVisible();
  await expect(page.getByRole("link", { name: "보러 가기 →" })).toHaveAttribute("href", "/library");
  await expect(page.getByRole("banner").getByRole("link", { name: "내 책갈피 1개" })).toBeVisible();
  await expect.poll(() => named(events, "book_saved").map((e) => e.props)).toEqual([
    { book_id: named(events, "save_clicked")[0]?.props.book_id, is_auto_save: false, storage: "account" },
  ]);
  expect(named(events, "save_clicked").map((e) => e.props.is_logged_in)).toEqual([true]);
  expect(named(events, "login_prompt_shown")).toEqual([]);
  expect(named(events, "bookmark_pulled")).toEqual([]);                          // keeping no longer needs pulling out

  await page.getByRole("button", { name: SAVED }).click();
  await expect(page.getByRole("button", { name: SAVE })).toBeVisible();
  await expect(page.getByRole("banner").getByRole("link", { name: "내 책갈피 0개" })).toBeVisible();
  await expect.poll(() => named(events, "book_unsaved").length).toBe(1);
  expect(lib.saved).toEqual([]);
  expect(specMismatches(events)).toEqual([]);
});

const MOVE_HINT = "책갈피를 끌어서 원하는 자리에 놓으세요";
const DRAGGING = "놓을 자리로 끌어서 놓으세요";

/** In move mode: press a bookmark with the mouse and drag it straight away (no hold) in steps to a point, let go (10-04). */
async function dragTo(page: Page, bookmark: Locator, to: { x: number; y: number }) {
  await bookmark.scrollIntoViewIfNeeded();
  const box = await bookmark.boundingBox();
  if (!box) throw new Error("no bookmark box");
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await page.mouse.move(to.x, to.y, { steps: 12 });
  await expect(page.getByRole("status").filter({ hasText: DRAGGING })).toBeVisible();
  await page.mouse.up();
}

/** A point just right of a bookmark's centre — past it, so the dragged one lands after it. */
async function after(bookmark: Locator) {
  const box = await bookmark.boundingBox();
  if (!box) throw new Error("no bookmark box");
  return { x: box.x + box.width * 0.75, y: box.y + box.height / 2 };
}

/** The centre of an element on screen. */
async function centreOf(el: Locator) {
  const box = await el.boundingBox();
  if (!box) throw new Error("no box");
  return { x: box.x + box.width / 2, y: box.y + box.height / 2 };
}

const titlesOn = (page: Page, rod: string) =>
  page.getByRole("list", { name: rod }).getByRole("button").evaluateAll((els) => els.map((el) => el.getAttribute("aria-label")));

test("S-09: [책갈피 옮기기] → drag to a place on a rod → [완료]; move by the sheet, add a rod, remove, log out (E-16·17·18·29·30)", async ({ page }) => {
  const lib: FakeLibrary = {
    loggedIn: true,
    shelves: [{ id: ROD_A, name: "읽을 책", position: 0 }, { id: ROD_B, name: "마음에 남은", position: 1 }],
    saved: [
      { isbn: "9790000000001", shelfId: ROD_A, title: "지어낸 첫째 책" }, { isbn: "9790000000002", shelfId: ROD_A, title: "지어낸 둘째 책" },
      { isbn: "9790000000003", shelfId: ROD_A, title: "지어낸 셋째 책" }, { isbn: "9790000000004", shelfId: ROD_B, title: "지어낸 넷째 책" },
    ],
    posts: [],
    moves: [],
  };
  await fakeAccount(page, lib);
  await page.context().route("https://www.yes24.com/**", (route) => route.fulfill({ contentType: "text/html", body: "<title>YES24</title>" }));
  const { events } = await recordEvents(page);
  const bm = (title: string) => page.getByRole("button", { name: `${title} 책갈피` });
  const moved = page.getByRole("status").filter({ hasText: "옮겼어요" });

  await page.goto("/library");
  await expect(page.getByText("4개 · 동물 1종")).toBeVisible();
  await expect(page.getByRole("heading", { name: "마음에 남은" })).toHaveAttribute("data-amp-mask", "");
  await expect(bm("지어낸 첫째 책").getByText("2026. 10. 1. 만남")).toBeAttached();          // the met date on the small front too

  // move mode on: [완료] (ink), the hint, [모두 제거] and the rod buttons step aside; a tap there opens nothing
  const toggle = page.getByRole("button", { name: "책갈피 옮기기" });
  await expect(toggle).not.toHaveAttribute("data-moving");
  expect((await toggle.boundingBox())?.height).toBeGreaterThanOrEqual(48);
  await toggle.click();
  const done = page.getByRole("button", { name: "완료" });
  await expect(done).toHaveAttribute("data-moving", "");
  await expect(page.getByRole("button", { name: "모두 제거" })).toHaveCount(0);
  await expect(page.getByText(MOVE_HINT)).toBeVisible();
  await expect(page.getByRole("button", { name: "＋ 막대 추가" })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "막대 이름 고치기" })).toHaveCount(0);
  await bm("지어낸 둘째 책").click();
  await expect(page.getByRole("dialog")).toHaveCount(0);

  // within a rod: the first one after the second
  await dragTo(page, bm("지어낸 첫째 책"), await after(bm("지어낸 둘째 책")));
  await expect.poll(() => titlesOn(page, "읽을 책")).toEqual(["지어낸 둘째 책 책갈피", "지어낸 첫째 책 책갈피", "지어낸 셋째 책 책갈피"]);

  // to another rod, after the one hanging there — no "옮겼어요" toast (user, 10-04)
  await dragTo(page, bm("지어낸 셋째 책"), await after(bm("지어낸 넷째 책")));
  await expect.poll(() => titlesOn(page, "마음에 남은")).toEqual(["지어낸 넷째 책 책갈피", "지어낸 셋째 책 책갈피"]);
  await expect(moved).toHaveCount(0);

  // let go outside every rod (on the hint line): nothing changes, nothing is sent
  await dragTo(page, bm("지어낸 첫째 책"), await centreOf(page.getByText(MOVE_HINT)));
  await expect(page.getByRole("status").filter({ hasText: DRAGGING })).toHaveCount(0);
  expect(await titlesOn(page, "읽을 책")).toEqual(["지어낸 둘째 책 책갈피", "지어낸 첫째 책 책갈피"]);
  await expect(page.getByRole("dialog")).toHaveCount(0);                      // the release after a drag is not a tap
  expect(lib.moves).toHaveLength(2);

  // [완료]: back to normal
  await done.click();
  await expect(page.getByRole("button", { name: "책갈피 옮기기" })).not.toHaveAttribute("data-moving");
  await expect(page.getByRole("button", { name: "모두 제거" })).toBeVisible();
  await expect(page.getByText(MOVE_HINT)).toHaveCount(0);
  await expect(page.getByRole("button", { name: "＋ 막대 추가" })).toBeVisible();

  // a tap opens the front, large, with the day it was met — no back face; YES24, then the menu move (to the front)
  await bm("지어낸 둘째 책").click();
  const sheet = page.getByRole("dialog", { name: "지어낸 둘째 책" });
  await expect(sheet.getByText("2026. 10. 1. 만남")).toBeVisible();
  await expect(sheet.getByText("나온 이유")).toHaveCount(0);
  await expect(sheet.getByText("만난 날")).toHaveCount(0);
  const [tab] = await Promise.all([page.waitForEvent("popup"), sheet.getByRole("link", { name: /예스24에서 보기/ }).click()]);
  await tab.close();
  await sheet.getByRole("button", { name: "다른 막대로 옮기기" }).click();
  await page.getByRole("dialog", { name: "어느 막대로 옮길까요?" }).getByRole("button", { name: "마음에 남은" }).click();
  await expect.poll(() => titlesOn(page, "마음에 남은")).toEqual(["지어낸 둘째 책 책갈피", "지어낸 넷째 책 책갈피", "지어낸 셋째 책 책갈피"]);
  await expect(moved).toHaveCount(0);
  expect(lib.moves).toEqual([
    { isbn: "9790000000001", shelfId: ROD_A, index: 1 },
    { isbn: "9790000000003", shelfId: ROD_B, index: 1 },
    { isbn: "9790000000002", shelfId: ROD_B },
  ]);

  // a new rod, then take the second book out
  await page.getByRole("button", { name: "＋ 막대 추가" }).click();
  await page.getByRole("textbox", { name: "새 막대 이름" }).fill("밤에 읽기");
  await page.getByRole("button", { name: "만들기" }).click();
  await expect(page.getByRole("heading", { name: "밤에 읽기" })).toBeVisible();
  await bm("지어낸 둘째 책").click();
  await page.getByRole("button", { name: "빼기" }).click();
  await page.getByRole("button", { name: "빼기" }).click();
  await expect(bm("지어낸 둘째 책")).toHaveCount(0);

  expect(named(events, "library_viewed").map((e) => e.props)).toEqual([{ saved_count: 4 }]);
  // moves and removes show before the server answers (10-02): their events follow a moment later
  await expect.poll(() => named(events, "bookmark_moved").map((e) => e.props)).toEqual([
    { book_id: "9790000000001", method: "drag", is_same_shelf: true },
    { book_id: "9790000000003", method: "drag", is_same_shelf: false },
    { book_id: "9790000000002", method: "menu", is_same_shelf: false },
  ]);
  expect(named(events, "yes24_link_clicked").map((e) => e.props)).toEqual([{ book_id: "9790000000002", source: "library", pick_type: null }]);
  expect(named(events, "shelf_created").map((e) => e.props)).toEqual([{ shelf_count: 3 }]);
  await expect.poll(() => named(events, "book_unsaved").map((e) => e.props)).toEqual([{ book_id: "9790000000002" }]);
  expect(JSON.stringify(events)).not.toContain("밤에 읽기");                // rod names never in events (taxonomy 6-1)
  expect(JSON.stringify(events)).not.toContain("마음에 남은");
  expect(specMismatches(events)).toEqual([]);

  lib.loggedIn = false;
  await page.getByRole("button", { name: "로그아웃" }).click();
  await expect(page).toHaveURL(/\/$/);
  await expect(page.getByRole("banner").getByRole("button", { name: "로그인" })).toBeVisible();
});

test("S-09 [모두 제거]: [그대로 두기] keeps all; [모두 빼기] empties every rod, the header says 0, one E-35 and no E-16", async ({ page }) => {
  const lib: FakeLibrary = {
    loggedIn: true,
    shelves: [{ id: ROD_A, name: "읽을 책", position: 0 }, { id: ROD_B, name: "마음에 남은", position: 1 }],
    saved: [
      { isbn: "9790000000001", shelfId: ROD_A, title: "지어낸 첫째 책" }, { isbn: "9790000000002", shelfId: ROD_A, title: "지어낸 둘째 책" },
      { isbn: "9790000000004", shelfId: ROD_B, title: "지어낸 넷째 책" },
    ],
    posts: [],
    clears: [],
  };
  await fakeAccount(page, lib);
  const { events } = await recordEvents(page);
  await page.goto("/library");
  await expect(page.getByText("3개 · 동물 1종")).toBeVisible();
  await expect(page.getByRole("banner").getByRole("link", { name: "내 책갈피 3개" })).toBeVisible();

  // the two buttons in one row, 48 px or more, [책갈피 옮기기] the wider
  const move = page.getByRole("button", { name: "책갈피 옮기기" });
  const clear = page.getByRole("button", { name: "모두 제거" });
  const [mb, cb] = [await move.boundingBox(), await clear.boundingBox()];
  if (!mb || !cb) throw new Error("no button box");
  expect(Math.min(mb.height, cb.height)).toBeGreaterThanOrEqual(48);
  expect(Math.abs(mb.y - cb.y)).toBeLessThan(1);
  expect(mb.width).toBeGreaterThan(cb.width);

  // [그대로 두기]: nothing sent, everything stays
  await clear.click();
  const sheet = page.getByRole("dialog", { name: "책갈피 3개를 모두 뺄까요?" });
  await expect(sheet.getByText("막대와 막대 이름은 그대로 남아요.")).toBeVisible();
  await sheet.getByRole("button", { name: "그대로 두기" }).click();
  await expect(sheet).toHaveCount(0);
  expect(lib.clears).toEqual([]);
  await expect(page.getByText("3개 · 동물 1종")).toBeVisible();

  // [모두 빼기]: the rods stay, empty; the header count follows
  await clear.click();
  await sheet.getByRole("button", { name: "모두 빼기" }).click();
  await expect(sheet).toHaveCount(0);
  expect(lib.clears).toEqual([{ all: true }]);
  await expect(page.getByText("0개 · 동물 0종")).toBeVisible();
  await expect(page.getByText("아직 비어 있어요")).toHaveCount(2);
  await expect(page.getByRole("heading", { name: "읽을 책" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "마음에 남은" })).toBeVisible();
  await expect(page.getByRole("banner").getByRole("link", { name: "내 책갈피 0개" })).toBeVisible();
  await expect(page.getByRole("button", { name: "모두 제거" })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "책갈피 옮기기" })).toHaveCount(0);

  await expect.poll(() => named(events, "library_cleared").map((e) => e.props)).toEqual([{ removed_count: 3 }]);
  expect(named(events, "book_unsaved")).toEqual([]);
  expect(JSON.stringify(events)).not.toContain("마음에 남은");
  expect(specMismatches(events)).toEqual([]);
});

test("S-09 [막대 지우기]: not on the first rod; an empty rod goes at once, a full one asks first and goes with its bookmarks (E-40, no E-16)", async ({ page }) => {
  if (SHOTS) await page.setViewportSize({ width: 375, height: 812 });
  const lib: FakeLibrary = {
    loggedIn: true,
    shelves: [{ id: ROD_A, name: "읽을 책", position: 0 }, { id: ROD_B, name: "마음에 남은", position: 1 }, { id: ROD_C, name: "빈 막대", position: 2 }],
    saved: [
      { isbn: "9790000000001", shelfId: ROD_A, title: "지어낸 첫째 책" }, { isbn: "9790000000002", shelfId: ROD_B, title: "지어낸 둘째 책" },
      { isbn: "9790000000003", shelfId: ROD_B, title: "지어낸 셋째 책" },
    ],
    posts: [],
    rodDeletes: [],
  };
  await fakeAccount(page, lib);
  const { events } = await recordEvents(page);
  await page.goto("/library");
  await expect(page.getByText("3개 · 동물 1종")).toBeVisible();
  const removeOf = (name: string) => page.locator("section").filter({ has: page.getByRole("heading", { name }) }).getByRole("button", { name: "막대 지우기" });
  await expect(removeOf("읽을 책")).toHaveCount(0);                                        // the first rod stays
  const button = removeOf("마음에 남은");
  expect((await button.boundingBox())?.height).toBeGreaterThanOrEqual(44);

  // an empty rod: at once, no sheet
  await removeOf("빈 막대").click();
  await expect(page.getByRole("heading", { name: "빈 막대" })).toHaveCount(0);
  await expect(page.getByRole("dialog")).toHaveCount(0);

  // a rod with two: [그대로 두기] keeps it, [지우기] takes it and its bookmarks
  await button.click();
  const sheet = page.getByRole("dialog", { name: "이 막대와 막대에 꽂힌 책갈피 2개를 지울까요?" });
  await expect(sheet.getByText("다른 막대와 책갈피는 그대로 남아요.")).toBeVisible();
  if (SHOTS) await page.screenshot({ path: `${SHOTS}/rod-delete.png` });
  await sheet.getByRole("button", { name: "그대로 두기" }).click();
  await expect(sheet).toHaveCount(0);
  expect(lib.rodDeletes).toEqual([{ id: ROD_C }]);
  await button.click();
  await sheet.getByRole("button", { name: "지우기" }).click();
  await expect(sheet).toHaveCount(0);
  await expect(page.getByRole("heading", { name: "마음에 남은" })).toHaveCount(0);
  await expect(page.getByText("1개 · 동물 1종")).toBeVisible();
  await expect(page.getByRole("banner").getByRole("link", { name: "내 책갈피 1개" })).toBeVisible();
  expect(lib.rodDeletes).toEqual([{ id: ROD_C }, { id: ROD_B, withBookmarks: true }]);

  await expect.poll(() => named(events, "shelf_removed").map((e) => e.props)).toEqual([{ removed_count: 0 }, { removed_count: 2 }]);
  expect(named(events, "book_unsaved")).toEqual([]);
  expect(JSON.stringify(events)).not.toContain("마음에 남은");
  expect(specMismatches(events)).toEqual([]);
});

// Real touch in Chromium (CDP touch events on the phone project): the browser decides at touchstart whether the finger's
// moves can be held back. If the page could still pan, it would send pointercancel mid-drag and nothing would move.
test("S-09 on a touch screen: in move mode a finger drags at once and the page does not pan; outside it a swipe on a bookmark scrolls", async ({ page }, info) => {
  test.skip(info.project.name !== "phone", "touch is emulated on the phone project only");
  const lib: FakeLibrary = {
    loggedIn: true,
    shelves: [{ id: ROD_A, name: "읽을 책", position: 0 }, { id: ROD_B, name: "마음에 남은", position: 1 }, { id: ROD_C, name: "밤에 읽기", position: 2 }],
    saved: [
      { isbn: "9790000000001", shelfId: ROD_A, title: "지어낸 첫째 책" }, { isbn: "9790000000002", shelfId: ROD_A, title: "지어낸 둘째 책" },
      { isbn: "9790000000004", shelfId: ROD_B, title: "지어낸 넷째 책" }, { isbn: "9790000000005", shelfId: ROD_C, title: "지어낸 다섯째 책" },
    ],
    posts: [],
    moves: [],
  };
  await fakeAccount(page, lib);
  const { events } = await recordEvents(page);
  const bm = (title: string) => page.getByRole("button", { name: `${title} 책갈피` });
  const dragging = page.getByRole("status").filter({ hasText: DRAGGING });
  await page.goto("/library");
  await expect(page.getByText("4개 · 동물 1종")).toBeVisible();

  const cdp = await page.context().newCDPSession(page);
  const touch = (type: "touchStart" | "touchMove" | "touchEnd", x = 0, y = 0) =>
    cdp.send("Input.dispatchTouchEvent", { type, touchPoints: type === "touchEnd" ? [] : [{ x, y }] });
  const scrollY = () => page.evaluate(() => window.scrollY);
  /** A finger from `at`, `dy` px up the screen in 10 moves (the page scrolls down if it may). */
  const swipeUp = async (at: { x: number; y: number }, dy: number) => {
    await touch("touchStart", at.x, at.y);
    for (let i = 1; i <= 10; i++) await touch("touchMove", at.x, at.y - (dy * i) / 10);
    await touch("touchEnd");
  };

  // outside move mode: a swipe that starts on a bookmark is the browser's scroll, never a drag
  const top = await scrollY();
  await swipeUp(await centreOf(bm("지어낸 넷째 책")), 150);
  await expect.poll(scrollY).toBeGreaterThan(top + 40);
  await expect(dragging).toHaveCount(0);
  await page.evaluate(() => window.scrollTo(0, 0));

  // move mode: a swipe outside the bookmarks still scrolls the page
  await page.getByRole("button", { name: "책갈피 옮기기" }).click();
  await expect(page.getByText(MOVE_HINT)).toBeVisible();
  await swipeUp(await centreOf(page.getByText(MOVE_HINT)), 150);
  await expect.poll(scrollY).toBeGreaterThan(40);
  await expect(dragging).toHaveCount(0);
  await page.evaluate(() => window.scrollTo(0, 0));

  // move mode: touch the first bookmark and drag straight down onto the other rod, after the one there — no hold
  await bm("지어낸 넷째 책").scrollIntoViewIfNeeded();
  const from = await centreOf(bm("지어낸 첫째 책"));
  const to = await after(bm("지어낸 넷째 책"));
  const scrolled = await scrollY();
  await touch("touchStart", from.x, from.y);
  for (let i = 1; i <= 15; i++) await touch("touchMove", from.x + ((to.x - from.x) * i) / 15, from.y + ((to.y - from.y) * i) / 15);
  await expect(dragging).toBeVisible();                                         // no pointercancel
  await touch("touchEnd");
  await expect.poll(() => titlesOn(page, "마음에 남은")).toEqual(["지어낸 넷째 책 책갈피", "지어낸 첫째 책 책갈피"]);
  expect(Math.abs((await scrollY()) - scrolled)).toBeLessThan(60);             // only the edge auto-scroll, no pan
  expect(lib.moves).toEqual([{ isbn: "9790000000001", shelfId: ROD_B, index: 1 }]);
  await expect.poll(() => named(events, "bookmark_moved").map((e) => e.props)).toEqual([{ book_id: "9790000000001", method: "drag", is_same_shelf: false }]);
  await expect(page.getByRole("dialog")).toHaveCount(0);                      // the lift-off is not a tap
  await expect(page.getByRole("status").filter({ hasText: "옮겼어요" })).toHaveCount(0);

  // a quick tap in move mode opens nothing
  const tap = await centreOf(bm("지어낸 둘째 책"));
  await touch("touchStart", tap.x, tap.y);
  await touch("touchEnd");
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(page.getByRole("button", { name: "완료" })).toBeVisible();
});

test("S-09 first visit: the example-shelf guide opens once, [시작하기] closes it (C-22)", async ({ page }) => {
  const lib: FakeLibrary = { loggedIn: true, shelves: [{ id: ROD_A, name: "첫 막대", position: 0 }], saved: [], posts: [] };
  await fakeAccount(page, lib);
  await page.addInitScript(() => { try { window.localStorage.removeItem("galpi.hint.libraryGuide"); } catch { /* blocked */ } });
  await page.goto("/library");
  const guide = page.getByRole("dialog", { name: "내 책갈피, 이렇게 써 보세요" });
  await expect(guide).toBeVisible();
  await expect(guide.getByText("[책갈피 옮기기]를 누르고 끌어서 원하는 자리에 놓아요")).toBeVisible();
  if (process.env.GUIDE_SHOTS) await page.screenshot({ path: `${process.env.GUIDE_SHOTS}/library-guide.png` });
  await guide.getByRole("button", { name: "시작하기" }).click();
  await expect(guide).toHaveCount(0);
  expect(await page.evaluate(() => window.localStorage.getItem("galpi.hint.libraryGuide"))).toBe("1");
});

test("S-09 logged out offers the login", async ({ page }) => {
  await fakeAccount(page, { loggedIn: false, shelves: [], saved: [], posts: [] });
  await page.goto("/library");
  await page.getByRole("main").getByRole("button", { name: "로그인" }).click();
  await expect(page.getByRole("dialog", { name: "로그인하고 내 책갈피를 모아 보세요" })).toBeVisible();
});
