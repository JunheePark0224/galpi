import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./e2e",
  webServer: { command: "npm run build && npm run start -- -p 3100", port: 3100, reuseExistingServer: true, timeout: 180_000 },
  use: { baseURL: "http://localhost:3100" },
  projects: [
    { name: "phone", use: { ...devices["Pixel 7"] } },
    { name: "laptop", use: { viewport: { width: 1440, height: 900 } } },
  ],
});
