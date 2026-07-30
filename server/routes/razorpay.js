const express = require('express');
const router = express.Router();
const crypto = require('crypto');
const path = require('path');
const fs = require('fs');
const PDFDocument = require('pdfkit');
const { razorpayMiddleware, razorpayInstance } = require('../middleware/razorpayMiddleware');
const Bill = require('../models/Bill');
const User = require('../models/User');
const authMiddleware = require('../middleware/authMiddleware');
const { sendPushNotification } = require('../utils/webPush');

// Ensure receipts directory exists
const receiptsDir = path.join(__dirname, '..', 'uploads', 'receipts');
if (!fs.existsSync(receiptsDir)) {
  fs.mkdirSync(receiptsDir, { recursive: true });
}

/**
 * Generates a PDF receipt for a paid bill.
 * Returns the relative URL path to the saved PDF.
 */
async function generateReceipt(bill, flat, society, paymentId) {
  // Safety: ensure the receipts directory exists right before writing
  try {
    if (!fs.existsSync(receiptsDir)) {
      fs.mkdirSync(receiptsDir, { recursive: true });
      console.log('PDF: Created receipts directory at', receiptsDir);
    }
  } catch (dirErr) {
    console.error('PDF Generation Error: Failed to create receipts directory:', dirErr);
    throw dirErr;
  }

  return new Promise((resolve, reject) => {
    const fileName = `receipt_${bill._id}_${Date.now()}.pdf`;
    const filePath = path.join(receiptsDir, fileName);
    console.log(`PDF: Generating receipt at ${filePath}`);

    const doc = new PDFDocument({ size: 'A4', margin: 50 });
    const stream = fs.createWriteStream(filePath);

    // Handle stream errors immediately
    stream.on('error', (streamErr) => {
      console.error('PDF Generation Error: Write stream error:', streamErr);
      reject(streamErr);
    });

    doc.pipe(stream);

    try {
      // --- Header ---
      doc.fontSize(22).font('Helvetica-Bold').text('PAYMENT RECEIPT', { align: 'center' });
      doc.moveDown(0.5);
      doc.moveTo(50, doc.y).lineTo(545, doc.y).stroke('#4f46e5');
      doc.moveDown(1);

      // --- Society Info ---
      doc.fontSize(12).font('Helvetica').fillColor('#666666');
      doc.text(`Society: ${society.name}`, 50);
      doc.text(`Address: ${society.address}`);
      doc.moveDown(1);

      // --- Receipt Details Table ---
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

      // --- Footer ---
      doc.moveDown(1);
      doc.moveTo(50, doc.y).lineTo(545, doc.y).stroke('#cccccc');
      doc.moveDown(0.5);
      doc.fontSize(10).font('Helvetica').fillColor('#999999')
        .text('This is a computer-generated receipt. No signature is required.', { align: 'center' });
    } catch (pdfContentErr) {
      // PDF content generation threw — destroy the stream and reject
      console.error('PDF Generation Error: Error writing PDF content:', pdfContentErr);
      stream.destroy();
      return reject(pdfContentErr);
    }

    // Finalize the document (triggers the stream to flush and close)
    doc.end();

    // Resolve only after the write stream has fully flushed to disk
    stream.on('finish', () => {
      console.log(`PDF: Receipt generated successfully — ${fileName}`);
      resolve(`/uploads/receipts/${fileName}`);
    });
  });
}

// All payment routes require authentication
router.use(authMiddleware);

// GET /bills
// Fetches all bills for the logged-in user's society
router.get('/bills', async (req, res) => {
  try {
    const bills = await Bill.find({ societyId: req.user.societyId })
      .populate('flatId', 'flatNumber')
      .sort({ createdAt: -1 })
      .lean();

    res.status(200).json(bills);
  } catch (error) {
    console.error('Error fetching bills:', error);
    res.status(500).json({ message: 'Error fetching bills' });
  }
});

// POST /create-order
// Accepts: amount, currency (default INR), billId
// Creates a Razorpay order and updates the Bill with the order ID
router.post('/create-order', razorpayMiddleware, async (req, res) => {
  try {
    const { amount, currency = 'INR', billId } = req.body;

    // razorpayMiddleware already creates the order and attaches it to req.orderId
    // Fetch the full order details from Razorpay
    const order = await razorpayInstance.orders.fetch(req.orderId);

    // Update the Bill document with the Razorpay order ID
    if (billId) {
      await Bill.findByIdAndUpdate(billId, { razorpayOrderId: order.id });
    }

    res.status(200).json(order);
  } catch (error) {
    console.error('Error creating Razorpay order:', error);
    res.status(500).json({ message: 'Error creating order' });
  }
});

// POST /verify-payment
// Accepts: razorpay_order_id, razorpay_payment_id, razorpay_signature, billId
// Verifies the payment signature and updates the Bill status to 'Paid'
router.post('/verify-payment', async (req, res) => {
  try {
    const { razorpay_order_id, razorpay_payment_id, razorpay_signature, billId } = req.body;

    // Generate HMAC SHA256 signature using the key secret
    const generatedSignature = crypto
      .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET)
      .update(`${razorpay_order_id}|${razorpay_payment_id}`)
      .digest('hex');

    if (generatedSignature === razorpay_signature) {
      // Signature verified — update the Bill status to 'Paid'
      const updatedBill = await Bill.findByIdAndUpdate(
        billId,
        { status: 'Paid' },
        { new: true }
      );

      if (!updatedBill) {
        return res.status(404).json({ message: 'Bill not found' });
      }

      // --- Generate PDF Receipt ---
      let receiptUrl = null;
      try {
        const Flat = require('../models/Flat');
        const Society = require('../models/Society');
        const flat = await Flat.findById(updatedBill.flatId);
        const society = await Society.findById(updatedBill.societyId);

        if (!flat) {
          console.error('PDF Generation Error: Flat not found for bill', billId, 'flatId:', updatedBill.flatId);
        }
        if (!society) {
          console.error('PDF Generation Error: Society not found for bill', billId, 'societyId:', updatedBill.societyId);
        }

        if (flat && society) {
          receiptUrl = await generateReceipt(updatedBill, flat, society, razorpay_payment_id);

          // Update the bill with the receipt URL
          await Bill.findByIdAndUpdate(billId, { receiptUrl });
          console.log('PDF: Receipt URL saved to bill', billId, '—', receiptUrl);
        }
      } catch (pdfError) {
        console.error('PDF Generation Error: Receipt generation failed for bill', billId, ':', pdfError.message || pdfError);
        if (pdfError.stack && process.env.NODE_ENV !== 'production') {
            console.error('PDF Generation Error: Stack trace:', pdfError.stack);
        }
        // Payment is still valid; receipt generation failure is non-fatal
        }
  
        // ── Web Push Notification to Resident ──
        try {
            const Flat = require('../models/Flat');
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
                    console.log('--- PUSH PAYMENT NOTIFICATION SENT ---');
                } else {
                    console.log('WebPush: Skipped payment notification — resident has no push subscriptions');
                }
            }
        } catch (pushErr) {
            console.error('WebPush Notification Error (non-blocking):', pushErr.message);
        }
  
        res.status(200).json({
        message: 'Payment verified and bill status updated',
        bill: { ...updatedBill.toObject(), receiptUrl },
      });
    } else {
      res.status(400).json({ message: 'Invalid payment signature' });
    }
  } catch (error) {
    console.error('Error verifying payment:', error);
    res.status(500).json({ message: 'Error verifying payment' });
  }
});

module.exports = router;
