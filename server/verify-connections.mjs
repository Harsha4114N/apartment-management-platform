#!/usr/bin/env node
/**
 * verify-connections.mjs — NexusGate API Connection Diagnostic
 *
 * Tests connectivity for all four production services:
 *   ✅ MongoDB Atlas        (via mongoose)
 *   ✅ Cloudinary           (via cloudinary.v2.api.ping)
 *   ✅ Razorpay             (via instance + dummy order creation)
 *   ✅ Twilio               (via account fetch)
 *
 * Usage:  node verify-connections.mjs
 */

import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

// ── Load server/.env ──────────────────────────────────────────────
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.join(__dirname, '.env') });

// ── ANSI Colors ───────────────────────────────────────────────────
const GREEN = '\x1b[32m';
const RED = '\x1b[31m';
const YELLOW = '\x1b[33m';
const CYAN = '\x1b[36m';
const BOLD = '\x1b[1m';
const RESET = '\x1b[0m';

function ok(msg)  { return `${GREEN}✓ ${msg}${RESET}`; }
function fail(msg){ return `${RED}✖ ${msg}${RESET}`; }
function warn(msg){ return `${YELLOW}⚠ ${msg}${RESET}`; }

// ── Status tracking ───────────────────────────────────────────────
const results = [];

function record(service, passed, detail) {
  results.push({ service, passed, detail });
  const icon = passed ? ok('PASS') : fail('FAIL');
  console.log(`  ${icon}  ${service.padEnd(28)} ${detail}`);
}

// ═══════════════════════════════════════════════════════════════════
//  1. MongoDB Atlas
// ═══════════════════════════════════════════════════════════════════
async function testMongoDB() {
  const uri = process.env.MONGO_URI;
  if (!uri) {
    record('MongoDB Atlas', false, 'MONGO_URI is not set in .env');
    return;
  }

  // Mask password for safe logging
  const safeUri = uri.replace(/\/\/([^:]+):([^@]+)@/, '//$1:****@');
  console.log(`\n${CYAN}─── MongoDB Atlas ──────────────────────────────────${RESET}`);
  console.log(`  Endpoint: ${safeUri.substring(0, 80)}...`);

  let mongoose;
  try {
    mongoose = await import('mongoose');
    const def = mongoose.default || mongoose;
    await def.connect(uri, {
      serverSelectionTimeoutMS: 10000,
      connectTimeoutMS: 10000,
    });
    // Verify the connection is actually live
    const admin = def.connection.db.admin();
    const info = await admin.ping();
    record('MongoDB Atlas', true, `Ping OK — server responded in ${info.ok ? 'healthy' : 'unknown'} state`);
  } catch (err) {
    const msg = err.message || String(err);
    // Classify common errors
    if (msg.includes('Authentication failed') || msg.includes('bad auth')) {
      record('MongoDB Atlas', false, `Authentication failed — check MONGO_URI username/password`);
    } else if (msg.includes('ENOTFOUND') || msg.includes('getaddrinfo')) {
      record('MongoDB Atlas', false, `DNS resolution failed — check cluster hostname in MONGO_URI`);
    } else if (msg.includes('ETIMEDOUT') || msg.includes('timed out')) {
      record('MongoDB Atlas', false, `Connection timed out — check network / IP whitelist in Atlas`);
    } else {
      record('MongoDB Atlas', false, `${msg.substring(0, 120)}`);
    }
  } finally {
    if (mongoose) {
      const def = mongoose.default || mongoose;
      if (def.connection?.readyState === 1) {
        await def.connection.close();
        console.log(`  ${warn('disconnected')}  Cleaned up MongoDB connection`);
      }
    }
  }
}

// ═══════════════════════════════════════════════════════════════════
//  2. Cloudinary
// ═══════════════════════════════════════════════════════════════════
async function testCloudinary() {
  const cloudName = process.env.CLOUDINARY_CLOUD_NAME;
  const apiKey    = process.env.CLOUDINARY_API_KEY;
  const apiSecret = process.env.CLOUDINARY_API_SECRET;

  console.log(`\n${CYAN}─── Cloudinary ─────────────────────────────────────${RESET}`);
  console.log(`  Cloud:  ${cloudName || warn('not set')}`);
  console.log(`  Key:    ${apiKey ? `${apiKey.substring(0, 6)}...${apiKey.slice(-4)}` : warn('not set')}`);

  if (!cloudName || !apiKey || !apiSecret) {
    record('Cloudinary', false, 'One or more CLOUDINARY_* vars are missing in .env');
    return;
  }

  try {
    const cloudinary = await import('cloudinary');
    const v2 = cloudinary.default?.v2 || cloudinary.v2;
    v2.config({
      cloud_name: cloudName,
      api_key: apiKey,
      api_secret: apiSecret,
    });
    const result = await v2.api.ping();
    if (result.status === 'ok') {
      record('Cloudinary', true, `Ping OK — status: "${result.status}"`);
    } else {
      record('Cloudinary', true, `Responded (${JSON.stringify(result)})`);
    }
  } catch (err) {
    const msg = err.message || String(err);
    if (msg.includes('Invalid cloud name')) {
      record('Cloudinary', false, `Invalid cloud name "${cloudName}" — check CLOUDINARY_CLOUD_NAME`);
    } else if (msg.includes('Invalid api_key')) {
      record('Cloudinary', false, `API key rejected — check CLOUDINARY_API_KEY`);
    } else if (msg.includes('Invalid api_secret') || msg.includes('signature')) {
      record('Cloudinary', false, `API secret rejected — check CLOUDINARY_API_SECRET`);
    } else {
      record('Cloudinary', false, `${msg.substring(0, 120)}`);
    }
  }
}

// ═══════════════════════════════════════════════════════════════════
//  3. Razorpay
// ═══════════════════════════════════════════════════════════════════
async function testRazorpay() {
  const keyId     = process.env.RAZORPAY_KEY_ID;
  const keySecret = process.env.RAZORPAY_KEY_SECRET;

  console.log(`\n${CYAN}─── Razorpay ───────────────────────────────────────${RESET}`);
  console.log(`  Key ID: ${keyId ? `${keyId.substring(0, 12)}...${keyId.slice(-4)}` : warn('not set')}`);

  if (!keyId || !keySecret) {
    record('Razorpay', false, 'RAZORPAY_KEY_ID or RAZORPAY_KEY_SECRET is missing in .env');
    return;
  }

  try {
    const Razorpay = await import('razorpay');
    const RazorpayClient = Razorpay.default || Razorpay;
    const instance = new RazorpayClient({
      key_id: keyId,
      key_secret: keySecret,
    });

    // Make a lightweight API call to verify credentials
    // Fetching payments (limit=1) is a safe read-only operation
    const payments = await instance.payments.all({ count: 1 });
    record('Razorpay', true, `Auth OK — fetched ${payments?.items?.length || 0} payments (read-only test)`);
  } catch (err) {
    const msg = err.message || String(err);
    if (msg.includes('Bad Request') || msg.includes('invalid')) {
      record('Razorpay', false, `Key rejected — check RAZORPAY_KEY_ID (expected rzp_test_ prefix for test keys)`);
    } else if (msg.includes('Unauthorized') || msg.includes('401')) {
      record('Razorpay', false, `Secret rejected — check RAZORPAY_KEY_SECRET`);
    } else if (msg.includes('rate_limit') || msg.includes('Too Many Requests')) {
      record('Razorpay', false, `Rate limited — try again in a few seconds`);
    } else {
      record('Razorpay', false, `${msg.substring(0, 120)}`);
    }
  }
}

// ═══════════════════════════════════════════════════════════════════
//  4. Twilio
// ═══════════════════════════════════════════════════════════════════
async function testTwilio() {
  const accountSid = process.env.TWILIO_ACCOUNT_SID;
  const authToken  = process.env.TWILIO_AUTH_TOKEN;

  console.log(`\n${CYAN}─── Twilio ─────────────────────────────────────────${RESET}`);
  console.log(`  SID:   ${accountSid ? `${accountSid.substring(0, 14)}...${accountSid.slice(-4)}` : warn('not set')}`);

  if (!accountSid || !authToken) {
    record('Twilio', false, 'TWILIO_ACCOUNT_SID or TWILIO_AUTH_TOKEN is missing in .env');
    return;
  }

  try {
    const twilio = await import('twilio');
    const TwilioClient = twilio.default || twilio;
    const client = new TwilioClient(accountSid, authToken);

    // Fetch account details — lightweight read-only call
    const account = await client.api.accounts(accountSid).fetch();
    const status = account.status;
    if (status === 'active' || status === 'active') {
      record('Twilio', true, `Auth OK — account "${account.friendlyName}" is ${status}`);
    } else {
      record('Twilio', true, `Auth OK — account status: ${status}`);
    }
  } catch (err) {
    const msg = err.message || String(err);
    if (msg.includes('Authenticate') || msg.includes('20003') || msg.includes('Invalid')) {
      record('Twilio', false, `Authentication failed — check TWILIO_ACCOUNT_SID and TWILIO_AUTH_TOKEN`);
    } else if (msg.includes('20005')) {
      record('Twilio', false, `Account SID not found — check TWILIO_ACCOUNT_SID`);
    } else {
      record('Twilio', false, `${msg.substring(0, 120)}`);
    }
  }
}

// ═══════════════════════════════════════════════════════════════════
//  MAIN — Run all tests
// ═══════════════════════════════════════════════════════════════════
async function main() {
  console.log('');
  console.log('╔══════════════════════════════════════════════════════════╗');
  console.log('║   🔌  NexusGate API Connection Diagnostic               ║');
  console.log('╚══════════════════════════════════════════════════════════╝');
  console.log('');

  await testMongoDB();
  await testCloudinary();
  await testRazorpay();
  await testTwilio();

  // ── Summary Table ──────────────────────────────────────────────
  console.log(`\n${CYAN}══════════════════════════════════════════════════════${RESET}`);
  console.log(`${BOLD}  Summary${RESET}`);
  console.log(`${CYAN}══════════════════════════════════════════════════════${RESET}`);
  const passed = results.filter((r) => r.passed).length;
  const failed = results.filter((r) => !r.passed).length;

  for (const r of results) {
    const status = r.passed ? ok('PASS') : fail('FAIL');
    console.log(`  ${status}  ${r.service.padEnd(28)} ${r.detail}`);
  }
  console.log(`${CYAN}────────────────────────────────────────────────────${RESET}`);
  console.log(`  ${failed === 0 ? GREEN : RED}${BOLD}${passed}/4 passed, ${failed}/4 failed${RESET}`);
  if (failed === 0) {
    console.log(`  ${GREEN}${BOLD}✅ All API Connections Verified — ready for deployment${RESET}`);
  } else {
    console.log(`  ${RED}${BOLD}❌ Some connections failed — fix the issues above and re-run${RESET}`);
  }
  console.log('');

  process.exit(failed > 0 ? 1 : 0);
}

main().catch((err) => {
  console.error(`\n${RED}Script error: ${err.message}${RESET}`);
  process.exit(1);
});
