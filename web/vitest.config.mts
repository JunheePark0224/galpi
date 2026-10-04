import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import path from "node:path";

export default defineConfig({
  plugins: [react()],
  resolve: { alias: { "@": path.resolve(import.meta.dirname, "src") } },
  test: {
    environment: "jsdom",
    setupFiles: ["./vitest.polyfills.ts", "./vitest.setup.ts"],
    include: ["src/**/*.test.{ts,tsx}"],
    coverage: {
      provider: "v8",
      include: ["src/lib/**"],
      exclude: ["src/**/*.test.*", "src/**/__fixtures__/**", "src/lib/recommend/index.ts", "src/lib/recommend/types.ts", "src/lib/paths/index.ts"],
      thresholds: {
        "src/lib/recommend/**": { lines: 100, branches: 100, functions: 100, statements: 100 },
        "src/lib/paths/**": { lines: 100, branches: 100, functions: 100, statements: 100 },
      },
    },
  },
});
