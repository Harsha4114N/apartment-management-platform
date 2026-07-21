const express = require('express');
const router = express.Router();
const Ticket = require('../models/Ticket');
const auth = require('../middleware/authMiddleware');
const upload = require('../middleware/upload'); 
const twilio = require('twilio');
const Resident = require('../models/Resident');

const client = twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);

// --- CREATE A NEW TICKET (WITH WHATSAPP IMAGE ATTACHMENT) ---
router.post('/', auth, upload.single('image'), async (req, res) => {
    try {
        const { title, description, category } = req.body;
        
        const imageUrl = req.file ? req.file.path : '';

        // 1. Look up the resident in the database using their login token ID
        const residentInfo = await Resident.findById(req.user.id); 
        
        if (!residentInfo) {
            return res.status(404).json({ message: "User not found" });
        }

        const userFlatNumber = residentInfo.flatNumber;

        // 2. Create the ticket including the user's flat number
        const newTicket = new Ticket({
            resident: req.user.id,
            title,
            description,
            category,
            imageUrl, 
            flatNumber: userFlatNumber, // <-- Automatically fetched from DB
            status: 'Open'
        });

        const ticket = await newTicket.save();

        // --- NEW TWILIO LOGIC ---
        try {
            // 3. Build the base message INCLUDING the flat number
            const messagePayload = {
                body: `🚨 *New Maintenance Ticket*\n\n*Flat:* ${userFlatNumber}\n*Issue:* ${title}\n*Category:* ${category}\n*Details:* ${description}`,
                from: 'whatsapp:+14155238886', 
                to: `whatsapp:${process.env.MY_PHONE_NUMBER}`
            };

            // 4. If an image was uploaded, attach it to the WhatsApp message!
            if (imageUrl) {
                // Twilio requires mediaUrl to be an array
                messagePayload.mediaUrl = [imageUrl]; 
            }

            // 5. Send the message
            await client.messages.create(messagePayload);
            console.log("WhatsApp notification with media sent successfully!");
        } catch (twilioErr) {
            console.error("Failed to send WhatsApp message:", twilioErr.message);
        }

        res.status(201).json(ticket);
    } catch (err) {
        console.error('Error creating ticket:', err.message);
        res.status(500).send('Server Error');
    }
});

// --- GET ALL TICKETS ---
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