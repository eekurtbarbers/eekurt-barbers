// ─── Firebase CDN imports ────────────────────────────────────────────────────
import { initializeApp }                from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js';
import { getFirestore, collection, addDoc, query, where, getDocs, Timestamp }
    from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js';

// ─── Firebase config (same project, new tenant) ───────────────────────────────
const firebaseConfig = {
    apiKey:            "AIzaSyA16eMVtA4ZOIu3ixCg8y8RUh-EAjMev3A",
    authDomain:        "havuz-44f70.firebaseapp.com",
    projectId:         "havuz-44f70",
    storageBucket:     "havuz-44f70.firebasestorage.app",
    messagingSenderId: "1050766582653",
    appId:             "1:1050766582653:web:7ddaa5acb3bec5ef122214"
};
const app = initializeApp(firebaseConfig);
const db  = getFirestore(app);

const TENANT = 'eekurt';

// ─── Duration map (minutes) ───────────────────────────────────────────────────
const DURATION_MAP = {
    "i-cut-royal": 60, "i-cut-deluxe": 50, "full-skinfade-beard-luxury": 40,
    "full-experience": 30, "senior-full-experience": 30, "skin-fade": 30,
    "scissor-cut": 30, "classic-sbs": 20, "hot-towel-shave": 15,
    "clipper-cut": 15, "senior-haircut": 20, "young-gents": 20,
    "young-gents-skin-fade": 25, "full-facial": 20, "beard-dyeing": 20,
    "face-mask": 15, "face-steam": 15, "threading": 10,
    "waxing": 10, "shape-up-clean-up": 15, "wash-hot-towel": 10
};

// ─── Opening hours ────────────────────────────────────────────────────────────
const SCHEDULE = [
    { day: 'Monday',    open: '09:00', close: '19:00', closed: false },
    { day: 'Tuesday',   open: '09:00', close: '19:00', closed: false },
    { day: 'Wednesday', open: '09:00', close: '19:00', closed: false },
    { day: 'Thursday',  open: '09:00', close: '19:00', closed: false },
    { day: 'Friday',    open: '09:00', close: '19:00', closed: false },
    { day: 'Saturday',  open: '09:00', close: '19:00', closed: false },
    { day: 'Sunday',    open: '10:00', close: '17:00', closed: false },
];
// JS getDay(): 0=Sun,1=Mon,...,6=Sat → map to SCHEDULE index
const JS_TO_SCHEDULE = [6, 0, 1, 2, 3, 4, 5];

function timeMins(t) { const [h, m] = t.split(':').map(Number); return h * 60 + m; }
function fmt12(t) {
    const [h, m] = t.split(':').map(Number);
    return `${h % 12 || 12}:${String(m).padStart(2, '0')} ${h >= 12 ? 'PM' : 'AM'}`;
}

// ─── Firestore helpers ────────────────────────────────────────────────────────
async function getBusySlots(date, barber) {
    const start = new Date(date + 'T00:00:00');
    const end   = new Date(date + 'T23:59:59');
    const snap  = await getDocs(query(
        collection(db, `tenants/${TENANT}/bookings`),
        where('startTime', '>=', Timestamp.fromDate(start)),
        where('startTime', '<=', Timestamp.fromDate(end))
    ));
    const busy = [];
    snap.forEach(doc => {
        const d = doc.data();
        if (d.status === 'CANCELLED') return;
        if (barber !== 'no-preference' && d.barberId !== barber) return;
        busy.push({ start: d.startTime.toMillis(), end: d.endTime.toMillis(), barberId: d.barberId });
    });
    return busy;
}

async function createPendingBooking(data) {
    const bookingId = 'EEK-' + Date.now();
    const match = data.time.match(/(\d+):(\d+)\s*(AM|PM)/i);
    let h = parseInt(match[1]), m = parseInt(match[2]);
    const ap = match[3].toUpperCase();
    if (ap === 'PM' && h !== 12) h += 12;
    if (ap === 'AM' && h === 12) h = 0;

    const startTime = new Date(data.date + 'T00:00:00');
    startTime.setHours(h, m, 0, 0);
    const duration = DURATION_MAP[data.service] || 30;
    const endTime  = new Date(startTime.getTime() + duration * 60 * 1000);

    const booking = {
        bookingId,
        tenantId:    TENANT,
        clientName:  data.name,
        clientEmail: data.email,
        clientPhone: data.phone,
        barberId:    data.barber,
        serviceId:   data.service,
        startTime:   Timestamp.fromDate(startTime),
        endTime:     Timestamp.fromDate(endTime),
        status:      'PENDING',
        paymentType: 'PAY_IN_SHOP',
        source:      'website',
        createdAt:   Timestamp.fromDate(new Date()),
    };

    const ref = await addDoc(collection(db, `tenants/${TENANT}/bookings`), booking);
    return { bookingId, docId: ref.id };
}

// ─── Hours widget ─────────────────────────────────────────────────────────────
function initHoursWidget() {
    const now      = new Date();
    const todayIdx = JS_TO_SCHEDULE[now.getDay()];
    const nowMins  = now.getHours() * 60 + now.getMinutes();
    const today    = SCHEDULE[todayIdx];
    const isOpen   = !today.closed && nowMins >= timeMins(today.open) && nowMins < timeMins(today.close);

    const statusEl = document.getElementById('hoursStatus');
    if (statusEl) {
        if (today.closed) {
            statusEl.innerHTML = `<span class="status-dot closed"></span> CLOSED TODAY`;
        } else if (isOpen) {
            const diff = timeMins(today.close) - nowMins;
            statusEl.innerHTML = `<span class="status-dot open"></span> OPEN NOW (Closes in ${Math.floor(diff / 60)}h ${diff % 60}m)`;
        } else {
            const opensLater = nowMins < timeMins(today.open);
            if (opensLater) {
                statusEl.innerHTML = `<span class="status-dot closed"></span> CLOSED (Opens today at ${fmt12(today.open)})`;
            } else {
                const next = SCHEDULE[(todayIdx + 1) % 7];
                statusEl.innerHTML = `<span class="status-dot closed"></span> CLOSED (Opens ${next.day} at ${fmt12(next.open)})`;
            }
        }
    }

    const grid = document.getElementById('hoursGrid');
    if (grid) {
        SCHEDULE.forEach((item, idx) => {
            const isToday = idx === todayIdx;
            const row = document.createElement('div');
            row.className = 'hours-row' + (isToday ? ' today' : '');
            row.innerHTML = item.closed
                ? `<span>${isToday ? '▶ ' : ''}${item.day}</span><span class="closed-label">CLOSED</span>`
                : `<span>${isToday ? '▶ ' : ''}${item.day}</span><span>${fmt12(item.open)} – ${fmt12(item.close)}</span>`;
            grid.appendChild(row);
        });
    }
}

// ─── Time slots ───────────────────────────────────────────────────────────────
async function checkAvailability(date) {
    const timeSlotsWrap = document.getElementById('timeSlotsWrap');
    const timeSlotsGrid = document.getElementById('timeSlots');
    const hiddenTime    = document.getElementById('time');
    const barber        = document.getElementById('barber').value || 'no-preference';
    const service       = document.getElementById('service').value;

    if (!date) { timeSlotsWrap.style.display = 'none'; return; }

    timeSlotsWrap.style.display = 'block';
    timeSlotsGrid.innerHTML = '<div class="slots-loading">Checking availability…</div>';
    hiddenTime.value = '';

    const duration  = DURATION_MAP[service] || 30;
    const selDate   = new Date(date + 'T00:00:00');
    const dayIdx    = JS_TO_SCHEDULE[selDate.getDay()];
    const dayConfig = SCHEDULE[dayIdx];

    if (dayConfig.closed) {
        timeSlotsGrid.innerHTML = '<div class="slots-empty">We are closed on this day.</div>';
        return;
    }

    const now      = new Date();
    const todayStr = now.toISOString().split('T')[0];
    const isToday  = date === todayStr;
    const nowMins  = isToday ? now.getHours() * 60 + now.getMinutes() : 0;

    const openH  = parseInt(dayConfig.open.split(':')[0]);
    const closeH = parseInt(dayConfig.close.split(':')[0]);
    const slots  = [];

    for (let h = openH; h < closeH; h++) {
        for (const m of [0, 30]) {
            const slotMins = h * 60 + m;
            if (isToday && slotMins <= nowMins) continue;
            const hour12 = h % 12 || 12;
            const ampm   = h >= 12 ? 'PM' : 'AM';
            slots.push({ label: `${hour12}:${String(m).padStart(2, '0')} ${ampm}`, h, m });
        }
    }

    if (slots.length === 0) {
        timeSlotsGrid.innerHTML = '<div class="slots-empty">No available slots for today.</div>';
        return;
    }

    let busyList = [];
    try { busyList = await getBusySlots(date, barber); } catch (e) { console.warn('Availability fetch failed:', e); }

    timeSlotsGrid.innerHTML = '';
    hiddenTime.value = '';

    slots.forEach(slot => {
        const slotMs  = new Date(date + 'T00:00:00');
        slotMs.setHours(slot.h, slot.m, 0, 0);
        const slotEnd = slotMs.getTime() + duration * 60 * 1000;
        const isBusy  = busyList.some(b => slotMs.getTime() < b.end && slotEnd > b.start);

        const btn = document.createElement('button');
        btn.type      = 'button';
        btn.textContent = slot.label;
        btn.className = 'time-slot-btn' + (isBusy ? ' unavailable' : '');
        btn.disabled  = isBusy;
        btn.dataset.assignedBarber = '';

        if (!isBusy) {
            // auto-assign barber for no-preference
            if (barber === 'no-preference') {
                const tuncFree  = !busyList.filter(b => b.barberId === 'tunc').some(b => slotMs.getTime() < b.end && slotEnd > b.start);
                const manocFree = !busyList.filter(b => b.barberId === 'manoc').some(b => slotMs.getTime() < b.end && slotEnd > b.start);
                btn.dataset.assignedBarber = tuncFree ? 'tunc' : (manocFree ? 'manoc' : 'tunc');
            }

            btn.addEventListener('click', () => {
                timeSlotsGrid.querySelectorAll('.time-slot-btn').forEach(b => b.classList.remove('selected'));
                btn.classList.add('selected');
                hiddenTime.value = slot.label;
                hiddenTime.dataset.assignedBarber = btn.dataset.assignedBarber;
            });
        }
        timeSlotsGrid.appendChild(btn);
    });
}

// ─── Manage Booking modal ─────────────────────────────────────────────────────
function initManageModal() {
    const modal       = document.getElementById('bookingModal');
    const openBtn     = document.getElementById('menuToggle');
    const closeBtn    = document.getElementById('closeModalBtn');

    openBtn.addEventListener('click', () => { modal.style.display = 'flex'; });
    if (closeBtn) closeBtn.addEventListener('click', () => { modal.style.display = 'none'; });
    modal.addEventListener('click', e => { if (e.target === modal) modal.style.display = 'none'; });
}

// ─── Success popup ────────────────────────────────────────────────────────────
function showSuccess(name, date, time, bookingId) {
    const popup = document.getElementById('successPopup');
    document.getElementById('popup-icon').textContent  = '✂️';
    document.getElementById('popup-title').textContent = `You're booked, ${name.split(' ')[0]}!`;
    document.getElementById('popup-text').textContent  =
        `Your request is received. We'll confirm by email shortly. See you on ${date} at ${time}.`;
    document.getElementById('popup-id').textContent = `Booking ID: ${bookingId}`;
    popup.style.display = 'flex';
}

// ─── BOOK NOW button → scroll ─────────────────────────────────────────────────
document.getElementById('bookNowBtn').addEventListener('click', e => {
    e.preventDefault();
    document.getElementById('booking').scrollIntoView({ behavior: 'smooth' });
});
document.getElementById('emblemBtn').addEventListener('click', () => {
    document.getElementById('booking').scrollIntoView({ behavior: 'smooth' });
});

// ─── Barber selector ──────────────────────────────────────────────────────────
document.querySelectorAll('.barber-btn').forEach(btn => {
    btn.addEventListener('click', () => {
        document.querySelectorAll('.barber-btn').forEach(b => b.classList.remove('selected'));
        btn.classList.add('selected');
        document.getElementById('barber').value = btn.dataset.value;
        const d = document.getElementById('date').value;
        if (d) checkAvailability(d);
    });
});

// ─── Date & service change → refresh slots ────────────────────────────────────
document.getElementById('date').addEventListener('change', function () {
    checkAvailability(this.value);
});
document.getElementById('service').addEventListener('change', function () {
    const d = document.getElementById('date').value;
    if (d) checkAvailability(d);
});

// ─── Phone validation ─────────────────────────────────────────────────────────
document.getElementById('phone').addEventListener('input', function () {
    let v = this.value.replace(/[^0-9+\s]/g, '');
    if (v && !v.startsWith('+')) v = '+' + v;
    this.value = v;
});
document.getElementById('phone').addEventListener('blur', function () {
    this.style.borderColor = /^\+[0-9]{1,3}\s?[0-9]{6,14}$/.test(this.value) ? '' : '#ff6b6b';
});
document.getElementById('email').addEventListener('blur', function () {
    this.style.borderColor = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(this.value) ? '' : '#ff6b6b';
});

// ─── Date bounds ──────────────────────────────────────────────────────────────
(function () {
    const dateInput = document.getElementById('date');
    const now       = new Date();
    const todayStr  = now.toISOString().split('T')[0];
    dateInput.setAttribute('min', todayStr);
    const max = new Date(); max.setDate(max.getDate() + 90);
    dateInput.setAttribute('max', max.toISOString().split('T')[0]);
})();

// ─── Form submission ──────────────────────────────────────────────────────────
document.getElementById('bookingForm').addEventListener('submit', async function (e) {
    e.preventDefault();

    const name    = document.getElementById('name').value.trim();
    const email   = document.getElementById('email').value.trim();
    const phone   = document.getElementById('phone').value.trim();
    const date    = document.getElementById('date').value;
    const service = document.getElementById('service').value;
    const barberEl = document.getElementById('barber');
    const hiddenTime = document.getElementById('time');

    if (!name || !email || !phone || !date || !service) {
        alert('Please fill in all fields.');
        return;
    }
    if (!hiddenTime.value) {
        alert('Please select a time slot.');
        return;
    }

    const barver = barberEl.value === 'no-preference'
        ? (hiddenTime.dataset.assignedBarber || 'no-preference')
        : barberEl.value;

    // Duplicate check
    try {
        const start = new Date(date + 'T00:00:00');
        const end   = new Date(date + 'T23:59:59');
        const snap  = await getDocs(query(
            collection(db, `tenants/${TENANT}/bookings`),
            where('clientPhone', '==', phone),
            where('startTime', '>=', Timestamp.fromDate(start)),
            where('startTime', '<=', Timestamp.fromDate(end)),
            where('status', '==', 'CONFIRMED')
        ));
        if (!snap.empty && !confirm('⚠️ You already have a booking on this date. Book again?')) return;
    } catch { /* non-blocking */ }

    const submitBtn = document.getElementById('submitBtn');
    submitBtn.disabled = true;
    submitBtn.textContent = 'Securing your slot…';

    try {
        const { bookingId } = await createPendingBooking({
            name, email, phone, date,
            time:    hiddenTime.value,
            service,
            barber:  barver,
        });
        showSuccess(name, date, hiddenTime.value, bookingId);
        this.reset();
        document.getElementById('timeSlotsWrap').style.display = 'none';
        document.querySelectorAll('.barber-btn').forEach((b, i) => {
            b.classList.toggle('selected', i === 0); // reset to No Preference
        });
        barberEl.value = 'no-preference';
    } catch (err) {
        console.error('Booking error:', err);
        alert('Something went wrong. Please try again or call us on 020 7833 1525.');
    } finally {
        submitBtn.disabled = false;
        submitBtn.textContent = '✂ BOOK MY APPOINTMENT';
    }
});

// ─── Init ─────────────────────────────────────────────────────────────────────
initHoursWidget();
initManageModal();