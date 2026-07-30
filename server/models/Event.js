const mongoose = require('mongoose');

const eventSchema = new mongoose.Schema({
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
    date: {
        type: String,
        required: true
    },
    time: {
        type: String,
        required: true
    },
    location: {
        type: String,
        required: true
    },
    category: {
        type: String,
        enum: ['Meeting', 'Festival', 'Workshop', 'Wellness', 'Sports', 'Social'],
        default: 'Meeting'
    },
    description: {
        type: String,
        required: true
    },
    rsvpCount: {
        type: Number,
        default: 0
    },
    maxCapacity: {
        type: Number,
        default: 100
    },
    createdBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    attendees: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
    }]
}, { timestamps: true });

module.exports = mongoose.model('Event', eventSchema);
