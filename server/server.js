// --- DNS OVERRIDE FIX ---
const dns = require('dns');
dns.setServers(['8.8.8.8', '1.1.1.1']);
// ------------------------

const express = require('express');
const twilio = require('twilio');   
const cors = require('cors');
const dotenv = require('dotenv');
const mongoose = require('mongoose');

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors());
app.use(express.json()); 
const authRoutes = require('./routes/auth');
const ticketRoutes = require('./routes/tickets');
app.use('/api/auth', authRoutes);
app.use('/api/tickets', ticketRoutes);


// --- DATABASE CONNECTION ---
mongoose.connect(process.env.MONGO_URI)
    .then(() => console.log("MongoDB Database connection established successfully!"))
    .catch((err) => console.log("MongoDB connection error: ", err));
// ---------------------------

app.get('/api/status', (req, res) => {
    res.json({ 
        status: "Online", 
        message: "Apartment Management Platform API is running smoothly." 
    });
});

app.listen(PORT, () => {
    console.log(`Server executing seamlessly on port ${PORT}`);
});
app.post('/api/admin/notify', async (req, res) => {
  const { sendTo, notificationTitle, message } = req.body;

  try {
    const twilioClient = twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);
    const twilioResponse = await twilioClient.messages.create({
      body: `🚨 *New Alert: ${notificationTitle}*\n\nTarget: ${sendTo}\n\nMessage: ${message}`,
      from: 'whatsapp:+14155238886', 
      to: `whatsapp:${process.env.MY_PHONE_NUMBER}`
    });

    console.log('WhatsApp dispatched! SID:', twilioResponse.sid);
    res.status(200).json({ success: true, messageId: twilioResponse.sid });

  } catch (error) {
    console.error('Twilio Error:', error);
    res.status(500).json({ success: false, error: 'Failed to send WhatsApp message' });
  }
});