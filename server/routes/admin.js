const express = require('express');
const User = require('../models/User');
const Ticket = require('../models/Ticket');
const Bill = require('../models/Bill');
const authMiddleware = require('../middleware/authMiddleware');
const { sendPushNotification } = require('../utils/webPush');

const router = express.Router();

// All admin routes require authentication
router.use(authMiddleware);

// --- GET PENDING USERS ---
// GET /api/admin/pending-users
// Fetches all users for the admin's societyId where approvalStatus === 'Pending'
router.get('/pending-users', async (req, res) => {
    try {
        // Only SuperAdmin or Admin can view pending users
        if (req.user.role !== 'SuperAdmin' && req.user.role !== 'Admin') {
            return res.status(403).json({ message: 'Access denied. Admin privileges required.' });
        }

        const pendingUsers = await User.find({
            societyId: req.user.societyId,
            approvalStatus: 'Pending'
        })
            .select('fullName email role flatNumber createdAt')
            .sort({ createdAt: 1 })
            .lean();

        res.status(200).json(pendingUsers);
    } catch (error) {
        console.error('Error fetching pending users:', error);
        res.status(500).json({ message: 'Server error while fetching pending users.' });
    }
});

// --- APPROVE OR REJECT A USER ---
// POST /api/admin/approve-user
// Body: { userId, action } where action is 'Approved' or 'Rejected'
router.post('/approve-user', async (req, res) => {
    try {
        // Only SuperAdmin or Admin can approve/reject users
        if (req.user.role !== 'SuperAdmin' && req.user.role !== 'Admin') {
            return res.status(403).json({ message: 'Access denied. Admin privileges required.' });
        }

        const { userId, action } = req.body;

        if (!userId || !action) {
            return res.status(400).json({ message: 'userId and action are required.' });
        }

        if (!['Approved', 'Rejected'].includes(action)) {
            return res.status(400).json({ message: 'Action must be either "Approved" or "Rejected".' });
        }

        // Find the user and verify they belong to the same society
        const user = await User.findOne({
            _id: userId,
            societyId: req.user.societyId
        });

        if (!user) {
            return res.status(404).json({ message: 'User not found in your society.' });
        }

        user.approvalStatus = action;
        await user.save();

        res.status(200).json({
            message: `User ${user.fullName} has been ${action.toLowerCase()}.`,
            user: {
                id: user._id,
                fullName: user.fullName,
                email: user.email,
                role: user.role,
                approvalStatus: user.approvalStatus
            }
        });
    } catch (error) {
        console.error('Error approving/rejecting user:', error);
        res.status(500).json({ message: 'Server error while updating user approval status.' });
    }
});

// --- GET ALL TICKETS (Admin scoped to society) ---
// GET /api/admin/tickets
// Fetches all tickets for the admin's society, populated with resident info
router.get('/tickets', async (req, res) => {
    try {
        // Only SuperAdmin or Admin can view all tickets
        if (req.user.role !== 'SuperAdmin' && req.user.role !== 'Admin') {
            return res.status(403).json({ message: 'Access denied. Admin privileges required.' });
        }

        const tickets = await Ticket.find({ societyId: req.user.societyId })
            .populate({
                path: 'resident',
                model: 'User',
                select: 'fullName email',
            })
            .sort({ createdAt: -1 })
            .lean();

        res.status(200).json(tickets);
    } catch (error) {
        console.error('Error fetching admin tickets:', error);
        res.status(500).json({ message: 'Server error while fetching tickets.' });
    }
});

// --- UPDATE TICKET STATUS (Admin) ---
// PUT /api/admin/tickets/:id/status
// Body: { status } where status is 'Open', 'In-Progress', or 'Resolved'
router.put('/tickets/:id/status', async (req, res) => {
    try {
        // Only SuperAdmin or Admin can update ticket status
        if (req.user.role !== 'SuperAdmin' && req.user.role !== 'Admin') {
            return res.status(403).json({ message: 'Access denied. Admin privileges required.' });
        }

        const { id } = req.params;
        const { status } = req.body;

        const validStatuses = ['Open', 'In-Progress', 'Resolved'];
        if (!status || !validStatuses.includes(status)) {
            return res.status(400).json({
                message: `Invalid status. Must be one of: ${validStatuses.join(', ')}`,
            });
        }

        // Ensure the ticket belongs to the admin's society
        const ticket = await Ticket.findOneAndUpdate(
            { _id: id, societyId: req.user.societyId },
            { status },
            { new: true }
        )
            .populate({
                path: 'resident',
                model: 'User',
                select: 'fullName email',
            })
            .lean();

        if (!ticket) {
            return res.status(404).json({ message: 'Ticket not found in your society.' });
        }

        // ── Web Push Notification to Resident ──
        try {
            const residentUser = await User.findById(ticket.resident._id || ticket.resident)
                .select('pushSubscriptions');

            const subscriptions = (residentUser && residentUser.pushSubscriptions) || [];
            if (subscriptions.length > 0) {
                await sendPushNotification(
                    subscriptions,
                    '🔧 Ticket Status Updated',
                    `${ticket.title} — ${status}`,
                    '/maintenance'
                );
                console.log('--- PUSH TICKET NOTIFICATION SENT ---');
            } else {
                console.log('WebPush: Skipped ticket notification — resident has no push subscriptions');
            }
        } catch (pushErr) {
            console.error('WebPush Notification Error (non-blocking):', pushErr.message);
        }

        res.status(200).json({
            message: `Ticket status updated to "${status}".`,
            ticket,
        });
    } catch (error) {
        console.error('Error updating ticket status:', error);
        res.status(500).json({ message: 'Server error while updating ticket status.' });
    }
});

// --- GET METRICS OVERVIEW ---
// GET /api/admin/metrics
// Aggregates key operational data for the admin's society:
//   - Total Revenue (sum of all 'Paid' bills)
//   - Outstanding Dues (sum of all 'Pending' bills)
//   - Active Maintenance Tickets (status: 'Open' or 'In-Progress')
//   - Pending Resident Approvals
router.get('/metrics', async (req, res) => {
    try {
        if (req.user.role !== 'SuperAdmin' && req.user.role !== 'Admin') {
            return res.status(403).json({ message: 'Access denied. Admin privileges required.' });
        }

        const societyId = req.user.societyId;

        // Run all four queries in parallel for performance
        const [revenueResult, duesResult, activeTickets, pendingApprovals] = await Promise.all([
            // 1. Total Revenue — sum of all Paid bills
            Bill.aggregate([
                { $match: { societyId, status: 'Paid' } },
                { $group: { _id: null, total: { $sum: '$amount' } } }
            ]),

            // 2. Outstanding Dues — sum of all Pending bills
            Bill.aggregate([
                { $match: { societyId, status: 'Pending' } },
                { $group: { _id: null, total: { $sum: '$amount' } } }
            ]),

            // 3. Active Maintenance Tickets — Open or In-Progress
            Ticket.countDocuments({
                societyId,
                status: { $in: ['Open', 'In-Progress'] }
            }),

            // 4. Pending Resident Approvals
            User.countDocuments({
                societyId,
                approvalStatus: 'Pending'
            })
        ]);

        res.status(200).json({
            totalRevenue: revenueResult.length > 0 ? revenueResult[0].total : 0,
            outstandingDues: duesResult.length > 0 ? duesResult[0].total : 0,
            activeTickets,
            pendingApprovals
        });
    } catch (error) {
        console.error('Error fetching admin metrics:', error);
        res.status(500).json({ message: 'Server error while fetching metrics.' });
    }
});

// --- DELETE (REMOVE) A USER from the society ---
// DELETE /api/admin/users/:id
// SuperAdmin/Admin can remove a user (delete document permanently)
router.delete('/users/:id', async (req, res) => {
    try {
        if (req.user.role !== 'SuperAdmin' && req.user.role !== 'Admin') {
            return res.status(403).json({ message: 'Access denied. Admin privileges required.' });
        }

        const { id } = req.params;

        // Find the user and verify they belong to the same society
        const user = await User.findOne({
            _id: id,
            societyId: req.user.societyId
        });

        if (!user) {
            return res.status(404).json({ message: 'User not found in your society.' });
        }

        // Don't allow removing yourself
        if (user._id.toString() === req.user.id.toString()) {
            return res.status(400).json({ message: 'Cannot remove yourself. Use a different admin account.' });
        }

        const removedName = user.fullName;

        // Delete the user document permanently
        await User.findByIdAndDelete(id);

        console.log(`[Admin] User "${removedName}" (${id}) removed from society ${req.user.societyId} by admin ${req.user.id}.`);

        res.status(200).json({
            message: `User "${removedName}" has been removed from the society.`,
            userId: id
        });
    } catch (error) {
        console.error('Error removing user:', error);
        res.status(500).json({ message: 'Server error while removing user.' });
    }
});

module.exports = router;
