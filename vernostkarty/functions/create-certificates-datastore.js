const { Datastore } = require('@google-cloud/datastore');
const { Storage } = require('@google-cloud/storage');

// Inicializace Datastore pro vernostkarty projekt (default namespace)
const datastore = new Datastore({
  projectId: 'vernostkarty',
  keyFilename: './certificates/vernostkarty-firebase-adminsdk-2j135-d46f086885.json'
});

// Inicializace Cloud Storage pro ověření existence souborů
const storage = new Storage({
  projectId: 'vernostkarty',
  keyFilename: './certificates/vernostkarty-firebase-adminsdk-2j135-d46f086885.json'
});
const bucketName = 'vernostni-certificates';

async function createCertificatesKind() {
  console.log('🔧 Vytvářím Datastore kind "certificates" s original záznamem...');
  
  // Definice záznamu "original" s kompletní strukturou
  const certificatesData = {
    rank: 1,
    key: 'original',
    cafeId: '1cf87e2e-e29a-4734-9e9a-ffa03fbd8029',
    p12Path: 'original/apple-wallet/certificates.p12',
    wwdrPath: 'original/apple-wallet/AppleWWDRCAG4.pem',
    pemCertPath: 'original/apple-wallet/passCert.pem',
    pemKeyPath: 'original/apple-wallet/privatekey.key'
  };
  
  try {
    // 🔍 Ověření existence všech certifikátů v Cloud Storage
    console.log('🔍 Ověřuji existenci certifikátů v Cloud Storage...');
    const bucket = storage.bucket(bucketName);
    
    const filesToCheck = [
      certificatesData.p12Path,
      certificatesData.wwdrPath,
      certificatesData.pemCertPath,
      certificatesData.pemKeyPath
    ];
    
    const existingFiles = [];
    const missingFiles = [];
    
    for (const filePath of filesToCheck) {
      try {
        const file = bucket.file(filePath);
        const [exists] = await file.exists();
        if (exists) {
          console.log(`✅ Nalezen: ${filePath}`);
          existingFiles.push(filePath);
        } else {
          console.log(`❌ Chybí: ${filePath}`);
          missingFiles.push(filePath);
        }
      } catch (error) {
        console.log(`❌ Chyba při kontrole ${filePath}: ${error.message}`);
        missingFiles.push(filePath);
      }
    }
    
    console.log(`
📋 Shrnutí:`);
    console.log(`✅ Existující soubory: ${existingFiles.length}`);
    console.log(`❌ Chybějící soubory: ${missingFiles.length}`);
    
    if (missingFiles.length > 0) {
      console.log(`⚠️  VAROVÁNÍ: Některé certifikáty chybí v Cloud Storage!`);
      console.log(`Chybějící: ${missingFiles.join(', ')}`);
    }
    
    // Vytvoření entity s key "original"
    const taskKey = datastore.key(['certificates', 'original']);
    
    const entity = {
      key: taskKey,
      data: certificatesData
    };
    
    // Uložení do Datastore
    await datastore.save(entity);
    
    console.log('✅ Záznam "original" úspěšně vytvořen v certificates kind');
    console.log('📋 Struktura záznamu:');
    console.log('   - Kind: certificates');
    console.log('   - Key: original');
    console.log('   - Data:', certificatesData);
    
    // Ověření - načteme záznam zpět
    console.log('\n🔍 Ověřuji vytvořený záznam...');
    const [entity_check] = await datastore.get(taskKey);
    
    if (entity_check) {
      console.log('✅ Záznam úspěšně ověřen:', entity_check);
    } else {
      console.log('❌ Chyba: Záznam se nepodařilo načíst zpět');
    }
    
  } catch (error) {
    console.error('❌ Chyba při vytváření certificates kind:', error);
  }
}

// Spustit vytvoření
createCertificatesKind().catch(console.error);
