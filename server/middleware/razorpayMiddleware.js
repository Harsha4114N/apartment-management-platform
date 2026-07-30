const Razorpay = require('razorpay');

let razorpayInstance = null;
let razorpayConfigured = true;

// 1. Initialize the instance using your environment variables
try {
  razorpayInstance = new Razorpay({
    key_id: process.env.RAZORPAY_KEY_ID,
    key_secret: process.env.RAZORPAY_KEY_SECRET,
  });
} catch (initErr) {
  console.error('Razorpay Init Error: RAZORPAY_KEY_ID or RAZORPAY_KEY_SECRET missing/bad. Payment features disabled.', initErr.message);
  razorpayConfigured = false;
}

const razorpayMiddleware = (req, res, next) => {
  if (!razorpayConfigured || !razorpayInstance) {
    return res.status(502).json({ message: 'Payment gateway is not configured. Please set RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET in environment variables.' });
  }
  if (req.body.amount && req.body.currency) {
    const options = {
      // 2. Multiply by 100 to convert Rupees to Paise (Math.round prevents floating point decimals)
      amount: Math.round(req.body.amount * 100),
      currency: req.body.currency,
    };
    
    // 3. Call orders.create on your authenticated instance
    razorpayInstance.orders.create(options, (err, order) => {
      if (err) {
        console.error("Razorpay Error:", err);
        res.status(500).send({ message: 'Error creating order' });
      } else {
        req.orderId = order.id;
        next();
      }
    });
  } else {
    res.status(400).send({ message: 'Amount and currency are required' });
  }
};

module.exports = { razorpayMiddleware, razorpayInstance };