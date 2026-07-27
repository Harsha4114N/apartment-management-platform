const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const mongoose = require('mongoose');
const User = require('../models/User');
const Society = require('../models/Society');
const Flat = require('../models/Flat');

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

// --- REGISTER A NEW SOCIETY + SUPERADMIN ---
// POST /api/auth/register-society
// Body: { fullName, email, password, societyName, address }
router.post('/register-society', async (req, res) => {
    try {
        const { fullName, email, password, societyName, address } = req.body;

        if (!fullName || !email || !password || !societyName || !address) {
            return res.status(400).json({ message: 'All fields are required.' });
        }

        // Check if user with this email already exists
        const existingUser = await User.findOne({ email: email.toLowerCase().trim() });
        if (existingUser) {
            return res.status(400).json({ message: 'An account with this email already exists.' });
        }

        // Hash password
        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(password, salt);

        // Generate a unique 6-character alphanumeric join code
        let uniqueJoinCode;
        let codeExists = true;
        while (codeExists) {
            uniqueJoinCode = generateJoinCode();
            const existingSociety = await Society.findOne({ uniqueJoinCode });
            codeExists = !!existingSociety;
        }

        // 1. Pre-generate MongoDB IDs so neither document is missing required fields
        const newSocietyId = new mongoose.Types.ObjectId();
        const newUserId = new mongoose.Types.ObjectId();

        // 2. Build the User object with the pre-generated Society ID attached
        const superAdmin = new User({
            _id: newUserId,
            fullName,
            email: email.toLowerCase().trim(),
            password: hashedPassword,
            role: 'SuperAdmin',
            approvalStatus: 'Approved',
            societyId: newSocietyId
        });

        // 3. Build the Society object with the pre-generated User ID attached
        const society = new Society({
            _id: newSocietyId,
            name: societyName,
            address,
            superAdmin: newUserId,
            uniqueJoinCode
        });

        // 4. Save both to the database simultaneously
        await superAdmin.save();
        await society.save();

        // Generate JWT token
        const token = jwt.sign(
            { id: superAdmin._id, role: superAdmin.role, societyId: society._id },
            process.env.JWT_SECRET,
            { expiresIn: '7d' }
        );

        res.status(201).json({
            message: 'Society and SuperAdmin account created successfully!',
            token,
            society: {
                id: society._id,
                name: society.name,
                address: society.address,
                uniqueJoinCode: society.uniqueJoinCode
            },
            user: {
                id: superAdmin._id,
                fullName: superAdmin.fullName,
                email: superAdmin.email,
                role: superAdmin.role
            }
        });
    } catch (error) {
        console.error('Society registration error:', error);
        res.status(500).json({ message: 'Server error during society registration.' });
    }
});

// --- REGISTER A NEW RESIDENT ---
// POST /api/auth/register-resident
// Body: { fullName, email, password, uniqueJoinCode, flatNumber }
router.post('/register-resident', async (req, res) => {
    try {
        const { fullName, email, password, uniqueJoinCode, flatNumber } = req.body;

        if (!fullName || !email || !password || !uniqueJoinCode || !flatNumber) {
            return res.status(400).json({ message: 'All fields are required.' });
        }

        // Find society by unique join code
        const society = await Society.findOne({ uniqueJoinCode: uniqueJoinCode.toUpperCase().trim() });
        if (!society) {
            return res.status(400).json({ message: 'Invalid join code. Please check and try again.' });
        }

        // Check if user with this email already exists
        const existingUser = await User.findOne({ email: email.toLowerCase().trim() });
        if (existingUser) {
            return res.status(400).json({ message: 'An account with this email already exists.' });
        }

        // Hash password
        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(password, salt);

        // Create User with role 'Resident' and approvalStatus 'Pending'
        const user = new User({
            fullName,
            email: email.toLowerCase().trim(),
            password: hashedPassword,
            role: 'Resident',
            approvalStatus: 'Pending',
            societyId: society._id
        });
        await user.save();

        // Auto-create or find the Flat by flatNumber within this society
        let flat = await Flat.findOne({ flatNumber, societyId: society._id });
        if (!flat) {
            flat = new Flat({
                flatNumber,
                societyId: society._id,
                currentTenants: [user._id]
            });
        } else {
            flat.currentTenants.push(user._id);
        }
        await flat.save();

        res.status(201).json({
            message: 'Registration submitted. Pending admin approval.'
        });
    } catch (error) {
        console.error('Resident registration error:', error);
        res.status(500).json({ message: 'Server error during registration.' });
    }
});

// --- LOGIN (any approved user) ---
// POST /api/auth/login
// Body: { email, password }
router.post('/login', async (req, res) => {
    try {
        const { email, password } = req.body;

        if (!email || !password) {
            return res.status(400).json({ message: 'Email and password are required.' });
        }

        const user = await User.findOne({ email: email.toLowerCase().trim() });
        if (!user) {
            return res.status(400).json({ message: 'Invalid email or password.' });
        }

        if (user.approvalStatus !== 'Approved') {
            return res.status(403).json({ message: 'Your account is pending approval or has been rejected.' });
        }

        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) {
            return res.status(400).json({ message: 'Invalid email or password.' });
        }

        const token = jwt.sign(
            { id: user._id, role: user.role, societyId: user.societyId },
            process.env.JWT_SECRET,
            { expiresIn: '7d' }
        );

        res.json({
            token,
            user: {
                id: user._id,
                fullName: user.fullName,
                email: user.email,
                role: user.role,
                societyId: user.societyId,
                approvalStatus: user.approvalStatus
            }
        });
    } catch (error) {
        console.error('Login error:', error);
        res.status(500).json({ message: 'Server error during authentication.' });
    }
});

module.exports = router;
