const { Datastore } = require('@google-cloud/datastore');
const path = require('path');

// Inicializace Datastore s explicitními kredenciály
const datastore = new Datastore({
  projectId: 'vernostkarty-db',
  keyFilename: path.join(__dirname, 'vernostkarty-db/functions/certificates', 'vernostkarty-db-firebase-adminsdk-fbsvc-0585ca91cb.json')
});

async function updateCertificatesPaths() {
  console.log('🔧 Aktualizace cest v tabulce certificates...\n');
  
  try {
    // Definice správných cest podle systému
    const correctPaths = {
      pempath: 'original/apple-wallet/passCert.pem',
      keypath: 'original/apple-wallet/privatekey.key',
      passTypeIdentifier: 'pass.vernostni.cz.vernostnikarty'
    };
    
    console.log('📝 Správné cesty:');
    console.log(`   pempath: ${correctPaths.pempath}`);
    console.log(`   keypath: ${correctPaths.keypath}`);
    console.log(`   passTypeIdentifier: ${correctPaths.passTypeIdentifier}\n`);
    
    // Načtení všech záznamů z tabulky certificates
    const query = datastore.createQuery('certificates').order('name');
    const [certificates] = await datastore.runQuery(query);
    
    console.log(`📋 Nalezeno ${certificates.length} záznamů v tabulce certificates\n`);
    
    if (certificates.length === 0) {
      console.log('⚠️  Tabulka certificates je prázdná. Vytvářím základní záznamy...\n');
      
      // Vytvoření základních záznamů
      const basicRecords = [
        {
          name: 'original',
          rank: 1,
          fullId: null,
          ...correctPaths
        },
        {
          name: '000001',
          rank: 2,
          fullId: null,
          ...correctPaths
        },
        {
          name: '000002',
          rank: 3,
          fullId: null,
          ...correctPaths
        }
      ];
      
      for (const record of basicRecords) {
        const key = datastore.key(['certificates', record.name]);
        await datastore.save({
          key,
          data: record
        });
        console.log(`✅ Vytvořen záznam: ${record.name}`);
      }
      
    } else {
      // Aktualizace existujících záznamů
      for (const cert of certificates) {
        const needsUpdate = 
          cert.pempath !== correctPaths.pempath ||
          cert.keypath !== correctPaths.keypath ||
          !cert.passTypeIdentifier;
        
        if (needsUpdate) {
          console.log(`🔄 Aktualizuji záznam: ${cert.name || cert[datastore.KEY].name}`);
          
          const key = cert[datastore.KEY];
          const updatedCert = {
            ...cert,
            ...correctPaths
          };
          
          await datastore.save({
            key,
            data: updatedCert
          });
          
          console.log(`   ✅ Aktualizováno`);
        } else {
          console.log(`✅ Záznam ${cert.name || cert[datastore.KEY].name} už má správné cesty`);
        }
      }
    }
    
    console.log('\n🎉 Aktualizace dokončena!');
    
    // Ověření - načtení aktualizovaných záznamů
    console.log('\n🔍 Ověření aktualizovaných záznamů:');
    const [updatedCertificates] = await datastore.runQuery(query);
    
    let availableCount = 0;
    updatedCertificates.forEach((cert, index) => {
      console.log(`\n📋 Záznam ${index + 1}: ${cert.name}`);
      console.log(`   - fullId: ${cert.fullId || 'null (VOLNÝ)'}`);
      console.log(`   - pempath: ${cert.pempath}`);
      console.log(`   - keypath: ${cert.keypath}`);
      console.log(`   - passTypeIdentifier: ${cert.passTypeIdentifier}`);
      
      if (cert.fullId === null || cert.fullId === undefined) {
        availableCount++;
      }
    });
    
    console.log(`\n📊 Finální statistiky:`);
    console.log(`   - Celkem záznamů: ${updatedCertificates.length}`);
    console.log(`   - Volných certifikátů: ${availableCount}`);
    console.log(`   - Systém je připraven pro přiřazování certifikátů: ${availableCount > 0 ? '✅ ANO' : '❌ NE'}`);
    
  } catch (error) {
    console.error('❌ Chyba při aktualizaci:', error);
  }
}

// Spuštění aktualizace
updateCertificatesPaths();
