const SHOP_NAME = 'EE KURT BARBERS';
const SHOP_PHONE = '020 7833 1525';
const SHOP_EMAIL = 'bookings@eekurtbarbers.co.uk';

function doPost(e) {
  try {
    const payload = JSON.parse(e.postData.contents || '{}');
    const eventType = String(payload.eventType || '');

    if (eventType === 'BOOKING_CONFIRMED') {
      sendConfirmedEmail_(payload.booking || {});
    }

    if (eventType === 'BOOKING_RESCHEDULED') {
      sendRescheduledEmail_(payload.before || {}, payload.after || {}, payload.bookingId || '');
    }

    if (eventType === 'BOOKING_CANCELLED') {
      sendCancelledEmail_(payload.booking || {});
    }

    return ContentService
      .createTextOutput(JSON.stringify({ ok: true }))
      .setMimeType(ContentService.MimeType.JSON);
  } catch (err) {
    return ContentService
      .createTextOutput(JSON.stringify({ ok: false, error: String(err) }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}

function sendConfirmedEmail_(b) {
  const email = safe_(b.clientEmail);
  if (!email) return;

  const bookingId = safe_(b.bookingId);
  const subject = 'Booking Confirmed - ' + SHOP_NAME + ' - ' + bookingId;

  const html =
    '<div style="font-family:Arial,sans-serif;max-width:640px;margin:0 auto;line-height:1.6;color:#222">' +
      '<h2 style="margin:0 0 12px">Your booking is confirmed</h2>' +
      '<p>Hi <strong>' + esc_(b.clientName) + '</strong>, your appointment is confirmed.</p>' +
      detailsTable_(b, false) +
      footer_() +
    '</div>';

  MailApp.sendEmail({
    to: email,
    subject: subject,
    htmlBody: html,
    name: SHOP_NAME,
  });
}

function sendRescheduledEmail_(beforeB, afterB, bookingId) {
  const email = safe_(afterB.clientEmail || beforeB.clientEmail);
  if (!email) return;

  const subject = 'Booking Updated - ' + SHOP_NAME + ' - ' + safe_(bookingId || afterB.bookingId || beforeB.bookingId);

  const html =
    '<div style="font-family:Arial,sans-serif;max-width:640px;margin:0 auto;line-height:1.6;color:#222">' +
      '<h2 style="margin:0 0 12px">Your booking has been updated</h2>' +
      '<p>Hi <strong>' + esc_(afterB.clientName || beforeB.clientName) + '</strong>, your booking details have changed.</p>' +
      '<h3 style="margin:18px 0 8px">Previous details</h3>' +
      detailsTable_(beforeB, true) +
      '<h3 style="margin:18px 0 8px">New details</h3>' +
      detailsTable_(afterB, true) +
      footer_() +
    '</div>';

  MailApp.sendEmail({
    to: email,
    subject: subject,
    htmlBody: html,
    name: SHOP_NAME,
  });
}

function sendCancelledEmail_(b) {
  const email = safe_(b.clientEmail);
  if (!email) return;

  const bookingId = safe_(b.bookingId);
  const subject = 'Booking Cancelled - ' + SHOP_NAME + ' - ' + bookingId;

  const html =
    '<div style="font-family:Arial,sans-serif;max-width:640px;margin:0 auto;line-height:1.6;color:#222">' +
      '<h2 style="margin:0 0 12px">Your booking has been cancelled</h2>' +
      '<p>Hi <strong>' + esc_(b.clientName) + '</strong>, your booking has been cancelled.</p>' +
      detailsTable_(b, false) +
      footer_() +
    '</div>';

  MailApp.sendEmail({
    to: email,
    subject: subject,
    htmlBody: html,
    name: SHOP_NAME,
  });
}

function detailsTable_(b, preferRawDateTime) {
  const dt = preferRawDateTime ? (b.dateTime || '') : prettyDateTime_(b.dateTime || '');
  const barber = safe_(b.barberName || b.barberId);
  const service = safe_(b.serviceId);
  const bookingId = safe_(b.bookingId);

  return '' +
    '<table style="width:100%;border-collapse:collapse;border:1px solid #ddd">' +
      row_('Name', b.clientName) +
      row_('Email', b.clientEmail) +
      row_('Phone', b.clientPhone) +
      row_('Barber', barber) +
      row_('Service', service) +
      row_('Date & Time', dt) +
      row_('Booking ID', bookingId) +
    '</table>';
}

function row_(label, value) {
  return '' +
    '<tr>' +
      '<td style="padding:10px;border-bottom:1px solid #eee;background:#fafafa;width:160px"><strong>' + esc_(label) + '</strong></td>' +
      '<td style="padding:10px;border-bottom:1px solid #eee">' + esc_(safe_(value)) + '</td>' +
    '</tr>';
}

function footer_() {
  return '' +
    '<p style="margin-top:18px">Need help? Contact us:</p>' +
    '<p style="margin:0">Phone: ' + esc_(SHOP_PHONE) + '</p>' +
    '<p style="margin:0">Email: ' + esc_(SHOP_EMAIL) + '</p>';
}

function prettyDateTime_(value) {
  if (!value) return 'N/A';
  return value;
}

function safe_(value) {
  return value == null ? '' : String(value);
}

function esc_(value) {
  return safe_(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}
