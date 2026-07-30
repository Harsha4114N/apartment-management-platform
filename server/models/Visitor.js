const mongoose = require('mongoose');

const visitorSchema = new mongoose.Schema({
    societyId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Society',
        required: true
    },
    flatId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Flat'
    },
    flat: {
        type: String,
        required: true
    },
    host: {
        type: String,
        required: true
    },
    hostId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    name: {
        type: String,
        required: true,
        trim: true
    },
    phone: {
        type: String,
        default: '—'
    },
    purpose: {
        type: String,
        required: true
    },
    vehicle: {
        type: String,
        default: '—'
    },
    expectedDate: {
        type: String,
        required: true
    },
    expectedTime: {
        type: String,
        required: true
    },
    status: {
        type: String,
        enum: ['Expected', 'Checked-In', 'Checked-Out', 'Pending Approval', 'Approved', 'Rejected'],
        default: 'Expected'
    },
    photoUrl: {
        type: String,
        default: null
    },
    qrCode: {
        type: String,
        default: null
    },
    entryTime: {
        type: Date,
        default: null
    }
}, { timestamps: true });

module.exports = mongoose.model('Visitor', visitorSchema);
