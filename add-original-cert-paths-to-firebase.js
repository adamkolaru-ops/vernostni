const admin = require('firebase-admin');

// Inicializace Firebase Admin SDK
const serviceAccount = require('./certificates-rotate/vernostkarty-firebase-adminsdk-2j135-d46f086885.json');

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  databaseURL: "https://vernostkarty.firebaseio.com"
});

const db = admin.firestore();

async function addOriginalCertPathsToFirebase() {
  console.log('🔥 Adding original certificate paths to Firebase...');
  
  try {
    // CafeId pro original certifikáty
    const cafeId = '1cf87e2e-e29a-4734-9e9a-ffa03fbd8029';
    
    // Cesty k original certifikátům (z našeho systému)
    const certPaths = {
      p12Path: 'original/apple-wallet/certificates.p12',
      wwdrPath: 'original/apple-wallet/AppleWWDRCAG4.pem',
      updatedAt: new Date().toISOString(),
      certificateType: 'original'
    };
    
    console.log(`📝 Adding certificate paths for cafeId: ${cafeId}`);
    console.log('📋 Certificate paths:', JSON.stringify(certPaths, null, 2));
    
    // Uložení do Firestore pod cardzapier/{cafeId}
    const docRef = db.collection('cardzapier').doc(cafeId);
    
    // Aktualizace dokumentu (merge: true zachová existující data)
    await docRef.set(certPaths, { merge: true });
    
    console.log('✅ Certificate paths successfully added to Firebase!');
    
    // Ověření zápisu
    const doc = await docRef.get();
    if (doc.exists) {
      console.log('🔍 Verification - Document data:', JSON.stringify(doc.data(), null, 2));
    } else {
      console.log('❌ Document was not created properly');
    }
    
  } catch (error) {
    console.error('❌ Error adding certificate paths to Firebase:', error);
  } finally {
    process.exit(0);
  }
}

// Spuštění funkce
addOriginalCertPathsToFirebase();
