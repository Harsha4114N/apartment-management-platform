const express = require('express');
const bcrypt = require('bcryptjs');
const Society = require('../models/Society');
const Resident = require('../models/Resident');

const router = express.Router();

// --- LIST ALL SOCIETIES (for registration dropdown) ---
router.get('/', async (req, res) => {
    try {
        const societies = await Society.find()
            .select('_id name address')
            .sort({ name: 1 })
            .lean();

        res.status(200).json(societies);
    } catch (error) {
        console.error('Error fetching societies:', error);
        res.status(500).json({ message: 'Server error while fetching societies.' });
    }
});

// --- REGISTER A NEW SOCIETY + ADMIN (bootstrap) ---
router.post('/register', async (req, res) => {
    let adminId = null;

    try {
        const { societyName, societyAddress, fullName, email, password, flatNumber } = req.body;

        const normalizedEmail = email?.toLowerCase().trim();

        if (!societyName || !societyAddress || !fullName || !normalizedEmail || !password || !flatNumber) {
            return res.status(400).json({ message: 'All fields are required.' });
        }

        const existingResident = await Resident.findOne({ email: normalizedEmail });
        if (existingResident) {
            return res.status(400).json({
                message: 'An account with this email already exists. Please use a different admin email.'
            });
        }

        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(password, salt);

        const now = new Date();
        const insertResult = await Resident.collection.insertOne({
            fullName,
            email: normalizedEmail,
            password: hashedPassword,
            flatNumber,
            role: 'admin',
            createdAt: now,
            updatedAt: now
        });
        adminId = insertResult.insertedId;

        const society = new Society({
            name: societyName,
            address: societyAddress,
            adminId
        });
        await society.save();

        await Resident.findByIdAndUpdate(adminId, { societyId: society._id });

        res.status(201).json({
            message: 'Society and admin account created successfully!',
            society: { id: society._id, name: society.name, address: society.address }
        });
    } catch (error) {
        if (adminId) {
            await Resident.findByIdAndDelete(adminId).catch((cleanupErr) => {
                console.error('Failed to clean up admin after society registration error:', cleanupErr);
            });
        }

        console.error('Society registration error:', error);

        if (error.code === 11000) {
            return res.status(400).json({
                message: 'An account with this email already exists. Please use a different admin email.'
            });
        }

        res.status(500).json({ message: 'Server error during society registration.' });
    }
});

module.exports = router;
