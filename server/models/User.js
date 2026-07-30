const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
    fullName: {
        type: String,
        required: true,
        trim: true
    },
    email: {
        type: String,
        required: true,
        unique: true,
        lowercase: true
    },
    phoneNumber: {
        type: String,
        trim: true,
        default: null
    },
    password: {
        type: String,
        required: true
    },
    role: {
        type: String,
        enum: ['PlatformAdmin', 'SuperAdmin', 'Admin', 'Treasurer', 'Resident', 'Security'],
        default: 'Resident'
    },
    societyId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Society',
        required: true
    },
    approvalStatus: {
        type: String,
        enum: ['Pending', 'Approved', 'Rejected'],
        default: 'Pending'
    },
    familyMembers: [{
        name: { type: String, required: true, trim: true },
        age: { type: Number, required: true, min: 0 },
        relation: { type: String, required: true, trim: true }
    }],
    pushSubscriptions: [{
        endpoint: { type: String, required: true },
        keys: {
            p256dh: { type: String, required: true },
            auth: { type: String, required: true }
        }
    }]
}, { timestamps: true });

module.exports = mongoose.model('User', userSchema);
