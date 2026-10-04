import { readFileSync } from "node:fs";
import { expect } from "@playwright/test";
import { test } from "./helpers";
import { bookTitle } from "../src/lib/books/title";

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

test("every page has the small logo header with the login place (P5), and the SVG icon", async ({ page, request }) => {
  for (const path of ["/", "/privacy"]) {
    await page.goto(path);
    await expect(page.locator("header").first().getByRole("img", { name: "갈피" })).toBeVisible();
    await expect(page.locator("header").first().getByRole("button", { name: "로그인" })).toBeVisible();
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

// C-02 text room: every real book's whole title (in 『 』, edition labels dropped — bookTitle), author and one-liner must fit
// the 160 x 344 frame. The title is fitted as fitTitle() does it: two lines stepping 1px down to 12px, then a third line at
// 13 -> 12px (data-lines="3", tighter lines and gaps); at normal text no title may end in "…". The author stays on one line,
// the one-liner may not be cut. The second run scales the name tag, title, author, one-liner and "갈피" by 1.15 (Android
// large-text setting) and also requires the stitch line and "갈피" to sit above the swallowtail notch (7% of the card height,
// cut into the bottom centre). The book scene scales the whole bookmark uniformly (transform), which does not change this layout.
// 내 책갈피's front (C-13, 10-04) adds "YYYY. M. D. 만남" under the one-liner: the same checks run on it too, with the date
// on one line between the one-liner and the stitch line.
for (const scale of [1, 1.15]) for (const met of [false, true]) {
  test(`every real book's title, author and one-liner fit the bookmark frame${met ? " with the met date" : ""} at text x${scale}`, async ({ page }) => {
    const books = (JSON.parse(readFileSync("src/data/books.json", "utf8")) as { isbn: string; title: string; author: string; one_liner: string }[])
      .map((b) => ({ ...b, shown: bookTitle(b.title) }));
    expect(books.length).toBeGreaterThanOrEqual(200); // 200 base + pilot additions (288 on 10-01)
    await page.goto("/design");
    await page.evaluate(() => document.fonts.ready);

    const problems = await page.evaluate(({ all, textScale, withMet }) => {
      const article = document.querySelector(withMet ? "article:has([data-part=met])" : "article:not(:has([data-part=met]))");
      const card = article?.children[1] as HTMLElement;
      const parts = Array.from(card.children) as HTMLElement[];
      const [, win, tag, title, author, line] = parts;
      const [stitch, mark] = parts.slice(-2);
      const date = withMet ? card.querySelector<HTMLElement>("[data-part=met]") : null;
      for (const el of [tag, title, author, line, mark, date]) if (el) el.style.fontSize = `${parseFloat(getComputedStyle(el).fontSize) * textScale}px`;
      const cardBox = card.getBoundingClientRect();
      const room = cardBox.bottom - parseFloat(getComputedStyle(card).paddingBottom) - 1;
      const notchY = cardBox.top + cardBox.height * 0.93;                // lowest point of the frame at the centre
      const naturalWindow = win.getBoundingClientRect().width * 0.76;     // art viewBox is 100 x 76
      const found: string[] = [];
      for (const b of all) {
        title.textContent = b.shown;
        title.style.fontSize = ""; delete title.dataset.lines;
        const base = parseFloat(getComputedStyle(title).fontSize) * textScale, min = 12 * textScale;
        const fits = () => title.scrollHeight <= title.clientHeight + 4;   // FIT_SLACK_PX
        let fitted = false;                                                // the steps of fitTitle()
        title.dataset.lines = "2";
        for (let px = base; px >= min - 0.01 && !fitted; px -= 1) { title.style.fontSize = `${px}px`; fitted = fits(); }
        if (!fitted) {
          title.dataset.lines = "3";
          for (let px = min + 1; px >= min - 0.01 && !fitted; px -= 1) { title.style.fontSize = `${px}px`; fitted = fits(); }
        }
        author.textContent = b.author;
        line.textContent = b.one_liner;
        const why: string[] = [];
        if (line.scrollHeight > line.clientHeight + 1) why.push("one-liner is cut");
        if (title.getBoundingClientRect().height > 3 * parseFloat(getComputedStyle(title).lineHeight) + 1) why.push("title over 3 lines");
        // at normal size every title shows whole; at x1.15 the very longest may end in "…"
        if (textScale === 1 && !fitted) why.push("title is cut");
        if (author.getBoundingClientRect().height > parseFloat(getComputedStyle(author).lineHeight) + 1) why.push("author over 1 line");
        // at normal size every author fits whole; at x1.15 a very long single name may end in "…" (one line kept)
        if (textScale === 1 && author.scrollWidth > author.clientWidth + 1) why.push("author is cut");
        if (line.getBoundingClientRect().bottom > stitch.getBoundingClientRect().top) why.push("text runs into the stitch line");
        if (date) {
          if (date.getBoundingClientRect().height > parseFloat(getComputedStyle(date).lineHeight) + 1 || date.scrollWidth > date.clientWidth + 1) why.push("met date is not one whole line");
          if (line.getBoundingClientRect().bottom > date.getBoundingClientRect().top + 0.5) why.push("one-liner runs into the met date");
          if (date.getBoundingClientRect().bottom > stitch.getBoundingClientRect().top + 0.5) why.push("met date runs into the stitch line");
        }
        if (mark.getBoundingClientRect().bottom > room + 0.5) why.push("갈피 mark leaves the card");
        if (mark.getBoundingClientRect().bottom > notchY) why.push("갈피 mark is caught by the swallowtail notch");
        if (stitch.getBoundingClientRect().bottom > mark.getBoundingClientRect().top) why.push("stitch line overlaps 갈피");
        if (Math.abs(win.getBoundingClientRect().height - naturalWindow) > 1) why.push("window is squeezed");
        if (why.length) found.push(`${b.isbn} ${b.title} / ${b.author}: ${why.join(", ")}`);
      }
      return found;
    }, { all: books.map(({ isbn, title, shown, author, one_liner }) => ({ isbn, title, shown, author, one_liner })), textScale: scale, withMet: met });
    expect(problems).toEqual([]);
  });
}
