const express = require('express');
const router = express.Router();
const Ticket = require('../models/Ticket');
const Flat = require('../models/Flat');
const auth = require('../middleware/authMiddleware');
const upload = require('../middleware/upload');
const User = require('../models/User');
const { sendPushNotification } = require('../utils/webPush');
const { uploadToCloudStorage, decodeBase64Image } = require('../utils/cloudStorage');
const { getIO } = require('../utils/socket');

// --- CREATE A NEW TICKET (WITH WHATSAPP IMAGE ATTACHMENT) ---
// The upload middleware handles Cloudinary credential validation, multer errors,
// file size limits, and format restrictions — returning clean JSON on failure
// Supports both:
//   - multipart/form-data with a file field "image" (from standard upload)
//   - JSON body with "imageBase64" (Base64 data-URI from camera snapshot)
router.post('/', auth, upload.single('image'), async (req, res) => {
    try {
        const { title, description, category, imageBase64 } = req.body;

        if (!req.user.societyId) {
            return res.status(403).json({ message: "No society associated with this account." });
        }
        
        // ── Determine image URL from either source ──
        let imageUrl = '';
        if (req.file) {
            // Case 1: Standard file upload via multer/Cloudinary
            imageUrl = req.file.path;
        } else if (imageBase64 && typeof imageBase64 === 'string' && imageBase64.startsWith('data:image/')) {
            // Case 2: Base64 data-URI from camera snapshot
            try {
                const decoded = decodeBase64Image(imageBase64);
                imageUrl = await uploadToCloudStorage(decoded);
            } catch (decodeErr) {
                console.error('Base64 decode/upload error:', decodeErr.message);
                // Non-fatal — ticket still created without image
                imageUrl = '';
            }
        }

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

        // ── Real-time Socket.io Event ──
        try {
            const io = getIO();
            io.emit('new_alert', {
                type: 'ticket',
                action: 'created',
                title,
                category,
                flatNumber: userFlatNumber,
                ticketId: ticket._id,
                timestamp: new Date().toISOString(),
            });
            // Also emit to the society-specific room
            io.to(`society:${req.user.societyId}`).emit('new_alert', {
                type: 'ticket',
                action: 'created',
                title,
                category,
                flatNumber: userFlatNumber,
                ticketId: ticket._id,
                timestamp: new Date().toISOString(),
            });
        } catch (socketErr) {
            console.error('Socket.io emit error (non-blocking):', socketErr.message);
        }

        // ── Web Push Notification (non-blocking) ──
        try {
            const adminUsers = await User.find({
                societyId: req.user.societyId,
                role: { $in: ['SuperAdmin', 'Admin'] }
            }).lean();
            const subscriptions = adminUsers.flatMap(u => u.pushSubscriptions || []);
            if (subscriptions.length > 0) {
                await sendPushNotification(
                    subscriptions,
                    '🛠️ New Maintenance Ticket',
                    `Flat ${userFlatNumber}: ${title} — ${category}`,
                    '/maintenance'
                );
            }
        } catch (pushErr) {
            console.error('[WebPush] Ticket notification error (non-blocking):', pushErr.message);
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
