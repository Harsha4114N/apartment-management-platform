const mongoose = require('mongoose');

const announcementSchema = new mongoose.Schema({
    societyId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Society',
        required: true
    },
    title: {
        type: String,
        required: true,
        trim: true
    },
    message: {
        type: String,
        required: true
    },
    category: {
        type: String,
        enum: ['Emergency', 'Notice', 'Maintenance', 'General'],
        default: 'General'
    },
    target: {
        type: String,
        default: 'All Residents'
    },
    author: {
        type: String,
        default: 'Admin'
    },
    createdBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    }
}, { timestamps: true });

module.exports = mongoose.model('Announcement', announcementSchema);
