const twilio = require('twilio');

// ── Twilio Client Initialization ──
// Initialize once and reuse across all routes. If env vars are missing,
// client will be null and sendWhatsApp will skip gracefully.
let client = null;
try {
  if (process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN) {
    client = twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);
    console.log('WhatsApp: Twilio client initialized successfully.');
  } else {
    console.warn('WhatsApp: Twilio credentials not found in env. WhatsApp notifications are disabled.');
  }
} catch (err) {
  console.error('WhatsApp: Failed to initialize Twilio client:', err.message);
}

/**
 * Sends a WhatsApp message via Twilio.
 *
 * @param {string} body       - The message body (supports Twilio WhatsApp formatting)
 * @param {object} [options]  - Optional overrides
 * @param {string} [options.to]      - Recipient WhatsApp number (defaults to MY_PHONE_NUMBER env)
 * @param {string} [options.from]    - Sender number (defaults to Twilio sandbox)
 * @param {string[]} [options.mediaUrls] - Optional array of media URLs to attach
 * @returns {Promise<boolean>} true if sent successfully, false otherwise
 */
async function sendWhatsApp(body, options = {}) {
  // If Twilio client isn't initialized, skip silently
  if (!client) {
    console.warn('WhatsApp: Skipped — Twilio client not initialized.');
    return false;
  }

  const recipient = options.to || process.env.MY_PHONE_NUMBER;
  const sender = options.from || 'whatsapp:+14155238886';

  if (!recipient) {
    console.warn('WhatsApp: Skipped — No recipient phone number configured.');
    return false;
  }

  try {
    const payload = {
      body,
      from: sender,
      to: `whatsapp:${recipient}`,
    };

    if (options.mediaUrls && options.mediaUrls.length > 0) {
      payload.mediaUrl = options.mediaUrls;
    }

    await client.messages.create(payload);
    console.log(`WhatsApp: Message sent successfully to ${recipient}`);
    return true;
  } catch (error) {
    // Non-blocking: log the error but DO NOT throw or crash the request
    console.error('WhatsApp Notification Error:', error.message);
    if (error.stack && process.env.NODE_ENV !== 'production') {
        console.error('WhatsApp Notification Stack:', error.stack);
    }
    return false;
  }
}

module.exports = { sendWhatsApp };
