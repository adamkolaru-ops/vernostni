const { Datastore } = require('@google-cloud/datastore');

// Inicializace Datastore pro vernostkarty projekt (default namespace)
const datastore = new Datastore({
  projectId: 'vernostkarty'
  // Používáme default credentials a default namespace
});

async function createCertificatesKind() {
  console.log('🔧 Vytvářím Datastore kind "certificates" s original záznamem...');
  
  // Definice záznamu "original"
  const certificatesData = {
    rank: 1,
    key: 'original',
    cafeId: '1cf87e2e-e29a-4734-9e9a-ffa03fbd8029',
    p12Path: 'original/apple-wallet/certificates.p12',
    wwdrPath: 'original/apple-wallet/AppleWWDRCAG4.pem'
  };
  
  try {
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
