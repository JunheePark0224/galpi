import { readFileSync } from "node:fs";
import { expect } from "@playwright/test";
import { test } from "./helpers";

test("design page shows tokens and buttons", async ({ page }) => {
  await page.goto("/design");
  await expect(page.getByRole("button", { name: "궁금해요" })).toBeVisible();
  const ink = await page.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue("--ink").trim());
  expect(ink.toUpperCase()).toBe("#2B2724");
});

test("content column is 430px and centered on laptop, full width on phone", async ({ page }, testInfo) => {
  await page.goto("/");
  const viewport = page.viewportSize();
  if (!viewport) throw new Error("viewport is not set");
  const rect = await page.locator(".column").evaluate((el) => {
    const r = el.getBoundingClientRect();
    return { left: r.left, width: r.width };
  });
  if (testInfo.project.name === "laptop") {
    expect(rect.width).toBe(430);
    expect(Math.round(rect.left)).toBe(Math.round((viewport.width - 430) / 2));
  } else {
    expect(rect.width).toBe(viewport.width);
  }
});

test("footer credits YES24", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByText("예스24와 무관한 개인 프로젝트")).toBeVisible();
});

test("every page has the small logo header, no login yet, and the SVG icon", async ({ page, request }) => {
  for (const path of ["/", "/privacy"]) {
    await page.goto(path);
    await expect(page.locator("header").first().getByRole("img", { name: "갈피" })).toBeVisible();
    await expect(page.getByText("로그인")).toHaveCount(0);
  }
  const icon = await request.get("/icon.svg");
  expect(icon.status()).toBe(200);
  expect(icon.headers()["content-type"]).toContain("image/svg+xml");
});

test("frost and book tokens exist for bookmarks", async ({ page }) => {
  await page.goto("/design");
  const values = await page.evaluate(() => {
    const s = getComputedStyle(document.documentElement);
    return ["--frost-blur", "--frost-edge", "--radius-book", "--radius-bookmark"].map((k) => s.getPropertyValue(k).trim());
  });
  const [blur, edge, book, bookmark] = values;
  expect([blur, book, bookmark]).toEqual(["blur(3px) saturate(1.1)", "2px 10px 10px 2px", "10px 10px 0 0"]);
  // the production build minifies rgba(255, 255, 255, 0.8) to #fffc
  expect(edge).toMatch(/^1px solid (rgba\(255, 255, 255, 0\.8\)|#fffc)$/);
});

test("design page shows a bookmark with its reading label", async ({ page }) => {
  await page.goto("/design");
  await expect(page.getByRole("article", { name: /천천히 걷는 아침/ })).toBeVisible();
});

// C-02 text room: every real book's title, author and one-liner must fit the 160 x 344 frame (title may clamp at 2 lines,
// the author stays on one line, the one-liner may not be cut). The second run scales the name tag, title, author,
// one-liner and "갈피" by 1.15 (Android large-text setting) and also requires the stitch line and "갈피" to sit above the
// swallowtail notch (7% of the card height, cut into the bottom centre). The book scene scales the whole bookmark
// uniformly (transform), which does not change this layout.
for (const scale of [1, 1.15]) {
  test(`every real book's title, author and one-liner fit the bookmark frame at text x${scale}`, async ({ page }) => {
    const books = JSON.parse(readFileSync("src/data/books.json", "utf8")) as { isbn: string; title: string; author: string; one_liner: string }[];
    expect(books).toHaveLength(200);
    await page.goto("/design");
    await page.evaluate(() => document.fonts.ready);

    const problems = await page.evaluate(({ all, textScale }) => {
      const card = document.querySelector("article")?.children[1] as HTMLElement;
      const [, win, tag, title, author, line, stitch, mark] = Array.from(card.children) as HTMLElement[];
      for (const el of [tag, title, author, line, mark]) el.style.fontSize = `${parseFloat(getComputedStyle(el).fontSize) * textScale}px`;
      const cardBox = card.getBoundingClientRect();
      const room = cardBox.bottom - parseFloat(getComputedStyle(card).paddingBottom) - 1;
      const notchY = cardBox.top + cardBox.height * 0.93;                // lowest point of the frame at the centre
      const naturalWindow = win.getBoundingClientRect().width * 0.76;     // art viewBox is 100 x 76
      const found: string[] = [];
      for (const b of all) {
        title.textContent = b.title;
        author.textContent = b.author;
        line.textContent = b.one_liner;
        const why: string[] = [];
        if (line.scrollHeight > line.clientHeight + 1) why.push("one-liner is cut");
        if (title.getBoundingClientRect().height > 2 * parseFloat(getComputedStyle(title).lineHeight) + 1) why.push("title over 2 lines");
        if (author.getBoundingClientRect().height > parseFloat(getComputedStyle(author).lineHeight) + 1) why.push("author over 1 line");
        // at normal size every author fits whole; at x1.15 a very long single name may end in "…" (one line kept)
        if (textScale === 1 && author.scrollWidth > author.clientWidth + 1) why.push("author is cut");
        if (line.getBoundingClientRect().bottom > stitch.getBoundingClientRect().top) why.push("text runs into the stitch line");
        if (mark.getBoundingClientRect().bottom > room + 0.5) why.push("갈피 mark leaves the card");
        if (mark.getBoundingClientRect().bottom > notchY) why.push("갈피 mark is caught by the swallowtail notch");
        if (stitch.getBoundingClientRect().bottom > mark.getBoundingClientRect().top) why.push("stitch line overlaps 갈피");
        if (Math.abs(win.getBoundingClientRect().height - naturalWindow) > 1) why.push("window is squeezed");
        if (why.length) found.push(`${b.isbn} ${b.title} / ${b.author}: ${why.join(", ")}`);
      }
      return found;
    }, { all: books.map(({ isbn, title, author, one_liner }) => ({ isbn, title, author, one_liner })), textScale: scale });
    expect(problems).toEqual([]);
  });
}
