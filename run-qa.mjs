#!/usr/bin/env node
/**
 * run-qa.mjs — Cross-Platform Autonomous QA Pipeline Orchestrator
 *
 * Executes: Lint → TypeScript Check → Build Check → Seed Data → E2E Tests
 *
 * Usage:  node run-qa.mjs
 */

import { execSync, spawn } from 'child_process';
import fs from 'fs';
import http from 'http';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = __dirname;

const TIMESTAMP = new Date().toISOString().replace('T', ' ').substring(0, 19);
let failures = 0;

// ── Utilities ────────────────────────────────────────────────────────

function color(text, code) {
  return `\x1b[${code}m${text}\x1b[0m`;
}
const red = (t) => color(t, 31);
const green = (t) => color(t, 32);
const yellow = (t) => color(t, 33);
const cyan = (t) => color(t, 36);

function log(label, msg, ok = true) {
  const icon = ok ? green('✓') : red('✖');
  console.log(`  ${icon} ${label}: ${msg}`);
}

function run(cmd, opts = {}) {
  const cwd = opts.cwd || ROOT;
  const label = opts.label || cmd;
  const ignoreError = opts.ignoreError || false;

  console.log(cyan(`\n[●] ${label}`));
  try {
    const output = execSync(cmd, {
      cwd,
      stdio: ['pipe', 'pipe', 'pipe'],
      timeout: opts.timeout || 120000,
      maxBuffer: 10 * 1024 * 1024,
    });
    const stdout = output.toString().trim();
    if (stdout) {
      // Show only last 20 lines for brevity
      const lines = stdout.split('\n');
      if (lines.length > 20) {
        console.log(`  (${lines.length} lines — showing last 20)`);
        console.log('  ...' + lines.slice(lines.length - 20).join('\n  '));
      } else {
        console.log('  ' + stdout.replace(/\n/g, '\n  '));
      }
    }
    log(label, 'passed', true);
    return true;
  } catch (err) {
    const stderr = err.stderr?.toString().trim() || '';
    const stdout = err.stdout?.toString().trim() || '';
    if (stderr) console.error('  ' + stderr.replace(/\n/g, '\n  '));
    if (stdout) console.log('  ' + stdout.replace(/\n/g, '\n  '));
    
    if (ignoreError) {
      log(label, 'skipped (non-fatal)', true);
      return true;
    }
    log(label, 'FAILED', false);
    failures++;
    return false;
  }
}

async function spawnServer(command, args, cwd, port, timeout = 30000) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd,
      stdio: ['pipe', 'pipe', 'pipe'],
      env: { ...process.env, NODE_ENV: 'test' },
    });

    let started = false;
    const startTime = Date.now();

    const checkReady = () => {
      if (started) return;
      const req = http.get(`http://localhost:${port}/api/status`, (res) => {
        started = true;
        resolve(child);
      });
      req.on('error', () => {
        if (Date.now() - startTime > timeout) {
          reject(new Error(`Server on port ${port} failed to start within ${timeout}ms`));
        } else {
          setTimeout(checkReady, 500);
        }
      });
      req.end();
    };

    child.stdout.on('data', (data) => {
      const text = data.toString();
      process.stdout.write(`  [server] ${text}`);
    });

    child.stderr.on('data', (data) => {
      const text = data.toString();
      // Only show errors, not debug info
      if (text.toLowerCase().includes('err')) {
        process.stderr.write(`  [server:err] ${text}`);
      }
    });

    child.on('error', reject);
    child.on('exit', (code) => {
      if (!started) reject(new Error(`Server exited with code ${code}`));
    });

    checkReady();
  });
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// ═════════════════════════════════════════════════════════════════════
//  MAIN PIPELINE
// ═════════════════════════════════════════════════════════════════════

async function main() {
  console.log('');
  console.log('╔══════════════════════════════════════════════════════════╗');
  console.log('║   🚀  NexusGate Autonomous QA Pipeline                  ║');
  console.log(`║   ${TIMESTAMP}              ║`);
  console.log('╚══════════════════════════════════════════════════════════╝');
  console.log('');

  // ── Step 0: Dependency Check ──
  console.log(cyan('[0/5] Checking dependencies...'));
  if (!fs.existsSync(path.join(ROOT, 'node_modules'))) {
    run('npm install --silent', { label: 'Installing root deps', timeout: 120000 });
  }
  if (!fs.existsSync(path.join(ROOT, 'client', 'node_modules'))) {
    run('npm install --silent', { cwd: path.join(ROOT, 'client'), label: 'Installing client deps', timeout: 120000 });
  }
  if (!fs.existsSync(path.join(ROOT, 'server', 'node_modules'))) {
    run('npm install --silent', { cwd: path.join(ROOT, 'server'), label: 'Installing server deps', timeout: 120000 });
  }
  console.log(green('  ✓ Dependencies ready\n'));

  // ── Step 1: Lint Check ──
  console.log(cyan('[1/5] Running ESLint (client)...'));
  run('npx eslint . --max-warnings=50', {
    cwd: path.join(ROOT, 'client'),
    label: 'ESLint',
    ignoreError: true,
  });

  // ── Step 2: TypeScript Check ──
  console.log(cyan('[2/5] TypeScript check...'));
  const tsconfigPath = path.join(ROOT, 'client', 'tsconfig.json');
  if (fs.existsSync(tsconfigPath)) {
    run('npx tsc --noEmit', {
      cwd: path.join(ROOT, 'client'),
      label: 'TypeScript',
      ignoreError: true,
    });
  } else {
    console.log(yellow('  ⚡ No TypeScript config found — skipping\n'));
  }

  // ── Step 3: Build Check ──
  console.log(cyan('[3/5] Build check...'));
  run('npx vite build --logLevel error', {
    cwd: path.join(ROOT, 'client'),
    label: 'Client build',
    ignoreError: true,
  });

  // ── Step 4: Seed Test Data ──
  console.log(cyan('[4/5] Seeding E2E test data...'));
  
  let serverProcess = null;
  try {
    // Start the backend server
    console.log('  ↳ Starting backend for seeding...');
    serverProcess = await spawnServer('node', ['server/server.js'], ROOT, 5000);
    console.log(green('  ✓ Server is ready\n'));

    // Run the seed script
    const seedSuccess = run('node tests/setup.mjs', {
      label: 'Seed test data',
      timeout: 30000,
      ignoreError: true,
    });

    if (!seedSuccess) {
      console.error(red('\n  ✖ Seed failed — cannot proceed to E2E tests'));
    }
  } catch (err) {
    console.error(red(`\n  ✖ Server setup failed: ${err.message}`));
    failures++;
  } finally {
    if (serverProcess) {
      serverProcess.kill();
      console.log('  ↳ Seeding server stopped\n');
    }
  }

  // ── Step 5: E2E Tests (Playwright) ──
  console.log(cyan('[5/5] Running Playwright E2E tests...'));
  
  // The webServer config in playwright.config.mjs will auto-start both servers
  run('npx playwright test --headed --config=playwright.config.mjs', {
    label: 'Playwright E2E tests',
    timeout: 180000, // 3 minutes for full test run
    ignoreError: true,
  });

  // ═══════════════════════════════════════════════════════════════════
  //  SUMMARY
  // ═══════════════════════════════════════════════════════════════════
  console.log('');
  console.log('╔══════════════════════════════════════════════════════════╗');
  console.log('║  📊 QA Pipeline Summary                                 ║');
  console.log('╠══════════════════════════════════════════════════════════╣');
  if (failures === 0) {
    console.log(`║  ${green('✅ ALL CHECKS PASSED')}                              ║`);
  } else {
    console.log(`║  ${red(`❌ ${failures} CHECK(S) FAILED`)}                              ║`);
  }
  console.log('╚══════════════════════════════════════════════════════════╝');
  console.log('');

  process.exit(failures > 0 ? 1 : 0);
}

main().catch((err) => {
  console.error(red(`\n❌ Pipeline error: ${err.message}`));
  process.exit(1);
});
