const Flat = require('../models/Flat');
const Bill = require('../models/Bill');
const Society = require('../models/Society');

/**
 * generateMonthlyBills
 *
 * Scheduled to run on the 1st of every month.
 * Maps through all flats in every society and generates
 * a base "Pending" maintenance bill for each flat.
 *
 * The bill amount is read from Society.maintenanceFee (defaults to ₹2000).
 */
async function generateMonthlyBills() {
  console.log('[Cron] generateMonthlyBills — started');

  try {
    // Fetch all societies with their configured maintenance fee
    const societies = await Society.find({}).select('_id maintenanceFee name').lean();

    if (societies.length === 0) {
      console.log('[Cron] No societies found; skipping monthly bill generation.');
      return;
    }

    let totalBillsCreated = 0;

    for (const society of societies) {
      // Find all flats belonging to this society
      const flats = await Flat.find({ societyId: society._id })
        .select('_id flatNumber')
        .lean();

      if (flats.length === 0) {
        console.log(`[Cron] Society "${society.name}" has no flats; skipping.`);
        continue;
      }

      const defaultAmount = society.maintenanceFee || 2000;
      const now = new Date();
      // Due date: 15th of the current month
      const dueDate = new Date(now.getFullYear(), now.getMonth(), 15);
      const title = `Maintenance Bill — ${now.toLocaleString('default', { month: 'long' })} ${now.getFullYear()}`;

      // Build bulk insert array
      const bills = flats.map((flat) => ({
        flatId: flat._id,
        societyId: society._id,
        amount: defaultAmount,
        title,
        dueDate,
        status: 'Pending',
      }));

      // Use insertMany with ordered: false so individual failures don't block others
      const result = await Bill.insertMany(bills, { ordered: false });
      totalBillsCreated += result.length;

      console.log(
        `[Cron] Society "${society.name}": ${result.length} bills created (₹${defaultAmount} each, due ${dueDate.toISOString().slice(0, 10)})`
      );
    }

    console.log(`[Cron] generateMonthlyBills — complete. Total bills created: ${totalBillsCreated}`);
  } catch (error) {
    console.error('[Cron] generateMonthlyBills — error:', error.message);
  }
}

module.exports = generateMonthlyBills;
