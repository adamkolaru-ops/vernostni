// Skript pro prozkoumání databáze a nalezení existujících cafeId
const admin = require('firebase-admin');

// Inicializace Firebase Admin
admin.initializeApp({
  credential: admin.credential.cert(require("./vernostkarty-db/functions/certificates/vernostkarty-db-firebase-adminsdk-fbsvc-0585ca91cb.json")),
  databaseURL: "https://vernostkarty-db-default-rtdb.europe-west1.firebasedatabase.app"
});

const db = admin.firestore();

async function inspectDatabase() {
  try {
    console.log('🔍 Prozkoumávám kolekci cardzapier...');
    
    const snapshot = await db.collection('cardzapier').limit(5).get();
    
    if (snapshot.empty) {
      console.log('❌ Kolekce cardzapier je prázdná nebo neexistuje');
      return;
    }
    
    console.log(`✅ Nalezeno ${snapshot.size} záznamů v kolekci cardzapier:`);
    console.log('');
    
    snapshot.forEach(doc => {
      const data = doc.data();
      const docId = doc.id;
      const last12 = docId.slice(-12);
      
      console.log(`📄 Document ID: ${docId}`);
      console.log(`   Posledních 12 znaků: ${last12}`);
      console.log(`   Business Name: ${data.businessName || 'N/A'}`);
      console.log(`   pempath: ${data.pempath || 'N/A'}`);
      console.log(`   keypath: ${data.keypath || 'N/A'}`);
      console.log(`   p12Path: ${data.p12Path || 'N/A'}`);
      console.log(`   wwdrPath: ${data.wwdrPath || 'N/A'}`);
      console.log('');
    });
    
    // Použijeme první nalezený záznam pro test
    const firstDoc = snapshot.docs[0];
    const testCafeId = firstDoc.id.slice(-12);
    
    console.log(`🧪 Doporučený testovací cafeId: ${testCafeId}`);
    console.log(`   (z dokumentu: ${firstDoc.id})`);
    
  } catch (error) {
    console.error('❌ Chyba při prozkoumávání databáze:', error);
  } finally {
    process.exit(0);
  }
}

inspectDatabase();
