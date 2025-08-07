const { Datastore } = require('@google-cloud/datastore');
const admin = require('firebase-admin');
const path = require('path');
const fs = require('fs');

// Inicializace Datastore s service account
const datastore = new Datastore({
  projectId: 'vernostkarty-db',
  keyFilename: path.join(__dirname, 'vernostkarty-db/functions/certificates', 'vernostkarty-db-firebase-adminsdk-fbsvc-0585ca91cb.json')
});

// Inicializace Firebase Admin (pokud ještě není inicializován)
if (!admin.apps.length) {
  const serviceAccount = require('./vernostkarty-db/functions/certificates/vernostkarty-db-firebase-adminsdk-fbsvc-0585ca91cb.json');
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    projectId: 'vernostkarty-db'
  });
}

const db = admin.firestore();

async function testCertificates() {
  console.log('🔍 Kontrola tabulky certificates v Datastore...');
  
  // Načtení všech záznamů z tabulky certificates
  const query = datastore.createQuery('certificates').order('name');
  const [certificates] = await datastore.runQuery(query);
  
  console.log(`📋 Nalezeno ${certificates.length} záznamů`);
  
  // Kontrola každého záznamu
  let allHavePassTypeIdentifier = true;
  let countWithPassTypeIdentifier = 0;
  
  for (const cert of certificates) {
    console.log(`\n🔐 Certifikát: ${cert.name || cert.key}`);
    console.log(`  - fullId: ${cert.fullId || 'null'}`);
    console.log(`  - passTypeIdentifier: ${cert.passTypeIdentifier || 'CHYBÍ!'}`);
    
    if (!cert.passTypeIdentifier) {
      allHavePassTypeIdentifier = false;
    } else {
      countWithPassTypeIdentifier++;
    }
  }
  
  console.log('\n🧪 VÝSLEDEK KONTROLY:');
  console.log(`  - Celkem záznamů: ${certificates.length}`);
  console.log(`  - Záznamů s passTypeIdentifier: ${countWithPassTypeIdentifier}`);
  console.log(`  - Všechny záznamy mají passTypeIdentifier: ${allHavePassTypeIdentifier ? '✅ ANO' : '❌ NE'}`);
  
  // Kontrola fungování Cloud Function endpoint (zda je nasazena)
  console.log('\n🌐 Kontrola dostupnosti Cloud Function endpoint...');
  try {
    // Vytvořím test UUID, který neexistuje (nepoužívám UUID funkci, abych zajistil, že tohle ID nebude nikde existovat)
    const testUUID = '00000000-0000-0000-0000-000000000001';
    
    // Tento test pouze ověřuje, že endpoint je dostupný a vrací validní odpověď, ne že přiřadí certifikát
    const url = `https://us-central1-vernostkarty-db.cloudfunctions.net/assignCertificate`;
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ fullId: testUUID })
    });
    
    if (response.status === 200 || response.status === 404) {
      // 200 = úspěch, 404 = žádný volný certifikát (což je očekávaná odpověď při korektně fungující funkci)
      console.log(`✅ Cloud Function endpoint je dostupný! Status: ${response.status}`);
      const result = await response.json();
      console.log(`📝 Odpověď:`, result);
    } else {
      console.log(`❌ Cloud Function endpoint vrátil neočekávaný status: ${response.status}`);
      console.log(`📝 Odpověď:`, await response.text());
    }
  } catch (error) {
    console.error(`❌ Chyba při volání Cloud Function endpoint:`, error.message);
  }
  
  // Kontrola integrace s WIX.txt (pouze vypsání relevantních částí)
  console.log('\n🖥️ Kontrola integrace s WIX.txt...');
  try {
    const wixContent = fs.readFileSync('./WIX.txt', 'utf8');
    
    // Kontrola přítomnosti tlačítka a funkce
    const hasButton = wixContent.includes('id="generateAccountBtn"');
    const hasAssignFunction = wixContent.includes('assignCertificateToAccount');
    const hasFunctionCall = wixContent.includes('fetch(\'https://us-central1-vernostkarty-db.cloudfunctions.net/assignCertificate\'');
    
    console.log(`  - Tlačítko pro generování účtu: ${hasButton ? '✅ ANO' : '❌ NE'}`);
    console.log(`  - Funkce assignCertificateToAccount: ${hasAssignFunction ? '✅ ANO' : '❌ NE'}`);
    console.log(`  - Volání Cloud Function: ${hasFunctionCall ? '✅ ANO' : '❌ NE'}`);
  } catch (error) {
    console.error(`❌ Chyba při kontrole WIX.txt:`, error.message);
  }
  
  console.log('\n🏁 Test dokončen!');
}

// Spuštění testu
testCertificates().catch(err => {
  console.error('❌ Chyba při testu:', err);
  process.exit(1);
});
