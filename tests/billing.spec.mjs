/**
 * Financial Engine E2E Tests — Phase 17
 *
 * Tests the split-billing mathematical logic and strict data isolation rules
 * to ensure residents only ever see their own dues.
 *
 * Scenarios:
 *   1. Split Equally Across ALL Flats — Admin creates ₹2000 expense
 *   2. Data Isolation & Math — ResidentA sees ₹1000, ResidentB sees ₹1000
 *   3. Targeted Splitting — Admin creates ₹500 expense targeted to Flat101 only
 *
 * ── PRODUCTION MODE (PROD_RUN=true) ──
 *   ENTIRE SUITE IS SKIPPED because these tests create/modify real expense/bill
 *   data in the live MongoDB Atlas database, which would corrupt production
 *   financial records. Additionally, clicking "Pay" buttons would trigger
 *   real Razorpay payment orders, incurring real transaction fees.
 *
 *   Tag: @skip-in-prod
 */

import { test, expect } from '@playwright/test';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { isProdRun } from './prod-helpers.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ── SKIP ALL BILLING TESTS IN PRODUCTION ───────────────────────────
// These tests create real expenses and bills in the database, and would
// trigger real Razorpay payment orders if Pay buttons were clicked.
// This is destructive to production financial data.
if (isProdRun()) {
  test.describe('Financial Engine E2E Tests (@skip-in-prod)', () => {
    test.skip('Skipped in production — would modify real financial data and trigger Razorpay payment orders', async () => {});
  });
} else {
  // ── Local test execution (original behavior) ──────────────────────

  // ── Load test user credentials ──────────────────────────────────────
  const usersPath = path.join(__dirname, '.auth', 'users.json');
  if (!fs.existsSync(usersPath)) {
    throw new Error(
      '❌ Test users not found. Run "node tests/setup.mjs" first to seed test data.'
    );
  }
  const USERS = JSON.parse(fs.readFileSync(usersPath, 'utf-8'));

  // ── Shared error monitoring ─────────────────────────────────────────
  const HTTP_ERROR_CODES = [400, 401, 402, 403, 404, 405, 500, 501, 502, 503];

  /**
   * Navigate to login page, authenticate as the given user, and wait for
   * the role-specific dashboard to load.
   */
  async function loginAs(page, email, password, expectedUrlPattern) {
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    await page.waitForSelector('input[type="email"]', { timeout: 15000 });
    await page.locator('input[type="email"]').pressSequentially(email, { delay: 100 });
    await page.locator('input[type="password"]').pressSequentially(password, { delay: 100 });
    await page.click('button[type="submit"]');
    await page.waitForURL(expectedUrlPattern, { timeout: 15000 });
  }

  /**
   * Attach console.error and HTTP error listeners to a page.
   */
  function attachErrorListeners(page, errors) {
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
  }

  // ═════════════════════════════════════════════════════════════════════
  //  TEST SUITE
  // ═════════════════════════════════════════════════════════════════════
  test.describe('Financial Engine E2E Tests', () => {
    test.describe.configure({ mode: 'serial' });

    // ═══════════════════════════════════════════════════════════════════
    //  SCENARIO 1: Split Equally Across ALL Flats
    // ═══════════════════════════════════════════════════════════════════
    test('Scenario 1: Split Equally Across ALL Flats', async ({ browser }) => {
      test.setTimeout(90000);

      const errors = [];
      const context = await browser.newContext();
      const page = await context.newPage();
      attachErrorListeners(page, errors);

      // Login as SuperAdmin — wait for /admin-dashboard
      await loginAs(page, USERS.superAdmin.email, USERS.superAdmin.password, '**/admin-dashboard');

      // Navigate to the billing page
      await page.goto('/bills');
      await page.waitForLoadState('networkidle');

      // Wait for the expense form to be fully rendered
      await page.waitForSelector('input[placeholder="e.g., Lift Maintenance"]', { timeout: 15000 });

      // ── Fill expense form ──
      const expenseTitle = 'E2E-ALL-Split-2000';
      await page.locator('input[placeholder="e.g., Lift Maintenance"]').pressSequentially(expenseTitle, { delay: 100 });
      await page.locator('input[placeholder="e.g., 50000"]').pressSequentially('2000', { delay: 100 });

      // Set date to today
      const today = new Date().toISOString().split('T')[0];
      await page.locator('input[type="date"]').pressSequentially(today, { delay: 100 });

      // Ensure "ALL" radio is selected (should be default)
      await page.check('input[type="radio"][value="ALL"]');

      // Click "Record Expense"
      await page.click('button:has-text("Record Expense")');

      // Wait for the expense to be created and the table to re-render
      await page.waitForTimeout(3000);

      // Verify the "All Flats" badge appears in the expenses table for this expense
      const allFlatsBadge = page.locator('span:has-text("All Flats")').first();
      await expect(allFlatsBadge).toBeVisible();

      // Also verify the expense row shows the correct title
      await expect(page.locator(`td:has-text("${expenseTitle}")`).first()).toBeVisible();

      // No console errors or HTTP errors
      expect(errors.filter((e) => e.type === 'console.error')).toEqual([]);

      await context.close();
    });

    // ═══════════════════════════════════════════════════════════════════
    //  SCENARIO 2: Data Isolation & Math Verification
    // ═══════════════════════════════════════════════════════════════════
    test('Scenario 2: Data Isolation & Math Verification', async ({ browser }) => {
      test.setTimeout(90000);

      // ── 2a. Resident A — should see exactly ₹1000 ──
      const errorsA = [];
      const contextA = await browser.newContext();
      const pageA = await contextA.newPage();
      attachErrorListeners(pageA, errorsA);

      await loginAs(pageA, USERS.residentA.email, USERS.residentA.password, '**/dashboard');
      await pageA.goto('/bills');
      await pageA.waitForLoadState('networkidle');

      await pageA.waitForSelector('h2:has-text("Pending Bills")', { timeout: 15000 });
      await pageA.waitForTimeout(2000);

      const pendingBadgeA = pageA.locator('h2:has-text("Pending Bills") span').first();
      await expect(pendingBadgeA).toHaveText('1', { timeout: 10000 });

      await expect(pageA.locator('text=₹1000').first()).toBeVisible();
      await expect(pageA.locator('button:has-text("Pay ₹1000")').first()).toBeVisible();

      expect(errorsA.filter((e) => e.type === 'console.error')).toEqual([]);
      await contextA.close();

      // ── 2b. Resident B — should also see exactly ₹1000 ──
      const errorsB = [];
      const contextB = await browser.newContext();
      const pageB = await contextB.newPage();
      attachErrorListeners(pageB, errorsB);

      await loginAs(pageB, USERS.residentB.email, USERS.residentB.password, '**/dashboard');
      await pageB.goto('/bills');
      await pageB.waitForLoadState('networkidle');

      await pageB.waitForSelector('h2:has-text("Pending Bills")', { timeout: 15000 });

      const pendingBadgeB = pageB.locator('h2:has-text("Pending Bills") span').first();
      await expect(pendingBadgeB).toHaveText('1');

      await expect(pageB.locator('text=₹1000').first()).toBeVisible();
      await expect(pageB.locator('button:has-text("Pay ₹1000")').first()).toBeVisible();

      expect(errorsB.filter((e) => e.type === 'console.error')).toEqual([]);
      await contextB.close();
    });

    // ═══════════════════════════════════════════════════════════════════
    //  SCENARIO 3: Targeted Splitting
    // ═══════════════════════════════════════════════════════════════════
    test('Scenario 3: Targeted Splitting', async ({ browser }) => {
      test.setTimeout(90000);

      // ── 3a. Admin creates TARGET expense for Flat101 only ──
      const errorsAdmin = [];
      const adminContext = await browser.newContext();
      const adminPage = await adminContext.newPage();
      attachErrorListeners(adminPage, errorsAdmin);

      await loginAs(adminPage, USERS.superAdmin.email, USERS.superAdmin.password, '**/admin-dashboard');
      await adminPage.goto('/bills');
      await adminPage.waitForLoadState('networkidle');

      await adminPage.waitForSelector('input[placeholder="e.g., Lift Maintenance"]', { timeout: 15000 });

      const expenseTitleTarget = 'E2E-TARGET-Flat101-500';
      await adminPage.locator('input[placeholder="e.g., Lift Maintenance"]').pressSequentially(expenseTitleTarget, { delay: 100 });
      await adminPage.locator('input[placeholder="e.g., 50000"]').pressSequentially('500', { delay: 100 });

      const today = new Date().toISOString().split('T')[0];
      await adminPage.locator('input[type="date"]').pressSequentially(today, { delay: 100 });

      await adminPage.click('label:has-text("Target specific flats")');
      await adminPage.waitForTimeout(500);

      const targetFlatsInput = adminPage.locator('input[placeholder="e.g. A-101, A-102, B-201"]');
      await expect(targetFlatsInput).toBeVisible({ timeout: 5000 });
      await targetFlatsInput.pressSequentially('101', { delay: 100 });

      await adminPage.click('button:has-text("Record Expense")');
      await adminPage.waitForTimeout(3000);

      const targetedBadge = adminPage.locator('span:has-text("Targeted")').first();
      await expect(targetedBadge).toBeVisible();

      expect(errorsAdmin.filter((e) => e.type === 'console.error')).toEqual([]);
      await adminContext.close();

      // ── 3b. Resident A — should now have 2 bills (₹1000 + ₹500) ──
      const errorsA = [];
      const contextA = await browser.newContext();
      const pageA = await contextA.newPage();
      attachErrorListeners(pageA, errorsA);

      await loginAs(pageA, USERS.residentA.email, USERS.residentA.password, '**/dashboard');
      await pageA.goto('/bills');
      await pageA.waitForLoadState('networkidle');
      await pageA.waitForSelector('h2:has-text("Pending Bills")', { timeout: 15000 });

      const pendingBadgeA = pageA.locator('h2:has-text("Pending Bills") span').first();
      await expect(pendingBadgeA).toHaveText('2');

      await expect(pageA.locator('text=₹1000').first()).toBeVisible();
      await expect(pageA.locator('text=₹500').first()).toBeVisible();

      await expect(pageA.locator('button:has-text("Pay ₹1000")').first()).toBeVisible();
      await expect(pageA.locator('button:has-text("Pay ₹500")').first()).toBeVisible();

      expect(errorsA.filter((e) => e.type === 'console.error')).toEqual([]);
      await contextA.close();

      // ── 3c. Resident B — should still have 1 bill of ₹1000 ──
      const errorsB = [];
      const contextB = await browser.newContext();
      const pageB = await contextB.newPage();
      attachErrorListeners(pageB, errorsB);

      await loginAs(pageB, USERS.residentB.email, USERS.residentB.password, '**/dashboard');
      await pageB.goto('/bills');
      await pageB.waitForLoadState('networkidle');
      await pageB.waitForSelector('h2:has-text("Pending Bills")', { timeout: 15000 });

      const pendingBadgeB = pageB.locator('h2:has-text("Pending Bills") span').first();
      await expect(pendingBadgeB).toHaveText('1');

      await expect(pageB.locator('text=₹1000').first()).toBeVisible();
      await expect(pageB.locator('button:has-text("Pay ₹1000")').first()).toBeVisible();
      await expect(pageB.locator('text=₹500')).toHaveCount(0);

      expect(errorsB.filter((e) => e.type === 'console.error')).toEqual([]);
      await contextB.close();
    });
  });
}
