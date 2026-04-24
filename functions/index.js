const { onDocumentCreated, onDocumentUpdated } = require('firebase-functions/v2/firestore');
const { defineSecret } = require('firebase-functions/params');
const admin = require('firebase-admin');
const https = require('https');

admin.initializeApp();

// ─── CONFIG ───────────────────────────────────────────────────────────────────
const TELEGRAM_TOKEN = defineSecret('TELEGRAM_TOKEN');
const TELEGRAM_CHAT_IDS = defineSecret('TELEGRAM_CHAT_IDS');
const GAS_WEBHOOK_URL = '';

// ─── HELPERS ──────────────────────────────────────────────────────────────────
function sendTelegram(message, chatId) {
  return new Promise((resolve, reject) => {
    const body = JSON.stringify({ chat_id: chatId, text: message, parse_mode: 'HTML' });
    const token = TELEGRAM_TOKEN.value();
    if (!token) {
      reject(new Error('Missing TELEGRAM_TOKEN secret'));
      return;
    }
    const options = {
      hostname: 'api.telegram.org',
      path: `/bot${token}/sendMessage`,
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

function getTelegramChatIds() {
  const raw = TELEGRAM_CHAT_IDS.value() || '';
  return raw.split(',').map((s) => s.trim()).filter(Boolean);
}

async function sendTelegramToAll(message) {
  const chatIds = getTelegramChatIds();
  if (!chatIds.length) {
    console.error('Missing TELEGRAM_CHAT_IDS secret');
    return;
  }
  const sends = chatIds.map((chatId) => sendTelegram(message, chatId));
  const results = await Promise.allSettled(sends);
  results.forEach((result) => {
    if (result.status === 'rejected') console.error('Telegram error:', result.reason);
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

function toMillis(value) {
  if (!value) return 0;
  if (typeof value.toMillis === 'function') return value.toMillis();
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? 0 : date.getTime();
}

// ─── HELPERS ──────────────────────────────────────────────────────────────────
async function getBarberName(barberId) {
  if (!barberId) return barberId;
  try {
    const snap = await admin.firestore().doc(`tenants/eekurt/barbers/${barberId}`).get();
    if (snap.exists) return snap.data().name || barberId;
  } catch (_) {}
  return barberId;
}

// ─── ON BOOKING CREATED (AUTO-CONFIRMED) ─────────────────────────────────────
exports.onBookingCreated = onDocumentCreated(
  {
    region: 'us-central1',
    document: 'tenants/eekurt/bookings/{bookingId}',
    secrets: [TELEGRAM_TOKEN, TELEGRAM_CHAT_IDS],
  },
  async (event) => {
    const data = event.data ? event.data.data() : null;
    if (!data) return null;

    const wasPending = data.status === 'PENDING';
    if (wasPending) {
      await event.data.ref.update({
        status: 'CONFIRMED',
        confirmedAt: admin.firestore.FieldValue.serverTimestamp(),
      });
    }

    const dateTimeStr = formatDateTime(data.startTime);
    const barberName = await getBarberName(data.barberId);
    const bookingId = data.bookingId || event.params.bookingId;

    // ── Telegram confirmed notification ──
    const tgMsg =
      `✅ <b>BOOKING CONFIRMED</b>\n\n` +
      `👤 <b>${data.clientName}</b>\n` +
      `📧 ${data.clientEmail}\n` +
      `📞 ${data.clientPhone}\n` +
      `✂️ Barber: ${barberName}\n` +
      `💈 Service: ${data.serviceId}\n` +
      `📅 ${dateTimeStr}\n` +
      `🔑 ${bookingId}`;

    await sendTelegramToAll(tgMsg);

    await notifyGas('BOOKING_CONFIRMED', {
      ...data,
      status: 'CONFIRMED',
      bookingId,
      barberName,
      dateTime: dateTimeStr,
    });

    return null;
  }
);

// ─── ON BOOKING CONFIRMED ─────────────────────────────────────────────────────
exports.onBookingConfirmed = onDocumentUpdated(
  {
    region: 'us-central1',
    document: 'tenants/eekurt/bookings/{bookingId}',
    secrets: [TELEGRAM_TOKEN, TELEGRAM_CHAT_IDS],
  },
  async (event) => {
    const before = event.data?.before?.data();
    const after  = event.data?.after?.data();
    if (!before || !after) return null;

    const dateTimeStr = formatDateTime(after.startTime);
    const beforeDateTimeStr = formatDateTime(before.startTime);
    const barberName = await getBarberName(after.barberId);
    const beforeBarberName = await getBarberName(before.barberId);
    const bookingId = after.bookingId || before.bookingId || event.params.bookingId;

    const movedDateTime = toMillis(before.startTime) !== toMillis(after.startTime);
    const changedBarber = String(before.barberId || '') !== String(after.barberId || '');
    const changedService = String(before.serviceId || '') !== String(after.serviceId || '');
    const wasRescheduled = before.status !== 'CANCELLED' && after.status !== 'CANCELLED' && (movedDateTime || changedBarber || changedService);

    if (wasRescheduled) {
      const tgMsg =
        `🔁 <b>BOOKING RESCHEDULED</b>\n\n` +
        `👤 <b>${after.clientName}</b>\n` +
        `📧 ${after.clientEmail}\n` +
        `📞 ${after.clientPhone}\n` +
        `✂️ Barber: ${beforeBarberName} → ${barberName}\n` +
        `💈 Service: ${before.serviceId || 'N/A'} → ${after.serviceId || 'N/A'}\n` +
        `📅 ${beforeDateTimeStr} → ${dateTimeStr}\n` +
        `🔑 ${bookingId}`;
      await sendTelegramToAll(tgMsg);

      await notifyGas('BOOKING_RESCHEDULED', {
        before: {
          ...before,
          barberName: beforeBarberName,
          dateTime: beforeDateTimeStr,
        },
        after: {
          ...after,
          barberName,
          dateTime: dateTimeStr,
        },
        bookingId,
      });
    }

    // ── ANY STATUS → CANCELLED ──
    if (before.status !== 'CANCELLED' && after.status === 'CANCELLED') {
      const tgMsg =
        `❌ <b>BOOKING CANCELLED</b>\n\n` +
        `👤 <b>${after.clientName}</b>\n` +
        `📧 ${after.clientEmail}\n` +
        `📞 ${after.clientPhone}\n` +
        `✂️ Barber: ${barberName}\n` +
        `💈 Service: ${after.serviceId}\n` +
        `📅 ${dateTimeStr}\n` +
        `🔑 ${bookingId}`;
      await sendTelegramToAll(tgMsg);

      await notifyGas('BOOKING_CANCELLED', {
        ...after,
        bookingId,
        barberName,
        dateTime: dateTimeStr,
      });
    }

    return null;
  }
);
