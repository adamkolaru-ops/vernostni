const admin = require('firebase-admin');

// Inicializace Firebase Admin SDK
const serviceAccount = require('./vernostkarty/functions/certificates/vernostkarty-firebase-adminsdk-2j135-d46f086885.json');

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  databaseURL: 'https://vernostkarty-default-rtdb.firebaseio.com/'
});

const db = admin.firestore();

async function addCertificatePathsToFirebase() {
  console.log('📋 PŘIDÁVÁNÍ CERTIFICATE PATHS DO FIREBASE');
  console.log('=' .repeat(60));
  
  try {
    const cafeId = '1cf87e2e-e29a-4734-9e9a-ffa03fbd8029';
    
    // Cesty k certifikátům pro original
    const certificatePaths = {
      p12Path: 'original/apple-wallet/certificates.p12',
      wwdrPath: 'original/apple-wallet/AppleWWDRCAG4.pem',
      passTypeIdentifier: 'pass.pass.com.example.vernostkarty2',
      updated: admin.firestore.FieldValue.serverTimestamp()
    };
    
    console.log(`🔧 Přidávám certificate paths pro cafeId: ${cafeId}`);
    console.log(`📄 P12 Path: ${certificatePaths.p12Path}`);
    console.log(`🍎 WWDR Path: ${certificatePaths.wwdrPath}`);
    console.log(`🎫 Pass Type ID: ${certificatePaths.passTypeIdentifier}`);
    
    // Přidání do Firebase kolekce cardzapier
    const docRef = db.collection('cardzapier').doc(cafeId);
    
    // Nejprve zkontrolujeme, jestli dokument existuje
    const docSnap = await docRef.get();
    
    if (docSnap.exists()) {
      console.log('✅ Dokument již existuje, aktualizuji...');
      await docRef.update(certificatePaths);
      console.log('✅ Certificate paths byly přidány k existujícímu dokumentu');
    } else {
      console.log('📝 Dokument neexistuje, vytvářím nový...');
      await docRef.set(certificatePaths);
      console.log('✅ Nový dokument s certificate paths byl vytvořen');
    }
    
    // Ověření
    console.log('\n🔍 Ověření - načítání dokumentu...');
    const updatedDoc = await docRef.get();
    const data = updatedDoc.data();
    
    console.log('📋 Obsah dokumentu:');
    console.log(`   📄 P12 Path: ${data.p12Path}`);
    console.log(`   🍎 WWDR Path: ${data.wwdrPath}`);
    console.log(`   🎫 Pass Type ID: ${data.passTypeIdentifier}`);
    console.log(`   📅 Updated: ${data.updated ? data.updated.toDate() : 'N/A'}`);
    
    console.log('\n🎉 ÚSPĚCH! Certificate paths byly přidány do Firebase');
    
  } catch (error) {
    console.error('❌ Chyba při přidávání certificate paths:', error);
    process.exit(1);
  } finally {
    // Ukončení Firebase připojení
    admin.app().delete();
  }
}

// Spuštění
addCertificatePathsToFirebase();
