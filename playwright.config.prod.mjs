// @ts-check
import { defineConfig, devices } from '@playwright/test';

/**
 * Production Post-Deployment Verification Config
 *
 * Target: https://apartment-management-platform-beta.vercel.app/
 *
 * Key differences from local config:
 *   1. No webServer — the app is already deployed on Vercel + Render
 *   2. Increased timeouts for cloud cold-starts (Vercel -> Render -> Atlas)
 *   3. Permissive CORS / external navigation for Razorpay redirects
 *   4. Credentials loaded from tests/.auth/prod-users.json (not setup.mjs)
 *   5. Billing tests (@skip-in-prod) excluded to avoid modifying real financial data
 *
 * @see https://playwright.dev/docs/test-configuration
 */
export default defineConfig({
  testDir: './tests',
  /* Run tests sequentially to avoid cross-session conflicts */
  fullyParallel: false,
  /* Fail the build on CI if you accidentally left test.only in the source code. */
  forbidOnly: !!process.env.CI,
  /* Retry failed tests once (cloud flakiness) */
  retries: process.env.CI ? 2 : 1,
  /* Sequential workers — safer for shared production data */
  workers: 1,
  /* Reporter to use. JSON for AI parsing, also CLI for humans */
  reporter: [
    ['list'],
    ['json', { outputFile: 'prod-test-results/results.json' }],
    ['html', { open: 'never', outputFolder: 'prod-test-results/html-report' }],
  ],

  /* Shared settings for all projects below. */
  use: {
    /* ── PRODUCTION BASE URL ── */
    baseURL: 'https://apartment-management-platform-beta.vercel.app',

    /* ── CLOUD LATENCY TIMEOUTS ── */
    /* Navigation timeout: 30s for cold-start SSR */
    navigationTimeout: 30000,
    /* Action timeout: 15s for DOM interactions */
    actionTimeout: 15000,

    /* ── CORS & EXTERNAL NAVIGATION ── */
    /* Allow navigation to external domains (Razorpay, etc.) */
    bypassCSP: true,
    /* Ignore HTTPS errors (if any mixed-content issues) */
    ignoreHTTPSErrors: false,

    /* ── BROWSER CONTEXT ── */
    /* Set geolocation to India for consistent locale testing */
    locale: 'en-IN',
    /* Set timezone to IST */
    timezoneId: 'Asia/Kolkata',
    /* Color scheme for visual consistency */
    colorScheme: 'light',

    /* ── TRACE & DEBUG ── */
    /* Collect trace when retrying the failed test */
    trace: 'retain-on-failure',
    /* Capture screenshot on failure */
    screenshot: 'only-on-failure',
    /* Record video for visual debugging */
    video: 'retain-on-failure',
  },

  /* ── NO webServer — live production only ── */

  /* Configure projects for major browser */
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],

  /* ── GLOBAL EXPECT TIMEOUT ── */
  expect: {
    /* Increased from default 5s to 15s for cloud API latency */
    timeout: 15000,
  },
});
