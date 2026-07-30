const express = require('express');
const User = require('../models/User');
const auth = require('../middleware/authMiddleware');

const router = express.Router();

// All routes require authentication
router.use(auth);

// --- SUBSCRIBE TO PUSH NOTIFICATIONS ---
// POST /api/users/push-subscribe
// Body: { endpoint, keys: { p256dh, auth } }
router.post('/push-subscribe', async (req, res) => {
    try {
        const { endpoint, keys } = req.body;

        if (!endpoint || !keys || !keys.p256dh || !keys.auth) {
            return res.status(400).json({ message: 'Invalid subscription object. Requires endpoint and keys (p256dh, auth).' });
        }

        const user = await User.findById(req.user.id);
        if (!user) {
            return res.status(404).json({ message: 'User not found.' });
        }

        // Check if this endpoint already exists to avoid duplicates
        const existingIndex = user.pushSubscriptions.findIndex(
            (sub) => sub.endpoint === endpoint
        );

        if (existingIndex >= 0) {
            // Update existing subscription keys
            user.pushSubscriptions[existingIndex].keys = keys;
            console.log('[PushSubscribe] Updated existing subscription for user:', req.user.id);
        } else {
            // Add new subscription
            user.pushSubscriptions.push({ endpoint, keys });
            console.log('[PushSubscribe] New subscription added for user:', req.user.id);
        }

        await user.save();
        res.status(201).json({ message: 'Push subscription saved successfully.' });
    } catch (error) {
        console.error('Error saving push subscription:', error);
        res.status(500).json({ message: 'Server error while saving push subscription.' });
    }
});

// --- GET USER PROFILE ---
// GET /api/users/profile
// Returns the logged-in user's full profile data (including familyMembers)
router.get('/profile', async (req, res) => {
    try {
        const user = await User.findById(req.user.id)
            .select('fullName email phoneNumber role societyId familyMembers createdAt')
            .lean();

        if (!user) {
            return res.status(404).json({ message: 'User not found.' });
        }

        res.status(200).json({ user });
    } catch (error) {
        console.error('Error fetching profile:', error);
        res.status(500).json({ message: 'Server error while fetching profile.' });
    }
});

// --- UPDATE FAMILY MEMBERS ---
// PUT /api/users/profile/family
// Body: { familyMembers: [{ name, age, relation }] }
// Replaces the entire familyMembers array for the logged-in user
router.put('/profile/family', async (req, res) => {
    try {
        const { familyMembers } = req.body;

        if (!Array.isArray(familyMembers)) {
            return res.status(400).json({ message: 'familyMembers must be an array.' });
        }

        // Validate each member entry
        for (let i = 0; i < familyMembers.length; i++) {
            const member = familyMembers[i];
            if (!member.name || typeof member.name !== 'string' || !member.name.trim()) {
                return res.status(400).json({ message: `Family member at index ${i} is missing a valid name.` });
            }
            if (member.age === undefined || member.age === null || typeof member.age !== 'number' || member.age < 0) {
                return res.status(400).json({ message: `Family member at index ${i} is missing a valid age.` });
            }
            if (!member.relation || typeof member.relation !== 'string' || !member.relation.trim()) {
                return res.status(400).json({ message: `Family member at index ${i} is missing a valid relation.` });
            }
        }

        const user = await User.findByIdAndUpdate(
            req.user.id,
            { familyMembers },
            { new: true, runValidators: true }
        ).select('familyMembers');

        if (!user) {
            return res.status(404).json({ message: 'User not found.' });
        }

        console.log(`[Profile] Family members updated for user ${req.user.id}: ${familyMembers.length} members.`);

        res.status(200).json({
            message: 'Family members updated successfully.',
            familyMembers: user.familyMembers
        });
    } catch (error) {
        console.error('Error updating family members:', error);
        res.status(500).json({ message: 'Server error while updating family members.' });
    }
});

module.exports = router;
