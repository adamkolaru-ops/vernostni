const admin = require('firebase-admin');

// Inicializace Firebase Admin
const serviceAccount = require('./functions/vernostkarty-db-firebase-adminsdk-service-account.json');

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  projectId: 'vernostkarty-db'
});

const db = admin.firestore();

async function testTrigger() {
  try {
    console.log('🧪 Spouštím test triggeru...');
    
    // Simulace změny v users kolekci, která spustí trigger
    const testDoc = db.collection('users').doc('test123456789012').collection('emails').doc('test@example.com');
    
    await testDoc.set({
      name: 'Test User UPDATED',
      phone: '987654321',
      points: '25',
      deviceLibraryIdentifier: 'test-device-123',
      pushToken: 'test-push-token-123',
      lastUpdated: admin.firestore.FieldValue.serverTimestamp()
    }, { merge: true });
    
    console.log('✅ Testovací změna provedena - trigger by se měl spustit');
    console.log('📋 Zkontroluj logy triggeru za 10-20 sekund');
    
  } catch (error) {
    console.error('❌ Chyba při testu:', error);
  }
  
  process.exit(0);
}

testTrigger();
