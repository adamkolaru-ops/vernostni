const { Datastore } = require('@google-cloud/datastore');
const path = require('path');

// Inicializace Datastore s explicitními kredenciály
const datastore = new Datastore({
  projectId: 'vernostkarty-db',
  keyFilename: path.join(__dirname, 'vernostkarty-db/functions/certificates', 'vernostkarty-db-firebase-adminsdk-fbsvc-0585ca91cb.json')
});

async function checkAndCreateCertificates() {
  console.log('🔍 Kontrola a vytvoření základních záznamů v tabulce certificates...\n');
  
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
    
    // Základní záznamy, které potřebujeme
    const requiredRecords = [
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
      },
      {
        name: '000003',
        rank: 4,
        fullId: null,
        ...correctPaths
      },
      {
        name: '000004',
        rank: 5,
        fullId: null,
        ...correctPaths
      }
    ];
    
    console.log('🔧 Vytvářím/aktualizuji záznamy...\n');
    
    for (const record of requiredRecords) {
      try {
        // Pokus o načtení existujícího záznamu
        const key = datastore.key(['certificates', record.name]);
        const [existingRecord] = await datastore.get(key);
        
        if (existingRecord) {
          console.log(`📋 Záznam ${record.name} už existuje:`);
          console.log(`   - fullId: ${existingRecord.fullId || 'null (VOLNÝ)'}`);
          console.log(`   - pempath: ${existingRecord.pempath || 'CHYBÍ'}`);
          console.log(`   - keypath: ${existingRecord.keypath || 'CHYBÍ'}`);
          console.log(`   - passTypeIdentifier: ${existingRecord.passTypeIdentifier || 'CHYBÍ'}`);
          
          // Aktualizace pouze pokud chybí cesty
          const needsUpdate = 
            !existingRecord.pempath || 
            !existingRecord.keypath || 
            !existingRecord.passTypeIdentifier;
          
          if (needsUpdate) {
            const updatedRecord = {
              ...existingRecord,
              ...correctPaths
            };
            
            await datastore.save({
              key,
              data: updatedRecord
            });
            console.log(`   🔄 Aktualizováno s chybějícími cestami`);
          } else {
            console.log(`   ✅ Má už správné cesty`);
          }
        } else {
          // Vytvoření nového záznamu
          await datastore.save({
            key,
            data: record
          });
          console.log(`✅ Vytvořen nový záznam: ${record.name}`);
        }
        
      } catch (error) {
        console.error(`❌ Chyba při zpracování záznamu ${record.name}:`, error.message);
      }
      
      console.log(''); // Prázdný řádek pro přehlednost
    }
    
    console.log('🎉 Zpracování dokončeno!\n');
    
    // Jednoduchá kontrola - načtení konkrétních záznamů
    console.log('🔍 Finální kontrola vytvořených záznamů:');
    let availableCount = 0;
    
    for (const record of requiredRecords) {
      try {
        const key = datastore.key(['certificates', record.name]);
        const [cert] = await datastore.get(key);
        
        if (cert) {
          console.log(`\n📋 ${record.name}:`);
          console.log(`   - fullId: ${cert.fullId || 'null (VOLNÝ)'}`);
          console.log(`   - pempath: ${cert.pempath}`);
          console.log(`   - keypath: ${cert.keypath}`);
          console.log(`   - passTypeIdentifier: ${cert.passTypeIdentifier}`);
          
          if (cert.fullId === null || cert.fullId === undefined) {
            availableCount++;
          }
        }
      } catch (error) {
        console.error(`❌ Chyba při kontrole ${record.name}:`, error.message);
      }
    }
    
    console.log(`\n📊 Finální statistiky:`);
    console.log(`   - Zkontrolováno záznamů: ${requiredRecords.length}`);
    console.log(`   - Volných certifikátů: ${availableCount}`);
    console.log(`   - Systém je připraven: ${availableCount > 0 ? '✅ ANO' : '❌ NE'}`);
    
    if (availableCount > 0) {
      console.log(`\n🚀 Můžete nyní testovat tlačítko "Vygenerovat účet" v WIX.txt!`);
    }
    
  } catch (error) {
    console.error('❌ Celková chyba:', error);
  }
}

// Spuštění
checkAndCreateCertificates();
