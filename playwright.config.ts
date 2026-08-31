import { defineConfig, devices } from "@playwright/test";
import { loadEnvConfig } from "@next/env";

loadEnvConfig(process.cwd());

const PORT = 3000;
const HOST = "127.0.0.1";
const INNGEST_SINK_PORT = 8288;

export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: false,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: process.env.CI ? [["html", { open: "never" }], ["list"]] : "list",
  use: {
    baseURL: `http://${HOST}:${PORT}`,
    trace: "on-first-retry",
  },
  webServer: [
    // Trip creation enqueues its job server-side, so the event never passes
    // through the browser and cannot be stubbed there. This stands in for the
    // Inngest dev server: it accepts the event and runs nothing.
    {
      command: "node tests/e2e/helpers/inngest-sink.mjs",
      url: `http://${HOST}:${INNGEST_SINK_PORT}/health`,
      timeout: 30_000,
      reuseExistingServer: !process.env.CI,
    },
    {
      command: `npm run dev -- --hostname ${HOST} --port ${PORT}`,
      url: `http://${HOST}:${PORT}`,
      timeout: 120_000,
      reuseExistingServer: !process.env.CI,
      env: {
        ...process.env,
        ENABLE_TEST_AUTH: "true",
        E2E_TEST_EMAIL: process.env.E2E_TEST_EMAIL ?? "e2e@travel-ai.local",
        E2E_TEST_NAME: process.env.E2E_TEST_NAME ?? "E2E User",
        INNGEST_DEV: `http://${HOST}:${INNGEST_SINK_PORT}`,
        NEXT_TELEMETRY_DISABLED: "1",
      },
    },
  ],
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
});
