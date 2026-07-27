const express = require('express');
const Bill = require('../models/Bill');
const Flat = require('../models/Flat');
const User = require('../models/User');
const Society = require('../models/Society');
const authMiddleware = require('../middleware/authMiddleware');
const { sendWhatsApp } = require('../utils/whatsapp');

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

        // ── WhatsApp Notification to Resident ──
        try {
            // Find the flat owner or tenant to get their phone number
            const residentUser = await User.findOne({
                societyId: req.user.societyId,
                $or: [
                    { _id: flat.owner },
                    { _id: { $in: flat.currentTenants || [] } }
                ]
            }).select('fullName phoneNumber');

            const society = await Society.findById(req.user.societyId).select('name');

            // Fallback: use resident's phone, or fall back to MY_PHONE_NUMBER env for testing
            const targetPhone = (residentUser && residentUser.phoneNumber) || process.env.MY_PHONE_NUMBER;

            console.log('--- WHATSAPP NOTIFICATION TRIGGERED ---');
            console.log('Event: Bill Issued');
            console.log('Target Phone:', targetPhone);
            console.log('Resident User:', residentUser ? `${residentUser.fullName} (${residentUser.phoneNumber || 'no phone'})` : 'not found');
            console.log('Flat:', flatNumber, '| Amount:', amount, '| Title:', title);

            if (targetPhone) {
                const societyName = society ? society.name : 'Your Society';
                await sendWhatsApp(
                    `🧾 *New Bill Issued*\n\nSociety: ${societyName}\nFlat: ${flatNumber}\nAmount: ₹${amount}\nTitle: ${title}\nDue Date: ${new Date(dueDate).toLocaleDateString('en-IN')}\n\nPlease log in to your dashboard to make the payment.`,
                    { to: targetPhone }
                );
                console.log('--- WHATSAPP BILL NOTIFICATION SENT ---');
            } else {
                console.log('WhatsApp: Skipped bill notification — no phone number available');
            }
        } catch (waErr) {
            console.error('WhatsApp Notification Error:', waErr.message);
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
