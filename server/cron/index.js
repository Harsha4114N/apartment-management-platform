const cron = require('node-cron');
const generateMonthlyBills = require('./generateMonthlyBills');
const applyLateFees = require('./applyLateFees');

/**
 * Starts all scheduled cron jobs.
 * Call this once after the database connection is established.
 */
function startCronJobs() {
  console.log('[Cron] Scheduler initializing...');

  // ── 1st of every month at 00:30 — Generate monthly maintenance bills ──
  // Cron: "30 0 1 * *"  (minute=30, hour=0, day-of-month=1)
  cron.schedule('30 0 1 * *', async () => {
    console.log('[Cron] Trigger: Monthly bill generation');
    await generateMonthlyBills();
  });

  // ── 16th of every month at 00:30 — Apply late fees to overdue bills ──
  // Cron: "30 0 16 * *" (minute=30, hour=0, day-of-month=16)
  cron.schedule('30 0 16 * *', async () => {
    console.log('[Cron] Trigger: Late fee application');
    await applyLateFees();
  });

  console.log('[Cron] Scheduler initialized. Jobs registered:');
  console.log('  • Monthly Bill Generation  — 1st of every month @ 00:30');
  console.log('  • Late Fee Application     — 16th of every month @ 00:30');
}

module.exports = { startCronJobs };
