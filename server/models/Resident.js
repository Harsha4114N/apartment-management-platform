const mongoose = require('mongoose');

const residentSchema = new mongoose.Schema({
    fullName: {
        type: String,
        required: true,
        trim: true
    },
    email: {
        type: String,
        required: true,
        unique: true, // Prevents duplicate accounts
        lowercase: true
    },
    password: {
        type: String,
        required: true
    },
    flatNumber: {
        type: String,
        required: true
    },
    role: {
        type: String,
        enum: ['resident', 'admin', 'security'],
        default: 'resident'
    }
}, { timestamps: true }); // Automatically adds createdAt and updatedAt fields

module.exports = mongoose.model('Resident', residentSchema);