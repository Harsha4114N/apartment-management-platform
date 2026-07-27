const mongoose = require('mongoose');

const flatSchema = new mongoose.Schema({
    flatNumber: {
        type: String,
        required: true,
        trim: true
    },
    societyId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Society',
        required: true
    },
    owner: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
    },
    currentTenants: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
    }]
}, { timestamps: true });

module.exports = mongoose.model('Flat', flatSchema);
