const { onDocumentCreated, onDocumentUpdated } = require('firebase-functions/v2/firestore');
const admin = require('firebase-admin');
const https = require('https');

admin.initializeApp();

// ─── CONFIG ───────────────────────────────────────────────────────────────────
const TELEGRAM_TOKEN = '8756110813:AAEBFlDeofbJ_2g41sSZ8IakpGV-CESHxPE';
const TELEGRAM_CHAT_ID = '1679287636';
const GAS_WEBHOOK_URL = '';

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

function postJson(url, payload) {
  return new Promise((resolve, reject) => {
    if (!url) {
      resolve(false);
      return;
    }

    const target = new URL(url);
    const body = JSON.stringify(payload);
    const options = {
      hostname: target.hostname,
      path: `${target.pathname}${target.search}`,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(body),
      },
    };

    const req = https.request(options, (res) => {
      res.on('data', () => {});
      res.on('end', () => resolve(res.statusCode >= 200 && res.statusCode < 300));
    });

    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

async function notifyGas(eventType, booking) {
  if (!GAS_WEBHOOK_URL) return;

  try {
    await postJson(GAS_WEBHOOK_URL, {
      tenantId: 'eekurt',
      eventType,
      booking,
    });
  } catch (error) {
    console.error('GAS webhook error:', error);
  }
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

    await notifyGas('BOOKING_CREATED', {
      ...data,
      dateTime: dateTimeStr,
    });

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

      await notifyGas('BOOKING_CONFIRMED', {
        ...after,
        dateTime: dateTimeStr,
      });
    }

    // ── PENDING → CANCELLED ──
    if (before.status === 'PENDING' && after.status === 'CANCELLED') {
      const tgMsg = `❌ <b>BOOKING CANCELLED</b>\n\n👤 ${after.clientName}\n🔑 ${after.bookingId}`;
      try { await sendTelegram(tgMsg); } catch (e) { console.error('Telegram error:', e); }

      await notifyGas('BOOKING_CANCELLED', {
        ...after,
        dateTime: dateTimeStr,
      });
    }

    return null;
  }
);
