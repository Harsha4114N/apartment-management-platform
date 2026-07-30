/**
 * uploadToCloudStorage
 *
 * Production Cloudinary upload utility.
 * Accepts file data (Base64 data-URI, Buffer, or file path) and uploads
 * to Cloudinary under the configured folder. Falls back to empty string
 * on any failure so the caller's main request is never blocked.
 *
 * @param {Object|string} fileData - The file to upload.
 *   Supported formats:
 *     - string: Base64 data-URI starting with "data:image/..."
 *     - { buffer: Buffer, mimetype: string }  (from multer / Base64 decode)
 *     - { path: string }                       (existing file on disk)
 *
 * @returns {Promise<string>} Secure URL of the uploaded image, or '' on failure.
 */
const cloudinary = require('cloudinary').v2;

// ── Cloudinary Configuration ──
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

const UPLOAD_FOLDER = 'nexusgate/tickets';

async function uploadToCloudStorage(fileData) {
  try {
    let uploadResult;

    if (typeof fileData === 'string' && fileData.startsWith('data:image/')) {
      // ── Case 1: Base64 data-URI (from camera snapshot) ──
      console.log('[Cloudinary] Uploading Base64 data-URI...');
      uploadResult = await cloudinary.uploader.upload(fileData, {
        folder: UPLOAD_FOLDER,
        resource_type: 'image',
      });
    } else if (fileData && fileData.buffer) {
      // ── Case 2: Buffer (from multer or decodeBase64Image) ──
      console.log('[Cloudinary] Uploading buffer...');
      uploadResult = await new Promise((resolve, reject) => {
        const uploadStream = cloudinary.uploader.upload_stream(
          {
            folder: UPLOAD_FOLDER,
            resource_type: 'image',
            public_id: `ticket_${Date.now()}`,
          },
          (error, result) => {
            if (error) return reject(error);
            resolve(result);
          }
        );
        uploadStream.end(fileData.buffer);
      });
    } else if (fileData && fileData.path) {
      // ── Case 3: File path on disk ──
      console.log('[Cloudinary] Uploading file from path:', fileData.path);
      uploadResult = await cloudinary.uploader.upload(fileData.path, {
        folder: UPLOAD_FOLDER,
        resource_type: 'image',
      });
    } else {
      console.warn('[Cloudinary] Unknown fileData format — falling back to empty URL.');
      return '';
    }

    console.log('[Cloudinary] Upload successful — URL:', uploadResult.secure_url);
    return uploadResult.secure_url;
  } catch (error) {
    // Non-blocking: log the error but return empty string so the main request continues
    console.error('[Cloudinary] Upload failed:', error.message);
    if (error.http_code) {
      console.error('[Cloudinary] HTTP Code:', error.http_code);
    }
    return '';
  }
}

/**
 * decodeBase64Image
 *
 * Helper to convert a Base64 data-URI string into a { buffer, mimetype } object
 * suitable for passing to uploadToCloudStorage.
 *
 * @param {string} dataUri - e.g. "data:image/jpeg;base64,/9j/4AAQ..."
 * @returns {{ buffer: Buffer, mimetype: string }}
 */
function decodeBase64Image(dataUri) {
  const matches = dataUri.match(/^data:([A-Za-z-+/]+);base64,(.+)$/);
  if (!matches || matches.length !== 3) {
    throw new Error('Invalid Base64 data-URI format');
  }

  const mimetype = matches[1];
  const base64Data = matches[2];
  const buffer = Buffer.from(base64Data, 'base64');

  return { buffer, mimetype };
}

module.exports = { uploadToCloudStorage, decodeBase64Image };
