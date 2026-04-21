const config = {
  shopName: 'EE KURT BARBERS',
  shopAddress: 'EE Kurt Barbers, London',
  shopPhone: '020 7833 1525',
  shopEmail: 'bookings@eekurtbarbers.co.uk',
  shopWhatsApp: '447470108578',
  
  // Platform Settings
  platforms: {
    booksy: {
      depositEnabled: true,
      depositAmount: 10,
    },
    fresha: {
      depositEnabled: false,
      depositAmount: 0,
    },
  },
  // Apps Script URL
  scriptUrl: 'https://script.google.com/macros/s/AKfycbymASCa4MN7LMPoPa6fYwfeu2OCYfxKlLvoIBlauXhe_o7BDMF5DFgrrpBtUIrZAZi_/exec',
  
  // Admin password (change this!)
  adminPassword: 'icut2026',
  // Opening hours
  hours: {
    Monday: { open: '09:00', close: '19:00', closed: false },
    Tuesday: { open: '09:00', close: '19:00', closed: false },
    Wednesday: { open: '09:00', close: '19:00', closed: false },
    Thursday: { open: '09:00', close: '19:00', closed: false },
    Friday: { open: '09:00', close: '19:00', closed: false },
    Saturday: { open: '09:00', close: '19:00', closed: false },
    Sunday: { open: '10:00', close: '17:00', closed: false },
  },

  // Barbers
  barbers: [
    { id: 'tunc', name: 'Tunc', color: '#d4af37' },
    { id: 'manoc', name: 'Manoc', color: '#4caf50' },
  ],

  // Services
  services: [
  { id: 'hair-cut', name: 'Hair Cut', price: 21, duration: 25 },
  { id: 'skin-fade', name: 'Skin Fade', price: 24, duration: 25 },
  { id: 'childrens-hair', name: 'Childrens Hair', price: 16, duration: 25 },
  { id: 'children-skin-fade', name: 'Children Skin Fade', price: 18, duration: 25 },
  { id: 'shape-up', name: 'Shape Up', price: 16, duration: 25 },
  { id: 'beard-trim', name: 'Beard Trim', price: 16, duration: 25 },
  { id: 'hair-beard', name: 'Hair & Beard', price: 32, duration: 30 },
  { id: 'skin-fade-beard', name: 'Skin fade & Beard', price: 34, duration: 30 },
  { id: 'eekurt-special', name: 'EEkurtSpecial', price: 40, duration: 45 },
],
};

export default config;
