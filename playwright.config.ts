import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "src/tests/e2e",
  timeout: 120_000,
  use: {
    baseURL: process.env.APP_URL || "http://127.0.0.1:3000",
  },
  webServer: {
    command: "npm run dev",
    url: process.env.APP_URL || "http://127.0.0.1:3000",
    reuseExistingServer: false,
    timeout: 120_000,
  },
});
