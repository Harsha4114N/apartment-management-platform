/**
 * Production Post-Deployment Verification Helpers
 *
 * Provides:
 *   1. Credential loading from tests/.auth/prod-users.json
 *   2. Production mode detection (process.env.PROD_RUN)
 *   3. Shared error monitoring (reused from original tests, but with prod URL filtering)
 *   4. Prod-specific login helper with longer timeouts
 *
 * Usage:
 *   import { isProdRun, getProdUsers, attachErrorListeners, loginAs } from './prod-helpers.mjs';
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { expect } from '@playwright/test';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ── Production mode flag ───────────────────────────────────────────
export function isProdRun() {
  return process.env.PROD_RUN === 'true';
}

// ── Load production credentials ────────────────────────────────────
const prodUsersPath = path.join(__dirname, '.auth', 'prod-users.json');

/**
 * Returns the production test user credentials.
 * Throws a clear error if the file doesn't exist or is malformed.
 * Only call this when isProdRun() is true.
 */
export function getProdUsers() {
  if (!fs.existsSync(prodUsersPath)) {
    throw new Error(
      '\n' +
      '  ┌─────────────────────────────────────────────────────────────┐\n' +
      '  │  ❌ PRODUCTION CREDENTIALS NOT FOUND                        │\n' +
      '  ├─────────────────────────────────────────────────────────────┤\n' +
      '  │  Please create tests/.auth/prod-users.json with the         │\n' +
      '  │  credentials for live Admin, Resident, and Security users.  │\n' +
      '  │                                                             │\n' +
      '  │  Use tests/.auth/prod-users.json.example as a template.    │\n' +
      '  └─────────────────────────────────────────────────────────────┘\n'
    );
  }

  try {
    const raw = fs.readFileSync(prodUsersPath, 'utf-8');
    const data = JSON.parse(raw);

    // Validate required fields
    const required = [
      ['superAdmin', 'email'],
      ['superAdmin', 'password'],
      ['residentA', 'email'],
      ['residentA', 'password'],
      ['security', 'email'],
      ['security', 'password'],
    ];

    for (const [user, field] of required) {
      if (!data[user]?.[field]) {
        throw new Error(`Missing ${user}.${field} in prod-users.json`);
      }
    }

    return data;
  } catch (err) {
    if (err.code === 'ENOENT') {
      throw new Error(
        '\n  ❌ Production credentials file not found at: ' + prodUsersPath + '\n' +
        '     Run: cp tests/.auth/prod-users.json.example tests/.auth/prod-users.json\n' +
        '     Then fill in the live user credentials.\n'
      );
    }
    throw new Error(`\n  ❌ Invalid prod-users.json: ${err.message}\n`);
  }
}

// ── HTTP error codes to monitor ────────────────────────────────────
const HTTP_ERROR_CODES = [400, 401, 402, 403, 404, 405, 500, 501, 502, 503];

/**
 * Attach console.error and HTTP error listeners to a page.
 * In production mode, filters to the app's own domain.
 */
export function attachErrorListeners(page, errors) {
  page.on('console', (msg) => {
    if (msg.type() === 'error') {
      errors.push({ type: 'console.error', text: msg.text() });
      console.log(`  [CONSOLE ERROR] ${msg.text()}`);
    }
  });

  page.on('response', (response) => {
    const status = response.status();
    if (HTTP_ERROR_CODES.includes(status)) {
      const url = response.url();
      // In production, filter to our own API domain only
      if (isProdRun()) {
        if (
          url.includes('apartment-management-platform') ||
          url.includes('render.com')
        ) {
          errors.push({ type: 'HTTP Error', status, url });
          console.log(`  [HTTP ${status}] ${url}`);
        }
      } else {
        // Local: only localhost
        if (url.startsWith('http://localhost')) {
          errors.push({ type: 'HTTP Error', status, url });
          console.log(`  [HTTP ${status}] ${url}`);
        }
      }
    }
  });
}

/**
 * Production login helper with generous timeouts.
 *
 * Navigates to the login page, fills credentials, submits,
 * and waits for the expected URL pattern.
 */
export async function loginAs(page, email, password, expectedUrlPattern, options = {}) {
  const timeout = options.timeout || 30000;

  await page.goto('/login', { waitUntil: 'networkidle', timeout });
  
  // Wait for the email input to be visible
  await page.waitForSelector('input[type="email"]', { timeout: 20000 });

  // Fill credentials with human-like delay
  await page.locator('input[type="email"]').pressSequentially(email, { delay: 80 });
  await page.locator('input[type="password"]').pressSequentially(password, { delay: 80 });
  
  // Click submit
  await page.click('button[type="submit"]');

  // Wait for React Router to navigate to the expected dashboard
  await page.waitForURL(expectedUrlPattern, { timeout: 30000 });

  // Wait for the page content to fully settle
  await page.waitForLoadState('networkidle');
}
