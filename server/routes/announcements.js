const express = require('express');
const Announcement = require('../models/Announcement');
const auth = require('../middleware/authMiddleware');
const { getIO } = require('../utils/socket');

const router = express.Router();

// All routes require authentication
router.use(auth);

// --- GET ALL ANNOUNCEMENTS (scoped to user's society) ---
// GET /api/announcements
router.get('/', async (req, res) => {
    try {
        if (!req.user.societyId) {
            return res.status(403).json({ message: 'No society associated with this account.' });
        }

        const announcements = await Announcement.find({ societyId: req.user.societyId })
            .sort({ createdAt: -1 })
            .lean();

        res.status(200).json(announcements);
    } catch (error) {
        console.error('Error fetching announcements:', error);
        res.status(500).json({ message: 'Server error while fetching announcements.' });
    }
});

// --- CREATE A NEW ANNOUNCEMENT (Admin/SuperAdmin only) ---
// POST /api/announcements
// Body: { title, message, category, target }
router.post('/', async (req, res) => {
    try {
        if (req.user.role !== 'SuperAdmin' && req.user.role !== 'Admin') {
            return res.status(403).json({ message: 'Access denied. Admin privileges required.' });
        }

        if (!req.user.societyId) {
            return res.status(403).json({ message: 'No society associated with this account.' });
        }

        const { title, message, category, target } = req.body;

        if (!title || !message) {
            return res.status(400).json({ message: 'Title and message are required.' });
        }

        const announcement = new Announcement({
            societyId: req.user.societyId,
            title,
            message,
            category: category || 'General',
            target: target || 'All Residents',
            author: 'Admin',
            createdBy: req.user.id
        });

        await announcement.save();

        // ── Real-time Socket.io Event ──
        try {
            const io = getIO();
            io.to(`society:${req.user.societyId}`).emit('new_announcement', {
                _id: announcement._id,
                title: announcement.title,
                message: announcement.message,
                category: announcement.category,
                target: announcement.target,
                author: announcement.author,
                createdBy: announcement.createdBy,
                societyId: announcement.societyId,
                createdAt: announcement.createdAt,
            });
            console.log('[Socket] new_announcement emitted to society:', req.user.societyId);
        } catch (socketErr) {
            console.error('[Socket] Emit error (non-blocking):', socketErr.message);
        }

        res.status(201).json(announcement);
    } catch (error) {
        console.error('Error creating announcement:', error);
        res.status(500).json({ message: 'Server error while creating announcement.' });
    }
});

// --- DELETE AN ANNOUNCEMENT (Admin/SuperAdmin only) ---
// DELETE /api/announcements/:id
router.delete('/:id', async (req, res) => {
    try {
        if (req.user.role !== 'SuperAdmin' && req.user.role !== 'Admin') {
            return res.status(403).json({ message: 'Access denied. Admin privileges required.' });
        }

        const announcement = await Announcement.findOne({
            _id: req.params.id,
            societyId: req.user.societyId
        });

        if (!announcement) {
            return res.status(404).json({ message: 'Announcement not found.' });
        }

        await announcement.deleteOne();
        res.json({ message: 'Announcement deleted.' });
    } catch (error) {
        console.error('Error deleting announcement:', error);
        res.status(500).json({ message: 'Server error while deleting announcement.' });
    }
});

module.exports = router;
