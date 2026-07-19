const express = require('express');
const router = express.Router();
const Ticket = require('../models/Ticket'); // Adjust the path if your folders are different
const auth = require('../middleware/authMiddleware'); // Imported once

// --- CREATE A NEW TICKET ---
// @route   POST /api/tickets
// @access  Private (Requires JWT)
// @route   POST api/tickets
// @desc    Create a new service ticket
// @access  Private (Requires token)
// @route   POST api/tickets
router.post('/', auth, async (req, res) => {
    try {
        // 1. Extract category from the incoming frontend request
        const { title, description, category } = req.body;

        const newTicket = new Ticket({
            resident: req.user.id, // FIX: Changed from 'user' to 'resident' to match your schema
            title,
            description,
            category,              // FIX: Passing the required category
            status: 'Open'
        });

        const ticket = await newTicket.save();
        res.status(201).json(ticket);
    } catch (err) {
        console.error('Error creating ticket:', err.message);
        res.status(500).send('Server Error');
    }
});
// --- GET ALL TICKETS FOR THE LOGGED-IN RESIDENT ---
// @route   GET /api/tickets
// @access  Private (Requires JWT)
router.get('/', auth, async (req, res) => {
    try {
        // Find all tickets where the 'resident' field matches the ID from the token
        const tickets = await Ticket.find({ resident: req.user.id }).sort({ createdAt: -1 });
        res.status(200).json(tickets);
    } catch (err) {
        console.error("Error fetching tickets:", err.message);
        res.status(500).json({ error: "Server error while fetching tickets." });
    }
});
// @route   DELETE api/tickets/:id
// @desc    Delete a ticket
// @access  Private
router.delete('/:id', auth, async (req, res) => {
    try {
        // Find the ticket by the ID passed in the URL
        const ticket = await Ticket.findById(req.params.id);

        if (!ticket) {
            return res.status(404).json({ msg: 'Ticket not found' });
        }

        // Deep Insight: Security Check! 
        // Ensure the person deleting the ticket actually owns it.
        // We compare the ticket's resident ID with the token's user ID.
        if (ticket.resident.toString() !== req.user.id) {
            return res.status(401).json({ msg: 'User not authorized to delete this ticket' });
        }

        await ticket.deleteOne();
        res.json({ msg: 'Ticket removed' });
    } catch (err) {
        console.error('Error deleting ticket:', err.message);
        // If the ID is poorly formatted, it throws a specific error
        if (err.kind === 'ObjectId') {
            return res.status(404).json({ msg: 'Ticket not found' });
        }
        res.status(500).send('Server Error');
    }
});
// @route   PUT api/tickets/:id
// @desc    Update a ticket's status to Resolved
// @access  Private
router.put('/:id', auth, async (req, res) => {
    try {
        // 1. Find the existing ticket
        let ticket = await Ticket.findById(req.params.id);

        if (!ticket) {
            return res.status(404).json({ msg: 'Ticket not found' });
        }

        // 2. Security Check: Only the owner can update their ticket
        if (ticket.resident.toString() !== req.user.id) {
            return res.status(401).json({ msg: 'User not authorized to update this ticket' });
        }

        // 3. Execute the Update
        // { new: true } tells MongoDB to return the updated document, not the old one
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
// Exported exactly once at the very bottom
module.exports = router;