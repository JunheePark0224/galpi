import { expect } from "@playwright/test";
import { test } from "./helpers";

const common = { anon_id: "e2e", user_id: null, session_id: "e2e", round: 1, entry: null, screen_version: "v1",
  referrer: "", returning: false, device: "desktop", in_app_browser: false };
const event = { name: "visit", props: {}, common };

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
