const Razorpay = require('razorpay');

// 1. Initialize the instance using your environment variables
const razorpayInstance = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID,
  key_secret: process.env.RAZORPAY_KEY_SECRET,
});

const razorpayMiddleware = (req, res, next) => {
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