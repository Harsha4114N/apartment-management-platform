/**
 * Test Setup Script
 *
 * Seeds the database with test users before E2E tests run.
 * Run via: node tests/setup.mjs
 *
 * This script:
 * 1. Registers a Society + SuperAdmin
 * 2. Registers Resident A (Flat 101) and Resident B (Flat 102)
 * 3. Registers a Security guard
 * 4. Logs in as SuperAdmin, approves all pending users
 * 5. Fetches flat IDs from directory endpoint
 * 6. Saves credentials to tests/.auth/users.json
 */

import axios from 'axios';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const API_BASE = 'http://localhost:5000';
const timestamp = Date.now();

// ── Test User Credentials ──────────────────────────────────────────────
const CREDENTIALS = {
  superAdmin: {
    fullName: 'Test SuperAdmin',
    email: `superadmin_${timestamp}@test.com`,
    password: 'TestPass123!',
    role: 'SuperAdmin',
  },
  residentA: {
    fullName: 'Test Resident A',
    email: `resident_a_${timestamp}@test.com`,
    password: 'TestPass123!',
    role: 'Resident',
    flatNumber: '101',
  },
  residentB: {
    fullName: 'Test Resident B',
    email: `resident_b_${timestamp}@test.com`,
    password: 'TestPass123!',
    role: 'Resident',
    flatNumber: '102',
  },
  security: {
    fullName: 'Test Security',
    email: `security_${timestamp}@test.com`,
    password: 'TestPass123!',
    role: 'Security',
  },
};

let societyJoinCode = '';
let superAdminToken = '';
let residentAId = '';
let residentBId = '';
let securityId = '';

async function step(label, fn) {
  process.stdout.write(`  ⏳ ${label}... `);
  try {
    await fn();
    process.stdout.write('✅\n');
  } catch (err) {
    process.stdout.write('❌\n');
    console.error(`\n  ✖ Failed: ${label}`);
    console.error(`    ${err.response?.status || ''} ${err.response?.data?.message || err.message}`);
    throw err;
  }
}

async function setup() {
  console.log('\n═════════════════════════════════════════');
  console.log('  E2E Test Data Setup — Phase 17');
  console.log('═════════════════════════════════════════\n');

  // ── 1. Register Society + SuperAdmin ──
  await step('Register Society + SuperAdmin', async () => {
    const res = await axios.post(`${API_BASE}/api/auth/register-society`, {
      fullName: CREDENTIALS.superAdmin.fullName,
      email: CREDENTIALS.superAdmin.email,
      password: CREDENTIALS.superAdmin.password,
      societyName: `Test Society ${timestamp}`,
      address: '123 Test Street, Test City',
    });
    superAdminToken = res.data.token;
    societyJoinCode = res.data.society.uniqueJoinCode;
    CREDENTIALS.superAdmin.societyId = res.data.society.id;
    CREDENTIALS.superAdmin.id = res.data.user.id;
  });

  // ── 2a. Register Resident A (Flat 101) ──
  await step('Register Resident A (Flat 101)', async () => {
    const res = await axios.post(`${API_BASE}/api/auth/register-resident`, {
      fullName: CREDENTIALS.residentA.fullName,
      email: CREDENTIALS.residentA.email,
      password: CREDENTIALS.residentA.password,
      uniqueJoinCode: societyJoinCode,
      flatNumber: CREDENTIALS.residentA.flatNumber,
    });
  });

  // ── 2b. Register Resident B (Flat 102) ──
  await step('Register Resident B (Flat 102)', async () => {
    const res = await axios.post(`${API_BASE}/api/auth/register-resident`, {
      fullName: CREDENTIALS.residentB.fullName,
      email: CREDENTIALS.residentB.email,
      password: CREDENTIALS.residentB.password,
      uniqueJoinCode: societyJoinCode,
      flatNumber: CREDENTIALS.residentB.flatNumber,
    });
  });

  // ── 3. Register Security Guard ──
  await step('Register Security Guard', async () => {
    await axios.post(`${API_BASE}/api/auth/register-security`, {
      fullName: CREDENTIALS.security.fullName,
      email: CREDENTIALS.security.email,
      password: CREDENTIALS.security.password,
      uniqueJoinCode: societyJoinCode,
    });
  });

  // ── 4. Fetch Pending Users to get their IDs ──
  await step('Fetch pending users (to get IDs)', async () => {
    const res = await axios.get(`${API_BASE}/api/admin/pending-users`, {
      headers: { Authorization: `Bearer ${superAdminToken}` },
    });
    const pending = res.data;
    for (const user of pending) {
      if (user.email === CREDENTIALS.residentA.email) {
        residentAId = user._id;
      }
      if (user.email === CREDENTIALS.residentB.email) {
        residentBId = user._id;
      }
      if (user.email === CREDENTIALS.security.email) {
        securityId = user._id;
      }
    }
    if (!residentAId) throw new Error('Resident A not found in pending users');
    if (!residentBId) throw new Error('Resident B not found in pending users');
    if (!securityId) throw new Error('Security not found in pending users');
  });

  // ── 5a. Approve Resident A ──
  await step('Approve Resident A', async () => {
    await axios.post(
      `${API_BASE}/api/admin/approve-user`,
      { userId: residentAId, action: 'Approved' },
      { headers: { Authorization: `Bearer ${superAdminToken}` } }
    );
  });

  // ── 5b. Approve Resident B ──
  await step('Approve Resident B', async () => {
    await axios.post(
      `${API_BASE}/api/admin/approve-user`,
      { userId: residentBId, action: 'Approved' },
      { headers: { Authorization: `Bearer ${superAdminToken}` } }
    );
  });

  // ── 5c. Approve Security ──
  await step('Approve Security Guard', async () => {
    await axios.post(
      `${API_BASE}/api/admin/approve-user`,
      { userId: securityId, action: 'Approved' },
      { headers: { Authorization: `Bearer ${superAdminToken}` } }
    );
  });

  // ── 6. Fetch Directory to get flatId for each resident ──
  let residentAFlatId = '';
  let residentBFlatId = '';
  await step('Fetch directory (to get flat IDs)', async () => {
    const res = await axios.get(`${API_BASE}/api/directory`, {
      headers: { Authorization: `Bearer ${superAdminToken}` },
    });
    const directory = res.data;
    for (const entry of directory) {
      if (entry.name === CREDENTIALS.residentA.fullName) {
        residentAFlatId = entry.flatId;
      }
      if (entry.name === CREDENTIALS.residentB.fullName) {
        residentBFlatId = entry.flatId;
      }
    }
    if (!residentAFlatId) throw new Error('Flat ID not found for Resident A');
    if (!residentBFlatId) throw new Error('Flat ID not found for Resident B');
    console.log(`\n    Resident A flatId: ${residentAFlatId}`);
    console.log(`    Resident B flatId: ${residentBFlatId}`);
  });

  // ── 7. Save credentials to JSON file ──
  const authDir = path.join(__dirname, '.auth');
  if (!fs.existsSync(authDir)) {
    fs.mkdirSync(authDir, { recursive: true });
  }

  const credentialsPath = path.join(authDir, 'user-credentials.json');
  fs.writeFileSync(credentialsPath, JSON.stringify(CREDENTIALS, null, 2));
  console.log(`\n  📝 Credentials saved to: ${credentialsPath}`);

  // Also save a clean per-user file for the Playwright tests
  const usersPath = path.join(authDir, 'users.json');
  const usersData = {
    superAdmin: {
      email: CREDENTIALS.superAdmin.email,
      password: CREDENTIALS.superAdmin.password,
      role: 'SuperAdmin',
      name: CREDENTIALS.superAdmin.fullName,
      token: superAdminToken,
    },
    residentA: {
      email: CREDENTIALS.residentA.email,
      password: CREDENTIALS.residentA.password,
      role: 'Resident',
      name: CREDENTIALS.residentA.fullName,
      flatNumber: CREDENTIALS.residentA.flatNumber,
      flatId: residentAFlatId,
    },
    residentB: {
      email: CREDENTIALS.residentB.email,
      password: CREDENTIALS.residentB.password,
      role: 'Resident',
      name: CREDENTIALS.residentB.fullName,
      flatNumber: CREDENTIALS.residentB.flatNumber,
      flatId: residentBFlatId,
    },
    security: {
      email: CREDENTIALS.security.email,
      password: CREDENTIALS.security.password,
      role: 'Security',
      name: CREDENTIALS.security.fullName,
    },
    // Backward-compatible alias for the Phase 16 auth spec
    resident: {
      email: CREDENTIALS.residentA.email,
      password: CREDENTIALS.residentA.password,
      role: 'Resident',
      name: CREDENTIALS.residentA.fullName,
      flatNumber: CREDENTIALS.residentA.flatNumber,
      flatId: residentAFlatId,
    },
    society: {
      joinCode: societyJoinCode,
    },
  };
  fs.writeFileSync(usersPath, JSON.stringify(usersData, null, 2));
  console.log(`  📝 Users data saved to: ${usersPath}`);

  console.log('\n═════════════════════════════════════════');
  console.log('  ✅ Setup complete! Ready for E2E tests.');
  console.log('═════════════════════════════════════════\n');
}

setup().catch((err) => {
  console.error('\n❌ Setup failed:', err.message);
  process.exit(1);
});
