const { Datastore } = require('@google-cloud/datastore');

// Inicializace Datastore
const datastore = new Datastore({
  projectId: 'vernostkarty',
  keyFilename: './certificates/vernostkarty-firebase-adminsdk-2j135-d46f086885.json'
});

async function addOriginalCertPathsToFirebase() {
  console.log('🔥 Adding original certificate paths to Datastore...');
  
  try {
    // CafeId pro original certifikáty
    const cafeId = '1cf87e2e-e29a-4734-9e9a-ffa03fbd8029';
    
    // Cesty k original certifikátům (z našeho systému)
    const certPaths = {
      p12Path: 'original/apple-wallet/certificates.p12',
      wwdrPath: 'original/apple-wallet/AppleWWDRCAG4.pem',
      updatedAt: new Date().toISOString(),
      certificateType: 'original'
    };
    
    console.log(`📝 Adding certificate paths for cafeId: ${cafeId}`);
    console.log('📋 Certificate paths:', JSON.stringify(certPaths, null, 2));
    
    // Vytvoření klíče pro Datastore
    const key = datastore.key(['cardzapier', cafeId]);
    
    // Nejprve zkusíme načíst existující entitu
    let existingData = {};
    try {
      const [entity] = await datastore.get(key);
      if (entity) {
        existingData = entity;
        console.log('📄 Found existing data:', JSON.stringify(existingData, null, 2));
      }
    } catch (err) {
      console.log('📄 No existing data found, creating new entity');
    }
    
    // Sloučení s existujícími daty
    const mergedData = { ...existingData, ...certPaths };
    
    // Uložení do Datastore
    const entity = {
      key: key,
      data: mergedData
    };
    
    await datastore.save(entity);
    
    console.log('✅ Certificate paths successfully added to Datastore!');
    
    // Ověření zápisu
    const [savedEntity] = await datastore.get(key);
    if (savedEntity) {
      console.log('🔍 Verification - Saved data:', JSON.stringify(savedEntity, null, 2));
    } else {
      console.log('❌ Entity was not created properly');
    }
    
  } catch (error) {
    console.error('❌ Error adding certificate paths to Datastore:', error);
  } finally {
    process.exit(0);
  }
}

// Spuštění funkce
addOriginalCertPathsToFirebase();
