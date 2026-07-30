const express = require('express');
const router = express.Router();
const Razorpay = require('razorpay');
const crypto = require('crypto');
const path = require('path');
const fs = require('fs');
const PDFDocument = require('pdfkit');
const Bill = require('../models/Bill');
const Flat = require('../models/Flat');
const Society = require('../models/Society');
const User = require('../models/User');
const authMiddleware = require('../middleware/authMiddleware');
const { sendPushNotification } = require('../utils/webPush');

// ── Initialize Razorpay instance ──
let razorpayInstance = null;
try {
    razorpayInstance = new Razorpay({
        key_id: process.env.RAZORPAY_KEY_ID,
        key_secret: process.env.RAZORPAY_KEY_SECRET,
    });
} catch (initErr) {
    console.error('Razorpay Init Error: RAZORPAY_KEY_ID or RAZORPAY_KEY_SECRET missing. Payment features disabled.', initErr.message);
}

// Ensure receipts directory exists
const receiptsDir = path.join(__dirname, '..', 'uploads', 'receipts');
if (!fs.existsSync(receiptsDir)) {
    fs.mkdirSync(receiptsDir, { recursive: true });
}

/**
 * Generates a PDF receipt for a paid bill.
 */
async function generateReceipt(bill, flat, society, paymentId) {
    try {
        if (!fs.existsSync(receiptsDir)) {
            fs.mkdirSync(receiptsDir, { recursive: true });
        }
    } catch (dirErr) {
        console.error('PDF: Failed to create receipts directory:', dirErr);
        throw dirErr;
    }

    return new Promise((resolve, reject) => {
        const fileName = `receipt_${bill._id}_${Date.now()}.pdf`;
        const filePath = path.join(receiptsDir, fileName);

        const doc = new PDFDocument({ size: 'A4', margin: 50 });
        const stream = fs.createWriteStream(filePath);

        stream.on('error', (streamErr) => {
            console.error('PDF: Write stream error:', streamErr);
            reject(streamErr);
        });

        doc.pipe(stream);

        try {
            // Header
            doc.fontSize(22).font('Helvetica-Bold').text('PAYMENT RECEIPT', { align: 'center' });
            doc.moveDown(0.5);
            doc.moveTo(50, doc.y).lineTo(545, doc.y).stroke('#4f46e5');
            doc.moveDown(1);

            // Society Info
            doc.fontSize(12).font('Helvetica').fillColor('#666666');
            doc.text(`Society: ${society.name}`, 50);
            doc.text(`Address: ${society.address}`);
            doc.moveDown(1);

            // Receipt Details
            const labelX = 50;
            const valueX = 220;
            const startY = doc.y;

            doc.fillColor('#333333').font('Helvetica-Bold').fontSize(13);
            doc.text('Receipt Details', labelX, startY);
            doc.moveDown(0.8);

            const details = [
                ['Bill Title', bill.title],
                ['Flat Number', flat.flatNumber],
                ['Amount Paid', `₹${bill.amount.toLocaleString('en-IN')}`],
                ['Date of Payment', new Date().toLocaleDateString('en-IN', { day: '2-digit', month: 'long', year: 'numeric' })],
                ['Due Date', new Date(bill.dueDate).toLocaleDateString('en-IN', { day: '2-digit', month: 'long', year: 'numeric' })],
                ['Razorpay Order ID', bill.razorpayOrderId || 'N/A'],
                ['Razorpay Payment ID', paymentId],
                ['Status', 'Paid ✓'],
            ];

            doc.font('Helvetica').fontSize(11);
            for (const [label, value] of details) {
                doc.font('Helvetica-Bold').fillColor('#555555').text(label + ':', labelX);
                doc.font('Helvetica').fillColor('#111111').text(String(value), valueX);
                doc.moveDown(0.4);
            }

            // Footer
            doc.moveDown(1);
            doc.moveTo(50, doc.y).lineTo(545, doc.y).stroke('#cccccc');
            doc.moveDown(0.5);
            doc.fontSize(10).font('Helvetica').fillColor('#999999')
                .text('This is a computer-generated receipt. No signature is required.', { align: 'center' });
        } catch (pdfContentErr) {
            console.error('PDF: Error writing content:', pdfContentErr);
            stream.destroy();
            return reject(pdfContentErr);
        }

        doc.end();

        stream.on('finish', () => {
            console.log(`PDF: Receipt generated — ${fileName}`);
            resolve(`/uploads/receipts/${fileName}`);
        });
    });
}

// ── Role guard: only non-Security roles can access payment routes ──
function requireNonSecurity(req, res, next) {
    const allowedRoles = ['SuperAdmin', 'Admin', 'Treasurer', 'Resident'];
    if (!allowedRoles.includes(req.user.role)) {
        return res.status(403).json({ message: 'Access denied. Insufficient privileges for payment operations.' });
    }
    next();
}

// All payment routes require authentication + non-Security role
router.use(authMiddleware);
router.use(requireNonSecurity);

/**
 * GET /api/payments/bills
 * Fetches bills for the logged-in user's society.
 * Tenant-isolated: Residents only see their own flat's bills.
 * Admins/Treasurers see all society bills.
 */
router.get('/bills', async (req, res) => {
    try {
        if (!req.user.societyId) {
            return res.status(403).json({ message: 'No society associated with this account.' });
        }

        let query = { societyId: req.user.societyId };

        // ── RESIDENT ISOLATION: filter by their flat(s) ──
        if (req.user.role === 'Resident') {
            const userFlats = await Flat.find({
                societyId: req.user.societyId,
                $or: [
                    { owner: req.user.id },
                    { currentTenants: req.user.id }
                ]
            }).select('_id').lean();

            const flatIds = userFlats.map(f => f._id);
            if (flatIds.length > 0) {
                query.flatId = { $in: flatIds };
            } else {
                // No flat assigned — return empty array
                return res.status(200).json([]);
            }
        }

        const bills = await Bill.find(query)
            .populate('flatId', 'flatNumber')
            .sort({ createdAt: -1 })
            .lean();

        res.status(200).json(bills);
    } catch (error) {
        console.error('Error fetching bills:', error);
        res.status(500).json({ message: 'Error fetching bills' });
    }
});

/**
 * POST /api/payments/create-order
 * Tenant-isolated: Resident attempts to pay a bill → fetches Bill from MongoDB
 * with societyId guard, then creates a Razorpay order.
 *
 * Body: { billId }
 * Optionally: { amount, currency } as fallback (but bill amount is authoritative)
 */
router.post('/create-order', async (req, res) => {
    try {
        const { billId } = req.body;

        if (!billId) {
            return res.status(400).json({ message: 'billId is required.' });
        }

        if (!razorpayInstance) {
            return res.status(502).json({ message: 'Payment gateway is not configured. Please set RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET.' });
        }

        // ── TENANT ISOLATION: Fetch the Bill and verify it belongs to the user's society ──
        const bill = await Bill.findOne({
            _id: billId,
            societyId: req.user.societyId
        });

        if (!bill) {
            return res.status(404).json({ message: 'Bill not found in your society.' });
        }

        if (bill.status === 'Paid') {
            return res.status(400).json({ message: 'This bill has already been paid.' });
        }

        // Create Razorpay order using the authoritative amount from the Bill document
        const amountInPaise = Math.round(bill.amount * 100);
        const options = {
            amount: amountInPaise,
            currency: 'INR',
            receipt: `bill_${bill._id}_${Date.now()}`,
            notes: {
                billId: bill._id.toString(),
                societyId: bill.societyId.toString()
            }
        };

        const order = await razorpayInstance.orders.create(options);

        // Store the Razorpay order ID on the Bill document
        await Bill.findByIdAndUpdate(bill._id, { razorpayOrderId: order.id });

        res.status(200).json({
            id: order.id,
            amount: order.amount,
            currency: order.currency,
            receipt: order.receipt,
            status: order.status
        });
    } catch (error) {
        console.error('Error creating Razorpay order:', error);
        res.status(500).json({ message: 'Error creating order' });
    }
});

/**
 * POST /api/payments/verify
 * Tenant-isolated: Verifies the Razorpay payment signature using HMAC SHA256
 * and updates the Bill status to 'Paid' only if it belongs to the user's society.
 *
 * Body: { razorpay_order_id, razorpay_payment_id, razorpay_signature, billId }
 */
router.post('/verify', async (req, res) => {
    try {
        const { razorpay_order_id, razorpay_payment_id, razorpay_signature, billId } = req.body;

        if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature || !billId) {
            return res.status(400).json({
                message: 'Missing required fields: razorpay_order_id, razorpay_payment_id, razorpay_signature, billId.'
            });
        }

        // ── TENANT ISOLATION: Verify the Bill belongs to the user's society ──
        const bill = await Bill.findOne({
            _id: billId,
            societyId: req.user.societyId
        });

        if (!bill) {
            return res.status(404).json({ message: 'Bill not found in your society.' });
        }

        if (bill.status === 'Paid') {
            return res.status(400).json({ message: 'This bill has already been paid.' });
        }

        // ── CRYPTOGRAPHIC VERIFICATION: HMAC SHA256 ──
        const generatedSignature = crypto
            .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET)
            .update(`${razorpay_order_id}|${razorpay_payment_id}`)
            .digest('hex');

        if (generatedSignature !== razorpay_signature) {
            return res.status(400).json({ message: 'Invalid payment signature. Verification failed.' });
        }

        // ── Signature valid — update Bill status to 'Paid' ──
        const updatedBill = await Bill.findByIdAndUpdate(
            billId,
            { status: 'Paid' },
            { new: true }
        );

        if (!updatedBill) {
            return res.status(404).json({ message: 'Bill not found after verification.' });
        }

        // ── Generate PDF Receipt (non-blocking) ──
        let receiptUrl = null;
        try {
            const flat = await Flat.findById(updatedBill.flatId);
            const society = await Society.findById(updatedBill.societyId);

            if (flat && society) {
                receiptUrl = await generateReceipt(updatedBill, flat, society, razorpay_payment_id);
                await Bill.findByIdAndUpdate(billId, { receiptUrl });
            } else {
                console.error('PDF: Flat or Society not found for bill', billId);
            }
        } catch (pdfError) {
            console.error('PDF: Receipt generation failed (non-fatal):', pdfError.message);
        }

        // ── Web Push Notification to Resident (non-blocking) ──
        try {
            const billFlat = await Flat.findById(updatedBill.flatId);
            if (billFlat) {
                const residentUser = await User.findOne({
                    societyId: updatedBill.societyId,
                    $or: [
                        { _id: billFlat.owner },
                        { _id: { $in: billFlat.currentTenants || [] } }
                    ]
                }).select('pushSubscriptions');

                const subscriptions = (residentUser && residentUser.pushSubscriptions) || [];
                if (subscriptions.length > 0) {
                    await sendPushNotification(
                        subscriptions,
                        '✅ Payment Received',
                        `₹${updatedBill.amount} — ${updatedBill.title} (Receipt available)`,
                        '/billing'
                    );
                }
            }
        } catch (pushErr) {
            console.error('WebPush: Payment notification error (non-blocking):', pushErr.message);
        }

        res.status(200).json({
            message: 'Payment verified successfully. Bill status updated to Paid.',
            bill: { ...updatedBill.toObject(), receiptUrl },
        });
    } catch (error) {
        console.error('Error verifying payment:', error);
        res.status(500).json({ message: 'Error verifying payment' });
    }
});

module.exports = router;
