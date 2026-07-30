const express = require('express');
const multer = require('multer');
const QRCode = require('qrcode');
const Visitor = require('../models/Visitor');
const Flat = require('../models/Flat');
const User = require('../models/User');
const auth = require('../middleware/authMiddleware');
const { uploadToCloudStorage } = require('../utils/cloudStorage');
const { getIO } = require('../utils/socket');
const { sendPushNotification } = require('../utils/webPush');

const router = express.Router();

// Memory-storage multer for visitor photo uploads (non-blocking Cloudinary)
const visitorUpload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 5 * 1024 * 1024 } // 5 MB
});

// All routes require authentication
router.use(auth);

// --- GET ALL VISITORS ---
// GET /api/visitors
// Admin: all visitors in society | Resident: only their own flat's visitors
router.get('/', async (req, res) => {
    try {
        if (!req.user.societyId) {
            return res.status(403).json({ message: 'No society associated with this account.' });
        }

        const isAdmin = req.user.role === 'SuperAdmin' || req.user.role === 'Admin' || req.user.role === 'Security';
        let query = { societyId: req.user.societyId };

        if (!isAdmin) {
            // Resident: find their flat number first
            const flat = await Flat.findOne({
                societyId: req.user.societyId,
                $or: [
                    { owner: req.user.id },
                    { currentTenants: req.user.id }
                ]
            });

            if (flat) {
                query.flat = flat.flatNumber;
            } else {
                // Fallback: filter by hostId
                query.hostId = req.user.id;
            }
        }

        const visitors = await Visitor.find(query)
            .sort({ createdAt: -1 })
            .lean();

        res.status(200).json(visitors);
    } catch (error) {
        console.error('Error fetching visitors:', error);
        res.status(500).json({ message: 'Server error while fetching visitors.' });
    }
});

// --- CREATE A VISITOR PASS (Resident any role) ---
// POST /api/visitors
// Body (JSON): { name, phone, purpose, vehicle, expectedDate, expectedTime, photoUrl? }
// Or (multipart): form fields + "photo" file upload → non-blocking Cloudinary
router.post('/', visitorUpload.single('photo'), async (req, res) => {
    try {
        if (!req.user.societyId) {
            return res.status(403).json({ message: 'No society associated with this account.' });
        }

        const { name, phone, purpose, vehicle, expectedDate, expectedTime, photoUrl: bodyPhotoUrl } = req.body;

        if (!name || !purpose || !expectedDate || !expectedTime) {
            return res.status(400).json({ message: 'Name, purpose, expectedDate, and expectedTime are required.' });
        }

        // Find the user's flat
        const flat = await Flat.findOne({
            societyId: req.user.societyId,
            $or: [
                { owner: req.user.id },
                { currentTenants: req.user.id }
            ]
        });

        const flatNumber = flat ? flat.flatNumber : 'Unknown';

        // ── Photo upload to Cloudinary (non-blocking) ──
        // If a file was uploaded via multipart, try Cloudinary; otherwise use bodyPhotoUrl from JSON
        let photoUrl = req.file ? null : (bodyPhotoUrl || null);
        if (req.file) {
            try {
                // uploadToCloudStorage already has internal try/catch → returns '' on failure
                photoUrl = await uploadToCloudStorage(req.file);
                if (!photoUrl) photoUrl = null; // normalize empty string to null
            } catch (cloudErr) {
                console.error('[Visitors] Cloudinary upload error (non-blocking):', cloudErr.message);
                // photoUrl stays null — visitor saved without image
            }
        }

        const visitor = new Visitor({
            societyId: req.user.societyId,
            flat: flatNumber,
            host: 'You',
            hostId: req.user.id,
            name,
            phone: phone || '—',
            purpose,
            vehicle: vehicle || '—',
            expectedDate,
            expectedTime,
            photoUrl: photoUrl || null,
            status: 'Expected'
        });

        await visitor.save();

        // ── Generate QR Code for this visitor (non-blocking) ──
        try {
            const qrData = JSON.stringify({ visitorId: visitor._id });
            const qrCodeDataUri = await QRCode.toDataURL(qrData);
            visitor.qrCode = qrCodeDataUri;
            await visitor.save();
        } catch (qrErr) {
            console.error('[Visitors] QR generation error (non-blocking):', qrErr.message);
        }

        // ── Web Push Notification to Resident (non-blocking, replaces Twilio/WhatsApp) ──
        try {
            const residentUser = await User.findById(req.user.id).lean();
            const subscriptions = residentUser?.pushSubscriptions || [];
            if (subscriptions.length > 0) {
                await sendPushNotification(
                    subscriptions,
                    '🚪 Visitor Access Pass Generated',
                    `${name} is visiting on ${expectedDate} at ${expectedTime} — Purpose: ${purpose}`,
                    '/visitors'
                );
                console.log('[WebPush] Visitor notification sent to resident:', req.user.id);
            } else {
                console.log('[WebPush] No push subscriptions for resident — notification skipped.');
            }
        } catch (pushErr) {
            console.error('[WebPush] Visitor notification error (non-blocking):', pushErr.message);
        }

        res.status(201).json(visitor);
    } catch (error) {
        console.error('Error creating visitor:', error);
        res.status(500).json({ message: 'Server error while creating visitor pass.' });
    }
});

// --- UPDATE VISITOR STATUS (Admin only) ---
// PUT /api/visitors/:id/status
// Body: { status } — 'Checked-In' or 'Checked-Out'
router.put('/:id/status', async (req, res) => {
    try {
        if (req.user.role !== 'SuperAdmin' && req.user.role !== 'Admin' && req.user.role !== 'Security') {
            return res.status(403).json({ message: 'Access denied. Admin or Security privileges required.' });
        }

        const { status } = req.body;
        const validStatuses = ['Expected', 'Checked-In', 'Checked-Out'];

        if (!status || !validStatuses.includes(status)) {
            return res.status(400).json({ message: `Invalid status. Must be one of: ${validStatuses.join(', ')}` });
        }

        const visitor = await Visitor.findOneAndUpdate(
            { _id: req.params.id, societyId: req.user.societyId },
            { status },
            { new: true }
        ).lean();

        if (!visitor) {
            return res.status(404).json({ message: 'Visitor not found.' });
        }

        res.json(visitor);
    } catch (error) {
        console.error('Error updating visitor status:', error);
        res.status(500).json({ message: 'Server error while updating visitor status.' });
    }
});

// --- VERIFY QR CODE (Security) ---
// POST /api/visitors/verify-qr
// Body: { visitorId } — extracted from scanned QR code
// Checks visitor exists, status is Expected, then updates to Checked-In
router.post('/verify-qr', async (req, res) => {
    try {
        if (req.user.role !== 'Security' && req.user.role !== 'SuperAdmin' && req.user.role !== 'Admin') {
            return res.status(403).json({ message: 'Access denied. Security or Admin privileges required.' });
        }

        const { visitorId } = req.body;

        if (!visitorId) {
            return res.status(400).json({ message: 'Visitor ID is required.' });
        }

        const visitor = await Visitor.findOne({
            _id: visitorId,
            societyId: req.user.societyId
        }).lean();

        if (!visitor) {
            return res.status(404).json({ message: 'Visitor not found.' });
        }

        if (visitor.status === 'Checked-In') {
            return res.status(400).json({
                message: 'Visitor already checked in.',
                visitor: {
                    name: visitor.name,
                    flat: visitor.flat,
                    purpose: visitor.purpose,
                    status: visitor.status,
                    entryTime: visitor.entryTime
                }
            });
        }

        if (visitor.status === 'Checked-Out') {
            return res.status(400).json({
                message: 'Visitor has already checked out.',
                visitor: {
                    name: visitor.name,
                    flat: visitor.flat,
                    purpose: visitor.purpose,
                    status: visitor.status
                }
            });
        }

        // Update to Checked-In
        const updatedVisitor = await Visitor.findOneAndUpdate(
            { _id: visitorId, societyId: req.user.societyId },
            { status: 'Checked-In', entryTime: new Date() },
            { new: true }
        ).lean();

        res.status(200).json({
            message: 'ACCESS GRANTED',
            visitor: {
                name: updatedVisitor.name,
                flat: updatedVisitor.flat,
                host: updatedVisitor.host,
                purpose: updatedVisitor.purpose,
                phone: updatedVisitor.phone,
                vehicle: updatedVisitor.vehicle,
                status: updatedVisitor.status,
                entryTime: updatedVisitor.entryTime
            }
        });
    } catch (error) {
        console.error('Error verifying QR:', error);
        res.status(500).json({ message: 'Server error while verifying QR code.' });
    }
});

// --- WALK-IN VISITOR (Security) ---
// POST /api/visitors/walk-in
// Body: { name, phone, purpose, vehicle, flat, flatId }
// If flatId is provided, looks up the flat's resident as host and sets status to 'Pending Approval'.
// If no flatId, falls back to 'Pending Approval' with Security as host.
router.post('/walk-in', async (req, res) => {
    try {
        if (req.user.role !== 'Security' && req.user.role !== 'SuperAdmin' && req.user.role !== 'Admin') {
            return res.status(403).json({ message: 'Access denied. Security or Admin privileges required.' });
        }

        const { name, phone, purpose, vehicle, flat, flatId } = req.body;

        if (!name || !purpose) {
            return res.status(400).json({ message: 'Name and purpose are required.' });
        }

        const now = new Date();

        let flatNumber = flat || 'Gate Entry';
        let hostName = 'Security';
        let hostUserId = req.user.id;

        // If a destination flat was selected, look up the resident
        if (flatId) {
            const destinationFlat = await Flat.findOne({
                _id: flatId,
                societyId: req.user.societyId
            }).lean();

            if (destinationFlat) {
                flatNumber = destinationFlat.flatNumber;

                // Find the resident (owner first, then first tenant)
                if (destinationFlat.owner) {
                    const owner = await User.findById(destinationFlat.owner).select('fullName').lean();
                    if (owner) {
                        hostName = owner.fullName;
                        hostUserId = destinationFlat.owner;
                    }
                } else if (destinationFlat.currentTenants && destinationFlat.currentTenants.length > 0) {
                    const tenant = await User.findById(destinationFlat.currentTenants[0]).select('fullName').lean();
                    if (tenant) {
                        hostName = tenant.fullName;
                        hostUserId = destinationFlat.currentTenants[0];
                    }
                }
            }
        }

        const visitor = new Visitor({
            societyId: req.user.societyId,
            flat: flatNumber,
            flatId: flatId || undefined,
            host: hostName,
            hostId: hostUserId,
            name,
            phone: phone || '—',
            purpose,
            vehicle: vehicle || '—',
            expectedDate: now.toISOString().split('T')[0],
            expectedTime: now.toTimeString().split(' ')[0].slice(0, 5),
            status: 'Pending Approval'
        });

        await visitor.save();

        // ── Web Push Notification to Resident (non-blocking) ──
        if (hostUserId !== req.user.id) {
            try {
                const residentUser = await User.findById(hostUserId).select('pushSubscriptions').lean();
                const subscriptions = residentUser?.pushSubscriptions || [];
                if (subscriptions.length > 0) {
                    await sendPushNotification(
                        subscriptions,
                        '🚪 Walk-in Visitor — Pending Approval',
                        `${name} is at the gate for ${purpose}. Approve or reject this entry.`,
                        '/visitors'
                    );
                }
            } catch (pushErr) {
                console.error('[WebPush] Walk-in notification error (non-blocking):', pushErr.message);
            }
        }

        // ── Socket.io real-time emission ──
        try {
            const io = getIO();
            io.to(`society:${req.user.societyId}`).emit('visitor:walkin', visitor.toObject());
            console.log('[Socket.io] visitor:walkin emitted for', visitor.name);
        } catch (socketErr) {
            console.error('[Socket.io] Emission error (non-blocking):', socketErr.message);
        }

        res.status(201).json({
            message: 'Walk-in visitor logged. Awaiting resident approval.',
            visitor
        });
    } catch (error) {
        console.error('Error creating walk-in visitor:', error);
        res.status(500).json({ message: 'Server error while logging walk-in visitor.' });
    }
});

// --- APPROVE WALK-IN VISITOR (Resident / Admin) ---
// PUT /api/visitors/:id/approve
// Sets status to 'Approved' and records entryTime
router.put('/:id/approve', async (req, res) => {
    try {
        const visitor = await Visitor.findOne({
            _id: req.params.id,
            societyId: req.user.societyId
        }).lean();

        if (!visitor) {
            return res.status(404).json({ message: 'Visitor not found.' });
        }

        if (visitor.status !== 'Pending Approval') {
            return res.status(400).json({ message: `Cannot approve visitor with status "${visitor.status}".` });
        }

        // Only the assigned host (resident) or Admin/SuperAdmin can approve
        const isAdmin = req.user.role === 'SuperAdmin' || req.user.role === 'Admin';
        const isHost = req.user.id === visitor.hostId.toString();

        if (!isAdmin && !isHost) {
            return res.status(403).json({ message: 'Access denied. Only the assigned resident or admin can approve.' });
        }

        const updatedVisitor = await Visitor.findOneAndUpdate(
            { _id: req.params.id, societyId: req.user.societyId },
            { status: 'Approved', entryTime: new Date() },
            { new: true }
        ).lean();

        // ── Socket.io real-time emission ──
        try {
            const io = getIO();
            io.to(`society:${req.user.societyId}`).emit('visitor:status', updatedVisitor);
            console.log('[Socket.io] visitor:status emitted — approved:', updatedVisitor.name);
        } catch (socketErr) {
            console.error('[Socket.io] Emission error (non-blocking):', socketErr.message);
        }

        res.status(200).json({
            message: 'Visitor approved. Entry granted.',
            visitor: updatedVisitor
        });
    } catch (error) {
        console.error('Error approving visitor:', error);
        res.status(500).json({ message: 'Server error while approving visitor.' });
    }
});

// --- REJECT WALK-IN VISITOR (Resident / Admin) ---
// PUT /api/visitors/:id/reject
// Sets status to 'Rejected'
router.put('/:id/reject', async (req, res) => {
    try {
        const visitor = await Visitor.findOne({
            _id: req.params.id,
            societyId: req.user.societyId
        }).lean();

        if (!visitor) {
            return res.status(404).json({ message: 'Visitor not found.' });
        }

        if (visitor.status !== 'Pending Approval') {
            return res.status(400).json({ message: `Cannot reject visitor with status "${visitor.status}".` });
        }

        // Only the assigned host (resident) or Admin/SuperAdmin can reject
        const isAdmin = req.user.role === 'SuperAdmin' || req.user.role === 'Admin';
        const isHost = req.user.id === visitor.hostId.toString();

        if (!isAdmin && !isHost) {
            return res.status(403).json({ message: 'Access denied. Only the assigned resident or admin can reject.' });
        }

        const updatedVisitor = await Visitor.findOneAndUpdate(
            { _id: req.params.id, societyId: req.user.societyId },
            { status: 'Rejected' },
            { new: true }
        ).lean();

        // ── Socket.io real-time emission ──
        try {
            const io = getIO();
            io.to(`society:${req.user.societyId}`).emit('visitor:status', updatedVisitor);
            console.log('[Socket.io] visitor:status emitted — rejected:', updatedVisitor.name);
        } catch (socketErr) {
            console.error('[Socket.io] Emission error (non-blocking):', socketErr.message);
        }

        res.status(200).json({
            message: 'Visitor rejected. Entry denied.',
            visitor: updatedVisitor
        });
    } catch (error) {
        console.error('Error rejecting visitor:', error);
        res.status(500).json({ message: 'Server error while rejecting visitor.' });
    }
});

module.exports = router;
