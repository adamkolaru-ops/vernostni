const { Datastore } = require('@google-cloud/datastore');

// Inicializace Datastore
const datastore = new Datastore({
  projectId: 'vernostkarty',
  keyFilename: './vernostkarty/functions/certificates/vernostkarty-firebase-adminsdk-2j135-d46f086885.json'
});

async function updateOriginalP12Path() {
  console.log('🔄 AKTUALIZACE DATASTORE ZÁZNAMU PRO ORIGINAL');
  console.log('=' .repeat(60));
  
  try {
    // Načtení současného záznamu "original"
    console.log('📋 Načítám současný záznam "original"...');
    const originalKey = datastore.key(['certificates', 'original']);
    const [originalEntity] = await datastore.get(originalKey);
    
    if (!originalEntity) {
      console.error('❌ Záznam "original" nenalezen!');
      process.exit(1);
    }
    
    console.log('✅ Současný záznam "original" nalezen:');
    console.log(`   🔢 Rank: ${originalEntity.rank}`);
    console.log(`   🔑 Key: ${originalEntity.key}`);
    console.log(`   ☕ CafeId: ${originalEntity.cafeId}`);
    console.log(`   📄 P12 Path: ${originalEntity.p12Path || 'null'}`);
    console.log(`   🍎 WWDR Path: ${originalEntity.wwdrPath}`);
    
    // Aktualizace p12Path
    console.log('\n🔧 Aktualizuji p12Path...');
    const updatedEntity = {
      key: originalKey,
      data: {
        ...originalEntity,
        p12Path: 'original/apple-wallet/certificates.p12',
        updated: new Date()
      }
    };
    
    await datastore.save(updatedEntity);
    console.log('✅ Záznam "original" aktualizován');
    
    // Ověření aktualizace
    console.log('\n🔍 Ověření aktualizace...');
    const [updatedRecord] = await datastore.get(originalKey);
    
    console.log('📋 Aktualizovaný záznam "original":');
    console.log(`   🔢 Rank: ${updatedRecord.rank}`);
    console.log(`   🔑 Key: ${updatedRecord.key}`);
    console.log(`   ☕ CafeId: ${updatedRecord.cafeId}`);
    console.log(`   📄 P12 Path: ${updatedRecord.p12Path}`);
    console.log(`   🍎 WWDR Path: ${updatedRecord.wwdrPath}`);
    console.log(`   📅 Updated: ${updatedRecord.updated}`);
    
    // Ověření všech záznamů v kolekci
    console.log('\n📊 Přehled všech záznamů v kolekci certificates:');
    console.log('-' .repeat(60));
    
    const query = datastore.createQuery('certificates').order('rank');
    const [allCertificates] = await datastore.runQuery(query);
    
    allCertificates.forEach((cert, index) => {
      console.log(`\n📋 Záznam ${index + 1}:`);
      console.log(`   🔢 Rank: ${cert.rank}`);
      console.log(`   🔑 Key: ${cert.key}`);
      console.log(`   ☕ CafeId: ${cert.cafeId || 'null'}`);
      console.log(`   📄 P12 Path: ${cert.p12Path || 'null'}`);
      console.log(`   🍎 WWDR Path: ${cert.wwdrPath}`);
    });
    
    console.log('\n🎉 ÚSPĚCH! Datastore záznam pro "original" byl aktualizován');
    console.log('✅ Nyní oba záznamy ("original" i "000001") mají správné p12Path');
    
  } catch (error) {
    console.error('❌ Chyba při aktualizaci Datastore záznamu:', error);
    process.exit(1);
  }
}

// Spuštění aktualizace
updateOriginalP12Path();
