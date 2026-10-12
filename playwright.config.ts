import { defineConfig } from "@playwright/test";
import path from "node:path";

// Runs against a production build with a throwaway data folder (see e2e/setup.ts).
const DATA_DIR = path.join(__dirname, ".e2e-data");
const PORT = 3999;

export default defineConfig({
  testDir: "e2e",
  globalSetup: "./e2e/setup.ts",
  workers: 1,
  timeout: 120_000,
  use: { baseURL: `http://localhost:${PORT}` },
  projects: [
    { name: "phone", use: { viewport: { width: 375, height: 812 }, isMobile: true, hasTouch: true } },
    { name: "desktop", use: { viewport: { width: 1366, height: 900 } } },
  ],
  webServer: {
    command: `npx next start -p ${PORT}`,
    url: `http://localhost:${PORT}/login`,
    reuseExistingServer: false,
    env: {
      DATA_DIR,
      INSECURE_COOKIES: "1",
      // Keep e2e offline: Next does not override an env var that is already set, so .env.local's real key is ignored.
      GEMINI_API_KEY: "",
      SESSION_SECRET: process.env.SESSION_SECRET ?? "e2e-only-secret-e2e-only-secret-e2e-only",
    },
  },
});
