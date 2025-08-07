const { Datastore } = require('@google-cloud/datastore');

// Inicializace Datastore
const datastore = new Datastore({
  projectId: 'vernostkarty',
  keyFilename: './certificates/vernostkarty-firebase-adminsdk-2j135-d46f086885.json'
});

async function addCertPathsToDatastore() {
  console.log('🔥 Přidávám cesty k certifikátům do Datastore...');
  
  try {
    // CafeId pro original certifikáty
    const cafeId = '1cf87e2e-e29a-4734-9e9a-ffa03fbd8029';
    
    // Cesty k original certifikátům
    const certPaths = {
      p12Path: 'original/apple-wallet/certificates.p12',
      wwdrPath: 'original/apple-wallet/AppleWWDRCAG4.pem',
      updatedAt: new Date().toISOString(),
      certificateType: 'original'
    };
    
    console.log(`📝 Přidávám cesty pro cafeId: ${cafeId}`);
    console.log('📋 Cesty k certifikátům:', JSON.stringify(certPaths, null, 2));
    
    // Vytvoření klíče pro Datastore
    const key = datastore.key(['cardzapier', cafeId]);
    
    // Načtení existujících dat (pokud existují)
    let existingData = {};
    try {
      const [entity] = await datastore.get(key);
      if (entity) {
        existingData = entity;
        console.log('📄 Nalezena existující data:', JSON.stringify(existingData, null, 2));
      }
    } catch (err) {
      console.log('📄 Žádná existující data nenalezena, vytvářím nový záznam');
    }
    
    // Sloučení s existujícími daty
    const mergedData = { ...existingData, ...certPaths };
    
    // Uložení do Datastore
    const entity = {
      key: key,
      data: mergedData
    };
    
    await datastore.save(entity);
    
    console.log('✅ Cesty k certifikátům úspěšně přidány do Datastore!');
    
    // Ověření zápisu
    const [savedEntity] = await datastore.get(key);
    if (savedEntity) {
      console.log('🔍 Ověření - uložená data:', JSON.stringify(savedEntity, null, 2));
    } else {
      console.log('❌ Záznam nebyl správně vytvořen');
    }
    
  } catch (error) {
    console.error('❌ Chyba při přidávání cest k certifikátům:', error);
  } finally {
    process.exit(0);
  }
}

addCertPathsToDatastore();
