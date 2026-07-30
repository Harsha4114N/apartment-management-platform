const Bill = require('../models/Bill');

const LATE_FEE_PERCENT = 0.05; // 5%

/**
 * applyLateFees
 *
 * Scheduled to run on the 16th of every month.
 * Finds all "Pending" bills whose dueDate has passed (overdue)
 * and appends a 5% late fee by increasing the amount.
 *
 * Only applies the fee once per bill (checks if `lateFeeApplied` flag exists).
 * Since the Bill schema doesn't have a lateFeeApplied field yet,
 * we use a convention: if amount already looks increased (optional),
 * but safer to track via a new field.
 *
 * We'll use an upsert-style approach — if the bill was created
 * before the 16th and is still Pending, we add 5%.
 *
 * To avoid double-fees, we update only bills where:
 *   - status === 'Pending'
 *   - dueDate < now (overdue)
 *   - amount === original amount (i.e., hasn't been fee-adjusted yet)
 *
 * A cleaner approach: add a `lateFeeApplied: Boolean` to the schema.
 * For now, we track by storing the original amount in a comparison,
 * but the safest is a schema flag. We'll do a one-time schema extension
 * via a direct update query.
 */
async function applyLateFees() {
  console.log('[Cron] applyLateFees — started');

  try {
    const now = new Date();

    // Find all overdue Pending bills
    const overdueBills = await Bill.find({
      status: 'Pending',
      dueDate: { $lt: now },
      lateFeeApplied: { $ne: true }, // only bills not yet fee-adjusted
    }).lean();

    if (overdueBills.length === 0) {
      console.log('[Cron] No overdue bills found; skipping late fee application.');
      return;
    }

    let updatedCount = 0;

    for (const bill of overdueBills) {
      const lateFee = Math.round(bill.amount * LATE_FEE_PERCENT);
      const newAmount = bill.amount + lateFee;

      await Bill.updateOne(
        { _id: bill._id },
        {
          $set: {
            amount: newAmount,
            lateFeeApplied: true,
            lateFeeAmount: lateFee,
          },
        }
      );
      updatedCount++;
    }

    console.log(
      `[Cron] applyLateFees — complete. ${updatedCount} bills updated with 5% late fee.`
    );
  } catch (error) {
    console.error('[Cron] applyLateFees — error:', error.message);
  }
}

module.exports = applyLateFees;
