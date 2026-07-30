const express = require('express');
const User = require('../models/User');
const Flat = require('../models/Flat');
const auth = require('../middleware/authMiddleware');

const router = express.Router();

// All routes require authentication
router.use(auth);

// --- GET ALL RESIDENTS IN SOCIETY (Admin/SuperAdmin/Security only) ---
// GET /api/directory
router.get('/', async (req, res) => {
    try {
        if (req.user.role !== 'SuperAdmin' && req.user.role !== 'Admin' && req.user.role !== 'Security') {
            return res.status(403).json({ message: 'Access denied. Admin or Security privileges required.' });
        }

        if (!req.user.societyId) {
            return res.status(403).json({ message: 'No society associated with this account.' });
        }

        // Get all approved users in the society
        const users = await User.find({
            societyId: req.user.societyId,
            approvalStatus: 'Approved'
        })
            .select('fullName email phoneNumber role')
            .lean();

        // Get all flats in the society to map flat numbers
        const flats = await Flat.find({ societyId: req.user.societyId })
            .select('flatNumber owner currentTenants')
            .lean();

        // Build a map of userId -> flatNumber + flatId
        const userFlatMap = {};
        flats.forEach((flat) => {
            const flatIdStr = flat._id.toString();
            if (flat.owner) {
                userFlatMap[flat.owner.toString()] = {
                    unit: flat.flatNumber,
                    tower: flat.flatNumber.replace(/[0-9-]/g, '').trim() || 'General',
                    flatId: flatIdStr
                };
            }
            (flat.currentTenants || []).forEach((tenantId) => {
                userFlatMap[tenantId.toString()] = {
                    unit: flat.flatNumber,
                    tower: flat.flatNumber.replace(/[0-9-]/g, '').trim() || 'General',
                    flatId: flatIdStr
                };
            });
        });

        // Enrich users with flat info and status
        const residents = users.map((user) => {
            const flatInfo = userFlatMap[user._id.toString()] || {};
            // Determine display status from role — explicit Security check first
            let displayStatus;
            if (user.role === 'Security') {
                displayStatus = 'Security';
            } else if (user.role === 'SuperAdmin' || user.role === 'Admin') {
                displayStatus = 'Owner';
            } else {
                displayStatus = 'Tenant';
            }
            return {
                id: user._id,
                name: user.fullName,
                unit: flatInfo.unit || 'N/A',
                tower: flatInfo.tower || 'N/A',
                flatId: flatInfo.flatId || null,
                phone: user.phoneNumber || '—',
                email: user.email || '—',
                role: user.role,           // raw role for frontend use
                status: displayStatus,     // display label for badges
                moveInDate: user.createdAt ? new Date(user.createdAt).toISOString().split('T')[0] : '—',
                vehicle: 'Not Registered',
                avatar: user.fullName ? user.fullName.split(' ').map((n) => n[0]).join('').toUpperCase().slice(0, 2) : '??'
            };
        });

        res.status(200).json(residents);
    } catch (error) {
        console.error('Error fetching directory:', error);
        res.status(500).json({ message: 'Server error while fetching directory.' });
    }
});

module.exports = router;
