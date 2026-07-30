const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const mongoose = require('mongoose');
const User = require('../models/User');
const Society = require('../models/Society');
const authMiddleware = require('../middleware/authMiddleware');

const router = express.Router();

// Helper: generate a 6-character alphanumeric join code
function generateJoinCode() {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let code = '';
    for (let i = 0; i < 6; i++) {
        code += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return code;
}

// ── All routes require authentication + PlatformAdmin role ──
router.use(authMiddleware);

// ── PlatformAdmin-only middleware ──
function requirePlatformAdmin(req, res, next) {
    if (req.user.role !== 'PlatformAdmin') {
        return res.status(403).json({ message: 'Access denied. PlatformAdmin privileges required.' });
    }
    next();
}

/**
 * POST /api/platform/society
 * PlatformAdmin only.
 * Creates a new Society document and generates the initial SuperAdmin user
 * for that specific apartment complex.
 *
 * Body: {
 *   societyName,       // Name of the apartment complex
 *   societyAddress,    // Full address
 *   adminName,         // SuperAdmin's full name
 *   adminEmail,        // SuperAdmin's email
 *   adminPassword      // SuperAdmin's password
 * }
 */
router.post('/society', requirePlatformAdmin, async (req, res) => {
    try {
        const { societyName, societyAddress, adminName, adminEmail, adminPassword } = req.body;

        if (!societyName || !societyAddress || !adminName || !adminEmail || !adminPassword) {
            return res.status(400).json({
                message: 'All fields are required: societyName, societyAddress, adminName, adminEmail, adminPassword.'
            });
        }

        // Check if a user with this email already exists
        const existingUser = await User.findOne({ email: adminEmail.toLowerCase().trim() });
        if (existingUser) {
            return res.status(400).json({ message: 'A user with this email already exists.' });
        }

        // Hash the SuperAdmin's password
        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(adminPassword, salt);

        // Generate a unique 6-character alphanumeric join code
        let uniqueJoinCode;
        let codeExists = true;
        while (codeExists) {
            uniqueJoinCode = generateJoinCode();
            const existingSociety = await Society.findOne({ uniqueJoinCode });
            codeExists = !!existingSociety;
        }

        // Pre-generate MongoDB IDs so neither document is missing required fields
        const newSocietyId = new mongoose.Types.ObjectId();
        const newUserId = new mongoose.Types.ObjectId();

        // Build the SuperAdmin User object
        const superAdmin = new User({
            _id: newUserId,
            fullName: adminName,
            email: adminEmail.toLowerCase().trim(),
            password: hashedPassword,
            role: 'SuperAdmin',
            approvalStatus: 'Approved',
            societyId: newSocietyId
        });

        // Build the Society object
        const society = new Society({
            _id: newSocietyId,
            name: societyName,
            address: societyAddress,
            superAdmin: newUserId,
            uniqueJoinCode,
            maintenanceFee: 2000 // default
        });

        // Save both documents
        await superAdmin.save();
        await society.save();

        res.status(201).json({
            message: 'Society and SuperAdmin account provisioned successfully!',
            society: {
                id: society._id,
                name: society.name,
                address: society.address,
                uniqueJoinCode: society.uniqueJoinCode
            },
            superAdmin: {
                id: superAdmin._id,
                fullName: superAdmin.fullName,
                email: superAdmin.email,
                role: superAdmin.role
            }
        });
    } catch (error) {
        console.error('Platform society provisioning error:', error);
        res.status(500).json({ message: 'Server error while provisioning society.' });
    }
});

/**
 * GET /api/platform/societies
 * PlatformAdmin only.
 * Lists all societies in the platform.
 */
router.get('/societies', requirePlatformAdmin, async (req, res) => {
    try {
        const societies = await Society.find()
            .populate('superAdmin', 'fullName email')
            .sort({ createdAt: -1 })
            .lean();

        res.status(200).json(societies);
    } catch (error) {
        console.error('Error fetching all societies:', error);
        res.status(500).json({ message: 'Server error while fetching societies.' });
    }
});

module.exports = router;
