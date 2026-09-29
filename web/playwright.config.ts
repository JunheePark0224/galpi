import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./e2e",
  webServer: {
    command: "npm run build && npm run start -- -p 3100",
    port: 3100,
    reuseExistingServer: true,
    timeout: 180_000,
    // Next does not let .env.local override an already-set env var: E2E never writes to the real events table.
    env: { TRACK_STORE: "off" },
  },
  use: { baseURL: "http://localhost:3100" },
  projects: [
    { name: "phone", use: { ...devices["Pixel 7"] } },
    { name: "laptop", use: { viewport: { width: 1440, height: 900 } } },
  ],
});
