/**
 * Database Reset Script
 * 
 * Connects to MongoDB using the MONGO_URI from .env and deletes all documents
 * from every collection (User, Society, Flat, Bill, Ticket, Resident).
 * 
 * Usage:  node reset-db.js
 */

const mongoose = require('mongoose');
const dotenv = require('dotenv');
const path = require('path');

// Load .env from the server directory
dotenv.config({ path: path.join(__dirname, '.env') });

const User = require('./models/User');
const Society = require('./models/Society');
const Flat = require('./models/Flat');
const Bill = require('./models/Bill');
const Ticket = require('./models/Ticket');
const Resident = require('./models/Resident');

async function resetDatabase() {
    const uri = process.env.MONGO_URI;
    if (!uri) {
        console.error('❌ MONGO_URI is not defined in .env');
        process.exit(1);
    }

    try {
        console.log('🔌 Connecting to MongoDB...');
        await mongoose.connect(uri);
        console.log('✅ Connected to MongoDB\n');

        console.log('🗑️  Deleting all documents...\n');

        const results = await Promise.all([
            User.deleteMany({}),
            Society.deleteMany({}),
            Flat.deleteMany({}),
            Bill.deleteMany({}),
            Ticket.deleteMany({}),
            Resident.deleteMany({})
        ]);

        const labels = ['Users', 'Societies', 'Flats', 'Bills', 'Tickets', 'Residents'];
        labels.forEach((label, i) => {
            console.log(`   ✅ ${label}: ${results[i].deletedCount} documents deleted`);
        });

        console.log('\n🎉 Database reset complete!');
    } catch (error) {
        console.error('❌ Error resetting database:', error.message);
        process.exit(1);
    } finally {
        await mongoose.disconnect();
        console.log('🔌 Disconnected from MongoDB');
        process.exit(0);
    }
}

resetDatabase();
