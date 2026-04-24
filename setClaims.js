const admin = require('firebase-admin');
const serviceAccount = require('./serviceAccountKey.json');

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

async function setClaims() {
  await admin.auth().setCustomUserClaims('CsktIKNC0wRaP2eK8DECVMWPD0m1', {
    tenantId: 'whitecross'
  });
  
  await admin.auth().setCustomUserClaims('L6wsBgQmBYXIVBt3RYHS2LATsxH2', {
    tenantId: 'eekurt'
  });
  
  console.log('Claims set successfully!');
  process.exit(0);
}

setClaims().catch(console.error);