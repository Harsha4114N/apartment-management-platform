const express = require('express');
const router = express.Router();
const Ticket = require('../models/Ticket');
const Flat = require('../models/Flat');
const auth = require('../middleware/authMiddleware');
const upload = require('../middleware/upload');
const User = require('../models/User');
const { sendWhatsApp } = require('../utils/whatsapp');

// --- CREATE A NEW TICKET (WITH WHATSAPP IMAGE ATTACHMENT) ---
// The upload middleware handles Cloudinary credential validation, multer errors,
// file size limits, and format restrictions — returning clean JSON on failure
router.post('/', auth, upload.single('image'), async (req, res) => {
    try {
        const { title, description, category } = req.body;

        if (!req.user.societyId) {
            return res.status(403).json({ message: "No society associated with this account." });
        }
        
        const imageUrl = req.file ? req.file.path : '';

        const residentInfo = await User.findById(req.user.id);
        
        if (!residentInfo) {
            return res.status(404).json({ message: "User not found" });
        }

        // Query the Flat collection to find the flat where this user is owner or tenant
        const flat = await Flat.findOne({
            societyId: req.user.societyId,
            $or: [
                { owner: req.user.id },
                { currentTenants: req.user.id }
            ]
        });

        if (!flat || !flat.flatNumber) {
            return res.status(400).json({ message: "Could not determine flat number for this user. Please contact your administrator." });
        }

        const userFlatNumber = flat.flatNumber;

        const newTicket = new Ticket({
            resident: req.user.id,
            societyId: req.user.societyId,
            title,
            description,
            category,
            imageUrl,
            flatNumber: userFlatNumber,
            status: 'Open'
        });

        const ticket = await newTicket.save();
        console.log('Ticket created successfully:', ticket._id);

        // ── WhatsApp Notification (non-blocking) ──
        try {
            const mediaUrls = imageUrl ? [imageUrl] : undefined;
            await sendWhatsApp(
                `🚨 *New Maintenance Ticket*\n\n*Flat:* ${userFlatNumber}\n*Issue:* ${title}\n*Category:* ${category}\n*Details:* ${description}`,
                { mediaUrls }
            );
        } catch (twilioErr) {
            console.error('WhatsApp Notification Error:', twilioErr.message);
        }

        res.status(201).json(ticket);
    } catch (err) {
        console.error('Error creating ticket:', err.message || err);
        if (err.stack && process.env.NODE_ENV !== 'production') {
            console.error('Ticket creation stack trace:', err.stack);
        }
        res.status(500).json({ message: err.message || 'Server error while creating ticket.' });
    }
});

// --- GET ALL TICKETS (scoped to user's society) ---
router.get('/', auth, async (req, res) => {
    try {
        if (!req.user.societyId) {
            return res.status(403).json({ message: "No society associated with this account." });
        }

        const query = { societyId: req.user.societyId };

        if (req.user.role === 'resident') {
            query.resident = req.user.id;
        }

        const tickets = await Ticket.find(query).sort({ createdAt: -1 });
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

        if (ticket.societyId.toString() !== req.user.societyId.toString()) {
            return res.status(401).json({ msg: 'User not authorized to delete this ticket' });
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

        if (ticket.societyId.toString() !== req.user.societyId.toString()) {
            return res.status(401).json({ msg: 'User not authorized to update this ticket' });
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
