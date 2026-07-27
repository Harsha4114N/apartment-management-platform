const cloudinary = require('cloudinary').v2;
const { CloudinaryStorage } = require('multer-storage-cloudinary');
const multer = require('multer');

// --- Cloudinary credentials validation ---
const CLOUD_NAME = process.env.CLOUDINARY_CLOUD_NAME;
const API_KEY = process.env.CLOUDINARY_API_KEY;
const API_SECRET = process.env.CLOUDINARY_API_SECRET;

if (!CLOUD_NAME || !API_KEY || !API_SECRET) {
  console.warn('⚠️  Cloudinary credentials missing in .env — Image uploads will fail.');
  console.warn('   Required: CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, CLOUDINARY_API_SECRET');
}

// Configure Cloudinary with your .env credentials
cloudinary.config({
  cloud_name: CLOUD_NAME,
  api_key: API_KEY,
  api_secret: API_SECRET,
});

// Check if Cloudinary is configured correctly
const isCloudinaryConfigured = !!(CLOUD_NAME && API_KEY && API_SECRET);

// Set up the storage engine
const storage = new CloudinaryStorage({
  cloudinary: cloudinary,
  params: {
    folder: 'apartment_tickets', // This creates a neat folder in your Cloudinary dashboard
    allowed_formats: ['jpg', 'jpeg', 'png', 'webp'], // Only allow images
  },
});

// Create the multer upload instance with a 5 MB file size limit
const upload = multer({
  storage: storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5 MB
});

// Middleware wrapper that checks Cloudinary config BEFORE multer processes the file.
// Returns a clean JSON 500 response instead of crashing the server.
const uploadWithFailsafe = {
  single: (fieldName) => (req, res, next) => {
    if (!isCloudinaryConfigured) {
      console.error('Image upload blocked: Cloudinary credentials are not configured.');
      return res.status(502).json({
        message: 'Image upload service is not configured correctly. Please contact the administrator.',
      });
    }
    upload.single(fieldName)(req, res, (err) => {
      if (err) {
        console.error('Upload middleware error:', err.message, err.code);
        if (err.code === 'LIMIT_FILE_SIZE') {
          return res.status(400).json({ message: 'File too large. Maximum allowed size is 5 MB.' });
        }
        return res.status(502).json({
          message: 'Image upload failed. The upload service may be misconfigured.',
        });
      }
      next();
    });
  },
};

module.exports = uploadWithFailsafe;
