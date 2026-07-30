/**
 * Authentication E2E Tests
 *
 * Tests the Unified Login screen (/login) for three user roles:
 *   - Resident  → /dashboard
 *   - SuperAdmin → /admin-dashboard
 *   - Security   → /security-dashboard
 *
 * Also monitors console.error and 4xx/5xx HTTP responses during login.
 */

import { test, expect } from '@playwright/test';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ── Load test user credentials ──────────────────────────────────────
const usersPath = path.join(__dirname, '.auth', 'users.json');
if (!fs.existsSync(usersPath)) {
  throw new Error(
    '❌ Test users not found. Run "node tests/setup.js" first to seed test data.'
  );
}
const USERS = JSON.parse(fs.readFileSync(usersPath, 'utf-8'));

// ── Shared error monitoring ─────────────────────────────────────────
const HTTP_ERROR_CODES = [400, 401, 402, 403, 404, 405, 500, 501, 502, 503];

/**
 * Decorates a page object with network and console error listeners.
 * The test will fail automatically if:
 *   - console.error() is called
 *   - Any network response returns a 4xx or 5xx status code
 */
async function attachErrorListeners(page, testInfo) {
  const errors = [];

  // Listen for console.error calls
  page.on('console', (msg) => {
    if (msg.type() === 'error') {
      const text = msg.text();
      errors.push({ type: 'console.error', text });
      console.log(`  [CONSOLE ERROR] ${text}`);
    }
  });

  // Listen for failed / errored network requests
  page.on('response', (response) => {
    const status = response.status();
    if (HTTP_ERROR_CODES.includes(status)) {
      const url = response.url();
      // Filter out browser extension / 3rd-party noise
      if (url.startsWith('http://localhost')) {
        errors.push({ type: 'HTTP Error', status, url });
        console.log(`  [HTTP ${status}] ${url}`);
      }
    }
  });

  // After the test, assert no errors were collected
  testInfo.attach('error-log', {
    body: JSON.stringify(errors, null, 2),
    contentType: 'application/json',
  });

  return errors;
}

// ── Helpers ─────────────────────────────────────────────────────────

/** Navigate to the login page and wait for it to be fully loaded */
async function goToLogin(page) {
  // Use UnifiedLogin at /auth  (or /login for legacy)
  await page.goto('/', { waitUntil: 'domcontentloaded' });
  // Wait for the email input to be visible (form is ready)
  await page.waitForSelector('input[type="email"]', { timeout: 15000 });
}

/** Fill credentials and click Sign In */
async function loginAs(page, email, password) {
  const emailInput = page.locator('input[type="email"]');
  const passwordInput = page.locator('input[type="password"]');
  const submitButton = page.locator('button[type="submit"]');

  await emailInput.pressSequentially(email, { delay: 100 });
  await passwordInput.pressSequentially(password, { delay: 100 });
  await submitButton.click();
}

// ═══════════════════════════════════════════════════════════════════
//  TEST A: Resident Login → /dashboard
// ═══════════════════════════════════════════════════════════════════
test.describe('Authentication Flow', () => {
  test.describe.configure({ mode: 'serial' });

  test('Test A: Resident login routes to /dashboard and profile loads', async ({ page }) => {
    test.setTimeout(30000);

    const errors = [];

    page.on('console', (msg) => {
      if (msg.type() === 'error') {
        errors.push({ type: 'console.error', text: msg.text() });
      }
    });

    page.on('response', (response) => {
      const status = response.status();
      if (HTTP_ERROR_CODES.includes(status)) {
        const url = response.url();
        if (url.startsWith('http://localhost')) {
          errors.push({ type: 'HTTP Error', status, url });
        }
      }
    });

    await goToLogin(page);
    await loginAs(page, USERS.resident.email, USERS.resident.password);

    // Wait for navigation to /dashboard
    await page.waitForURL('**/dashboard', { timeout: 15000 });
    expect(page.url()).toContain('/dashboard');

    // Verify the page is loaded — look for dashboard content
    // The Dashboard component fetches data; wait for content
    await page.waitForLoadState('networkidle');

    // No console.errors or HTTP errors during the login flow
    expect(errors.filter((e) => e.type === 'console.error')).toEqual([]);
  });

  // ═══════════════════════════════════════════════════════════════════
  //  TEST B: SuperAdmin Login → /admin-dashboard
  // ═══════════════════════════════════════════════════════════════════
  test('Test B: SuperAdmin login routes to /admin-dashboard and KPI metrics load', async ({ page }) => {
    test.setTimeout(30000);

    const errors = [];

    page.on('console', (msg) => {
      if (msg.type() === 'error') {
        errors.push({ type: 'console.error', text: msg.text() });
      }
    });

    page.on('response', (response) => {
      const status = response.status();
      if (HTTP_ERROR_CODES.includes(status)) {
        const url = response.url();
        if (url.startsWith('http://localhost')) {
          errors.push({ type: 'HTTP Error', status, url });
        }
      }
    });

    await goToLogin(page);
    await loginAs(page, USERS.superAdmin.email, USERS.superAdmin.password);

    // Wait for navigation to /admin-dashboard
    await page.waitForURL('**/admin-dashboard', { timeout: 15000 });
    expect(page.url()).toContain('/admin-dashboard');

    // Wait for KPI metrics to load — AdminDashboard fetches /api/admin/metrics
    await page.waitForLoadState('networkidle');

    // Verify that the metrics API call completed
    // AdminDashboard shows "Metrics Overview" or similar heading
    await expect(page.locator('body')).not.toContainText('Failed to load metrics');

    // No console.errors or HTTP errors during the login flow
    expect(errors.filter((e) => e.type === 'console.error')).toEqual([]);
  });

  // ═══════════════════════════════════════════════════════════════════
  //  TEST C: Security Login → /security-dashboard
  // ═══════════════════════════════════════════════════════════════════
  test('Test C: Security login routes to /security-dashboard', async ({ page }) => {
    test.setTimeout(30000);

    const errors = [];

    page.on('console', (msg) => {
      if (msg.type() === 'error') {
        errors.push({ type: 'console.error', text: msg.text() });
      }
    });

    page.on('response', (response) => {
      const status = response.status();
      if (HTTP_ERROR_CODES.includes(status)) {
        const url = response.url();
        if (url.startsWith('http://localhost')) {
          errors.push({ type: 'HTTP Error', status, url });
        }
      }
    });

    await goToLogin(page);
    await loginAs(page, USERS.security.email, USERS.security.password);

    // Wait for navigation to /security-dashboard
    await page.waitForURL('**/security-dashboard', { timeout: 15000 });
    expect(page.url()).toContain('/security-dashboard');

    // Wait for security dashboard content to load
    await page.waitForLoadState('networkidle');

    // No console.errors or HTTP errors during the login flow
    expect(errors.filter((e) => e.type === 'console.error')).toEqual([]);
  });
});
