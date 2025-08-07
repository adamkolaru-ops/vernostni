const { Datastore } = require('@google-cloud/datastore');

// Inicializace Datastore
const datastore = new Datastore({ projectId: 'vernostkarty-db' });

async function testAssignCertificateSystem() {
  console.log('🔍 Kompletní test systému assignCertificate...\n');
  
  try {
    // 1. Kontrola tabulky certificates
    console.log('📋 1. Kontrola tabulky certificates:');
    const query = datastore.createQuery('certificates').order('name');
    const [certificates] = await datastore.runQuery(query);
    
    console.log(`   Nalezeno ${certificates.length} záznamů`);
    
    let availableCount = 0;
    let hasCorrectPaths = false;
    
    certificates.forEach((cert, index) => {
      console.log(`\n   🔐 Záznam ${index + 1}: ${cert.name}`);
      console.log(`      - fullId: ${cert.fullId || 'null (VOLNÝ)'}`);
      console.log(`      - passTypeIdentifier: ${cert.passTypeIdentifier || 'CHYBÍ'}`);
      console.log(`      - keypath: ${cert.keypath || 'CHYBÍ'}`);
      console.log(`      - pempath: ${cert.pempath || 'CHYBÍ'}`);
      
      if (cert.fullId === null || cert.fullId === undefined) {
        availableCount++;
      }
      
      // Kontrola správných cest
      if (cert.pempath && cert.pempath.includes('original/apple-wallet/passCert.pem')) {
        hasCorrectPaths = true;
      }
    });
    
    console.log(`\n   📊 Statistiky:`);
    console.log(`      - Volných certifikátů: ${availableCount}`);
    console.log(`      - Správné cesty k certifikátům: ${hasCorrectPaths ? '✅ ANO' : '❌ NE'}`);
    
    if (availableCount === 0) {
      console.log(`\n   ⚠️  VAROVÁNÍ: Žádné volné certifikáty!`);
      return;
    }
    
    if (!hasCorrectPaths) {
      console.log(`\n   ⚠️  VAROVÁNÍ: Certifikáty nemají správné cesty!`);
      console.log(`      Očekávané cesty: original/apple-wallet/passCert.pem, original/apple-wallet/privatekey.key`);
    }
    
    // 2. Test volání assignCertificate API
    console.log(`\n🌐 2. Test volání assignCertificate API:`);
    
    // Vygenerujeme testovací UUID
    const testUUID = generateTestUUID();
    console.log(`   Používám testovací fullId: ${testUUID}`);
    
    try {
      const response = await fetch('https://us-central1-vernostkarty-db.cloudfunctions.net/assignCertificate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ fullId: testUUID })
      });
      
      console.log(`   Status odpovědi: ${response.status}`);
      
      if (response.ok) {
        const result = await response.json();
        console.log(`   ✅ Úspěšná odpověď:`, result);
        
        // 3. Ověření v Firebase
        console.log(`\n🔥 3. Ověření zápisu do Firebase:`);
        // Toto by vyžadovalo Firebase Admin inicializaci, takže jen logujeme
        console.log(`   Měl by být vytvořen/aktualizován dokument: cardzapier/${testUUID}`);
        console.log(`   S hodnotami: keypath, pempath, passTypeIdentifier`);
        
      } else {
        const errorText = await response.text();
        console.log(`   ❌ Chyba API: ${response.status} - ${errorText}`);
      }
      
    } catch (error) {
      console.log(`   ❌ Chyba při volání API: ${error.message}`);
    }
    
  } catch (error) {
    console.error('❌ Chyba při testu:', error);
  }
}

function generateTestUUID() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    const r = Math.random() * 16 | 0;
    const v = c == 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}

// Spuštění testu
testAssignCertificateSystem();
