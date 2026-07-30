const mongoose = require('mongoose');

const expenseSchema = new mongoose.Schema({
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
    amount: {
        type: Number,
        required: true,
        min: 0
    },
    date: {
        type: String,
        required: true
    },
    category: {
        type: String,
        enum: ['Maintenance', 'Repairs', 'Utilities', 'Security', 'Cleaning', 'Amenities', 'Events', 'Other'],
        default: 'Other'
    },
    splitType: {
        type: String,
        enum: ['NONE', 'ALL', 'TARGET'],
        default: 'NONE'
    },
    splitAcrossFlats: {
        type: Boolean,
        default: false
    },
    createdBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    }
}, { timestamps: true });

module.exports = mongoose.model('Expense', expenseSchema);
