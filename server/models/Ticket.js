const mongoose = require('mongoose');

const ticketSchema = new mongoose.Schema({
    // This creates a direct relational link to the Resident who created the ticket
    resident: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Resident',
        required: true
    },
    title: {
        type: String,
        required: true,
        trim: true
    },
    description: {
        type: String,
        required: true
    },
    // NEW: Cloudinary Image URL storage
    imageUrl: {
        type: String,
        default: '' // Defaults to an empty string if no picture is uploaded
    },
    category: {
        type: String,
        enum: ['Electrical', 'Plumbing', 'Carpentry', 'Security', 'General'],
        required: true
    },
    status: {
        type: String,
        enum: ['Open', 'In-Progress', 'Resolved'],
        default: 'Open'
    },
    priority: {
        type: String,
        enum: ['Low', 'Medium', 'High', 'Emergency'],
        default: 'Low'
    }
    flatNumber: {
    type: String,
    required: true
    }
}, { timestamps: true });

module.exports = mongoose.model('Ticket', ticketSchema);