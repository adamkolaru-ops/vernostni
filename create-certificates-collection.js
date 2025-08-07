const { Datastore } = require('@google-cloud/datastore');

// Inicializace Datastore s credentials z vernostkarty projektu
const datastore = new Datastore({
  projectId: 'vernostkarty',
  keyFilename: './vernostkarty/functions/certificates/vernostkarty-firebase-adminsdk-2j135-d46f086885.json'
});

async function createCertificatesCollection() {
  try {
    console.log('🔐 Vytvářím kolekci "certificates" v Datastore...\n');
    
    // Definice struktury podle vašich požadavků:
    // 1. rank - pořadí
    // 2. key - identifikátor (000001, original, 000002, atd.)
    // 3. cafeId - ID kavárny
    // 4. p12Path - cesta k .p12 certifikátu v Cloud Storage
    // 5. wwdrPath - cesta k AppleWWDRCAG4.pem (obecný Apple klíč)
    
    const certificatesData = [
      {
        rank: 1,
        key: 'original',
        cafeId: '1cf87e2e-e29a-4734-9e9a-ffa03fbd8029',
        p12Path: null, // original nemá .p12 soubor
        wwdrPath: 'original/apple-wallet/AppleWWDRCAG4.pem'
      },
      {
        rank: 2,
        key: '000001',
        cafeId: null, // zatím nepřiřazeno
        p12Path: '000001/0000001_Certifikáty.p12',
        wwdrPath: 'original/apple-wallet/AppleWWDRCAG4.pem'
      }
    ];
    
    console.log('📋 Vytvářím záznamy:');
    
    for (const certData of certificatesData) {
      // Vytvoření klíče pro Datastore
      const certKey = datastore.key(['certificates', certData.key]);
      
      // Příprava entity
      const entity = {
        key: certKey,
        data: {
          rank: certData.rank,
          key: certData.key,
          cafeId: certData.cafeId,
          p12Path: certData.p12Path,
          wwdrPath: certData.wwdrPath,
          created: new Date(),
          updated: new Date()
        }
      };
      
      console.log(`📤 Vytvářím záznam: ${certData.key}`);
      console.log(`   🔢 Rank: ${certData.rank}`);
      console.log(`   🔑 Key: ${certData.key}`);
      console.log(`   ☕ CafeId: ${certData.cafeId || 'null'}`);
      console.log(`   📄 P12 Path: ${certData.p12Path || 'null'}`);
      console.log(`   🍎 WWDR Path: ${certData.wwdrPath}`);
      
      try {
        await datastore.save(entity);
        console.log(`✅ Záznam "${certData.key}" vytvořen úspěšně\n`);
      } catch (error) {
        console.error(`❌ Chyba při vytváření záznamu "${certData.key}":`, error.message);
      }
    }
    
    console.log('🎉 Kolekce "certificates" vytvořena!');
    
    // Ověření - načtení všech záznamů
    console.log('\n🔍 Ověření - načítání všech záznamů z kolekce "certificates":');
    console.log('=' .repeat(70));
    
    const query = datastore.createQuery('certificates').order('rank');
    const [certificates] = await datastore.runQuery(query);
    
    if (certificates.length > 0) {
      console.log(`✅ Nalezeno ${certificates.length} záznamů:`);
      
      certificates.forEach((cert, index) => {
        console.log(`\n📋 Záznam ${index + 1}:`);
        console.log(`   🔢 Rank: ${cert.rank}`);
        console.log(`   🔑 Key: ${cert.key}`);
        console.log(`   ☕ CafeId: ${cert.cafeId || 'null'}`);
        console.log(`   📄 P12 Path: ${cert.p12Path || 'null'}`);
        console.log(`   🍎 WWDR Path: ${cert.wwdrPath}`);
        console.log(`   📅 Created: ${cert.created}`);
      });
    } else {
      console.log('⚠️  Žádné záznamy nenalezeny!');
    }
    
  } catch (error) {
    console.error('❌ Chyba při vytváření kolekce certificates:', error);
    process.exit(1);
  }
}

// Spuštění vytvoření kolekce
createCertificatesCollection();
