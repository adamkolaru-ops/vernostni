const admin = require('firebase-admin');

// Inicializace Firebase Admin SDK s explicitními credentials
if (!admin.apps.length) {
  admin.initializeApp({
    projectId: 'vernostkarty',
    credential: admin.credential.cert('./certificates/vernostkarty-firebase-adminsdk-2j135-d46f086885.json')
  });
}

// Firestore instance
const db = admin.firestore();

async function createCertificatesCollection() {
  console.log('🔧 Vytvářím Firestore kolekci "certificates" s original záznamem...');
  
  // Definice záznamu "original"
  const certificatesData = {
    rank: 1,
    key: 'original',
    cafeId: '1cf87e2e-e29a-4734-9e9a-ffa03fbd8029',
    p12Path: 'original/apple-wallet/certificates.p12',
    wwdrPath: 'original/apple-wallet/AppleWWDRCAG4.pem'
  };
  
  try {
    // Vytvoření dokumentu v Firestore
    const docRef = db.collection('certificates').doc('original');
    await docRef.set(certificatesData);
    
    console.log('✅ Dokument "original" úspěšně vytvořen v certificates kolekci');
    console.log('📋 Struktura dokumentu:', certificatesData);
    
    // Ověření - načteme dokument zpět
    console.log('\n🔍 Ověřuji vytvořený dokument...');
    const doc = await docRef.get();
    
    if (doc.exists) {
      console.log('✅ Dokument úspěšně ověřen:', doc.data());
    } else {
      console.log('❌ Chyba: Dokument se nepodařilo načíst zpět');
    }
    
    // Vytvoříme i testovací záznam pro prefix 000001
    console.log('\n🔧 Vytvářím testovací záznam "000001"...');
    const test001Data = {
      rank: 2,
      key: '000001',
      cafeId: '',  // Zatím prázdné
      p12Path: '000001/000001_certificates.p12',
      wwdrPath: '000001/000001_AppleWWDRCAG4.pem'
    };
    
    const test001Ref = db.collection('certificates').doc('000001');
    await test001Ref.set(test001Data);
    console.log('✅ Testovací záznam "000001" vytvořen:', test001Data);
    
  } catch (error) {
    console.error('❌ Chyba při vytváření certificates kolekce:', error);
  }
}

// Spustit vytvoření
createCertificatesCollection().catch(console.error);
