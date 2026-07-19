const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const Resident = require('../models/Resident');

const router = express.Router();

// --- REGISTER A NEW RESIDENT ---
router.post('/register', async (req, res) => {
    try {
        const { fullName, email, password, flatNumber } = req.body;

        // 1. Check if the resident already exists in the database
        const existingResident = await Resident.findOne({ email });
        if (existingResident) {
            return res.status(400).json({ message: "A resident with this email already exists." });
        }

        // 2. Encrypt (hash) the password
        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(password, salt);

        // 3. Create the new resident blueprint
        const newResident = new Resident({
            fullName,
            email,
            password: hashedPassword,
            flatNumber
        });

        // 4. Save to MongoDB
        await newResident.save();
        res.status(201).json({ message: "Resident registered successfully!" });

    } catch (error) {
        res.status(500).json({ error: "Server error during registration." });
    }
});
// --- RESIDENT LOGIN ---
router.post('/login', async (req, res) => {
    try {
        const { email, password } = req.body;

        // 1. Verify the resident exists
        const resident = await Resident.findOne({ email });
        if (!resident) {
            return res.status(400).json({ message: "Invalid email or password." });
        }

        // 2. Compare the entered password with the encrypted password in MongoDB
        const isMatch = await bcrypt.compare(password, resident.password);
        if (!isMatch) {
            return res.status(400).json({ message: "Invalid email or password." });
        }

        // 3. Generate a secure JSON Web Token payload containing the user ID and role
        const token = jwt.sign(
            { id: resident._id, role: resident.role },
            process.env.JWT_SECRET,
            { expiresIn: '1d' } // Token expires in 24 hours
        );

        // 4. Return the token and essential user data to the client application
        res.json({
            token,
            user: {
                id: resident._id,
                fullName: resident.fullName,
                email: resident.email,
                role: resident.role,
                flatNumber: resident.flatNumber
            }
        });

    } catch (error) {
        res.status(500).json({ error: "Server error during authentication." });
    }
});

module.exports = router;