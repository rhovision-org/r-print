import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./e2e",
  outputDir: "test-results",
  timeout: 45_000,
  expect: { timeout: 10_000 },
  fullyParallel: true,
  retries: 0,
  reporter: [
    ["list"],
    ["html", { outputFolder: "playwright-report", open: "never" }],
    ["json", { outputFile: "test-results/results.json" }],
  ],
  use: {
    baseURL: "http://127.0.0.1:4173",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    video: "off",
  },
  webServer: {
    command: "npm run test:e2e:serve",
    url: "http://127.0.0.1:4173",
    timeout: 120_000,
    reuseExistingServer: false,
    env: { VITE_RPRINT_MODE: "fixture" },
  },
  projects: [
    {
      name: "fixture-chromium",
      testMatch: /fixture\/.*\.spec\.ts/,
      use: { ...devices["Desktop Chrome"] },
    },
    {
      name: "fixture-mobile",
      testMatch: /mobile\/.*\.spec\.ts/,
      use: { ...devices["Pixel 7"] },
    },
    {
      name: "live-chromium",
      testMatch: /live\/.*\.spec\.ts/,
      timeout: 1_200_000,
      use: { ...devices["Desktop Chrome"] },
    },
  ],
});
