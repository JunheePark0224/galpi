import { defineConfig, devices } from "@playwright/test";

// A port no other local app uses. Never attach to a server we did not start: it may be a stale build.
const PORT = 3217;

export default defineConfig({
  testDir: "./e2e",
  webServer: {
    command: `npm run build && npm run start -- -p ${PORT}`,
    port: PORT,
    reuseExistingServer: false,
    timeout: 180_000,
    // Next does not let .env files override an already-set env var: E2E never writes to the real events table.
    // BOOKS_SOURCE=sample: flows draw from the 30-book fixture so assertions never depend on the real catalogue.
    // NEXT_PUBLIC_AMPLITUDE_API_KEY="": Amplitude stays off even if a key ever lands in .env.local (the key is Production-only).
    // YES24 / Kakao / Anthropic keys "": E2E never calls outside services — specs mock /api/books/<isbn> or
    // /api/goal/classify in the page when they need an answer; without a key the classifier is word matching.
    env: {
      TRACK_STORE: "off", BOOKS_SOURCE: "sample", NEXT_PUBLIC_AMPLITUDE_API_KEY: "",
      YES24_API_KEY: "", KAKAO_REST_KEY: "", ANTHROPIC_API_KEY: "",
      // F-26: no 갈피 우체통 notice email ever leaves an E2E run.
      RESEND_API_KEY: "", FEEDBACK_NOTIFY_TO: "",
      // P5: a made-up Supabase address turns the login place on; e2e/library.spec.ts answers the login and the
      // 내 책갈피 routes itself. No request reaches a real Supabase.
      NEXT_PUBLIC_SUPABASE_URL: "http://supabase.e2e.invalid", NEXT_PUBLIC_SUPABASE_ANON_KEY: "e2e-anon-not-a-key",
    },
  },
  use: { baseURL: `http://localhost:${PORT}` },
  projects: [
    { name: "phone", use: { ...devices["Pixel 7"] } },
    { name: "laptop", use: { viewport: { width: 1440, height: 900 } } },
  ],
});
