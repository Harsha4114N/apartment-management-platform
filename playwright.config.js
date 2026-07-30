// @ts-check
import { defineConfig, devices } from '@playwright/test';

/**
 * @see https://playwright.dev/docs/test-configuration
 */
export default defineConfig({
  testDir: './tests',
  /* Run tests in files in parallel */
  fullyParallel: false,
  /* Fail the build on CI if you accidentally left test.only in the source code. */
  forbidOnly: !!process.env.CI,
  /* Retry on CI only */
  retries: process.env.CI ? 2 : 1,
  /* Opt out of parallel tests on CI. */
  workers: process.env.CI ? 1 : 1,
  /* Reporter to use. JSON for AI parsing, also CLI for humans */
  reporter: [
    ['list'],
    ['json', { outputFile: 'test-results/results.json' }],
    ['html', { open: 'never' }]
  ],
  /* Shared settings for all the projects below. */
  use: {
    /* Base URL for the frontend */
    baseURL: 'http://localhost:5173',
    /* Collect trace when retrying the failed test */
    trace: 'retain-on-failure',
    /* Capture screenshot on failure */
    screenshot: 'only-on-failure',
    /* Record video for visual debugging */
    video: 'retain-on-failure',
  },

  /* Configure webServer to boot both backend and frontend */
  webServer: [
    {
      command: 'npx cross-env NODE_ENV=test node server/server.js',
      cwd: '.',
      port: 5000,
      timeout: 30000,
      reuseExistingServer: !process.env.CI,
      stdout: 'pipe',
      stderr: 'pipe',
    },
    {
      command: 'npx vite --port 5173',
      cwd: 'client',
      port: 5173,
      timeout: 30000,
      reuseExistingServer: !process.env.CI,
      stdout: 'pipe',
      stderr: 'pipe',
    },
  ],

  /* Configure projects for major browsers */
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
});
