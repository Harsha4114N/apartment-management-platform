// --- DNS OVERRIDE FIX ---
const dns = require('dns');
dns.setServers(['8.8.8.8', '1.1.1.1']);
// ------------------------

const http = require('http');
const express = require('express');
const path = require('path');
const twilio = require('twilio');
const cors = require('cors');
const dotenv = require('dotenv');
const mongoose = require('mongoose');

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

// --- CORS Configuration ---
const allowedOrigins = [
    process.env.CLIENT_URL,
    'http://localhost:5173',
    'http://localhost:3000'
].filter(Boolean);

const corsOptions = {
    origin: (origin, callback) => {
        // Allow server-to-server / non-browser requests with no origin
        if (!origin) return callback(null, true);
        // Allow if origin is explicitly in the allowed list
        if (allowedOrigins.includes(origin)) return callback(null, true);
        // In development, allow all origins for easier testing
        if (process.env.NODE_ENV !== 'production') return callback(null, true);
        // Production: reject unknown origins
        return callback(new Error('Not allowed by CORS'));
    },
    credentials: true,
};

app.use(cors(corsOptions));
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Serve uploaded receipts as static files
app.use('/uploads/receipts', express.static(path.join(__dirname, 'uploads', 'receipts')));

// --- ROUTES ---
const authRoutes = require('./routes/auth');
const adminRoutes = require('./routes/admin');
const billRoutes = require('./routes/bills');
const ticketRoutes = require('./routes/tickets');
const societyRoutes = require('./routes/societies');
const paymentRoutes = require('./routes/payments');
const announcementRoutes = require('./routes/announcements');
const visitorRoutes = require('./routes/visitors');
const eventRoutes = require('./routes/events');
const directoryRoutes = require('./routes/directory');
const userRoutes = require('./routes/users');
const expenseRoutes = require('./routes/expenses');
const platformRoutes = require('./routes/platform');

app.use('/api/auth', authRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/bills', billRoutes);
app.use('/api/tickets', ticketRoutes);
app.use('/api/societies', societyRoutes);
app.use('/api/payments', paymentRoutes);
app.use('/api/announcements', announcementRoutes);
app.use('/api/visitors', visitorRoutes);
app.use('/api/events', eventRoutes);
app.use('/api/directory', directoryRoutes);
app.use('/api/users', userRoutes);
app.use('/api/expenses', expenseRoutes);
app.use('/api/platform', platformRoutes);

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

app.post('/api/admin/notify', async (req, res) => {
  const { sendTo, notificationTitle, message } = req.body;

  try {
    const twilioClient = twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);
    const twilioResponse = await twilioClient.messages.create({
      body: `🚨 *New Alert: ${notificationTitle}*\n\nTarget: ${sendTo}\n\nMessage: ${message}`,
      from: 'whatsapp:+14155238886', 
      to: `whatsapp:${process.env.MY_PHONE_NUMBER}`
    });

    console.log('WhatsApp dispatched successfully.');
    res.status(200).json({ success: true, messageId: twilioResponse.sid });

  } catch (error) {
    console.error('Twilio Error:', error.message);
    res.status(500).json({ success: false, error: 'Failed to send WhatsApp message' });
  }
});

// ════════════════════════════════════════════════════
//  CREATE HTTP SERVER (required for Socket.io)
// ════════════════════════════════════════════════════
const server = http.createServer(app);

// ── Initialize Socket.io ──
const { initSocket } = require('./utils/socket');
initSocket(server);

// ── Start Cron Jobs (after DB is connected) ──
mongoose.connection.once('open', () => {
  const { startCronJobs } = require('./cron/index');
  startCronJobs();
});

server.listen(PORT, () => {
    console.log(`Server executing seamlessly on port ${PORT}`);
});
