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
    env: { TRACK_STORE: "off" },
  },
  use: { baseURL: `http://localhost:${PORT}` },
  projects: [
    { name: "phone", use: { ...devices["Pixel 7"] } },
    { name: "laptop", use: { viewport: { width: 1440, height: 900 } } },
  ],
});
