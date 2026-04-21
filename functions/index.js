const { onDocumentCreated, onDocumentUpdated } = require('firebase-functions/v2/firestore');
const admin = require('firebase-admin');
const https = require('https');
const sgMail = require('@sendgrid/mail');

admin.initializeApp();

// ─── CONFIG ───────────────────────────────────────────────────────────────────
// ⚠️  Replace these placeholders before deploying
const SENDGRID_API_KEY  = 'SG.PLACEHOLDER_REPLACE_ME';
const SENDER_EMAIL      = 'bookings@eekurtbarbers.co.uk';  // must be verified in SendGrid
const SENDER_NAME       = 'EE Kurt Barbers';

// ⚠️  Create a new Telegram bot via @BotFather and fill in below
const TELEGRAM_TOKEN    = 'YOUR_TELEGRAM_BOT_TOKEN';
const TELEGRAM_CHAT_ID  = 'YOUR_TELEGRAM_CHAT_ID';

sgMail.setApiKey(SENDGRID_API_KEY);

// ─── HELPERS ──────────────────────────────────────────────────────────────────
function sendTelegram(message) {
  return new Promise((resolve, reject) => {
    const body = JSON.stringify({ chat_id: TELEGRAM_CHAT_ID, text: message, parse_mode: 'HTML' });
    const options = {
      hostname: 'api.telegram.org',
      path: `/bot${TELEGRAM_TOKEN}/sendMessage`,
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body) },
    };
    const req = https.request(options, (res) => {
      res.on('data', () => {});
      res.on('end', resolve);
    });
    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

function formatDateTime(startTime) {
  if (!startTime) return 'N/A';
  const d = startTime.toDate ? startTime.toDate() : new Date(startTime);
  return d.toLocaleString('en-GB', {
    weekday: 'long', day: '2-digit', month: 'long',
    year: 'numeric', hour: '2-digit', minute: '2-digit',
    timeZone: 'Europe/London',
  });
}

// ─── ON BOOKING CREATED (PENDING) ─────────────────────────────────────────────
exports.onEekurtBookingCreated = onDocumentCreated(
  {
    region: 'us-central1',
    document: 'tenants/eekurt/bookings/{bookingId}',
  },
  async (event) => {
    const data = event.data ? event.data.data() : null;
    if (!data || data.status !== 'PENDING') return null;

    const dateTimeStr = formatDateTime(data.startTime);

    // ── Telegram notification to barber ──
    const tgMsg =
      `✂️ <b>NEW BOOKING REQUEST</b>\n\n` +
      `👤 <b>${data.clientName}</b>\n` +
      `📧 ${data.clientEmail}\n` +
      `📞 ${data.clientPhone}\n` +
      `✂️ Barber: ${data.barberId}\n` +
      `💈 Service: ${data.serviceId}\n` +
      `📅 ${dateTimeStr}\n` +
      `🔑 ${data.bookingId}\n\n` +
      `⚠️ Please confirm in the barber panel.`;

    try { await sendTelegram(tgMsg); } catch (e) { console.error('Telegram error:', e); }

    // ── SendGrid email to customer ──
    if (!data.clientEmail) return null;
    const emailHtml = `
      <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;background:#0d0d0d;color:#f0f0f0;border:1px solid #333;border-radius:8px;overflow:hidden;">
        <div style="background:#111;padding:32px;text-align:center;border-bottom:1px solid #222;">
          <h1 style="font-family:Georgia,serif;font-size:22px;letter-spacing:4px;color:#c8c8c8;margin:0;">EE KURT BARBERS</h1>
          <p style="color:#888;font-size:12px;letter-spacing:2px;margin:8px 0 0;">Traditional Grooming, Modern Excellence</p>
        </div>
        <div style="padding:32px;">
          <h2 style="color:#c8c8c8;font-size:18px;margin:0 0 16px;">Booking Received ⏳</h2>
          <p style="color:#bbb;line-height:1.7;">Hi <strong style="color:#e8e8e8;">${data.clientName}</strong>,</p>
          <p style="color:#bbb;line-height:1.7;">We've received your appointment request. Our team will confirm it shortly.</p>
          <div style="background:#1a1a1a;border:1px solid #333;border-radius:6px;padding:20px;margin:24px 0;">
            <p style="margin:4px 0;color:#888;font-size:13px;"><strong style="color:#c8c8c8;">📅 Date &amp; Time:</strong> ${dateTimeStr}</p>
            <p style="margin:4px 0;color:#888;font-size:13px;"><strong style="color:#c8c8c8;">✂️ Service:</strong> ${data.serviceId}</p>
            <p style="margin:4px 0;color:#888;font-size:13px;"><strong style="color:#c8c8c8;">💈 Barber:</strong> ${data.barberId}</p>
            <p style="margin:4px 0;color:#888;font-size:13px;"><strong style="color:#c8c8c8;">🔑 Booking ID:</strong> ${data.bookingId}</p>
          </div>
          <p style="color:#bbb;line-height:1.7;">Need to change or cancel? Call us at <strong style="color:#e8e8e8;">020 7833 1525</strong>.</p>
        </div>
        <div style="background:#0a0a0a;padding:20px;text-align:center;border-top:1px solid #222;">
          <p style="color:#555;font-size:11px;margin:0;">EE Kurt Barbers · 020 7833 1525</p>
        </div>
      </div>`;

    try {
      await sgMail.send({
        to: data.clientEmail,
        from: { email: SENDER_EMAIL, name: SENDER_NAME },
        subject: `Booking Request Received – ${data.bookingId}`,
        html: emailHtml,
      });
    } catch (e) { console.error('SendGrid error:', e.response ? e.response.body : e); }

    return null;
  }
);

// ─── ON BOOKING CONFIRMED ─────────────────────────────────────────────────────
exports.onEekurtBookingConfirmed = onDocumentUpdated(
  {
    region: 'us-central1',
    document: 'tenants/eekurt/bookings/{bookingId}',
  },
  async (event) => {
    const before = event.data?.before?.data();
    const after  = event.data?.after?.data();
    if (!before || !after) return null;

    const dateTimeStr = formatDateTime(after.startTime);

    // ── PENDING → CONFIRMED ──
    if (before.status === 'PENDING' && after.status === 'CONFIRMED') {
      const tgMsg =
        `✅ <b>BOOKING CONFIRMED</b>\n\n` +
        `👤 <b>${after.clientName}</b>\n` +
        `📅 ${dateTimeStr}\n` +
        `✂️ ${after.barberId} — ${after.serviceId}\n` +
        `🔑 ${after.bookingId}`;
      try { await sendTelegram(tgMsg); } catch (e) { console.error('Telegram error:', e); }

      if (after.clientEmail) {
        const emailHtml = `
          <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;background:#0d0d0d;color:#f0f0f0;border:1px solid #333;border-radius:8px;overflow:hidden;">
            <div style="background:#111;padding:32px;text-align:center;border-bottom:1px solid #222;">
              <h1 style="font-family:Georgia,serif;font-size:22px;letter-spacing:4px;color:#c8c8c8;margin:0;">EE KURT BARBERS</h1>
              <p style="color:#888;font-size:12px;letter-spacing:2px;margin:8px 0 0;">Traditional Grooming, Modern Excellence</p>
            </div>
            <div style="padding:32px;">
              <h2 style="color:#4caf50;font-size:18px;margin:0 0 16px;">✅ Booking Confirmed!</h2>
              <p style="color:#bbb;line-height:1.7;">Hi <strong style="color:#e8e8e8;">${after.clientName}</strong>,</p>
              <p style="color:#bbb;line-height:1.7;">Your appointment is confirmed. We look forward to seeing you!</p>
              <div style="background:#1a1a1a;border:1px solid #333;border-radius:6px;padding:20px;margin:24px 0;">
                <p style="margin:4px 0;color:#888;font-size:13px;"><strong style="color:#c8c8c8;">📅 Date &amp; Time:</strong> ${dateTimeStr}</p>
                <p style="margin:4px 0;color:#888;font-size:13px;"><strong style="color:#c8c8c8;">✂️ Service:</strong> ${after.serviceId}</p>
                <p style="margin:4px 0;color:#888;font-size:13px;"><strong style="color:#c8c8c8;">💈 Barber:</strong> ${after.barberId}</p>
                <p style="margin:4px 0;color:#888;font-size:13px;"><strong style="color:#c8c8c8;">🔑 Booking ID:</strong> ${after.bookingId}</p>
              </div>
              <p style="color:#bbb;line-height:1.7;">Need to change or cancel? Call us at <strong style="color:#e8e8e8;">020 7833 1525</strong>.</p>
            </div>
            <div style="background:#0a0a0a;padding:20px;text-align:center;border-top:1px solid #222;">
              <p style="color:#555;font-size:11px;margin:0;">EE Kurt Barbers · 020 7833 1525</p>
            </div>
          </div>`;
        try {
          await sgMail.send({
            to: after.clientEmail,
            from: { email: SENDER_EMAIL, name: SENDER_NAME },
            subject: `Booking Confirmed ✅ – ${after.bookingId}`,
            html: emailHtml,
          });
        } catch (e) { console.error('SendGrid error:', e.response ? e.response.body : e); }
      }
    }

    // ── PENDING → CANCELLED ──
    if (before.status === 'PENDING' && after.status === 'CANCELLED') {
      const tgMsg = `❌ <b>BOOKING CANCELLED</b>\n\n👤 ${after.clientName}\n🔑 ${after.bookingId}`;
      try { await sendTelegram(tgMsg); } catch (e) { console.error('Telegram error:', e); }
    }

    return null;
  }
);
