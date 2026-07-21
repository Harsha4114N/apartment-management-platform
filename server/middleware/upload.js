const cloudinary = require('cloudinary').v2;
const { CloudinaryStorage } = require('multer-storage-cloudinary');
const multer = require('multer');

// Configure Cloudinary with your .env credentials
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

// Set up the storage engine
const storage = new CloudinaryStorage({
  cloudinary: cloudinary,
  params: {
    folder: 'apartment_tickets', // This creates a neat folder in your Cloudinary dashboard
    allowed_formats: ['jpg', 'jpeg', 'png', 'webp'], // Only allow images
  },
});

// Create the multer upload instance
const upload = multer({ storage: storage });

module.exports = upload;