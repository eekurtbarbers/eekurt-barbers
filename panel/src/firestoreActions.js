import { db } from './firebase';
import { collection, doc, query, where, getDocs, addDoc, updateDoc, deleteDoc, setDoc, Timestamp } from 'firebase/firestore';

const TENANT = 'tenants/eekurt';
const DURATION_MAP = {
  'hair-cut': 25,
  'skin-fade': 25,
  'childrens-hair': 25,
  'children-skin-fade': 25,
  'shape-up': 25,
  'beard-trim': 25,
  'hair-beard': 30,
  'skin-fade-beard': 30,
  'eekurt-special': 45,
};

function parseBookingDateTime(date, time) {
  const months = { January:0, February:1, March:2, April:3, May:4, June:5, July:6, August:7, September:8, October:9, November:10, December:11 };
  const parts = String(date || '').split(' ');
  const timeMatch = String(time || '').match(/(\d+):(\d+)\s*(AM|PM)/i);
  if (parts.length < 3 || !timeMatch) {
    throw new Error('Invalid booking date or time');
  }
  let h = parseInt(timeMatch[1], 10);
  const m = parseInt(timeMatch[2], 10);
  const ap = timeMatch[3].toUpperCase();
  if (ap === 'PM' && h !== 12) h += 12;
  if (ap === 'AM' && h === 12) h = 0;
  return new Date(parseInt(parts[2], 10), months[parts[1]], parseInt(parts[0], 10), h, m, 0);
}

async function assertBookingSlotAvailable({ barber, startTime, endTime, excludeBookingId }) {
  const sameBarber = query(collection(db, `${TENANT}/bookings`), where('barberId', '==', barber));
  const snap = await getDocs(sameBarber);
  const hasOverlap = snap.docs.some((bookingDoc) => {
    const data = bookingDoc.data() || {};
    if (data.status === 'CANCELLED') return false;
    if (excludeBookingId && data.bookingId === excludeBookingId) return false;
    const existingStart = data.startTime && typeof data.startTime.toDate === 'function' ? data.startTime.toDate() : null;
    const existingEnd = data.endTime && typeof data.endTime.toDate === 'function' ? data.endTime.toDate() : null;
    if (!existingStart || !existingEnd) return false;
    return startTime.getTime() < existingEnd.getTime() && endTime.getTime() > existingStart.getTime();
  });

  if (hasOverlap) {
    throw new Error('This slot is already full for that barber.');
  }
}

// ── CHECKOUT ──────────────────────────────────────────────────────────────
export async function checkoutBooking({ bookingId, paymentMethod, total, discount, tip, note, splitSecond, splitAmount }) {
  const q = query(collection(db, `${TENANT}/bookings`), where('bookingId', '==', bookingId));
  const snap = await getDocs(q);
  if (snap.empty) throw new Error('Booking not found');
  const ref = snap.docs[0].ref;
  await updateDoc(ref, {
    status: 'CHECKED_OUT',
    paymentMethod,
    paidAmount: total,
    discount: discount || 0,
    tip: tip || 0,
    note: note || '',
    splitSecond: splitSecond || '',
    splitAmount: splitAmount || 0,
    checkedOutAt: Timestamp.fromDate(new Date()),
  });
}

export async function saveUnpaidBooking({ bookingId }) {
  const q = query(collection(db, `${TENANT}/bookings`), where('bookingId', '==', bookingId));
  const snap = await getDocs(q);
  if (snap.empty) throw new Error('Booking not found');
  await updateDoc(snap.docs[0].ref, { status: 'UNPAID' });
}

// ── WALK-IN ───────────────────────────────────────────────────────────────
export async function createWalkIn({ name, email, phone, date, time, service, barber, price, paymentType, source }) {
  const bookingId = 'EEK-' + Date.now();
  const startTime = parseBookingDateTime(date, time);
  const duration = DURATION_MAP[service] || 30;
  const endTime = new Date(startTime.getTime() + duration * 60 * 1000);
  await assertBookingSlotAvailable({ barber, startTime, endTime });
  await addDoc(collection(db, `${TENANT}/bookings`), {
    bookingId,
    tenantId: 'eekurt',
    clientName: name,
    clientEmail: email || '',
    clientPhone: phone || '',
    barberId: barber,
    serviceId: service,
    startTime: Timestamp.fromDate(startTime),
    endTime: Timestamp.fromDate(endTime),
    status: 'CONFIRMED',
    paymentType: paymentType || 'CASH',
    paidAmount: price || 0,
    source: source || 'Walk-in',
    createdAt: Timestamp.fromDate(new Date()),
  });
  return bookingId;
}

// ── BLOCK TIME ────────────────────────────────────────────────────────────
export async function blockTime({ date, startTime, endTime, barber, note }) {
  const blockId = 'BLOCKED-' + Date.now();
  const months = { January:0, February:1, March:2, April:3, May:4, June:5, July:6, August:7, September:8, October:9, November:10, December:11 };
  const parts = date.split(' ');
  const parseT = (t) => {
    const m = t.match(/(\d+):(\d+)\s*(AM|PM)/i);
    let h = parseInt(m[1]), min = parseInt(m[2]);
    const ap = m[3].toUpperCase();
    if (ap === 'PM' && h !== 12) h += 12;
    if (ap === 'AM' && h === 12) h = 0;
    return { h, min };
  };
  const st = parseT(startTime), et = parseT(endTime);
  const start = new Date(parseInt(parts[2]), months[parts[1]], parseInt(parts[0]), st.h, st.min, 0);
  const end = new Date(parseInt(parts[2]), months[parts[1]], parseInt(parts[0]), et.h, et.min, 0);
  await addDoc(collection(db, `${TENANT}/bookings`), {
    bookingId: blockId,
    tenantId: 'eekurt',
    barberId: barber,
    status: 'BLOCKED',
    startTime: Timestamp.fromDate(start),
    endTime: Timestamp.fromDate(end),
    note: note || '',
    source: 'block',
    createdAt: Timestamp.fromDate(new Date()),
  });
  return blockId;
}

// ── EDIT BOOKING ──────────────────────────────────────────────────────────
export async function editBooking({ bookingId, name, email, phone, date, time, service, barber }) {
  const q = query(collection(db, `${TENANT}/bookings`), where('bookingId', '==', bookingId));
  const snap = await getDocs(q);
  if (snap.empty) throw new Error('Booking not found');
  const startTime = parseBookingDateTime(date, time);
  const duration = DURATION_MAP[service] || 30;
  const endTime = new Date(startTime.getTime() + duration * 60 * 1000);
  await assertBookingSlotAvailable({ barber, startTime, endTime, excludeBookingId: bookingId });
  await updateDoc(snap.docs[0].ref, {
    clientName: name,
    clientEmail: email || '',
    clientPhone: phone || '',
    barberId: barber,
    serviceId: service,
    startTime: Timestamp.fromDate(startTime),
    endTime: Timestamp.fromDate(endTime),
    updatedAt: Timestamp.fromDate(new Date()),
  });
}

// ── DELETE BOOKING ─────────────────────────────────────────────────────────
export async function deleteBooking(bookingId) {
  const q = query(collection(db, `${TENANT}/bookings`), where('bookingId', '==', bookingId));
  const snap = await getDocs(q);
  if (snap.empty) throw new Error('Booking not found');
  await deleteDoc(snap.docs[0].ref);
}
export async function seedBarbers() {
  const barbers = [
    { id: 'tunc', name: 'Tunc', color: '#d4af37', active: true, order: 1 },
    { id: 'manoc', name: 'Manoc', color: '#4caf50', active: true, order: 2 },
  ];
  for (const barber of barbers) {
    await setDoc(doc(db, 'tenants/eekurt/barbers', barber.id), barber);
  }
}