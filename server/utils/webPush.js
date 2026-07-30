const webpush = require('web-push');

// ── VAPID Configuration ──
// Set these in your .env file:
//   VAPID_PUBLIC_KEY=<the public key>
//   VAPID_PRIVATE_KEY=<the private key>
//   VAPID_EMAIL=mailto:your-email@example.com

const vapidPublicKey = process.env.VAPID_PUBLIC_KEY;
const vapidPrivateKey = process.env.VAPID_PRIVATE_KEY;
const vapidEmail = process.env.VAPID_EMAIL || 'mailto:admin@nexusgate.app';

if (vapidPublicKey && vapidPrivateKey) {
    webpush.setVapidDetails(vapidEmail, vapidPublicKey, vapidPrivateKey);
    console.log('[WebPush] VAPID configured successfully.');
} else {
    console.warn('[WebPush] VAPID keys not found in .env — push notifications will fail.');
    console.warn('   Add VAPID_PUBLIC_KEY and VAPID_PRIVATE_KEY to your .env file.');
}

/**
 * Sends a push notification to all of a user's subscribed devices.
 * Non-blocking — failures are logged but never thrown.
 *
 * @param {Array} subscriptions - Array of push subscription objects from the user's document.
 * @param {string} title - Notification title.
 * @param {string} body - Notification body text.
 * @param {string} [url] - Optional URL to open when the notification is clicked.
 */
async function sendPushNotification(subscriptions, title, body, url) {
    if (!subscriptions || subscriptions.length === 0) {
        console.log('[WebPush] No subscriptions to notify.');
        return;
    }

    const payload = JSON.stringify({
        title,
        body,
        url: url || '/',
        timestamp: Date.now(),
    });

    const results = await Promise.allSettled(
        subscriptions.map(async (sub) => {
            try {
                await webpush.sendNotification(sub, payload);
                return { ok: true, endpoint: sub.endpoint };
            } catch (err) {
                // 410 Gone / 404 Not Found → subscription is stale, remove it later
                if (err.statusCode === 410 || err.statusCode === 404) {
                    console.warn('[WebPush] Stale subscription detected (Gone):', sub.endpoint);
                    return { ok: false, stale: true, endpoint: sub.endpoint };
                }
                console.error('[WebPush] Send error:', err.message);
                return { ok: false, stale: false, endpoint: sub.endpoint };
            }
        })
    );

    const staleEndpoints = results
        .filter((r) => r.status === 'fulfilled' && r.value.stale)
        .map((r) => r.value.endpoint);

    if (staleEndpoints.length > 0) {
        console.log(`[WebPush] ${staleEndpoints.length} stale subscription(s) detected.`);
        // Optional: emit a socket event or return stale endpoints so the caller
        // can clean them up from the user's document.
    }
}

module.exports = { sendPushNotification, webpush };
