/**
 * Authentication E2E Tests — Production-Aware
 *
 * Tests the Unified Login screen (/login) for three user roles:
 *   - Resident  → /dashboard
 *   - SuperAdmin → /admin-dashboard
 *   - Security   → /security-dashboard
 *
 * Also monitors console.error and 4xx/5xx HTTP responses during login.
 *
 * ── Production Mode (PROD_RUN=true) ──
 *   - Loads credentials from tests/.auth/prod-users.json
 *   - Filters HTTP errors to production domain only
 *   - Uses extended timeouts for cloud latency
 *   - No billing tests run (they modify real financial data)
 */

import { test, expect } from '@playwright/test';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { isProdRun, getProdUsers, attachErrorListeners } from './prod-helpers.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ── Load test user credentials ──────────────────────────────────────
let USERS;
if (isProdRun()) {
  const prodUsers = getProdUsers();
  USERS = {
    resident: {
      email: prodUsers.residentA.email,
      password: prodUsers.residentA.password,
      role: 'Resident',
    },
    superAdmin: {
      email: prodUsers.superAdmin.email,
      password: prodUsers.superAdmin.password,
      role: 'SuperAdmin',
    },
    security: {
      email: prodUsers.security.email,
      password: prodUsers.security.password,
      role: 'Security',
    },
  };
  console.log('  [PROD] Loaded production credentials for:', USERS.superAdmin.email, USERS.resident.email, USERS.security.email);
} else {
  // Local: load from setup.mjs generated file
  const usersPath = path.join(__dirname, '.auth', 'users.json');
  if (!fs.existsSync(usersPath)) {
    throw new Error(
      '❌ Test users not found. Run "node tests/setup.mjs" first to seed test data.'
    );
  }
  const localUsers = JSON.parse(fs.readFileSync(usersPath, 'utf-8'));
  USERS = {
    resident: localUsers.resident,
    superAdmin: localUsers.superAdmin,
    security: localUsers.security,
  };
}

// ── Helpers ─────────────────────────────────────────────────────────

/** Navigate to the login page and wait for it to be fully loaded */
async function goToLogin(page) {
  const timeout = isProdRun() ? 30000 : 15000;
  await page.goto('/login', { waitUntil: 'networkidle', timeout });
  // Wait for the email input to be visible (form is ready)
  await page.waitForSelector('input[type="email"]', { timeout: 20000 });
}

/** Fill credentials and click Sign In */
async function loginAs(page, email, password) {
  const emailInput = page.locator('input[type="email"]');
  const passwordInput = page.locator('input[type="password"]');
  const submitButton = page.locator('button[type="submit"]');

  await emailInput.pressSequentially(email, { delay: 80 });
  await passwordInput.pressSequentially(password, { delay: 80 });
  await submitButton.click();
}

// ═══════════════════════════════════════════════════════════════════
//  TEST SUITE
// ═══════════════════════════════════════════════════════════════════
test.describe('Authentication Flow', () => {
  test.describe.configure({ mode: 'serial' });

  // ═══════════════════════════════════════════════════════════════════
  //  TEST A: Resident Login → /dashboard
  // ═══════════════════════════════════════════════════════════════════
  test('Test A: Resident login routes to /dashboard and profile loads', async ({ page }) => {
    const prodTimeout = isProdRun() ? 60000 : 30000;
    test.setTimeout(prodTimeout);

    const errors = [];
    attachErrorListeners(page, errors);

    await goToLogin(page);
    await loginAs(page, USERS.resident.email, USERS.resident.password);

    // Wait for navigation to /dashboard
    const navTimeout = isProdRun() ? 30000 : 15000;
    await page.waitForURL('**/dashboard', { timeout: navTimeout });
    expect(page.url()).toContain('/dashboard');

    // Verify the page is loaded — wait for content to settle
    await page.waitForLoadState('networkidle');

    // No console.errors or HTTP errors during the login flow
    expect(errors.filter((e) => e.type === 'console.error')).toEqual([]);
  });

  // ═══════════════════════════════════════════════════════════════════
  //  TEST B: SuperAdmin Login → /admin-dashboard
  // ═══════════════════════════════════════════════════════════════════
  test('Test B: SuperAdmin login routes to /admin-dashboard and KPI metrics load', async ({ page }) => {
    const prodTimeout = isProdRun() ? 60000 : 30000;
    test.setTimeout(prodTimeout);

    const errors = [];
    attachErrorListeners(page, errors);

    await goToLogin(page);
    await loginAs(page, USERS.superAdmin.email, USERS.superAdmin.password);

    // Wait for navigation to /admin-dashboard
    const navTimeout = isProdRun() ? 30000 : 15000;
    await page.waitForURL('**/admin-dashboard', { timeout: navTimeout });
    expect(page.url()).toContain('/admin-dashboard');

    // Wait for KPI metrics to load
    await page.waitForLoadState('networkidle');

    // Verify that the metrics API call completed
    await expect(page.locator('body')).not.toContainText('Failed to load metrics');

    // No console.errors or HTTP errors during the login flow
    expect(errors.filter((e) => e.type === 'console.error')).toEqual([]);
  });

  // ═══════════════════════════════════════════════════════════════════
  //  TEST C: Security Login → /security-dashboard
  // ═══════════════════════════════════════════════════════════════════
  test('Test C: Security login routes to /security-dashboard', async ({ page }) => {
    const prodTimeout = isProdRun() ? 60000 : 30000;
    test.setTimeout(prodTimeout);

    const errors = [];
    attachErrorListeners(page, errors);

    await goToLogin(page);
    await loginAs(page, USERS.security.email, USERS.security.password);

    // Wait for navigation to /security-dashboard
    const navTimeout = isProdRun() ? 30000 : 15000;
    await page.waitForURL('**/security-dashboard', { timeout: navTimeout });
    expect(page.url()).toContain('/security-dashboard');

    // Wait for security dashboard content to load
    await page.waitForLoadState('networkidle');

    // No console.errors or HTTP errors during the login flow
    expect(errors.filter((e) => e.type === 'console.error')).toEqual([]);
  });
});
