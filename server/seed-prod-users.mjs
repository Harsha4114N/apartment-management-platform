#!/usr/bin/env node
/**
 * seed-prod-users.mjs — Seed MongoDB Atlas with Production Test Users
 *
 * Connects to the production MongoDB Atlas cluster (via MONGO_URI in .env)
 * and creates/upserts:
 *   1. A default Society ("Sunrise Residency")
 *   2. SuperAdmin  → superadmin@example.com / AdminPass123!
 *   3. Resident A  → residenta@example.com  / ResidentPass123!  (Flat 101)
 *   4. Security    → security@example.com   / SecurityPass123!
 *
 * Safe to run multiple times — all operations use upsert logic.
 *
 * Usage:
 *   node server/seed-prod-users.mjs
 */

import 'dotenv/config';
import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import User from './models/User.js';
import Society from './models/Society.js';
import Flat from './models/Flat.js';

const SALT_ROUNDS = 10;

// ── Configuration ────────────────────────────────────────────────────
const SOCIETY_NAME = 'Sunrise Residency';
const SOCIETY_ADDRESS = '123 Sunrise Avenue, Bangalore, Karnataka 560001';
const JOIN_CODE = 'PROD01';

const ACCOUNTS = {
  superAdmin: {
    email: 'superadmin@example.com',
    password: 'AdminPass123!',
    fullName: 'Production SuperAdmin',
    role: 'SuperAdmin',
    approvalStatus: 'Approved',
  },
  residentA: {
    email: 'residenta@example.com',
    password: 'ResidentPass123!',
    fullName: 'Production Resident A',
    role: 'Resident',
    approvalStatus: 'Approved',
    flatNumber: '101',
  },
  security: {
    email: 'security@example.com',
    password: 'SecurityPass123!',
    fullName: 'Production Security Guard',
    role: 'Security',
    approvalStatus: 'Approved',
  },
};

// ── Helpers ──────────────────────────────────────────────────────────

function log(msg, ok = true) {
  const icon = ok ? '✓' : '✖';
  console.log(`  ${icon} ${msg}`);
}

function divider(title) {
  console.log(`\n━━━ ${title} ━━━`);
}

// ── Main ─────────────────────────────────────────────────────────────

async function main() {
  console.log('');
  console.log('╔══════════════════════════════════════════════════════════════╗');
  console.log('║   🌱  NexusGate — Production User Seed                      ║');
  console.log('║   Target: MongoDB Atlas (production cluster)                 ║');
  console.log('╚══════════════════════════════════════════════════════════════╝');
  console.log('');

  // ── Step 1: Connect to MongoDB Atlas ──
  divider('Connecting to MongoDB Atlas');

  const MONGO_URI = process.env.MONGO_URI;
  if (!MONGO_URI) {
    console.error('  ✖ MONGO_URI not found in environment variables.');
    console.error('  ℹ  Ensure server/.env exists with MONGO_URI set.');
    process.exit(1);
  }

  // Mask credentials for logging
  const maskedUri = MONGO_URI.replace(/\/\/[^:]+:[^@]+@/, '//***:***@');
  console.log(`  Connecting to: ${maskedUri}`);

  await mongoose.connect(MONGO_URI, {
    serverSelectionTimeoutMS: 15000,
    connectTimeoutMS: 15000,
  });
  log('Connected to MongoDB Atlas');
  console.log(`  Database: ${mongoose.connection.db.databaseName}`);

  // ── Step 2: Find or create Society ──
  divider('Society Setup');

  let society = await Society.findOne({ name: SOCIETY_NAME });

  if (society) {
    log(`Found existing society: "${SOCIETY_NAME}" (ID: ${society._id})`);
    log(`  Join code: ${society.uniqueJoinCode}`);
  } else {
    // Pre-generate IDs for the society (superAdmin will be updated after user creation)
    const societyId = new mongoose.Types.ObjectId();

    society = new Society({
      _id: societyId,
      name: SOCIETY_NAME,
      address: SOCIETY_ADDRESS,
      uniqueJoinCode: JOIN_CODE,
      superAdmin: societyId, // Placeholder — updated after SuperAdmin creation
      maintenanceFee: 2000,
    });

    await society.save();
    log(`Created new society: "${SOCIETY_NAME}" (ID: ${society._id})`);
    log(`  Join code: ${JOIN_CODE}`);
  }

  // ── Step 3: Hash passwords ──
  divider('Hashing Passwords');

  const hashPromises = Object.entries(ACCOUNTS).map(async ([key, acct]) => {
    const salt = await bcrypt.genSalt(SALT_ROUNDS);
    const hashedPassword = await bcrypt.hash(acct.password, salt);
    return [key, { ...acct, hashedPassword }];
  });
  const hashEntries = await Promise.all(hashPromises);
  const accountsWithHashes = Object.fromEntries(hashEntries);
  log(`${Object.keys(accountsWithHashes).length} passwords hashed with bcrypt`);

  // ── Step 4: Create / upsert users ──
  divider('Creating / Upserting Users');

  let superAdminUser = null;
  let residentUser = null;

  for (const [key, acct] of Object.entries(accountsWithHashes)) {
    const existingUser = await User.findOne({ email: acct.email.toLowerCase().trim() });

    if (existingUser) {
      // Update existing user's password and ensure correct society/settings
      existingUser.password = acct.hashedPassword;
      existingUser.fullName = acct.fullName;
      existingUser.role = acct.role;
      existingUser.approvalStatus = acct.approvalStatus;
      existingUser.societyId = society._id;
      await existingUser.save();

      log(`Updated existing user: ${acct.email} (${acct.role})`);
      if (key === 'superAdmin') superAdminUser = existingUser;
      if (key === 'residentA') residentUser = existingUser;
    } else {
      // Create new user
      const user = new User({
        email: acct.email.toLowerCase().trim(),
        password: acct.hashedPassword,
        fullName: acct.fullName,
        role: acct.role,
        approvalStatus: acct.approvalStatus,
        societyId: society._id,
      });
      await user.save();

      log(`Created new user: ${acct.email} (${acct.role}, ID: ${user._id})`);
      if (key === 'superAdmin') superAdminUser = user;
      if (key === 'residentA') residentUser = user;
    }
  }

  // ── Step 5: Ensure Society.superAdmin references the SuperAdmin user ──
  divider('Verifying Society → SuperAdmin Link');

  if (superAdminUser && !society.superAdmin.equals(superAdminUser._id)) {
    society.superAdmin = superAdminUser._id;
    await society.save();
    log(`Society.superAdmin updated to: ${superAdminUser.email}`);
  } else {
    log(`Society.superAdmin already points to: ${superAdminUser?.email || society.superAdmin}`);
  }

  // ── Step 6: Create / update Flat 101 for Resident A ──
  divider('Flat 101 Setup');

  if (residentUser) {
    let flat101 = await Flat.findOne({ flatNumber: '101', societyId: society._id });

    if (flat101) {
      // Add resident to tenants if not already present
      if (!flat101.currentTenants.some((id) => id.equals(residentUser._id))) {
        flat101.currentTenants.push(residentUser._id);
        await flat101.save();
        log(`Added Resident A to existing Flat 101 tenants`);
      } else {
        log(`Resident A already linked to Flat 101`);
      }

      // Set owner if not already set
      if (!flat101.owner) {
        flat101.owner = residentUser._id;
        await flat101.save();
        log(`Set Resident A as Flat 101 owner`);
      }
    } else {
      flat101 = new Flat({
        flatNumber: '101',
        societyId: society._id,
        owner: residentUser._id,
        currentTenants: [residentUser._id],
      });
      await flat101.save();
      log(`Created Flat 101 with Resident A as owner/tenant`);
    }
  } else {
    log(`Resident A not found — skipping Flat 101 creation`, false);
  }

  // ── Summary ──
  divider('Seed Summary');

  const totalUsers = await User.countDocuments({ societyId: society._id });
  const totalFlats = await Flat.countDocuments({ societyId: society._id });

  console.log(`  Society:     "${SOCIETY_NAME}" (Join Code: ${society.uniqueJoinCode})`);
  console.log(`  Users:       ${totalUsers} total in society`);
  console.log(`  Flats:       ${totalFlats} total in society`);
  console.log('');
  console.log('  ── Credentials ──');
  console.log('  SuperAdmin:  superadmin@example.com / AdminPass123!');
  console.log('  Resident A:  residenta@example.com  / ResidentPass123!');
  console.log('  Security:    security@example.com   / SecurityPass123!');
  console.log('');
  console.log('  ℹ  These credentials are also in tests/.auth/prod-users.json');
  console.log('');

  await mongoose.disconnect();
  log('Disconnected from MongoDB Atlas');

  console.log('');
  console.log('╔══════════════════════════════════════════════════════════════╗');
  console.log('║   ✅  Seeding Complete                                      ║');
  console.log('║   Run "node run-prod-qa.mjs" to verify production deployment ║');
  console.log('╚══════════════════════════════════════════════════════════════╝');
  console.log('');
}

main().catch((err) => {
  console.error('\n  ✖ Seed failed:', err.message);
  if (err.stack) console.error(err.stack);
  process.exit(1);
});
