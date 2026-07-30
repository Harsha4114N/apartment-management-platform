const express = require('express');
const Expense = require('../models/Expense');
const Bill = require('../models/Bill');
const Flat = require('../models/Flat');
const User = require('../models/User');
const auth = require('../middleware/authMiddleware');

const router = express.Router();

// All routes require authentication
router.use(auth);

// ── Role guard: only non-Security roles can access expense routes ──
function requireNonSecurity(req, res, next) {
    const allowedRoles = ['SuperAdmin', 'Admin', 'Treasurer', 'Resident'];
    if (!allowedRoles.includes(req.user.role)) {
        return res.status(403).json({ message: 'Access denied. Insufficient privileges for expense operations.' });
    }
    next();
}

// --- GET ALL EXPENSES (scoped to society) ---
// GET /api/expenses
router.get('/', requireNonSecurity, async (req, res) => {
    try {
        if (!req.user.societyId) {
            return res.status(403).json({ message: 'No society associated with this account.' });
        }

        const expenses = await Expense.find({ societyId: req.user.societyId })
            .sort({ createdAt: -1 })
            .lean();

        res.status(200).json(expenses);
    } catch (error) {
        console.error('Error fetching expenses:', error);
        res.status(500).json({ message: 'Server error while fetching expenses.' });
    }
});

// --- CREATE AN EXPENSE (Admin/SuperAdmin only) ---
// POST /api/expenses
// Body: { title, amount, date, category, splitType, targetFlats }
// splitType: 'ALL' — split across all approved Residents (bills auto-generated)
// splitType: 'TARGET' — split only across Residents in targetFlats flatNumbers
// Backward compatible: splitAcrossFlats: true maps to splitType='ALL'
router.post('/', async (req, res) => {
    try {
        if (req.user.role !== 'SuperAdmin' && req.user.role !== 'Admin' && req.user.role !== 'Treasurer') {
            return res.status(403).json({ message: 'Access denied. Admin or Treasurer privileges required.' });
        }

        if (!req.user.societyId) {
            return res.status(403).json({ message: 'No society associated with this account.' });
        }

        const { title, amount, date, category, splitType, targetFlats, splitAcrossFlats } = req.body;

        if (!title || !amount || !date) {
            return res.status(400).json({ message: 'Title, amount, and date are required.' });
        }

        if (amount <= 0) {
            return res.status(400).json({ message: 'Amount must be greater than zero.' });
        }

        // Resolve effective split mode; backward compatible with splitAcrossFlats boolean
        const effectiveSplitType = splitType || (splitAcrossFlats ? 'ALL' : 'NONE');

        // 1. Create the expense record
        const expense = new Expense({
            societyId: req.user.societyId,
            title,
            amount: Number(amount),
            date,
            category: category || 'Other',
            splitType: effectiveSplitType,
            splitAcrossFlats: effectiveSplitType === 'ALL' || effectiveSplitType === 'TARGET',
            createdBy: req.user.id
        });

        await expense.save();

        // 2. If splitting, auto-generate Bills for matched Residents
        let billsCreated = 0;
        if (effectiveSplitType) {
            let residents = [];

            if (effectiveSplitType === 'TARGET' && targetFlats && targetFlats.length > 0) {
                // ── TARGET mode: find flats matching the supplied flatNumbers ──
                const matchedFlats = await Flat.find({
                    societyId: req.user.societyId,
                    flatNumber: { $in: targetFlats }
                }).lean();

                if (matchedFlats.length === 0) {
                    console.warn('[Expenses] No flats matched the target flatNumbers:', targetFlats);
                } else {
                    // Collect all user IDs (owner + tenants) from matched flats
                    const targetUserIds = new Set();
                    matchedFlats.forEach((flat) => {
                        if (flat.owner) targetUserIds.add(flat.owner.toString());
                        (flat.currentTenants || []).forEach((tenantId) => {
                            targetUserIds.add(tenantId.toString());
                        });
                    });

                    if (targetUserIds.size > 0) {
                        residents = await User.find({
                            _id: { $in: Array.from(targetUserIds) },
                            societyId: req.user.societyId,
                            role: 'Resident',
                            approvalStatus: 'Approved'
                        }).lean();
                    }
                }
            } else {
                // ── ALL mode: fetch all approved Residents in this society ──
                residents = await User.find({
                    societyId: req.user.societyId,
                    role: 'Resident',
                    approvalStatus: 'Approved'
                }).lean();
            }

            if (residents.length === 0) {
                console.warn('[Expenses] No approved residents found to split expense across.');
            } else {
                // Calculate split amount
                const splitAmount = Math.round(Number(amount) / residents.length);

                // For each resident, find their flat
                const flats = await Flat.find({ societyId: req.user.societyId }).lean();
                const residentFlatMap = {};
                flats.forEach((flat) => {
                    if (flat.owner) {
                        residentFlatMap[flat.owner.toString()] = flat._id;
                    }
                    (flat.currentTenants || []).forEach((tenantId) => {
                        residentFlatMap[tenantId.toString()] = flat._id;
                    });
                });

                // Log mapping info for debugging
                console.log(`[Expenses] Flat mapping: ${Object.keys(residentFlatMap).length} residents mapped to ${flats.length} flats.`);

                // Create a Bill for each resident
                const billDocs = residents.map((resident) => {
                    const mappedFlatId = residentFlatMap[resident._id.toString()];
                    return {
                        flatId: mappedFlatId || (flats.length > 0 ? flats[0]._id : null),
                        societyId: req.user.societyId,
                        amount: splitAmount,
                        title: `Split: ${title}`,
                        dueDate: new Date(date),
                        status: 'Pending'
                    };
                }).filter((b) => {
                    if (b.flatId === null) {
                        console.warn(`[Expenses] Skipping resident — no flatId mapped (resident ${b.title})`);
                        return false;
                    }
                    return true;
                });

                if (billDocs.length > 0) {
                    // Dedicated try/catch around Bill.insertMany to surface Mongoose validation errors
                    try {
                        const createdBills = await Bill.insertMany(billDocs, { ordered: false });
                        billsCreated = createdBills.length;
                        console.log(`[Expenses] ✅ ${billsCreated} bills inserted successfully via insertMany.`);
                    } catch (insertErr) {
                        // If ordered: false, some may still succeed; check partial results
                        if (insertErr.insertedDocs) {
                            billsCreated = insertErr.insertedDocs.length;
                            console.error(`[Expenses] ⚠️ Partial insert: ${billsCreated} succeeded, ${billDocs.length - billsCreated} failed.`);
                        }
                        console.error('[Expenses] ❌ Bill.insertMany validation error details:');
                        console.error(`  name: ${insertErr.name}`);
                        console.error(`  message: ${insertErr.message}`);
                        // Log individual validation errors if available
                        if (insertErr.errors) {
                            for (const [field, err] of Object.entries(insertErr.errors)) {
                                console.error(`  - Field "${field}": ${err.message}`);
                            }
                        }
                        if (insertErr.writeErrors) {
                            insertErr.writeErrors.forEach((we, idx) => {
                                console.error(`  - WriteError #${idx}: ${we.errmsg}`);
                                if (we.err && we.err.errors) {
                                    for (const [field, err] of Object.entries(we.err.errors)) {
                                        console.error(`      Field "${field}": ${err.message}`);
                                    }
                                }
                            });
                        }
                        // Re-throw so the outer catch handles the response
                        throw insertErr;
                    }

                    // ── Sum verification ──
                    const totalFromBills = billDocs.reduce((sum, b) => sum + b.amount, 0);
                    const originalAmount = Number(amount);
                    console.log('═══════════════════════════════════════════');
                    console.log(`[Expenses] Split Verification for "${title}":`);
                    console.log(`  Original amount : ₹${originalAmount}`);
                    console.log(`  Residents found : ${residents.length}`);
                    console.log(`  Split amount    : ₹${splitAmount} each`);
                    console.log(`  Bills created   : ${billsCreated}`);
                    console.log(`  Sum of bills    : ₹${totalFromBills}`);
                    console.log(`  Match original  : ${totalFromBills === originalAmount ? '✅ YES' : `⚠️  NO (difference: ₹${originalAmount - totalFromBills})`}`);
                    console.log('═══════════════════════════════════════════');
                } else {
                    console.warn('[Expenses] ❌ No residents could be mapped to a flat for bill creation. Zero bills created.');
                }
            }
        }

        res.status(201).json({
            expense,
            billsCreated,
            message: effectiveSplitType
                ? `Expense recorded and split across ${billsCreated} residents.`
                : 'Expense recorded.'
        });
    } catch (error) {
        console.error('Error creating expense:', error);
        res.status(500).json({ message: 'Server error while creating expense.' });
    }
});

module.exports = router;
