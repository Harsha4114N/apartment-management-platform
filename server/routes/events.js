const express = require('express');
const Event = require('../models/Event');
const auth = require('../middleware/authMiddleware');

const router = express.Router();

// All routes require authentication
router.use(auth);

// --- GET ALL EVENTS (scoped to user's society) ---
// GET /api/events
router.get('/', async (req, res) => {
    try {
        if (!req.user.societyId) {
            return res.status(403).json({ message: 'No society associated with this account.' });
        }

        const events = await Event.find({ societyId: req.user.societyId })
            .sort({ date: 1, time: 1 })
            .lean();

        // Add isUserAttending flag for residents
        const enriched = events.map((evt) => ({
            ...evt,
            isUserAttending: (evt.attendees || []).some(
                (a) => a.toString() === req.user.id.toString()
            )
        }));

        res.status(200).json(enriched);
    } catch (error) {
        console.error('Error fetching events:', error);
        res.status(500).json({ message: 'Server error while fetching events.' });
    }
});

// --- CREATE A NEW EVENT (Admin/SuperAdmin only) ---
// POST /api/events
// Body: { title, date, time, location, category, description, maxCapacity }
router.post('/', async (req, res) => {
    try {
        if (req.user.role !== 'SuperAdmin' && req.user.role !== 'Admin') {
            return res.status(403).json({ message: 'Access denied. Admin privileges required.' });
        }

        if (!req.user.societyId) {
            return res.status(403).json({ message: 'No society associated with this account.' });
        }

        const { title, date, time, location, category, description, maxCapacity } = req.body;

        if (!title || !date || !time || !location || !description) {
            return res.status(400).json({ message: 'Title, date, time, location, and description are required.' });
        }

        const event = new Event({
            societyId: req.user.societyId,
            title,
            date,
            time,
            location,
            category: category || 'Meeting',
            description,
            maxCapacity: maxCapacity || 100,
            createdBy: req.user.id
        });

        await event.save();
        res.status(201).json(event);
    } catch (error) {
        console.error('Error creating event:', error);
        res.status(500).json({ message: 'Server error while creating event.' });
    }
});

// --- UPDATE AN EVENT (Admin/SuperAdmin only) ---
// PUT /api/events/:id
router.put('/:id', async (req, res) => {
    try {
        if (req.user.role !== 'SuperAdmin' && req.user.role !== 'Admin') {
            return res.status(403).json({ message: 'Access denied. Admin privileges required.' });
        }

        const { title, date, time, location, category, description, maxCapacity } = req.body;

        const event = await Event.findOneAndUpdate(
            { _id: req.params.id, societyId: req.user.societyId },
            { title, date, time, location, category, description, maxCapacity },
            { new: true, runValidators: true }
        ).lean();

        if (!event) {
            return res.status(404).json({ message: 'Event not found.' });
        }

        res.json(event);
    } catch (error) {
        console.error('Error updating event:', error);
        res.status(500).json({ message: 'Server error while updating event.' });
    }
});

// --- DELETE AN EVENT (Admin/SuperAdmin only) ---
// DELETE /api/events/:id
router.delete('/:id', async (req, res) => {
    try {
        if (req.user.role !== 'SuperAdmin' && req.user.role !== 'Admin') {
            return res.status(403).json({ message: 'Access denied. Admin privileges required.' });
        }

        const event = await Event.findOneAndDelete({
            _id: req.params.id,
            societyId: req.user.societyId
        });

        if (!event) {
            return res.status(404).json({ message: 'Event not found.' });
        }

        res.json({ message: 'Event deleted.' });
    } catch (error) {
        console.error('Error deleting event:', error);
        res.status(500).json({ message: 'Server error while deleting event.' });
    }
});

// --- RSVP TO AN EVENT (Resident) ---
// POST /api/events/:id/rsvp
router.post('/:id/rsvp', async (req, res) => {
    try {
        const event = await Event.findOne({
            _id: req.params.id,
            societyId: req.user.societyId
        });

        if (!event) {
            return res.status(404).json({ message: 'Event not found.' });
        }

        // Check if already attending
        if (event.attendees.some((a) => a.toString() === req.user.id.toString())) {
            return res.status(400).json({ message: 'Already RSVP\'d for this event.' });
        }

        // Check capacity
        if (event.rsvpCount >= event.maxCapacity) {
            return res.status(400).json({ message: 'Event is at full capacity.' });
        }

        event.attendees.push(req.user.id);
        event.rsvpCount = event.attendees.length;
        await event.save();

        res.json({ message: 'RSVP confirmed!', event });
    } catch (error) {
        console.error('Error RSVPing to event:', error);
        res.status(500).json({ message: 'Server error while RSVPing to event.' });
    }
});

// --- CANCEL RSVP (Resident) ---
// DELETE /api/events/:id/rsvp
router.delete('/:id/rsvp', async (req, res) => {
    try {
        const event = await Event.findOne({
            _id: req.params.id,
            societyId: req.user.societyId
        });

        if (!event) {
            return res.status(404).json({ message: 'Event not found.' });
        }

        event.attendees = event.attendees.filter(
            (a) => a.toString() !== req.user.id.toString()
        );
        event.rsvpCount = event.attendees.length;
        await event.save();

        res.json({ message: 'RSVP cancelled.', event });
    } catch (error) {
        console.error('Error cancelling RSVP:', error);
        res.status(500).json({ message: 'Server error while cancelling RSVP.' });
    }
});

module.exports = router;
