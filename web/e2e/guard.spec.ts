import { expect } from "@playwright/test";
import { test } from "./helpers";

const common = { anon_id: "e2e", user_id: null, session_id: "e2e", round: 1, entry: null, mode: null, screen_version: "v2",
  referrer: "", is_returning: false, device: "desktop", is_in_app_browser: false };
const event = { name: "site_visited", props: {}, common };

// The production build behind `next start`, hit without a browser page: same-origin must be enforced there too.
test("track refuses a request from another origin, or with no origin at all", async ({ request, baseURL }) => {
  expect((await request.post("/api/track", { data: event })).status()).toBe(403);
  expect((await request.post("/api/track", { data: event, headers: { origin: "https://evil.example" } })).status()).toBe(403);
  expect((await request.post("/api/track", { data: event, headers: { origin: baseURL! } })).status()).toBe(202);
});

test("draw refuses a request from another origin", async ({ request, baseURL }) => {
  const body = { entry: "leaf", choices: ["A", "B", "A", "B", "A", "B", "A", "B", "A"] };
  expect((await request.post("/api/books/draw", { data: body, headers: { origin: "https://evil.example" } })).status()).toBe(403);
  expect((await request.post("/api/books/draw", { data: body, headers: { origin: baseURL! } })).status()).toBe(200);
});

test("book detail answers our own pages only, and only for our books", async ({ request, baseURL }) => {
  const isbn = "9790000000001";                                          // books.sample.json
  expect((await request.get(`/api/books/${isbn}`, { headers: { referer: "https://evil.example/" } })).status()).toBe(403);
  expect((await request.get(`/api/books/${isbn}`)).status()).toBe(403);   // no Origin, no Referer
  const ok = await request.get(`/api/books/${isbn}`, { headers: { referer: `${baseURL}/` } });
  expect(ok.status()).toBe(200);
  expect((await ok.json()).source).toBeNull();                           // no keys in E2E: the empty detail
  expect((await request.get("/api/books/9788998441012", { headers: { referer: `${baseURL}/` } })).status()).toBe(404);
});

test("goal classify refuses another origin and answers our own page with word matching (no key in E2E)", async ({ request, baseURL }) => {
  expect((await request.post("/api/goal/classify", { data: { text: "SQL" }, headers: { origin: "https://evil.example" } })).status()).toBe(403);
  const ok = await request.post("/api/goal/classify", { data: { text: "SQL 공부" }, headers: { origin: baseURL! } });
  expect(ok.status()).toBe(200);
  expect(await ok.json()).toMatchObject({ topic: "데이터 분석", keywords: ["SQL"], method: "word" });
});
