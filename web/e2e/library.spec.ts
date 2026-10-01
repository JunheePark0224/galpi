import { expect, type Page } from "@playwright/test";
import { named, reactToBookmarks, recordEvents, specMismatches, test } from "./helpers";

// P5 (PRD F-11·F-12·F-13). No real Kakao / Google: the build has a made-up Supabase address (playwright.config), the
// leave-for-login navigation to it is answered here as if the login came back, and the 내 책갈피 routes answer from a
// little in-memory library. Real login is checked by hand (plan Task 9).
test.use({ reducedMotion: "reduce" });

const SUPABASE = "http://supabase.e2e.invalid";
const ART = { animal: "fox", bg: "night", sky: "moon", ground: "books", rare: false };

interface Saved { isbn: string; shelfId: string; title: string }
interface FakeLibrary { loggedIn: boolean; shelves: { id: string; name: string; position: number }[]; saved: Saved[]; posts: unknown[] }

const ROD_A = "11111111-1111-4111-8111-111111111111";
const ROD_B = "22222222-2222-4222-8222-222222222222";
const ROD_C = "33333333-3333-4333-8333-333333333333";

const card = (s: Saved) => ({ id: s.isbn, entry: "leaf", title: s.title, author: "지어낸 저자", genre: "한국 소설", field: null, oneLiner: "지어낸 한 줄이에요", oneLinerStyle: "question" });

/** The person, their rods and bookmarks, and every route that reads or changes them. */
async function fakeAccount(page: Page, lib: FakeLibrary) {
  await page.route("**/api/me", (route) =>
    route.fulfill({ json: { enabled: true, loggedIn: lib.loggedIn, id: lib.loggedIn ? "e2e-user" : null, count: lib.saved.length } }));
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
    const body = route.request().postDataJSON() as { isbn: string; shelfId?: string };
    const method = route.request().method();
    if (method === "POST") {
      lib.posts.push(body);
      if (lib.shelves.length === 0) lib.shelves.push({ id: ROD_A, name: "첫 막대", position: 0 });
      const saved = !lib.saved.some((s) => s.isbn === body.isbn);
      if (saved) lib.saved.unshift({ isbn: body.isbn, shelfId: ROD_A, title: "꽂은 책" });
      return route.fulfill({ json: { ok: true, shelfId: ROD_A, saved } });
    }
    if (method === "PATCH") lib.saved = lib.saved.map((s) => (s.isbn === body.isbn ? { ...s, shelfId: body.shelfId as string } : s));
    if (method === "DELETE") lib.saved = lib.saved.filter((s) => s.isbn !== body.isbn);
    return route.fulfill({ json: { ok: true } });
  });
  await page.route("**/api/library/shelves", (route) => {
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
  await page.getByRole("button", { name: /알고 싶은 게 있어요/ }).click();
  await page.getByRole("button", { name: "데이터 분석", exact: true }).click();
  await page.getByRole("button", { name: "책 펼치기" }).click();
  await page.getByRole("button", { name: "책 펼치기" }).click();
  await page.getByRole("button", { name: "다음 장" }).click();
  await reactToBookmarks(page, ["궁금해요", "패스", "궁금해요", "패스", "패스"]);
  await expect(page.getByText("궁금해요 1 / 2")).toBeVisible();
}

test("logged out: 꽂기 → login sheet → Kakao → back on the same book, bookmark out, kept by itself (E-11·12·13·14·15)", async ({ page }) => {
  const lib: FakeLibrary = { loggedIn: false, shelves: [], saved: [], posts: [] };
  await fakeAccount(page, lib);
  await mockBooks(page);
  const { events } = await recordEvents(page);

  await page.goto("/");
  await expect(page.getByRole("banner").getByRole("button", { name: "로그인" })).toBeVisible();   // header (F-11)
  await toFirstResult(page);
  const title = await page.locator("#result-title").innerText();

  await page.getByRole("button", { name: "책갈피 꺼내기" }).click();
  await expect(page.getByText("로그인하면 내 책갈피에 모여요")).toBeVisible();
  await expect(page.getByRole("link", { name: /예스24에서 보기/ })).toHaveAttribute("data-variant", "secondary");  // one main button
  await page.getByRole("button", { name: "내 책갈피에 꽂기" }).click();

  const sheet = page.getByRole("dialog", { name: "내 책갈피에 꽂으려면 로그인해 주세요" });
  await expect(sheet.getByRole("link", { name: "개인정보 처리방침" })).toHaveAttribute("href", "/privacy");   // PHASES P5
  await sheet.getByRole("button", { name: "카카오로 계속하기" }).click();

  // back from the login: the same S-06 book, its bookmark already out, kept without another press
  await expect(page.getByRole("status").filter({ hasText: "꽂았어요 ✓" })).toBeVisible();
  await expect(page.locator("#result-title")).toHaveText(title);
  await expect(page.getByText("궁금해요 1 / 2")).toBeVisible();
  await expect(page.getByRole("button", { name: "책갈피 꺼내기" })).toHaveAttribute("aria-expanded", "true");
  expect(new URL(page.url()).search).toBe("");                                                   // the login mark is gone
  await expect(page.getByRole("banner").getByRole("link", { name: "내 책갈피 1개" })).toBeVisible();
  expect(lib.posts).toHaveLength(1);

  await expect.poll(() => named(events, "book_saved").length).toBe(1);
  const bookId = named(events, "save_clicked")[0]?.props.book_id;
  expect(named(events, "save_clicked").map((e) => e.props)).toEqual([{ book_id: bookId, is_logged_in: false }]);
  expect(named(events, "login_prompt_shown").map((e) => e.props)).toEqual([{ source: "save" }]);
  expect(named(events, "login_started").map((e) => e.props)).toEqual([{ provider: "kakao" }]);
  expect(named(events, "login_completed").map((e) => e.props)).toEqual([{ provider: "kakao", is_first_login: true }]);
  expect(named(events, "book_saved").map((e) => e.props)).toEqual([{ book_id: bookId, is_auto_save: true }]);
  expect(specMismatches(events)).toEqual([]);
});

test("logged in: 꽂기 keeps at once (E-11 → E-15)", async ({ page }) => {
  const lib: FakeLibrary = { loggedIn: true, shelves: [], saved: [], posts: [] };
  await fakeAccount(page, lib);
  await mockBooks(page);
  const { events } = await recordEvents(page);
  await page.goto("/");
  await expect(page.getByRole("banner").getByRole("link", { name: "내 책갈피 0개" })).toBeVisible();
  await toFirstResult(page);
  await page.getByRole("button", { name: "책갈피 꺼내기" }).click();
  await expect(page.getByText("로그인하면 내 책갈피에 모여요")).toHaveCount(0);
  await page.getByRole("button", { name: "내 책갈피에 꽂기" }).click();
  await expect(page.getByRole("link", { name: "내 책갈피 보기" })).toHaveAttribute("href", "/library");
  await expect.poll(() => named(events, "book_saved").map((e) => e.props.is_auto_save)).toEqual([false]);
  expect(named(events, "save_clicked").map((e) => e.props.is_logged_in)).toEqual([true]);
  expect(named(events, "login_prompt_shown")).toEqual([]);
  expect(specMismatches(events)).toEqual([]);
});

test("S-09: hold to move, move by the back face, add a rod, remove, log out (E-16·17·18·29·30)", async ({ page }) => {
  const lib: FakeLibrary = {
    loggedIn: true,
    shelves: [{ id: ROD_A, name: "읽을 책", position: 0 }, { id: ROD_B, name: "마음에 남은", position: 1 }],
    saved: [{ isbn: "9790000000001", shelfId: ROD_A, title: "지어낸 첫째 책" }, { isbn: "9790000000002", shelfId: ROD_A, title: "지어낸 둘째 책" }],
    posts: [],
  };
  await fakeAccount(page, lib);
  await page.context().route("https://www.yes24.com/**", (route) => route.fulfill({ contentType: "text/html", body: "<title>YES24</title>" }));
  const { events } = await recordEvents(page);

  await page.goto("/library");
  await expect(page.getByText("2개 · 동물 1종")).toBeVisible();
  await expect(page.getByRole("heading", { name: "마음에 남은" })).toHaveAttribute("data-amp-mask", "");

  // hold (0.5 s) → the other rod becomes the place to put it
  const first = page.getByRole("button", { name: "지어낸 첫째 책 책갈피" });
  await first.scrollIntoViewIfNeeded();
  const box = await first.boundingBox();
  if (!box) throw new Error("no bookmark box");
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await page.waitForTimeout(700);
  await page.mouse.up();
  await expect(first).toHaveAttribute("aria-pressed", "true");
  await page.getByRole("button", { name: "여기를 누르면 옮겨져요" }).click();
  await expect(page.getByRole("list", { name: "마음에 남은" }).getByRole("button", { name: "지어낸 첫째 책 책갈피" })).toBeVisible();

  // a tap turns it over: YES24, then move back through the menu
  await page.getByRole("button", { name: "지어낸 첫째 책 책갈피" }).click();
  const sheet = page.getByRole("dialog", { name: "지어낸 첫째 책" });
  await expect(sheet.getByText("만난 날")).toBeVisible();
  const [tab] = await Promise.all([page.waitForEvent("popup"), sheet.getByRole("link", { name: /예스24에서 보기/ }).click()]);
  await tab.close();
  await sheet.getByRole("button", { name: "다른 막대로 옮기기" }).click();
  await page.getByRole("dialog", { name: "어느 막대로 옮길까요?" }).getByRole("button", { name: "읽을 책" }).click();
  await expect(page.getByRole("list", { name: "읽을 책" }).getByRole("button", { name: "지어낸 첫째 책 책갈피" })).toBeVisible();

  // a new rod, then take the second book out
  await page.getByRole("button", { name: "＋ 막대 추가" }).click();
  await page.getByRole("textbox", { name: "새 막대 이름" }).fill("밤에 읽기");
  await page.getByRole("button", { name: "만들기" }).click();
  await expect(page.getByRole("heading", { name: "밤에 읽기" })).toBeVisible();
  await page.getByRole("button", { name: "지어낸 둘째 책 책갈피" }).click();
  await page.getByRole("button", { name: "빼기" }).click();
  await page.getByRole("button", { name: "빼기" }).click();
  await expect(page.getByRole("button", { name: "지어낸 둘째 책 책갈피" })).toHaveCount(0);

  expect(named(events, "library_viewed").map((e) => e.props)).toEqual([{ saved_count: 2 }]);
  expect(named(events, "bookmark_moved").map((e) => e.props)).toEqual([
    { book_id: "9790000000001", method: "hold" }, { book_id: "9790000000001", method: "menu" },
  ]);
  expect(named(events, "yes24_link_clicked").map((e) => e.props)).toEqual([{ book_id: "9790000000001", source: "library", pick_type: null }]);
  expect(named(events, "shelf_created").map((e) => e.props)).toEqual([{ shelf_count: 3 }]);
  expect(named(events, "book_unsaved").map((e) => e.props)).toEqual([{ book_id: "9790000000002" }]);
  expect(JSON.stringify(events)).not.toContain("밤에 읽기");                // rod names never in events (taxonomy 6-1)
  expect(JSON.stringify(events)).not.toContain("마음에 남은");
  expect(specMismatches(events)).toEqual([]);

  lib.loggedIn = false;
  await page.getByRole("button", { name: "로그아웃" }).click();
  await expect(page).toHaveURL(/\/$/);
  await expect(page.getByRole("banner").getByRole("button", { name: "로그인" })).toBeVisible();
});

test("S-09 logged out offers the login", async ({ page }) => {
  await fakeAccount(page, { loggedIn: false, shelves: [], saved: [], posts: [] });
  await page.goto("/library");
  await page.getByRole("main").getByRole("button", { name: "로그인" }).click();
  await expect(page.getByRole("dialog", { name: "로그인하고 내 책갈피를 모아 보세요" })).toBeVisible();
});
