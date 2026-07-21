const express = require('express');
const router = express.Router();
const Ticket = require('../models/Ticket');
const auth = require('../middleware/authMiddleware');

// 1. Import and initialize Twilio using your Render environment variables
const twilio = require('twilio');
const client = twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);

// --- CREATE A NEW TICKET ---
router.post('/', auth, async (req, res) => {
    try {
        const { title, description, category } = req.body;

        const newTicket = new Ticket({
            resident: req.user.id,
            title,
            description,
            category,
            status: 'Open'
        });

        const ticket = await newTicket.save();

        // 2. Fire off the WhatsApp Notification!
        try {
            await client.messages.create({
                body: `🚨 *New Maintenance Ticket*\n\n*Issue:* ${title}\n*Category:* ${category}\n*Details:* ${description}`,
                // Note: If you are using a purchased Twilio number, replace this sandbox number with yours.
                from: 'whatsapp:+14155238886', 
                to: `whatsapp:${process.env.MY_PHONE_NUMBER}`
            });
            console.log("WhatsApp notification sent successfully!");
        } catch (twilioErr) {
            console.error("Failed to send WhatsApp message:", twilioErr.message);
            // We only log the error so the app doesn't crash if Twilio has a hiccup
        }

        res.status(201).json(ticket);
    } catch (err) {
        console.error('Error creating ticket:', err.message);
        res.status(500).send('Server Error');
    }
});

// --- GET ALL TICKETS FOR THE LOGGED-IN RESIDENT ---
router.get('/', auth, async (req, res) => {
    try {
        const tickets = await Ticket.find({ resident: req.user.id }).sort({ createdAt: -1 });
        res.status(200).json(tickets);
    } catch (err) {
        console.error("Error fetching tickets:", err.message);
        res.status(500).json({ error: "Server error while fetching tickets." });
    }
});

// --- DELETE A TICKET ---
router.delete('/:id', auth, async (req, res) => {
    try {
        const ticket = await Ticket.findById(req.params.id);

        if (!ticket) {
            return res.status(404).json({ msg: 'Ticket not found' });
        }

        if (ticket.resident.toString() !== req.user.id) {
            return res.status(401).json({ msg: 'User not authorized to delete this ticket' });
        }

        await ticket.deleteOne();
        res.json({ msg: 'Ticket removed' });
    } catch (err) {
        console.error('Error deleting ticket:', err.message);
        if (err.kind === 'ObjectId') {
            return res.status(404).json({ msg: 'Ticket not found' });
        }
        res.status(500).send('Server Error');
    }
});

// --- UPDATE TICKET TO RESOLVED ---
router.put('/:id', auth, async (req, res) => {
    try {
        let ticket = await Ticket.findById(req.params.id);

        if (!ticket) {
            return res.status(404).json({ msg: 'Ticket not found' });
        }

        if (ticket.resident.toString() !== req.user.id) {
            return res.status(401).json({ msg: 'User not authorized to update this ticket' });
        }

        ticket = await Ticket.findByIdAndUpdate(
            req.params.id,
            { $set: { status: 'Resolved' } },
            { new: true }
        );

        res.json(ticket);
    } catch (err) {
        console.error('Error updating ticket:', err.message);
        if (err.kind === 'ObjectId') {
            return res.status(404).json({ msg: 'Ticket not found' });
        }
        res.status(500).send('Server Error');
    }
});

module.exports = router;