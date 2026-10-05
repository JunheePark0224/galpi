import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { expect, type Page } from "@playwright/test";
import { answerToClosedBook, reactToBookmarks, recordEvents, test } from "./helpers";

/**
 * Launch sweep (docs/launch-sweep.md, 10-05): every launch-channel browser (by user agent) × five small-phone viewports
 * walks home → questions → S-03 → S-04 → S-05 → S-06, the login sheet (opened, never completed), 내 책갈피 (mocked login,
 * as library.spec.ts), the 도감 tab and /privacy. Each screen is measured in the page (overflow, clipped text, small or
 * covered targets, fixed bars, the book scene) and screenshotted. Off unless LAUNCH_SWEEP=<folder>; phone project only.
 * Chromium only: the iOS user agents get Chromium's engine, not WebKit (no WebKit install here).
 */
const OUT = process.env.LAUNCH_SWEEP;

const UAS = {
  "ig-ios": "Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 Instagram 345.0.0.24.89 (iPhone15,2; iOS 17_5; ko_KR; ko; scale=3.00; 1179x2556; 634108168)",
  "ig-android": "Mozilla/5.0 (Linux; Android 14; SM-S911N Build/UP1A.231005.007; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/129.0.6668.81 Mobile Safari/537.36 Instagram 345.0.0.48.95 Android (34/14; 480dpi; 1080x2340; samsung; SM-S911N; dm1q; qcom; ko_KR; 634108168)",
  threads: "Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 Barcelona 352.0.0.20.80 (iPhone15,2; iOS 17_5; ko_KR; ko; scale=3.00; 1179x2556; 645204331)",
  kakao: "Mozilla/5.0 (Linux; Android 14; SM-S911N Build/UP1A.231005.007; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/129.0.6668.81 Mobile Safari/537.36 KAKAOTALK 10.9.5",
  linkedin: "Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 [LinkedInApp]/9.30.1234",
  safari: "Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1",
  chrome: "Mozilla/5.0 (Linux; Android 14; SM-S911N) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0.6668.81 Mobile Safari/537.36",
} as const;
const IN_APP: Record<keyof typeof UAS, boolean> = {
  "ig-ios": true, "ig-android": true, threads: true, kakao: true, linkedin: true, safari: false, chrome: false,
};
const VIEWPORTS = [[320, 568], [360, 740], [375, 667], [390, 844], [412, 915]] as const;

const ART = { animal: "fox", bg: "night", sky: "moon", ground: "books", rare: false };
const card = (isbn: string, title: string) => ({ id: isbn, entry: "leaf", title, author: "지어낸 저자", genre: "한국 소설", field: null, oneLiner: "지어낸 한 줄이에요", oneLinerStyle: "question" });
const mark = (isbn: string, title: string) => ({ isbn, art: ART, reason: { label: "나온 이유", items: ["따뜻함"] }, metOn: "2026-10-01", card: card(isbn, title) });
const ITEMS = [
  { kind: "animal", value: "cat", firstMetAt: "2026-10-05T01:00:00.000Z", firstArt: { ...ART, animal: "cat" }, isNew: false },
  { kind: "animal", value: "otter", firstMetAt: "2026-10-05T01:00:00.000Z", firstArt: { ...ART, animal: "otter", rare: true }, isNew: true },
  { kind: "bg", value: "night", firstMetAt: "2026-10-05T01:00:00.000Z", firstArt: ART, isNew: false },
];

/** Measured in the page; only what a person would notice on a phone. */
async function audit(page: Page) {
  return page.evaluate(() => {
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    // > 1px: visually hidden screen-reader text (1 × 1, clipped) is not something a person sees
    const visible = (el: Element) => {
      const r = el.getBoundingClientRect();
      const s = getComputedStyle(el);
      return r.width > 1 && r.height > 1 && s.visibility !== "hidden" && s.display !== "none" && Number(s.opacity) > 0.05
        && !el.closest("[aria-hidden=true], [inert]");
    };
    const label = (el: Element) => {
      const name = (el.getAttribute("aria-label") ?? (el as HTMLElement).innerText ?? "").replace(/\s+/g, " ").trim();
      const cls = typeof el.className === "string" ? el.className.split(" ")[0] : "";
      return `${el.tagName.toLowerCase()}${cls ? "." + cls : ""} "${name.slice(0, 30)}"`;
    };
    const round = (n: number) => Math.round(n);
    const doc = document.documentElement;

    // text cut off: an element with its own text whose content is wider/taller than its box while overflow hides it,
    // or that reaches past an ancestor that hides (or scrolls) its overflow — e.g. a line below the bottom of a book page
    const clipped: string[] = [];
    for (const el of document.querySelectorAll("body *")) {
      if (!visible(el)) continue;
      const own = [...el.childNodes].some((n) => n.nodeType === 3 && (n.textContent ?? "").trim() !== "");
      if (!own) continue;
      const s = getComputedStyle(el);
      const hidesX = s.overflowX !== "visible" || s.textOverflow === "ellipsis";
      const hidesY = s.overflowY !== "visible" || Number(s.webkitLineClamp) > 0;
      if ((hidesX && el.scrollWidth > el.clientWidth + 1) || (hidesY && el.scrollHeight > el.clientHeight + 1)) {
        clipped.push(label(el));
        continue;
      }
      const r = el.getBoundingClientRect();
      for (let a = el.parentElement; a && a !== document.body; a = a.parentElement) {
        const as = getComputedStyle(a);
        if (as.overflowX === "visible" && as.overflowY === "visible") continue;
        const ar = a.getBoundingClientRect();
        if (r.bottom > ar.bottom + 1 || r.top < ar.top - 1 || r.right > ar.right + 1 || r.left < ar.left - 1) {
          clipped.push(`${label(el)} (past ${label(a)} by ${round(Math.max(r.bottom - ar.bottom, ar.top - r.top, r.right - ar.right, ar.left - r.left))}px)`);
        }
        break;
      }
    }

    // text sticking out of the screen sideways
    const offscreen: string[] = [];
    for (const el of document.querySelectorAll("body *")) {
      if (!visible(el)) continue;
      const own = [...el.childNodes].some((n) => n.nodeType === 3 && (n.textContent ?? "").trim() !== "");
      if (!own) continue;
      const r = el.getBoundingClientRect();
      if (r.right > vw + 1 || r.left < -1) offscreen.push(`${label(el)} x=${round(r.left)}..${round(r.right)}`);
    }

    // targets: under 44px, or covered at their centre by something else (a fixed bar), or below the screen
    const small: string[] = [];
    const covered: string[] = [];
    const below: string[] = [];
    const targets = document.querySelectorAll("button, a[href], [role=button], input, select, textarea, summary");
    const dialog = document.querySelector("[role=dialog], dialog[open]");
    for (const el of targets) {
      if (!visible(el) || (el as HTMLButtonElement).disabled) continue;
      if (dialog && !dialog.contains(el)) continue;   // behind an open sheet on purpose
      const r = el.getBoundingClientRect();
      if (r.width < 44 || r.height < 44) small.push(`${label(el)} ${round(r.width)}×${round(r.height)}`);
      const cx = r.left + r.width / 2;
      const cy = r.top + r.height / 2;
      if (cy >= 0 && cy <= vh && cx >= 0 && cx <= vw) {
        const top = document.elementFromPoint(cx, cy);
        if (top && top !== el && !el.contains(top) && !top.contains(el)) covered.push(`${label(el)} under ${label(top)}`);
      } else if (r.top >= vh) {
        below.push(`${label(el)} top=${round(r.top)}`);
      }
    }

    // fixed / sticky boxes and whether two of them overlap
    const fixed = [...document.querySelectorAll("body *")].filter((el) => visible(el) && ["fixed", "sticky"].includes(getComputedStyle(el).position));
    const overlaps: string[] = [];
    for (let i = 0; i < fixed.length; i++) {
      for (let j = i + 1; j < fixed.length; j++) {
        if (fixed[i].contains(fixed[j]) || fixed[j].contains(fixed[i])) continue;
        const a = fixed[i].getBoundingClientRect();
        const b = fixed[j].getBoundingClientRect();
        if (a.left < b.right && b.left < a.right && a.top < b.bottom && b.top < a.bottom) overlaps.push(`${label(fixed[i])} × ${label(fixed[j])}`);
      }
    }

    // long-press: anything that is held should not open the system callout or select text
    const holds = [...document.querySelectorAll("[data-hold], [class*=hold], [class*=Hold]")].filter(visible).map((el) => {
      const s = getComputedStyle(el) as CSSStyleDeclaration & { webkitTouchCallout?: string };
      return `${label(el)} callout=${s.webkitTouchCallout ?? "?"} select=${s.userSelect || s.webkitUserSelect}`;
    });

    return {
      vw, vh,
      overflowX: doc.scrollWidth - vw,
      pageHeight: doc.scrollHeight,
      clipped, offscreen, small, covered, below, overlaps, holds,
    };
  });
}

type Audit = Awaited<ReturnType<typeof audit>> & { screen: string; ua: string; vp: string; extra?: Record<string, unknown> };

for (const [ua, agent] of Object.entries(UAS) as [keyof typeof UAS, string][]) {
  for (const [w, h] of VIEWPORTS) {
    test.describe(`${ua} ${w}x${h}`, () => {
      test.use({ viewport: { width: w, height: h }, userAgent: agent, isMobile: true, hasTouch: true, deviceScaleFactor: 2, reducedMotion: "reduce" });

      test(`sweep ${ua} ${w}x${h}`, async ({ page }, testInfo) => {
        test.skip(!OUT || testInfo.project.name !== "phone", "LAUNCH_SWEEP=<folder>, phone project only");
        test.setTimeout(180_000);
        const dir = join(OUT as string, `${ua}-${w}x${h}`);
        mkdirSync(dir, { recursive: true });
        const results: Audit[] = [];
        const shot = async (screen: string, extra?: Record<string, unknown>) => {
          results.push({ ...(await audit(page)), screen, ua, vp: `${w}x${h}`, extra });
          await page.screenshot({ path: join(dir, `${screen}.png`) });
        };

        const { events } = await recordEvents(page);
        await page.route(/\/api\/books\/\d{13}$/, (route) => route.fulfill({
          json: { source: "yes24", cover: null, price: 14400, rating: 9.4, pages: 280, intro: "테스트를 위해 지어낸 소개예요. 두 문장이에요.", link: "https://www.yes24.com/product/goods/1" },
        }));
        let loggedIn = false;
        await page.route("**/api/me", (route) => route.fulfill({ json: { enabled: true, loggedIn, id: loggedIn ? "e2e-user" : null, count: loggedIn ? 2 : 0, login: null } }));

        // S-01 → S-02 → S-03
        await page.goto("/?utm_source=threads&utm_medium=social&utm_campaign=launch_1007");
        await expect(page.getByRole("button", { name: "갈피 잡으러 가기" })).toBeVisible();
        await shot("s01-home");
        await page.getByRole("button", { name: "갈피 잡으러 가기" }).click();
        await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
        await shot("s02-question");
        await page.goto("/");   // answerToClosedBook starts from S-01
        await answerToClosedBook(page);
        await shot("s03-closed-book");

        // S-04 → S-05 (five bookmarks) → S-06
        await page.getByRole("button", { name: "책 펼치기" }).click();
        await expect(page.getByRole("button", { name: "다음 장" })).toBeEnabled();
        await shot("s04-first-page");
        await page.getByRole("button", { name: "다음 장" }).click();
        await expect(page.getByText("1 / 5")).toBeVisible();
        await expect(page.getByRole("button", { name: "궁금해요", exact: true })).toBeEnabled();   // the bookmark has risen
        await shot("s05-bookmark");
        await reactToBookmarks(page, ["궁금해요", "패스", "궁금해요", "패스", "패스"]);
        await expect(page.getByText("궁금해요 1 / 2")).toBeVisible();
        await shot("s06-result");

        // S-07 login sheet from the header — opened, never completed
        await page.getByRole("banner").getByRole("button", { name: "로그인" }).click();
        await expect(page.getByRole("dialog")).toBeVisible();
        await shot("s07-login-sheet");
        await page.getByRole("dialog").getByRole("button", { name: "닫기" }).click();

        // S-09 내 책갈피 and the 도감 tab (mocked login)
        loggedIn = true;
        await page.route("**/api/library", (route) => route.fulfill({ json: {
          shelves: [{ id: "11111111-1111-4111-8111-111111111111", name: "첫 막대", position: 0,
            bookmarks: [mark("9788998441012", "아주 긴 제목이 붙은 책 한 권 — 작은 화면에서 줄이 넘치는지"), mark("9788998441029", "짧은 제목")] }],
          count: 2, animals: 1 } }));
        await page.route("**/api/collection", (route) => route.fulfill({ json: { items: ITEMS } }));
        await page.route("**/api/collection/seen", (route) => route.fulfill({ json: { ok: true, seen: 1 } }));
        await page.goto("/library");
        await expect(page.getByRole("heading", { level: 1, name: "내 책갈피" })).toBeVisible();
        await shot("s09-library");
        await page.getByRole("button", { name: "도감", exact: true }).click();
        await expect(page.getByRole("heading", { level: 1, name: "도감" }).or(page.getByText(/동물 \d+ \/ \d+/))).toBeVisible();
        await shot("s09-collection");

        // S-10
        await page.goto("/privacy");
        await expect(page.getByRole("heading", { level: 1, name: "개인정보 처리방침" })).toBeVisible();
        await shot("s10-privacy");

        const visit = events.find((e) => e.name === "site_visited");
        const summary = {
          ua, vp: `${w}x${h}`, is_in_app_browser: visit?.common.is_in_app_browser, expected_in_app: IN_APP[ua],
          device: visit?.common.device, utm: visit?.props, results,
        };
        writeFileSync(join(dir, "audit.json"), JSON.stringify(summary, null, 2));
        expect(visit?.common.is_in_app_browser).toBe(IN_APP[ua]);
        expect(visit?.common.device).toBe("phone");
      });
    });
  }
}
