const express = require('express');
const Bill = require('../models/Bill');
const Flat = require('../models/Flat');
const User = require('../models/User');
const Society = require('../models/Society');
const authMiddleware = require('../middleware/authMiddleware');
const { sendPushNotification } = require('../utils/webPush');

const router = express.Router();

// All bill routes require authentication
router.use(authMiddleware);

// --- CREATE A BILL ---
// POST /api/bills/create-bill
// Body: { flatNumber, amount, title, dueDate, receiptUrl? }
router.post('/create-bill', async (req, res) => {
    try {
        // Only SuperAdmin, Admin, or Treasurer can create bills
        const allowedRoles = ['SuperAdmin', 'Admin', 'Treasurer'];
        if (!allowedRoles.includes(req.user.role)) {
            return res.status(403).json({ message: 'Access denied. Insufficient privileges to create bills.' });
        }

        const { flatNumber, amount, title, dueDate, receiptUrl } = req.body;

        if (!flatNumber || !amount || !title || !dueDate) {
            return res.status(400).json({ message: 'flatNumber, amount, title, and dueDate are required.' });
        }

        // Find the Flat within this society
        const flat = await Flat.findOne({
            flatNumber,
            societyId: req.user.societyId
        });

        if (!flat) {
            return res.status(404).json({ message: `Flat ${flatNumber} not found in your society.` });
        }

        // Create the bill
        const bill = new Bill({
            flatId: flat._id,
            societyId: req.user.societyId,
            amount,
            title,
            dueDate: new Date(dueDate),
            receiptUrl: receiptUrl || null,
            status: 'Pending'
        });

        await bill.save();

        // ── Web Push Notification to Resident ──
        try {
            const residentUser = await User.findOne({
                societyId: req.user.societyId,
                $or: [
                    { _id: flat.owner },
                    { _id: { $in: flat.currentTenants || [] } }
                ]
            }).select('pushSubscriptions');

            const subscriptions = (residentUser && residentUser.pushSubscriptions) || [];
            if (subscriptions.length > 0) {
                await sendPushNotification(
                    subscriptions,
                    '🧾 New Bill Issued',
                    `Flat ${flatNumber}: ₹${amount} — ${title} (Due: ${new Date(dueDate).toLocaleDateString('en-IN')})`,
                    '/billing'
                );
                console.log('--- PUSH BILL NOTIFICATION SENT ---');
            } else {
                console.log('WebPush: Skipped bill notification — resident has no push subscriptions');
            }
        } catch (pushErr) {
            console.error('WebPush Notification Error (non-blocking):', pushErr.message);
        }

        res.status(201).json({
            message: 'Bill created successfully.',
            bill: {
                id: bill._id,
                flatId: bill.flatId,
                societyId: bill.societyId,
                amount: bill.amount,
                title: bill.title,
                dueDate: bill.dueDate,
                receiptUrl: bill.receiptUrl,
                status: bill.status
            }
        });
    } catch (error) {
        console.error('Error creating bill:', error);
        res.status(500).json({ message: 'Server error while creating bill.' });
    }
});

module.exports = router;
