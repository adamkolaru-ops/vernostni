const admin = require('firebase-admin');

// Inicializace Firebase Admin
admin.initializeApp({
  credential: admin.credential.cert(require('./certificates/vernostkarty-firebase-adminsdk-2j135-d46f086885.json')),
  databaseURL: 'https://vernostkarty-default-rtdb.firebaseio.com/'
});

const db = admin.database();

async function addCertificatePaths() {
  try {
    console.log('🔧 Přidávám cesty k certifikátům do dat kavárny...');
    
    const cafeRef = db.ref('/cardzapier/81e91ab5-2396-4490-b48f-9db043f90397');
    
    await cafeRef.update({
      pempath: 'original/apple-wallet/passCert.pem',
      keypath: 'original/apple-wallet/privatekey.key'
    });
    
    console.log('✅ Certificate paths successfully added to cafe data:');
    console.log('  - pempath: original/apple-wallet/passCert.pem');
    console.log('  - keypath: original/apple-wallet/privatekey.key');
    
    // Ověření
    const snapshot = await cafeRef.once('value');
    const data = snapshot.val();
    console.log('🔍 Verification - pempath:', data.pempath);
    console.log('🔍 Verification - keypath:', data.keypath);
    
    process.exit(0);
  } catch (error) {
    console.error('❌ Error adding certificate paths:', error);
    process.exit(1);
  }
}

addCertificatePaths();
