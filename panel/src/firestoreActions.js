import { db } from './firebase';
import { 
  collection, doc, query, where, getDocs, addDoc, updateDoc, deleteDoc, 
  setDoc, Timestamp, runTransaction 
} from 'firebase/firestore';

const TENANT_ID = 'eekurt';
const TENANT_PATH = `tenants/${TENANT_ID}`;

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

/**
 * Robust Date/Time Parsing
 * Supports: "22 April 2026" (Admin UI) or "2026-04-22" (ISO-like)
 */
function parseBookingDateTime(dateStr, timeStr) {
  const months = { 
    January: 0, February: 1, March: 2, April: 3, May: 4, June: 5, 
    July: 6, August: 7, September: 8, October: 9, November: 10, December: 11 
  };
  
  let year, month, day;
  
  if (dateStr.includes('-')) {
    // Format: YYYY-MM-DD
    [year, month, day] = dateStr.split('-').map(Number);
    month -= 1; // JS months are 0-indexed
  } else {
    // Format: "22 April 2026"
    const parts = dateStr.trim().split(/\s+/);
    if (parts.length < 3) throw new Error('Invalid date format');
    day = parseInt(parts[0], 10);
    month = months[parts[1]];
    year = parseInt(parts[2], 10);
  }

  const timeMatch = String(timeStr || '').match(/(\d+):(\d+)\s*(AM|PM)/i);
  if (!timeMatch || month === undefined || isNaN(day) || isNaN(year)) {
    throw new Error('Invalid booking date or time');
  }

  let h = parseInt(timeMatch[1], 10);
  const m = parseInt(timeMatch[2], 10);
  const ap = timeMatch[3].toUpperCase();
  if (ap === 'PM' && h !== 12) h += 12;
  if (ap === 'AM' && h === 12) h = 0;

  return new Date(year, month, day, h, m, 0);
}

/**
 * FIXED: Atomic Overlap Check
 * Queries the specific day and barber to check for any overlapping bookings.
 */
async function checkOverlap(transaction, { barberId, startTime, endTime, excludeDocId = null }) {
  const bookingsRef = collection(db, `${TENANT_PATH}/bookings`);
  
  const dayStart = new Date(startTime);
  dayStart.setHours(0, 0, 0, 0);
  const dayEnd = new Date(startTime);
  dayEnd.setHours(23, 59, 59, 999);

  const q = query(
    bookingsRef,
    where('startTime', '>=', Timestamp.fromDate(dayStart)),
    where('startTime', '<=', Timestamp.fromDate(dayEnd))
  );

  const snap = await getDocs(q); 
  
  const hasOverlap = snap.docs.some(doc => {
    if (excludeDocId && doc.id === excludeDocId) return false;
    const data = doc.data();
    if (data.barberId !== barberId) return false;
    if (data.status === 'CANCELLED') return false;
    if (!data.startTime || !data.endTime) return false;

    const existingStart = data.startTime.toMillis();
    const existingEnd = data.endTime.toMillis();
    const newStart = startTime.getTime();
    const newEnd = endTime.getTime();

    return newStart < existingEnd && newEnd > existingStart;
  });

  if (hasOverlap) throw new Error('This slot is already occupied.');
}

// ── CHECKOUT ──────────────────────────────────────────────────────────────
export async function checkoutBooking({ bookingId, paymentMethod, total, discount, tip, note, splitSecond, splitAmount }) {
  const q = query(collection(db, `${TENANT_PATH}/bookings`), where('bookingId', '==', bookingId));
  const snap = await getDocs(q);
  if (snap.empty) throw new Error('Booking not found');
  
  await updateDoc(snap.docs[0].ref, {
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
  const q = query(collection(db, `${TENANT_PATH}/bookings`), where('bookingId', '==', bookingId));
  const snap = await getDocs(q);
  if (snap.empty) throw new Error('Booking not found');
  await updateDoc(snap.docs[0].ref, { status: 'UNPAID' });
}

// ── WALK-IN ───────────────────────────────────────────────────────────────
export async function createWalkIn({ name, email, phone, date, time, service, barber, price, paymentType, source }) {
  const startTime = parseBookingDateTime(date, time);
  const duration = DURATION_MAP[service] || 30;
  const endTime = new Date(startTime.getTime() + duration * 60 * 1000);
  const bookingId = 'EEK-' + Date.now();

  await runTransaction(db, async (transaction) => {
    await checkOverlap(transaction, { barberId: barber, startTime, endTime });
    
    const newDocRef = doc(collection(db, `${TENANT_PATH}/bookings`));
    transaction.set(newDocRef, {
      bookingId,
      tenantId: TENANT_ID,
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
  });
  
  return bookingId;
}

// ── BLOCK TIME ────────────────────────────────────────────────────────────
export async function blockTime({ date, startTime, endTime, barber, note }) {
  const start = parseBookingDateTime(date, startTime);
  const end = parseBookingDateTime(date, endTime);
  if (end <= start) throw new Error('End time must be after start time.');

  const blockId = 'BLOCKED-' + Date.now();

  await runTransaction(db, async (transaction) => {
    await checkOverlap(transaction, { barberId: barber, startTime: start, endTime: end });
    
    const newDocRef = doc(collection(db, `${TENANT_PATH}/bookings`));
    transaction.set(newDocRef, {
      bookingId: blockId,
      tenantId: TENANT_ID,
      barberId: barber,
      status: 'BLOCKED',
      startTime: Timestamp.fromDate(start),
      endTime: Timestamp.fromDate(end),
      note: note || '',
      source: 'block',
      createdAt: Timestamp.fromDate(new Date()),
    });
  });
  
  return blockId;
}

// ── EDIT BOOKING ──────────────────────────────────────────────────────────
export async function editBooking({ bookingId, name, email, phone, date, time, service, barber }) {
  const q = query(collection(db, `${TENANT_PATH}/bookings`), where('bookingId', '==', bookingId));
  const snap = await getDocs(q);
  if (snap.empty) throw new Error('Booking not found');
  const docRef = snap.docs[0].ref;

  const startTime = parseBookingDateTime(date, time);
  const duration = DURATION_MAP[service] || 30;
  const endTime = new Date(startTime.getTime() + duration * 60 * 1000);

  await runTransaction(db, async (transaction) => {
    await checkOverlap(transaction, { 
      barberId: barber, 
      startTime, 
      endTime, 
      excludeDocId: docRef.id 
    });
    
    transaction.update(docRef, {
      clientName: name,
      clientEmail: email || '',
      clientPhone: phone || '',
      barberId: barber,
      serviceId: service,
      startTime: Timestamp.fromDate(startTime),
      endTime: Timestamp.fromDate(endTime),
      updatedAt: Timestamp.fromDate(new Date()),
    });
  });
}

// ── DELETE BOOKING ─────────────────────────────────────────────────────────
export async function deleteBooking(bookingId) {
  const q = query(collection(db, `${TENANT_PATH}/bookings`), where('bookingId', '==', bookingId));
  const snap = await getDocs(q);
  if (snap.empty) throw new Error('Booking not found');
  await deleteDoc(snap.docs[0].ref);
}

// ── SEED DATA ──────────────────────────────────────────────────────────────
export async function seedBarbers() {
  const barbers = [
    { id: 'tunc', name: 'Tunc', color: '#d4af37', active: true, order: 1 },
    { id: 'manoc', name: 'Manoc', color: '#4caf50', active: true, order: 2 },
  ];
  for (const barber of barbers) {
    await setDoc(doc(db, `${TENANT_PATH}/barbers`, barber.id), barber);
  }
}
