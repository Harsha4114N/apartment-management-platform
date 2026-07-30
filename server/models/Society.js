const mongoose = require('mongoose');

const societySchema = new mongoose.Schema({
    name: {
        type: String,
        required: true,
        trim: true
    },
    address: {
        type: String,
        required: true,
        trim: true
    },
    uniqueJoinCode: {
        type: String,
        required: true,
        unique: true,
        trim: true
    },
    superAdmin: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    maintenanceFee: {
        type: Number,
        default: 2000,
        min: 0
    }
}, { timestamps: true });

module.exports = mongoose.model('Society', societySchema);
